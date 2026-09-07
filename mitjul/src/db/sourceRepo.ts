import { type SQLiteDatabase } from 'expo-sqlite';
import { newId } from '../core/ids';
import { Source } from '../core/types';

// 최근 사용 순 — 컴포저는 첫 번째를 미리 골라 둔다
export async function recentSources(
  db: SQLiteDatabase,
  kind: Source['kind'],
  limit: number = 8
): Promise<Source[]> {
  return db.getAllAsync<Source>(
    'SELECT * FROM sources WHERE kind = ? AND deleted_at IS NULL ORDER BY last_used_at DESC LIMIT ?',
    [kind, limit]
  );
}

export async function getSource(db: SQLiteDatabase, id: string): Promise<Source | null> {
  return db.getFirstAsync<Source>('SELECT * FROM sources WHERE id = ? AND deleted_at IS NULL', [id]);
}

export async function createSource(
  db: SQLiteDatabase,
  kind: Source['kind'],
  title: string,
  creator: string | null
): Promise<Source> {
  const now = Date.now();
  const source: Source = {
    id: newId(),
    kind,
    title,
    creator,
    created_at: now,
    last_used_at: now,
    last_tags: '',
    deleted_at: null,
  };
  await db.runAsync(
    'INSERT INTO sources (id, kind, title, creator, created_at, last_used_at, last_tags) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [source.id, kind, title, creator, now, now, '']
  );
  return source;
}

// 밑줄을 하나 남길 때마다 — 이 출처가 맨 앞으로 오고, 태그 기본값이 갱신된다
export async function touchSource(db: SQLiteDatabase, id: string, tags: string[]): Promise<void> {
  if (tags.length > 0) {
    await db.runAsync('UPDATE sources SET last_used_at = ?, last_tags = ? WHERE id = ?', [
      Date.now(),
      tags.join(' '),
      id,
    ]);
  } else {
    await db.runAsync('UPDATE sources SET last_used_at = ? WHERE id = ?', [Date.now(), id]);
  }
}

export async function countEntriesOfSource(db: SQLiteDatabase, sourceId: string, day?: string): Promise<number> {
  const row = day
    ? await db.getFirstAsync<{ n: number }>(
        'SELECT COUNT(*) as n FROM entries WHERE source_id = ? AND day = ? AND deleted_at IS NULL',
        [sourceId, day]
      )
    : await db.getFirstAsync<{ n: number }>(
        'SELECT COUNT(*) as n FROM entries WHERE source_id = ? AND deleted_at IS NULL',
        [sourceId]
      );
  return row?.n ?? 0;
}
