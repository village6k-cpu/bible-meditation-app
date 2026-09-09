import { type SQLiteDatabase } from 'expo-sqlite';
import { newId } from '../core/ids';
import { canonicalLinkUrl } from '../core/links';
import { Source, SourceKind } from '../core/types';

// 최근 사용 순으로 전부 — 컴포저는 첫 번째를 미리 골라 둔다.
// 스트립은 가로로 스크롤되므로 자르지 않는다. 잘라내면 밀려난 책을 다시 등록하게 되고, 그게 곧 중복이다.
export async function recentSources(db: SQLiteDatabase, kinds: SourceKind[]): Promise<Source[]> {
  if (kinds.length === 0) return [];
  const holes = kinds.map(() => '?').join(', ');
  return db.getAllAsync<Source>(
    `SELECT * FROM sources WHERE kind IN (${holes}) AND deleted_at IS NULL ORDER BY last_used_at DESC`,
    kinds
  );
}

export async function getSource(db: SQLiteDatabase, id: string): Promise<Source | null> {
  return db.getFirstAsync<Source>('SELECT * FROM sources WHERE id = ? AND deleted_at IS NULL', [id]);
}

// 같은 제목의 살아 있는 출처 — 출처는 한 번만 등록되어야 하므로 만들기 전에 반드시 찾는다
export async function findSource(
  db: SQLiteDatabase,
  kinds: SourceKind[],
  title: string
): Promise<Source | null> {
  if (kinds.length === 0) return null;
  const holes = kinds.map(() => '?').join(', ');
  return db.getFirstAsync<Source>(
    `SELECT * FROM sources WHERE kind IN (${holes}) AND title = ? AND deleted_at IS NULL ORDER BY last_used_at DESC LIMIT 1`,
    [...kinds, title.trim()]
  );
}

// 같은 링크(정규형)의 살아 있는 출처 — 붙여넣은 영상을 이미 담아뒀는지 링크로 안다
// 링크는 종류를 가리지 않고 찾는다 — 같은 주소면 영상이든 글이든 같은 출처다
export async function findSourceByUrl(db: SQLiteDatabase, url: string): Promise<Source | null> {
  return db.getFirstAsync<Source>(
    'SELECT * FROM sources WHERE url = ? AND deleted_at IS NULL ORDER BY last_used_at DESC LIMIT 1',
    [url]
  );
}

export interface SourceExtra {
  url?: string | null;
  thumbnail_uri?: string | null;
}

