import { newId } from '@core/ids';
import type { WebDb } from '../db/sqlite';

// 사진. 기록에서 사진이 빠지면 식단도 운동도 '적었다'는 사실만 남는다.
//
// 세 가지를 지킨다.
// 1. 원본을 그대로 두지 않는다 — 12MP 한 장이 5MB다. 긴 변 1600px, JPEG 품질 0.8로 줄여 200KB대로 만든다.
// 2. WebP를 요청하지 않는다 — iOS 캔버스는 WebP를 못 만들면서 오류도 내지 않고 조용히 PNG를 뱉는다.
//    (PNG로 저장되면 사진 한 장이 2MB가 된다.) 그래서 항상 image/jpeg으로 못 박는다.
// 3. 사진은 DB 안이 아니라 OPFS의 별도 파일로 둔다 — DB가 작아야 백업 파일 하나로 계속 나갈 수 있다.

export const PHOTO_DIR = 'photos';
const MAX_EDGE = 1600;
const QUALITY = 0.8;

/** entries.image_uri에 들어가는 값. 원격 썸네일(https://)과 구분된다. */
export const photoRef = (name: string): string => `${PHOTO_DIR}/${name}`;
export const isPhotoRef = (uri: string | null): uri is string =>
  !!uri && uri.startsWith(`${PHOTO_DIR}/`);

// ── 고르기 ──
// input은 클릭할 때마다 새로 만든다. 같은 사진을 두 번 고를 때 change가 안 오는 문제를 피한다.
export function pickPhotos(multiple = false): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = multiple;
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    document.body.appendChild(input);
    let settled = false;
    const done = (files: File[]) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(files);
    };
    input.addEventListener('change', () => done(Array.from(input.files ?? [])));
    // 취소는 이벤트가 없다 — 창이 돌아오면 한 번 확인하고 놓아 준다
    window.addEventListener(
      'focus',
      () => setTimeout(() => done(Array.from(input.files ?? [])), 800),
      { once: true }
    );
    input.click();
  });
}

// ── 줄이기 ──
async function toBitmap(file: File): Promise<ImageBitmap> {
  // 세워 찍은 사진이 눕지 않도록 EXIF 방향을 적용해 달라고 부탁한다.
  // 옵션을 모르는 판에서는 그냥 기본값으로 — 최신 WebKit은 어차피 방향을 반영한다.
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return await createImageBitmap(file);
  }
}

export interface Processed {
  bytes: Uint8Array<ArrayBuffer>;
  width: number;
  height: number;
}

export async function processPhoto(file: File): Promise<Processed> {
  const bitmap = await toBitmap(file);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const blob = await draw(bitmap, w, h);
    return { bytes: new Uint8Array(await blob.arrayBuffer()), width: w, height: h };
  } finally {
    bitmap.close();
  }
}

async function draw(bitmap: ImageBitmap, w: number, h: number): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, 0, 0, w, h);
      return canvas.convertToBlob({ type: 'image/jpeg', quality: QUALITY });
    }
  }
  // OffscreenCanvas가 없는 판(iOS 16.4 미만)에서는 보통 캔버스로
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('캔버스를 열 수 없습니다.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('사진을 변환하지 못했습니다.'))),
      'image/jpeg',
      QUALITY
    )
  );
}

// ── 넣고 빼기 ──
// 쓰기는 워커에게 맡긴다. 동기 접근 핸들은 워커에만 있고, 그 길이 모든 판에서 열려 있다
// (메인 스레드의 createWritable은 iOS 26부터이고 잠금 모드에서 꺼진다).

export async function savePhoto(db: WebDb, file: File): Promise<string> {
  const { bytes } = await processPhoto(file);
  const name = `${newId()}.jpg`;
  await db.writePhoto(name, bytes);
  return photoRef(name);
}

// 읽기는 메인 스레드에서 바로 — getFile()은 디스크의 파일을 가리킬 뿐 메모리에 복사하지 않는다.
async function photoFile(ref: string): Promise<File | null> {
  if (!isPhotoRef(ref)) return null;
  try {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle(PHOTO_DIR, { create: false });
    const handle = await dir.getFileHandle(ref.slice(PHOTO_DIR.length + 1), { create: false });
    return await handle.getFile();
  } catch {
    return null; // 지워졌거나 아직 없다 — 기록은 사진 없이도 남는다
  }
}

// blob URL은 반드시 되돌려줘야 한다. 사진 목록에서 이걸 흘리면 iOS는 페이지를 죽인다.
export async function photoUrl(ref: string): Promise<string | null> {
  const file = await photoFile(ref);
  return file ? URL.createObjectURL(file) : null;
}

export function releasePhotoUrl(url: string | null): void {
  if (url) URL.revokeObjectURL(url);
}

export async function photoBlob(ref: string): Promise<File | null> {
  return photoFile(ref);
}

export async function deletePhoto(db: WebDb, ref: string): Promise<void> {
  if (!isPhotoRef(ref)) return;
  await db.deletePhoto(ref.slice(PHOTO_DIR.length + 1)).catch(() => {});
}
