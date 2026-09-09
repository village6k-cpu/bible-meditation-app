import { type SQLiteDatabase } from 'expo-sqlite';
import {
  acknowledgeChanges,
  applyRemoteRecords,
  preparePushBatch,
  type PreparedChange,
  type RemoteRecord,
} from './syncRepo';

export interface RemoteSyncApi {
  push(changes: readonly PreparedChange[]): Promise<void>;
  pull(cursor: number): Promise<RemoteRecord[]>;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
}

const PULL_PAGE_SIZE = 500;

export async function bindSyncAccount(db: SQLiteDatabase, accountId: string): Promise<void> {
  const bound = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM sync_meta WHERE key = 'account_id'"
  );
  if (bound && bound.value !== accountId) {
    throw new Error('이 기록함은 다른 계정에 연결되어 있습니다. 먼저 백업한 뒤 새 기록함에서 로그인하세요.');
  }
  if (!bound) {
    await db.runAsync("INSERT INTO sync_meta (key, value) VALUES ('account_id', ?)", [accountId]);
  }
}

export async function syncOnce(db: SQLiteDatabase, api: RemoteSyncApi): Promise<SyncResult> {
  let pushed = 0;
  // 한 번에 너무 큰 요청을 만들지 않되, 이번 실행을 시작할 때 쌓여 있던 변경은 모두 비운다.
  for (let page = 0; page < 100; page += 1) {
    const batch = await preparePushBatch(db, 100);
    if (batch.length === 0) break;
    await api.push(batch);
    await acknowledgeChanges(db, batch);
    pushed += batch.length;
    if (batch.length < 100) break;
  }

  const cursorRow = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM sync_meta WHERE key = 'remote_cursor'"
  );
  let cursor = Number(cursorRow?.value ?? 0);
  if (!Number.isFinite(cursor)) cursor = 0;
  let pulled = 0;
  // Supabase 응답 한도를 넘는 오래된 기록함도 첫 실행에서 끝까지 따라잡는다.
  // 무한히 쓰기가 들어오는 경우까지 한 실행을 붙들지 않도록 안전 상한은 둔다.
  for (let page = 0; page < 100; page += 1) {
    const remote = await api.pull(cursor);
    await applyRemoteRecords(db, remote);
    pulled += remote.length;
    if (remote.length < PULL_PAGE_SIZE) break;
    cursor = Math.max(cursor, ...remote.map((record) => record.revision));
  }
  return { pushed, pulled };
}