// 없으면 만들고, 있으면 그것을 돌려준다 (비어 있던 저자·링크·썸네일은 이번 입력으로 채운다).
// 링크가 있으면 링크로만 찾는다 — 제목이 같아도(제목을 못 얻어 'YouTube · id'로 남긴 두 영상) 다른 영상이다.
export async function createSource(
  db: SQLiteDatabase,
  kind: SourceKind,
  title: string,
  creator: string | null,
  extra: SourceExtra = {}
): Promise<Source> {
  const t = title.trim();
  const url = extra.url ?? null;
  const thumbnail = extra.thumbnail_uri ?? null;
  const existing = url ? await findSourceByUrl(db, url) : await findSource(db, [kind], t);
  if (existing) {
    const merged: Source = {
      ...existing,
      creator: existing.creator ?? creator,
      url: existing.url ?? url,
      thumbnail_uri: existing.thumbnail_uri ?? thumbnail,
    };
    if (
      merged.creator !== existing.creator ||
      merged.url !== existing.url ||
      merged.thumbnail_uri !== existing.thumbnail_uri
    ) {
      await db.runAsync('UPDATE sources SET creator = ?, url = ?, thumbnail_uri = ? WHERE id = ?', [
        merged.creator,
        merged.url,
        merged.thumbnail_uri,
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
    thumbnail_uri: thumbnail,
    created_at: now,
    last_used_at: now,
    last_tags: '',
    deleted_at: null,
  };
  await db.runAsync(
    'INSERT INTO sources (id, kind, title, creator, url, thumbnail_uri, created_at, last_used_at, last_tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [source.id, kind, t, creator, url, thumbnail, now, now, '']
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

export async function setSourceThumbnail(db: SQLiteDatabase, id: string, uri: string): Promise<void> {
  await db.runAsync('UPDATE sources SET thumbnail_uri = ? WHERE id = ?', [uri, id]);
}

// 이 출처의 살아 있는 기록 중, 링크가 없거나 옛 링크(정규형 기준 — 시점·공유 꼬리가 달린 것도)를 쓰던 것에 새 링크를 단다
async function propagateUrl(
  db: SQLiteDatabase,
  sourceId: string,
  oldUrl: string | null,
  newUrl: string
): Promise<void> {
  const rows = await db.getAllAsync<{ id: string; url: string | null }>(
    'SELECT id, url FROM entries WHERE source_id = ? AND deleted_at IS NULL',
    [sourceId]
  );
  const oldCanon = oldUrl ? canonicalLinkUrl(oldUrl) : null;
  for (const r of rows) {
    if (!r.url || (oldCanon !== null && canonicalLinkUrl(r.url) === oldCanon)) {
      await db.runAsync('UPDATE entries SET url = ? WHERE id = ?', [newUrl, r.id]);
    }
  }
}

// 출처의 얼굴이 바뀌면, 그 얼굴을 복사해 지니던 기록들도 따라간다
async function propagateThumbnail(
  db: SQLiteDatabase,
  sourceId: string,
  oldThumb: string | null,
  newThumb: string | null
): Promise<void> {
  await db.runAsync(
    "UPDATE entries SET image_uri = ? WHERE source_id = ? AND deleted_at IS NULL AND (image_uri IS NULL OR image_uri = '' OR image_uri = ?)",
    [newThumb, sourceId, oldThumb ?? '']
  );
}

// 제목·저자·링크를 고치면, 그 출처의 밑줄에 복사돼 있던 제목·저자(·링크·썸네일)도 함께 고친다.
// 같은 링크나 제목의 살아 있는 출처가 이미 있으면 그쪽으로 합친다 (오타를 고쳐 원래 책과 만나는 경우):
// 밑줄은 그 출처로 옮기고, 이 출처는 조용히 내린다. 돌려주는 값이 앞으로 쓸 출처다.
// thumbnail: undefined면 그대로, null이면 지운다, 문자열이면 바꾼다 (링크가 바뀔 때만 넘긴다)
export async function renameSource(
  db: SQLiteDatabase,
  id: string,
  title: string,
  creator: string | null,
  url: string | null,
  thumbnail?: string | null
): Promise<Source> {
  const before = await getSource(db, id);
  if (!before) throw new Error('source not found');
  const t = title.trim();
  const now = Date.now();
  const target =
    (url && (await findSourceByUrl(db, url))) || (await findSource(db, [before.kind], t));

  if (target && target.id !== id) {
    const merged: Source = {
      ...target,
      creator: target.creator ?? creator,
      url: target.url ?? url,
      thumbnail_uri: target.thumbnail_uri ?? thumbnail ?? before.thumbnail_uri,
      last_used_at: now,
    };
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        'UPDATE sources SET creator = ?, url = ?, thumbnail_uri = ?, last_used_at = ? WHERE id = ?',
        [merged.creator, merged.url, merged.thumbnail_uri, now, target.id]
      );
      await db.runAsync(
        'UPDATE entries SET source_id = ?, title = ?, subtitle = ?, updated_at = ? WHERE source_id = ? AND deleted_at IS NULL',
        [target.id, merged.title, merged.creator, now, id]
      );
      if (merged.url) await propagateUrl(db, target.id, before.url, merged.url);
      if (merged.thumbnail_uri && merged.thumbnail_uri !== before.thumbnail_uri) {
        await propagateThumbnail(db, target.id, before.thumbnail_uri, merged.thumbnail_uri);
      }
      await db.runAsync('UPDATE sources SET deleted_at = ? WHERE id = ?', [now, id]);
    });
    return merged;
  }

  const urlChanged = url !== before.url;
  const nextThumb = thumbnail === undefined ? before.thumbnail_uri : thumbnail;
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE sources SET title = ?, creator = ?, url = ?, thumbnail_uri = ? WHERE id = ?',
      [t, creator, url, nextThumb, id]
    );
    await db.runAsync(
      'UPDATE entries SET title = ?, subtitle = ?, updated_at = ? WHERE source_id = ? AND deleted_at IS NULL',
      [t, creator, now, id]
    );
    // 링크를 새로 달거나 바꾸면, 링크가 없던 밑줄과 옛 링크를 그대로 쓰던 밑줄이 따라간다 — 얼굴도 함께
    if (url && urlChanged) await propagateUrl(db, id, before.url, url);
    if (thumbnail !== undefined && nextThumb !== before.thumbnail_uri) {
      await propagateThumbnail(db, id, before.thumbnail_uri, nextThumb);
    }
  });
  return { ...before, title: t, creator, url, thumbnail_uri: nextThumb };
}

// 출처만 조용히 내린다 — 밑줄은 복사된 제목을 지닌 채 그대로 남는다
export async function deleteSource(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('UPDATE sources SET deleted_at = ? WHERE id = ?', [Date.now(), id]);
}
