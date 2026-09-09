import { type SQLiteDatabase } from 'expo-sqlite';

export type SyncEntityType =
  | 'entries'
  | 'sources'
  | 'tags'
  | 'entry_tags'
  | 'resurfacings'
  | 'photo_links';

export interface PreparedChange {
  entity_type: SyncEntityType;
  entity_id: string;
  operation: 'upsert' | 'delete';
  changed_at: number;
  payload: Record<string, unknown> | null;
}

export interface RemoteRecord {
  entity_type: SyncEntityType;
  entity_id: string;
  operation: 'upsert' | 'delete';
  revision: number;
  payload: Record<string, unknown> | null;
}

const JOINER = String.fromCharCode(31);

const COLUMNS: Record<SyncEntityType, readonly string[]> = {
  entries: [
    'id', 'type', 'day', 'created_at', 'updated_at', 'deleted_at', 'pinned', 'revisit_count',
    'last_revisited_at', 'filed_at', 'source_id', 'title', 'subtitle', 'quote', 'body', 'url',
    'image_uri', 'page', 'slot', 'minutes', 'practiced', 'done', 'due_time',
  ],
  sources: [
    'id', 'kind', 'title', 'creator', 'url', 'thumbnail_uri', 'created_at', 'last_used_at',
    'last_tags', 'deleted_at',
  ],
  tags: ['id', 'name', 'created_at'],
  entry_tags: ['entry_id', 'tag_id'],
  resurfacings: ['entry_id', 'shown_day', 'reaction'],
  photo_links: ['photo_uri', 'media_item_id', 'album_id', 'created_at', 'updated_at'],
};

const PRIMARY_KEYS: Record<SyncEntityType, readonly string[]> = {
  entries: ['id'],
  sources: ['id'],
  tags: ['id'],
  entry_tags: ['entry_id', 'tag_id'],
  resurfacings: ['entry_id', 'shown_day'],
  photo_links: ['photo_uri'],
};

function splitEntityId(entityType: SyncEntityType, entityId: string): string[] {
  const keys = PRIMARY_KEYS[entityType];
  const values = keys.length === 1 ? [entityId] : entityId.split(JOINER);
  if (values.length !== keys.length || values.some((v) => !v)) {
    throw new Error(`잘못된 동기화 식별자: ${entityType}/${entityId}`);
  }
  return values;
}

async function rowForChange(
  db: SQLiteDatabase,
  entityType: SyncEntityType,
  entityId: string
): Promise<Record<string, unknown> | null> {
  const keys = PRIMARY_KEYS[entityType];
  const values = splitEntityId(entityType, entityId);
  const where = keys.map((key) => `${key} = ?`).join(' AND ');
  return db.getFirstAsync<Record<string, unknown>>(
    `SELECT ${COLUMNS[entityType].join(', ')} FROM ${entityType} WHERE ${where}`,
    values
  );
}

export async function preparePushBatch(
  db: SQLiteDatabase,
  limit: number = 100
): Promise<PreparedChange[]> {
  const rows = await db.getAllAsync<{
    entity_type: SyncEntityType;
    entity_id: string;
    operation: 'upsert' | 'delete';
    changed_at: number;
  }>(`SELECT entity_type, entity_id, operation, changed_at
      FROM sync_changes
      ORDER BY
        CASE operation
          WHEN 'upsert' THEN CASE entity_type
            WHEN 'sources' THEN 0
            WHEN 'tags' THEN 1
            WHEN 'entries' THEN 2
            WHEN 'entry_tags' THEN 3
            WHEN 'resurfacings' THEN 4
            WHEN 'photo_links' THEN 5
          END
          ELSE CASE entity_type
            WHEN 'photo_links' THEN 0
            WHEN 'resurfacings' THEN 1
            WHEN 'entry_tags' THEN 2
            WHEN 'entries' THEN 3
            WHEN 'tags' THEN 4
            WHEN 'sources' THEN 5
          END
        END,
        changed_at,
        entity_id
      LIMIT ?`, [limit]);

  const result: PreparedChange[] = [];
  for (const row of rows) {
    const payload = row.operation === 'upsert'
      ? await rowForChange(db, row.entity_type, row.entity_id)
      : null;
    // 행이 큐에 들어간 뒤 실제로 지워진 경우에는 삭제로 보내야 다시 살아나지 않는다.
    result.push({ ...row, operation: payload ? row.operation : 'delete', payload });
  }
  return result;
}

