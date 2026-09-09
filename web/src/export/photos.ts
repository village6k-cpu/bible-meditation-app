import type { WebDb } from '../db/sqlite';
import { asSqlite } from '../db';
import { deliverFile, type Delivered } from '../platform/backup';
import { isPhotoRef, PHOTO_DIR, photoBlob } from '../platform/photos';

// 사진은 .sqlite3 백업에 넣지 않는다.
//
// iOS에서 navigator.share는 파일을 통째로 메모리에 올리고, 웹 페이지는 1GB 한참 아래에서 죽는다.
// 메모리를 안 쓰는 길인 <a download>는 설치한 홈 화면 웹앱에서 깨져 있다(애플이 의도된 동작이라고 했다).
// 그래서 몇백 MB짜리 단일 아카이브를 만드는 순간 백업이 '가끔 실패하는 기능'이 된다.
//
// 대신: DB 백업은 작고 빠르게 유지하고(수백 KB), 사진은 묶음으로 나눠 내보낸다.
// 한 묶음이 손에 잡히는 크기를 넘지 않으므로 언제 눌러도 성공한다.

const BATCH_BYTES = 40 * 1024 * 1024; // 한 번에 넘길 최대치

export interface PhotoStat {
  count: number;
  bytes: number;
  orphans: number; // 기록이 사라졌는데 남아 있는 파일
}

async function referencedNames(d: WebDb): Promise<Set<string>> {
  const rows = await asSqlite(d).getAllAsync<{ image_uri: string }>(
    "SELECT image_uri FROM entries WHERE deleted_at IS NULL AND image_uri LIKE 'photos/%'"
  );
  return new Set(rows.map((r) => r.image_uri.slice(PHOTO_DIR.length + 1)));
}

export async function photoStat(d: WebDb): Promise<PhotoStat> {
  const files = await d.listPhotos().catch(() => []);
  const live = await referencedNames(d);
  return {
    count: files.length,
    bytes: files.reduce((n, f) => n + f.size, 0),
    orphans: files.filter((f) => !live.has(f.name)).length,
  };
}

// 기록이 지워진 사진은 남겨 둘 이유가 없다. 지우는 것은 파일뿐이고 기록은 건드리지 않는다.
export async function sweepOrphans(d: WebDb): Promise<number> {
  const files = await d.listPhotos().catch(() => []);
  const live = await referencedNames(d);
  let gone = 0;
  for (const f of files) {
    if (live.has(f.name)) continue;
    await d.deletePhoto(f.name).catch(() => {});
    gone += 1;
  }
  return gone;
}

/** 아직 안 내보낸 사진을 크기 상한까지만 묶는다. cursor는 마지막으로 내보낸 파일 이름. */
export async function photoBatch(
  d: WebDb,
  after: string | null
): Promise<{ names: string[]; bytes: number; remaining: number }> {
  const files = (await d.listPhotos().catch(() => [])).filter((f) => !after || f.name > after);
  const names: string[] = [];
  let bytes = 0;
  for (const f of files) {
    if (names.length > 0 && bytes + f.size > BATCH_BYTES) break;
    names.push(f.name);
    bytes += f.size;
  }
  return { names, bytes, remaining: files.length - names.length };
}

export async function sharePhotoBatch(
  d: WebDb,
  after: string | null
): Promise<
  | { result: 'empty' }
  | {
      result: 'ok';
      how: Delivered;
      count: number;
      bytes: number;
      next: string | null;
      remaining: number;
    }
> {
  const batch = await photoBatch(d, after);
  if (batch.names.length === 0) return { result: 'empty' };

  const files: File[] = [];
  for (const name of batch.names) {
    const f = await photoBlob(`${PHOTO_DIR}/${name}`);
    if (f) files.push(new File([f], name, { type: 'image/jpeg' }));
  }
  if (files.length === 0) return { result: 'empty' };

  const last = batch.names[batch.names.length - 1];
  const how = await shareMany(files);
  return {
    result: 'ok',
    how,
    count: files.length,
    bytes: batch.bytes,
    next: batch.remaining > 0 ? last : null,
    remaining: batch.remaining,
  };
}

// 여러 장을 한 번에 — iOS 공유 시트의 '파일에 저장'이 묶음째 받는다.
// 공유가 안 되는 판에서는 한 장씩 내려받는 길로 물러선다.
async function shareMany(files: File[]): Promise<Delivered> {
  try {
    if (navigator.canShare?.({ files })) {
      await navigator.share({ files });
      return 'shared';
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
  }
  let how: Delivered = 'downloaded';
  for (const f of files) {
    how = await deliverFile(f, f.name, 'image/jpeg');
    if (how === 'cancelled') return 'cancelled';
  }
  return how;
}

export { isPhotoRef };
