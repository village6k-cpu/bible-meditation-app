import { type SQLiteDatabase } from 'expo-sqlite';
import { newId } from '../core/ids';
import { extractHashtags, normalizeTags } from '../core/tags';
import { Entry, EntryInput, EntryType, MealSlot, Reaction, SourceKind, TrendRow } from '../core/types';
import { ResurfaceCandidate } from '../core/resurface';
import { CONTENT_TYPES, PRACTICE_TYPES, isPractice } from '../core/registry';
import { setEntryTags, tagsForEntries } from './tagRepo';

// '%'와 '_'가 사용자 입력에 있어도 문자 그대로 찾도록
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

const LIVE = 'deleted_at IS NULL';
// 콘텐츠만 — 할 일과 실천(식사·운동)을 뺀다. 기록 탭·검토·회상·기록 수 집계가 모두 이 범위다.
// 실천은 격자로만 산다(practiceEntries). 여기에 섞이면 하루 세 끼가 1년에 천 줄로 밑줄 사이에 낀다.
const CONTENT = `type IN (${CONTENT_TYPES.map((t) => `'${t}'`).join(', ')})`;
const PRACTICE = `type IN (${PRACTICE_TYPES.map((t) => `'${t}'`).join(', ')})`;

function collectTags(input: EntryInput): string[] {
  const inline = extractHashtags(`${input.quote ?? ''} ${input.body ?? ''}`);
  return normalizeTags([...(input.tags ?? []), ...inline]);
}

export async function createEntry(db: SQLiteDatabase, input: EntryInput): Promise<string> {
  const id = newId();
  const now = Date.now();
  const tagsNow = collectTags(input);
  // 구조가 이미 붙었으면(출처나 갈피가 있으면) 검토 큐에 올리지 않는다.
  // 실천(식사·운동)은 애초에 정리할 것이 없다 — 갈피를 붙이라고 물을 대상이 아니다.
  const filed = input.source_id || tagsNow.length > 0 || isPractice(input.type) ? now : null;
  await db.runAsync(
    `INSERT INTO entries (id, type, day, created_at, updated_at, filed_at, source_id, title, subtitle, quote, body,
                          url, image_uri, page, slot, minutes, practiced, done, due_time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.type,
      input.day,
      now,
      now,
      filed,
      input.source_id ?? null,
      input.title ?? null,
      input.subtitle ?? null,
      input.quote ?? null,
      input.body ?? null,
      input.url ?? null,
      input.image_uri ?? null,
      input.page ?? null,
      input.slot ?? null,
      input.minutes ?? null,
      input.practiced ?? null,
      input.done ?? null,
      input.due_time ?? null,
    ]
  );
  await setEntryTags(db, id, collectTags(input));
  return id;
}

export async function updateEntry(db: SQLiteDatabase, id: string, input: EntryInput): Promise<void> {
  await db.runAsync(
    `UPDATE entries SET type = ?, day = ?, source_id = ?, title = ?, subtitle = ?, quote = ?, body = ?, url = ?,
                        image_uri = ?, page = ?, slot = ?, minutes = ?, practiced = ?,
                        done = ?, due_time = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.type,
      input.day,
      input.source_id ?? null,
      input.title ?? null,
      input.subtitle ?? null,
      input.quote ?? null,
      input.body ?? null,
      input.url ?? null,
      input.image_uri ?? null,
      input.page ?? null,
      input.slot ?? null,
      input.minutes ?? null,
      input.practiced ?? null,
      input.done ?? null,
      input.due_time ?? null,
      Date.now(),
      id,
    ]
  );
  await setEntryTags(db, id, collectTags(input));
}

// 소프트 삭제 — 실수로 지운 기록이 정말로 사라지지 않도록
export async function deleteEntry(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('UPDATE entries SET deleted_at = ? WHERE id = ?', [Date.now(), id]);
}

export async function getEntry(db: SQLiteDatabase, id: string): Promise<Entry | null> {
  return db.getFirstAsync<Entry>(`SELECT * FROM entries WHERE id = ? AND ${LIVE}`, [id]);
}

