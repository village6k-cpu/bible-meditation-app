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
// 이름을 고쳤을 때 '합쳐질 상대'. 화면이 미리 물어보려면 renameSource와 같은 규칙을 봐야 하므로
// 조건을 여기 한 군데에만 둔다. 없으면 null — 그때만 조용히 고쳐도 안전하다.
//
// 규칙에 눈먼 구간이 하나 있다: 링크를 가진 출처는 첫 항에서 자기 자신을 찾아 `||`가 단락되므로
// 제목이 겹쳐도 상대를 못 만난다. 그래서 '합치기'를 따로 두었다 — 그쪽은 사용자가 상대를 지목한다.
export async function findMergeTarget(
  db: SQLiteDatabase,
  id: string,
  kind: SourceKind,
  title: string,
  url: string | null
): Promise<Source | null> {
  const found =
    (url && (await findSourceByUrl(db, url))) || (await findSource(db, [kind], title.trim()));
  return found && found.id !== id ? found : null;
}

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
  const target = await findMergeTarget(db, id, before.kind, t, url);

  if (target) {
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

// 출처를 내리고, 매달려 있던 밑줄은 출처에서 떼어 낸다.
//
// 떼어 내지 않으면 기록이 죽은 출처를 가리킨 채 남는데, 그러면 목록과 상세에는 그대로 보이면서
// 형식(책·영상·글) 필터에서만 조용히 사라진다. 그 필터가 살아 있는 출처를 거쳐 kind를 얻기
// 때문이다(entryRepo의 sourceKind 조건). 있는데 안 보이는 것이 가장 나쁜 상태다.
//
// 그래서 source_id를 비운다. 비면 그 기록은 검토 탭의 줄로 돌아온다 — 출처가 사라진 기록을
// 어디에 둘지는 사람이 정하는 게 맞고, 이 앱은 이미 그 리듬을 갖고 있다.
// 복사돼 있던 제목·저자는 지우지 않는다. 출처를 잃었다고 무엇을 읽었는지까지 잃을 이유는 없다.
export async function deleteSource(db: SQLiteDatabase, id: string): Promise<void> {
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    // filed_at도 함께 지운다. createEntry는 출처가 있으면 '구조가 붙었다'고 보고 이 칸을 찍어
    // 검토 큐에서 빼는데(entryRepo의 규칙), 출처만 떼고 이 칸을 남기면 그 기록은 출처도 없고
    // 검토에도 안 뜨는 미아가 된다. 갈피가 붙어 있으면 그것이 구조이므로 찍힌 채로 둔다 —
    // 큐에 올릴지 말지의 기준을 createEntry와 똑같이 맞춘다.
    await db.runAsync(
      `UPDATE entries
          SET source_id = NULL,
              filed_at = CASE WHEN id IN (SELECT entry_id FROM entry_tags) THEN filed_at ELSE NULL END,
              updated_at = ?
        WHERE source_id = ? AND deleted_at IS NULL`,
      [now, id]
    );
    // 지운 기록은 참조만 끊는다 — 얼굴을 다시 찍을 이유가 없다
    await db.runAsync('UPDATE entries SET source_id = NULL WHERE source_id = ?', [id]);
    await db.runAsync('UPDATE sources SET deleted_at = ? WHERE id = ?', [now, id]);
  });
}

// === 출처 관리 ===
// 화면이 출처를 손보려면 두 가지가 더 필요하다: 이 출처에 밑줄이 몇 개나 매달렸는지, 그리고 합치기.

export interface SourceWithCount extends Source {
  entry_count: number;
}

// 살아 있는 출처 전부 + 각 출처에 매달린 살아 있는 기록 수.
// 개수를 함께 주는 이유는 하나다 — 지우거나 합치기 전에 무엇이 얼마나 움직이는지 보여줘야 하기 때문이다.
export async function allSources(db: SQLiteDatabase): Promise<SourceWithCount[]> {
  return db.getAllAsync<SourceWithCount>(
    `SELECT s.*, (SELECT COUNT(*) FROM entries e
                  WHERE e.source_id = s.id AND e.deleted_at IS NULL) AS entry_count
     FROM sources s WHERE s.deleted_at IS NULL
     ORDER BY s.last_used_at DESC`
  );
}

// 출처 둘을 합친다. from은 내려가고 to가 남는다 — 돌려주는 값이 앞으로 쓸 출처다.
//
// renameSource도 안에서 같은 일을 하지만 그쪽은 이름을 고치다가 '어쩌다' 합쳐지는 길이다.
// 그 길은 사용자가 친 제목을 조용히 버리기까지 한다(살아남는 쪽 제목이 이긴다).
// 그래서 합치기를 이렇게 따로 꺼내 둔다. 사용자가 상대를 지목하고, 무엇이 움직이는지 보고 누른다.
export async function mergeSources(
  db: SQLiteDatabase,
  fromId: string,
  toId: string
): Promise<Source> {
  if (fromId === toId) throw new Error('같은 출처끼리는 합칠 수 없습니다.');
  const from = await getSource(db, fromId);
  const to = await getSource(db, toId);
  if (!from || !to) throw new Error('출처를 찾지 못했습니다.');

  const now = Date.now();
  // 남는 쪽이 이긴다. 비어 있던 칸만 사라지는 쪽에서 채워 온다.
  const merged: Source = {
    ...to,
    creator: to.creator ?? from.creator,
    url: to.url ?? from.url,
    thumbnail_uri: to.thumbnail_uri ?? from.thumbnail_uri,
    last_used_at: now,
  };

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE sources SET creator = ?, url = ?, thumbnail_uri = ?, last_used_at = ? WHERE id = ?',
      [merged.creator, merged.url, merged.thumbnail_uri, now, to.id]
    );
    // 지운 기록까지 함께 옮긴다 — 죽은 출처를 가리키는 참조를 남기지 않는다.
    await db.runAsync('UPDATE entries SET source_id = ? WHERE source_id = ?', [to.id, from.id]);
    // 얼굴(제목·저자)은 살아 있는 기록에만 새로 찍는다
    await db.runAsync(
      'UPDATE entries SET title = ?, subtitle = ?, updated_at = ? WHERE source_id = ? AND deleted_at IS NULL',
      [merged.title, merged.creator, now, to.id]
    );
    if (merged.url) await propagateUrl(db, to.id, from.url, merged.url);
    if (merged.thumbnail_uri && merged.thumbnail_uri !== from.thumbnail_uri) {
      await propagateThumbnail(db, to.id, from.thumbnail_uri, merged.thumbnail_uri);
    }
    await db.runAsync('UPDATE sources SET deleted_at = ? WHERE id = ?', [now, from.id]);
  });
  return merged;
}
