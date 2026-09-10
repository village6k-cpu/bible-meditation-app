import { type SQLiteDatabase } from 'expo-sqlite';
import {
  acknowledgeChanges,
  applyRemoteRecords,
  preparePushBatch,
  queueAllRecordsForSync,
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

export class LegacySyncAccountError extends Error {
  constructor(public readonly legacyAccountId: string) {
    super('이 기록함은 이전 동기화 서버에 연결되어 있습니다. 백업 후 렛저 전용 서버로 전환하세요.');
  }
}

async function readBinding(db: SQLiteDatabase) {
  const bound = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM sync_meta WHERE key = 'account_id'"
  );
  const project = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM sync_meta WHERE key = 'project_id'"
  );
  return { accountId: bound?.value, projectId: project?.value };
}

export async function bindSyncAccount(db: SQLiteDatabase, accountId: string, projectId: string): Promise<void> {
  if (!accountId || !projectId) throw new Error('동기화 계정과 서버를 확인하지 못했습니다.');
  await db.withTransactionAsync(async () => {
    const bound = await readBinding(db);
    if (bound.projectId && bound.projectId !== projectId) throw new Error('이 기록함은 다른 서버에 연결되어 있습니다.');
    if (bound.accountId && !bound.projectId) throw new LegacySyncAccountError(bound.accountId);
    if (bound.accountId && bound.accountId !== accountId) {
      throw new Error('이 기록함은 다른 계정에 연결되어 있습니다. 먼저 백업한 뒤 새 기록함에서 로그인하세요.');
    }
    if (!bound.accountId) {
      await db.runAsync("INSERT INTO sync_meta (key, value) VALUES ('account_id', ?)", [accountId]);
      await db.runAsync("INSERT INTO sync_meta (key, value) VALUES ('project_id', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [projectId]);
    }
  });
}

// 백업과 계정 확인을 마친 UI에서만 부른다. 새 서버에 이미 연결된 기록함은 재할당할 수 없다.
export async function migrateLegacySyncAccount(
  db: SQLiteDatabase, legacyAccountId: string, accountId: string, projectId: string
): Promise<void> {
  if (!legacyAccountId || !accountId || !projectId) throw new Error('서버 전환에 필요한 계정 정보가 없습니다.');
  await db.withTransactionAsync(async () => {
    const bound = await readBinding(db);
    if (bound.projectId || bound.accountId !== legacyAccountId) {
      throw new Error('연결 상태가 달라져 서버 전환을 중단했습니다.');
    }
    await queueAllRecordsForSync(db);
    await db.runAsync("UPDATE sync_meta SET value=? WHERE key='account_id'", [accountId]);
    await db.runAsync("INSERT INTO sync_meta (key,value) VALUES ('project_id',?)", [projectId]);
    await db.runAsync("INSERT INTO sync_meta (key,value) VALUES ('remote_cursor','0') ON CONFLICT(key) DO UPDATE SET value='0'");
  });
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
  if ((await preparePushBatch(db, 1)).length > 0) {
    throw new Error('보낼 기록이 많이 남아 있습니다. 다음 동기화에서 이어서 보냅니다.');
  }

  const cursorRow = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM sync_meta WHERE key = 'remote_cursor'"
  );
  let cursor = Number(cursorRow?.value ?? 0);
  if (!Number.isFinite(cursor)) cursor = 0;
  let pulled = 0;
  const received = new Map<string, RemoteRecord>();
  // Supabase 응답 한도를 넘는 오래된 기록함도 첫 실행에서 끝까지 따라잡는다.
  // 무한히 쓰기가 들어오는 경우까지 한 실행을 붙들지 않도록 안전 상한은 둔다.
  for (let page = 0; page < 100; page += 1) {
    const remote = await api.pull(cursor);
    pulled += remote.length;
    for (const record of remote) received.set(`${record.entity_type}/${record.entity_id}`, record);
    // 서버는 최신 행만 남기므로, 수정된 부모가 자식보다 뒷 페이지에 있을 수 있다.
    // 전체 변경을 받은 뒤 관계 순서로 한 번에 적용해야 첫 연결에서도 참조가 끊기지 않는다.
    if (remote.length < PULL_PAGE_SIZE) {
      await applyRemoteRecords(db, [...received.values()]);
      return { pushed, pulled };
    }
    cursor = Math.max(cursor, ...remote.map((record) => record.revision));
  }
  throw new Error('한 번에 받을 기록이 너무 많습니다. 수신 위치는 바꾸지 않았습니다.');
}