// 상세를 열 때마다 호출 — '오래 안 읽은 순'이 실제 읽기를 반영하게 하는 핵심
export async function recordRevisit(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync(
    'UPDATE entries SET revisit_count = revisit_count + 1, last_revisited_at = ? WHERE id = ?',
    [Date.now(), id]
  );
}

export async function togglePinned(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('UPDATE entries SET pinned = 1 - pinned WHERE id = ?', [id]);
}

export async function setTaskDone(db: SQLiteDatabase, id: string, done: boolean): Promise<void> {
  await db.runAsync('UPDATE entries SET done = ?, updated_at = ? WHERE id = ?', [
    done ? 1 : 0,
    Date.now(),
    id,
  ]);
}

export async function entriesOfDay(db: SQLiteDatabase, day: string): Promise<Entry[]> {
  return db.getAllAsync<Entry>(
    `SELECT * FROM entries WHERE day = ? AND ${LIVE} ORDER BY created_at, id`,
    [day]
  );
}

export async function entriesInRange(db: SQLiteDatabase, from: string, to: string): Promise<Entry[]> {
  return db.getAllAsync<Entry>(
    `SELECT * FROM entries WHERE day BETWEEN ? AND ? AND ${LIVE} ORDER BY day, created_at, id`,
    [from, to]
  );
}

export interface LibraryQuery {
  type?: EntryType | null;
  // 형식(책/영상/글) — 유형이 아니라 출처의 종류가 기억한다
  sourceKind?: SourceKind | null;
  tag?: string | null;
  q?: string;
  sort: 'recent' | 'dusty';
  pinnedOnly?: boolean;
  limit?: number;
}

export async function queryLibrary(db: SQLiteDatabase, opts: LibraryQuery): Promise<Entry[]> {
  const where: string[] = [LIVE, CONTENT];
  const params: (string | number)[] = [];

  if (opts.type) {
    where.push('type = ?');
    params.push(opts.type);
  }
  if (opts.sourceKind) {
    where.push('source_id IN (SELECT id FROM sources WHERE kind = ? AND deleted_at IS NULL)');
    params.push(opts.sourceKind);
  }
  if (opts.pinnedOnly) where.push('pinned = 1');
  if (opts.tag) {
    where.push(
      'id IN (SELECT entry_id FROM entry_tags et JOIN tags t ON t.id = et.tag_id WHERE t.name = ?)'
    );
    params.push(opts.tag);
  }
  if (opts.q && opts.q.trim()) {
    const q = `%${escapeLike(opts.q.trim())}%`;
    where.push(
      `(title LIKE ? ESCAPE '\\' OR subtitle LIKE ? ESCAPE '\\' OR quote LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\'
        OR id IN (SELECT entry_id FROM entry_tags et JOIN tags t ON t.id = et.tag_id WHERE t.name LIKE ? ESCAPE '\\'))`
    );
    params.push(q, q, q, q, q);
  }

  const order =
    opts.sort === 'dusty'
      ? 'ORDER BY COALESCE(last_revisited_at, created_at) ASC'
      : 'ORDER BY day DESC, created_at DESC';
  params.push(opts.limit ?? 300);

  return db.getAllAsync<Entry>(
    `SELECT * FROM entries WHERE ${where.join(' AND ')} ${order} LIMIT ?`,
    params
  );
}

export async function entriesByTag(db: SQLiteDatabase, tag: string): Promise<Entry[]> {
  return db.getAllAsync<Entry>(
    `SELECT e.* FROM entries e
     JOIN entry_tags et ON et.entry_id = e.id
     JOIN tags t ON t.id = et.tag_id
     WHERE t.name = ? AND e.${LIVE}
     ORDER BY e.day DESC, e.created_at DESC`,
    [tag]
  );
}

