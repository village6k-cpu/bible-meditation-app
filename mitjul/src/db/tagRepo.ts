import { type SQLiteDatabase } from 'expo-sqlite';
import { newId } from '../core/ids';
import { Tag } from '../core/types';

export async function upsertTag(db: SQLiteDatabase, name: string): Promise<string> {
  const existing = await db.getFirstAsync<{ id: string }>('SELECT id FROM tags WHERE name = ?', [
    name,
  ]);
  if (existing) return existing.id;
  const id = newId();
  await db.runAsync('INSERT OR IGNORE INTO tags (id, name, created_at) VALUES (?, ?, ?)', [
    id,
    name,
    Date.now(),
  ]);
  const row = await db.getFirstAsync<{ id: string }>('SELECT id FROM tags WHERE name = ?', [name]);
  return row?.id ?? id;
}

// 엔트리의 태그 집합을 통째로 교체
export async function setEntryTags(db: SQLiteDatabase, entryId: string, names: string[]): Promise<void> {
  await db.runAsync('DELETE FROM entry_tags WHERE entry_id = ?', [entryId]);
  for (const name of names) {
    const tagId = await upsertTag(db, name);
    await db.runAsync('INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?, ?)', [
      entryId,
      tagId,
    ]);
  }
}

export async function topTags(db: SQLiteDatabase, limit: number = 15): Promise<Tag[]> {
  return db.getAllAsync<Tag>(
    `SELECT t.id, t.name, COUNT(et.entry_id) as count
     FROM tags t
     JOIN entry_tags et ON et.tag_id = t.id
     JOIN entries e ON e.id = et.entry_id AND e.deleted_at IS NULL
     GROUP BY t.id HAVING count > 0
     ORDER BY count DESC, t.name LIMIT ?`,
    [limit]
  );
}

export async function tagsForEntries(
  db: SQLiteDatabase,
  entryIds: string[]
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (entryIds.length === 0) return result;
  const placeholders = entryIds.map(() => '?').join(',');
  const rows = await db.getAllAsync<{ entry_id: string; name: string }>(
    `SELECT et.entry_id, t.name FROM entry_tags et
     JOIN tags t ON t.id = et.tag_id
     WHERE et.entry_id IN (${placeholders})
     ORDER BY t.name`,
    entryIds
  );
  for (const r of rows) {
    const list = result.get(r.entry_id) ?? [];
    list.push(r.name);
    result.set(r.entry_id, list);
  }
  return result;
}

// 갈피 화면 헤더의 책갈피 양끝 — 첫 기록과 최근 기록
export async function tagBookends(
  db: SQLiteDatabase,
  name: string
): Promise<{ first: string; latest: string; count: number } | null> {
  const row = await db.getFirstAsync<{ first: string; latest: string; count: number }>(
    `SELECT MIN(e.day) as first, MAX(e.day) as latest, COUNT(*) as count
     FROM entries e
     JOIN entry_tags et ON et.entry_id = e.id
     JOIN tags t ON t.id = et.tag_id
     WHERE t.name = ? AND e.deleted_at IS NULL`,
    [name]
  );
  return row && row.count > 0 ? row : null;
}
