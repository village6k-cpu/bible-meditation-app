import { type SQLiteDatabase } from 'expo-sqlite';
import { newId } from '../core/ids';
import { Source } from '../core/types';

// 최근 사용 순으로 전부 — 컴포저는 첫 번째를 미리 골라 둔다.
// 스트립은 가로로 스크롤되므로 자르지 않는다. 잘라내면 밀려난 책을 다시 등록하게 되고, 그게 곧 중복이다.
export async function recentSources(db: SQLiteDatabase, kind: Source['kind']): Promise<Source[]> {
  return db.getAllAsync<Source>(
    'SELECT * FROM sources WHERE kind = ? AND deleted_at IS NULL ORDER BY last_used_at DESC',
    [kind]
  );
}

export async function getSource(db: SQLiteDatabase, id: string): Promise<Source | null> {
  return db.getFirstAsync<Source>('SELECT * FROM sources WHERE id = ? AND deleted_at IS NULL', [id]);
}

// 같은 제목의 살아 있는 출처 — 출처는 한 번만 등록되어야 하므로 만들기 전에 반드시 찾는다
export async function findSource(
  db: SQLiteDatabase,
  kind: Source['kind'],
  title: string
): Promise<Source | null> {
  return db.getFirstAsync<Source>(
    'SELECT * FROM sources WHERE kind = ? AND title = ? AND deleted_at IS NULL ORDER BY last_used_at DESC LIMIT 1',
    [kind, title.trim()]
  );
}

// 없으면 만들고, 있으면 그것을 돌려준다 (비어 있던 저자·링크는 이번 입력으로 채운다)
export async function createSource(
  db: SQLiteDatabase,
  kind: Source['kind'],
  title: string,
  creator: string | null,
  url: string | null = null
): Promise<Source> {
  const t = title.trim();
  const existing = await findSource(db, kind, t);
  if (existing) {
    const merged: Source = {
      ...existing,
      creator: existing.creator ?? creator,
      url: existing.url ?? url,
    };
    if (merged.creator !== existing.creator || merged.url !== existing.url) {
      await db.runAsync('UPDATE sources SET creator = ?, url = ? WHERE id = ?', [
        merged.creator,
        merged.url,
        existing.id,
      ]);
    }
    return merged;
  }
  const now = Date.now();
  const source: Source = {
    id: newId(),
    kind,
    title: t,
    creator,
    url,
    created_at: now,
    last_used_at: now,
    last_tags: '',
    deleted_at: null,
  };
  await db.runAsync(
    'INSERT INTO sources (id, kind, title, creator, url, created_at, last_used_at, last_tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [source.id, kind, t, creator, url, now, now, '']
  );
  return source;
}

// 밑줄을 하나 남길 때마다 — 이 출처가 맨 앞으로 오고, 이번에 쓴 태그(비웠으면 빈 것)가 다음 기본값이 된다
export async function touchSource(db: SQLiteDatabase, id: string, tags: string[]): Promise<void> {
  await db.runAsync('UPDATE sources SET last_used_at = ?, last_tags = ? WHERE id = ?', [
    Date.now(),
    tags.join(' '),
    id,
  ]);
}

// 제목·저자·링크를 고치면, 그 출처의 밑줄에 복사돼 있던 제목·저자(·링크)도 함께 고친다
export async function renameSource(
  db: SQLiteDatabase,
  id: string,
  title: string,
  creator: string | null,
  url: string | null
): Promise<void> {
  const before = await getSource(db, id);
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE sources SET title = ?, creator = ?, url = ? WHERE id = ?', [
      title,
      creator,
      url,
      id,
    ]);
    await db.runAsync(
      'UPDATE entries SET title = ?, subtitle = ?, updated_at = ? WHERE source_id = ? AND deleted_at IS NULL',
      [title, creator, now, id]
    );
    if (before?.url && url && before.url !== url) {
      await db.runAsync('UPDATE entries SET url = ? WHERE source_id = ? AND url = ?', [
        url,
        id,
        before.url,
      ]);
    }
  });
}

// 출처만 조용히 내린다 — 밑줄은 복사된 제목을 지닌 채 그대로 남는다
export async function deleteSource(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('UPDATE sources SET deleted_at = ? WHERE id = ?', [Date.now(), id]);
}