// 상세 화면의 '같은 갈피' — 태그 교집합 우선, 부족하면 같은 유형의 이웃으로 채움
export async function relatedEntries(db: SQLiteDatabase, entry: Entry, limit: number = 3): Promise<Entry[]> {
  const byTag = await db.getAllAsync<Entry>(
    `SELECT e.*, COUNT(*) as overlap FROM entries e
     JOIN entry_tags et ON et.entry_id = e.id
     WHERE et.tag_id IN (SELECT tag_id FROM entry_tags WHERE entry_id = ?)
       AND e.id != ? AND e.${LIVE}
     GROUP BY e.id ORDER BY overlap DESC, e.day DESC LIMIT ?`,
    [entry.id, entry.id, limit]
  );
  if (byTag.length >= limit) return byTag;
  const seen = new Set(byTag.map((e) => e.id));
  seen.add(entry.id);
  const sameType = await db.getAllAsync<Entry>(
    `SELECT * FROM entries WHERE type = ? AND id != ? AND ${LIVE}
     ORDER BY ABS(julianday(day) - julianday(?)) LIMIT ?`,
    [entry.type, entry.id, entry.day, limit]
  );
  for (const e of sameType) {
    if (byTag.length >= limit) break;
    if (!seen.has(e.id)) {
      byTag.push(e);
      seen.add(e.id);
    }
  }
  return byTag;
}

export async function tagsOf(db: SQLiteDatabase, entryIds: string[]): Promise<Map<string, string[]>> {
  return tagsForEntries(db, entryIds);
}

export async function recentTitles(db: SQLiteDatabase, type: EntryType, limit: number = 5): Promise<string[]> {
  const rows = await db.getAllAsync<{ title: string }>(
    `SELECT title FROM entries
     WHERE type = ? AND title IS NOT NULL AND title != '' AND ${LIVE}
     GROUP BY title ORDER BY MAX(created_at) DESC LIMIT ?`,
    [type, limit]
  );
  return rows.map((r) => r.title);
}

// === 다시 만나는 밑줄 ===

// lastShownDay는 '오늘 이전'의 노출만 — 오늘의 기록이 덱을 흔들지 않도록
export async function resurfaceCandidates(db: SQLiteDatabase, today: string): Promise<ResurfaceCandidate[]> {
  const rows = await db.getAllAsync<{
    id: string;
    type: EntryType;
    day: string;
    pinned: number;
    has_text: number;
    last_shown: string | null;
    skipped: number;
    retired: number;
  }>(
    `SELECT e.id, e.type, e.day, e.pinned,
            CASE WHEN (e.quote IS NOT NULL AND e.quote != '') OR (e.body IS NOT NULL AND e.body != '') THEN 1 ELSE 0 END as has_text,
            (SELECT MAX(shown_day) FROM resurfacings r WHERE r.entry_id = e.id AND r.shown_day < ?) as last_shown,
            EXISTS(SELECT 1 FROM resurfacings r WHERE r.entry_id = e.id AND r.reaction = 'skipped') as skipped,
            EXISTS(SELECT 1 FROM resurfacings r WHERE r.entry_id = e.id AND r.reaction = 'retired') as retired
     FROM entries e
     WHERE e.${LIVE} AND e.${CONTENT} AND e.day < ?`,
    [today, today]
  );
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    day: r.day,
    pinned: r.pinned,
    hasText: r.has_text === 1,
    lastShownDay: r.last_shown,
    skipped: r.skipped === 1,
    retired: r.retired === 1,
  }));
}

export async function recordShown(db: SQLiteDatabase, ids: string[], today: string): Promise<void> {
  for (const id of ids) {
    await db.runAsync(
      'INSERT OR IGNORE INTO resurfacings (entry_id, shown_day) VALUES (?, ?)',
      [id, today]
    );
  }
}

export async function setReaction(
  db: SQLiteDatabase,
  id: string,
  today: string,
  reaction: Reaction
): Promise<void> {
  await db.runAsync(
    'INSERT INTO resurfacings (entry_id, shown_day, reaction) VALUES (?, ?, ?) ON CONFLICT(entry_id, shown_day) DO UPDATE SET reaction = ?',
    [id, today, reaction, reaction]
  );
  if (reaction === 'kept') {
    await db.runAsync('UPDATE entries SET pinned = 1 WHERE id = ?', [id]);
  }
}

// === 흐름 ===

