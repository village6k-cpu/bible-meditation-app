import { getSetting, setSetting } from '@db/settingsRepo';
import { asSqlite } from '../db';
import type { WebDb } from '../db/sqlite';

// 브라우저 안의 저장소는 어떤 것이든 '보관소'가 아니다. WebKit은 최선을 다할 뿐이고,
// persist()가 참을 돌려줘도 계약이 아니라 휴리스틱이다.
// 그래서 이 앱의 유일한 보관 정책은 하나다 — 파일로 꺼내 두기.

const LAST_BACKUP = 'last_backup_at';
export const NAG_AFTER_DAYS = 14;

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export async function lastBackupAt(d: WebDb): Promise<number | null> {
  const v = await getSetting(asSqlite(d), LAST_BACKUP);
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

export async function daysSinceBackup(d: WebDb): Promise<number | null> {
  const at = await lastBackupAt(d);
  if (at === null) return null;
  return Math.floor((Date.now() - at) / 86400_000);
}

// 파일 하나를 사용자 손에 쥐여 주는 두 가지 길.
// iOS에서는 공유 시트가 '파일에 저장'·아이클라우드로 이어져 훨씬 쓸모 있고,
// 데스크톱에서는 그냥 내려받는 편이 빠르다.
export type Delivered = 'shared' | 'downloaded';

export async function deliverFile(
  bytes: BlobPart,
  filename: string,
  mime: string
): Promise<Delivered> {
  const file = new File([bytes], filename, { type: mime });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    }
  } catch (e) {
    // 사용자가 공유 시트를 닫은 것 — 내려받기로 떨어지지 않는다
    if (e instanceof DOMException && e.name === 'AbortError') return 'shared';
  }
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

export async function backupNow(d: WebDb): Promise<{ how: Delivered; bytes: number }> {
  const data = await d.serialize();
  // 워커에서 건너온 배열은 이 문맥의 ArrayBuffer 위에 있다 — 그대로 Blob에 넘긴다
  const how = await deliverFile(data, `밑줄-${stamp()}.sqlite3`, 'application/x-sqlite3');
  await setSetting(asSqlite(d), LAST_BACKUP, String(Date.now()));
  return { how, bytes: data.byteLength };
}

export async function restoreFrom(d: WebDb, file: File): Promise<void> {
  const buf = new Uint8Array(await file.arrayBuffer());
  if (buf.byteLength < 16 || new TextDecoder().decode(buf.subarray(0, 15)) !== 'SQLite format 3') {
    throw new Error('SQLite 파일이 아닙니다.');
  }
  await d.restore(buf);
}