export async function acknowledgeChanges(
  db: SQLiteDatabase,
  sent: readonly PreparedChange[]
): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const change of sent) {
      // 네트워크 요청 중 사용자가 다시 고친 행은 changed_at이 달라져 큐에 남는다.
      await db.runAsync(
        'DELETE FROM sync_changes WHERE entity_type = ? AND entity_id = ? AND changed_at = ?',
        [change.entity_type, change.entity_id, change.changed_at]
      );
    }
  });
}

function normalizedPayload(record: RemoteRecord): Record<string, unknown> {
  if (!record.payload || typeof record.payload !== 'object' || Array.isArray(record.payload)) {
    throw new Error(`내용이 없는 동기화 행: ${record.entity_type}/${record.entity_id}`);
  }
  const values: Record<string, unknown> = {};
  for (const column of COLUMNS[record.entity_type]) values[column] = record.payload[column] ?? null;
  const ids = splitEntityId(record.entity_type, record.entity_id);
  PRIMARY_KEYS[record.entity_type].forEach((key, index) => { values[key] = ids[index]; });
  return values;
}

async function upsertRemote(db: SQLiteDatabase, record: RemoteRecord): Promise<void> {
  const columns = COLUMNS[record.entity_type];
  const keys = PRIMARY_KEYS[record.entity_type];
  const payload = normalizedPayload(record);
  const updateColumns = columns.filter((column) => !keys.includes(column));
  const update = updateColumns.map((column) => `${column} = excluded.${column}`).join(', ');
  const conflict = keys.join(', ');
  const sql = `INSERT INTO ${record.entity_type} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`
    + ` ON CONFLICT (${conflict}) ${update ? `DO UPDATE SET ${update}` : 'DO NOTHING'}`;
  await db.runAsync(sql, columns.map((column) => payload[column]) as never[]);

  if (record.entity_type === 'photo_links') {
    await db.runAsync(
      `INSERT INTO photo_jobs (photo_uri, action, state, attempts, last_error, updated_at)
       VALUES (?, 'download', 'pending', 0, NULL, ?)
       ON CONFLICT(photo_uri) DO UPDATE SET action='download', state='pending', last_error=NULL, updated_at=excluded.updated_at`,
      [record.entity_id, Date.now()]
    );
  }
}

async function deleteRemote(db: SQLiteDatabase, record: RemoteRecord): Promise<void> {
  const keys = PRIMARY_KEYS[record.entity_type];
  const values = splitEntityId(record.entity_type, record.entity_id);
  await db.runAsync(
    `DELETE FROM ${record.entity_type} WHERE ${keys.map((key) => `${key} = ?`).join(' AND ')}`,
    values
  );
  if (record.entity_type === 'photo_links') {
    await db.runAsync('DELETE FROM photo_jobs WHERE photo_uri = ?', [record.entity_id]);
  }
}

const UPSERT_ORDER: Record<SyncEntityType, number> = {
  sources: 0,
  tags: 1,
  entries: 2,
  entry_tags: 3,
  resurfacings: 4,
  photo_links: 5,
};

export async function applyRemoteRecords(
  db: SQLiteDatabase,
  records: readonly RemoteRecord[]
): Promise<void> {
  if (records.length === 0) return;
  const ordered = [...records].sort((a, b) => {
    if (a.operation !== b.operation) return a.operation === 'upsert' ? -1 : 1;
    const direction = a.operation === 'upsert' ? 1 : -1;
    return direction * (UPSERT_ORDER[a.entity_type] - UPSERT_ORDER[b.entity_type]);
  });
  const cursor = Math.max(...records.map((record) => record.revision));

  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE sync_control SET applying_remote = 1 WHERE id = 1');
    for (const record of ordered) {
      const pending = await db.getFirstAsync<{ found: number }>(
        'SELECT 1 AS found FROM sync_changes WHERE entity_type = ? AND entity_id = ?',
        [record.entity_type, record.entity_id]
      );
      // 아직 서버에 못 보낸 내 값이 있으면 그것이 다음 전송에서 최종값이 된다.
      if (pending) continue;
      if (record.operation === 'upsert') await upsertRemote(db, record);
      else await deleteRemote(db, record);
    }
    await db.runAsync('UPDATE sync_meta SET value = ? WHERE key = ?', [String(cursor), 'remote_cursor']);
    await db.runAsync('UPDATE sync_control SET applying_remote = 0 WHERE id = 1');
  });
}