export async function trendRows(db: SQLiteDatabase, from: string, to: string): Promise<TrendRow[]> {
  const rows = await db.getAllAsync<{
    day: string;
    workout_done: number;
    workout_minutes: number;
    meal_count: number;
    meal_practiced: number;
    verse_count: number;
    entry_count: number;
  }>(
    `SELECT day,
            MAX(CASE WHEN type = 'workout' AND COALESCE(practiced, 1) = 1 THEN 1 ELSE 0 END) as workout_done,
            SUM(CASE WHEN type = 'workout' THEN COALESCE(minutes, 0) ELSE 0 END) as workout_minutes,
            SUM(CASE WHEN type = 'meal' THEN 1 ELSE 0 END) as meal_count,
            SUM(CASE WHEN type = 'meal' AND practiced = 1 THEN 1 ELSE 0 END) as meal_practiced,
            SUM(CASE WHEN type = 'verse' THEN 1 ELSE 0 END) as verse_count,
            SUM(CASE WHEN ${CONTENT} THEN 1 ELSE 0 END) as entry_count
     FROM entries
     WHERE day BETWEEN ? AND ? AND ${LIVE} AND type != 'task'
     GROUP BY day ORDER BY day`,
    [from, to]
  );
  return rows.map((r) => ({
    day: r.day,
    workoutDone: r.workout_done === 1,
    workoutMinutes: r.workout_minutes,
    mealCount: r.meal_count,
    mealPracticed: r.meal_practiced,
    verseCount: r.verse_count,
    entryCount: r.entry_count,
  }));
}

export interface MonthShelfRow {
  type: EntryType;
  count: number;
}

export async function monthShelf(db: SQLiteDatabase, from: string, to: string): Promise<MonthShelfRow[]> {
  return db.getAllAsync<MonthShelfRow>(
    `SELECT type, COUNT(*) as count FROM entries
     WHERE day BETWEEN ? AND ? AND ${LIVE} AND ${CONTENT}
     GROUP BY type ORDER BY count DESC`,
    [from, to]
  );
}

// ─── 정리 리듬 ───
// 정리는 사용자가 기억해야 할 일이 아니라 앱이 내미는 줄이어야 한다.
// 아직 구조가 붙지 않은(출처도 갈피도 없는) 기록을 오래된 것부터 내민다.

export async function unfiledCount(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM entries
     WHERE deleted_at IS NULL AND filed_at IS NULL AND source_id IS NULL
       AND ${CONTENT}
       AND id NOT IN (SELECT entry_id FROM entry_tags)`
  );
  return row?.n ?? 0;
}

export async function unfiledEntries(db: SQLiteDatabase, limit: number = 20): Promise<Entry[]> {
  return db.getAllAsync<Entry>(
    `SELECT * FROM entries
     WHERE deleted_at IS NULL AND filed_at IS NULL AND source_id IS NULL
       AND ${CONTENT}
       AND id NOT IN (SELECT entry_id FROM entry_tags)
     ORDER BY created_at ASC LIMIT ?`,
    [limit]
  );
}

// '이대로 둔다' — 구조 없이 두기로 한 기록은 다시 묻지 않는다
export async function markFiled(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('UPDATE entries SET filed_at = ?, updated_at = ? WHERE id = ?', [
    Date.now(),
    Date.now(),
    id,
  ]);
}

// 기록 탭의 '전체 N건' — 콘텐츠만 센다
export async function contentCount(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM entries WHERE ${LIVE} AND ${CONTENT}`
  );
  return row?.n ?? 0;
}

// ─── 실천 격자 ───
// 식사·운동은 줄이 아니라 격자다. 화면이 날짜 × 칸으로 그릴 수 있게 얇은 행만 준다.

export interface PracticeCell {
  id: string;
  type: EntryType;
  day: string;
  slot: MealSlot | null;
  practiced: number | null;
  image_uri: string | null;
  minutes: number | null;
  body: string | null;
}

export async function practiceEntries(
  db: SQLiteDatabase,
  from: string,
  to: string
): Promise<PracticeCell[]> {
  return db.getAllAsync<PracticeCell>(
    `SELECT id, type, day, slot, practiced, image_uri, minutes, body FROM entries
     WHERE ${LIVE} AND ${PRACTICE} AND day BETWEEN ? AND ?
     ORDER BY day DESC, created_at ASC`,
    [from, to]
  );
}
