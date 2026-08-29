import { Platform } from 'react-native';
import { getUserDb } from './db';
import { getBook } from './bible-data';
import { addDays, daysBetween, getISODate } from './utils';
import {
  EntryType,
  MediaKind,
  MealSlot,
  dailySeed,
  extractHashtags,
  normalizeTags,
  parseTags,
} from './journal-utils';

export interface Entry {
  id: number;
  date: string;
  created_at: string;
  updated_at: string;
  type: EntryType;
  media_kind: MediaKind | null;
  title: string | null;
  quote: string | null;
  body: string | null;
  link: string | null;
  photo_uri: string | null;
  minutes: number | null;
  meal_slot: MealSlot | null;
  pinned: number;
  tags: string;
}

export interface EntryInput {
  date: string;
  type: EntryType;
  media_kind?: MediaKind | null;
  title?: string | null;
  quote?: string | null;
  body?: string | null;
  link?: string | null;
  photo_uri?: string | null;
  minutes?: number | null;
  meal_slot?: MealSlot | null;
  tags?: string[];
}

export interface DayLog {
  date: string;
  day_title: string | null;
  workout_done: number;
  diet_kept: number | null;
}

export interface Todo {
  id: number;
  date: string;
  content: string;
  done: number;
  sort_order: number;
}

export interface DayMeditation {
  id: number;
  content: string;
  book_id: number | null;
  chapter: number | null;
  verse: number | null;
  book_name?: string;
  date: string;
}

export interface HabitDay {
  workout: boolean;
  diet: boolean | null; // null = 미기록
  meditation: boolean;
}

// Tags typed in the tag field plus #hashtags inline in the text — one merged set
function collectTags(input: EntryInput): string {
  const inline = extractHashtags(`${input.quote ?? ''} ${input.body ?? ''}`);
  return normalizeTags([...(input.tags ?? []), ...inline]);
}

// === Entries ===

export async function saveEntry(input: EntryInput): Promise<number> {
  const db = getUserDb();
  if (!db) return -1;
  const result = await db.runAsync(
    `INSERT INTO entries (date, type, media_kind, title, quote, body, link, photo_uri, minutes, meal_slot, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.date,
      input.type,
      input.media_kind ?? null,
      input.title ?? null,
      input.quote ?? null,
      input.body ?? null,
      input.link ?? null,
      input.photo_uri ?? null,
      input.minutes ?? null,
      input.meal_slot ?? null,
      collectTags(input),
    ]
  );
  return result.lastInsertRowId;
}

export async function updateEntry(id: number, input: EntryInput): Promise<void> {
  const db = getUserDb();
  if (!db) return;
  await db.runAsync(
    `UPDATE entries SET date = ?, type = ?, media_kind = ?, title = ?, quote = ?, body = ?, link = ?,
     photo_uri = ?, minutes = ?, meal_slot = ?, tags = ?, updated_at = datetime('now') WHERE id = ?`,
    [
      input.date,
      input.type,
      input.media_kind ?? null,
      input.title ?? null,
      input.quote ?? null,
      input.body ?? null,
      input.link ?? null,
      input.photo_uri ?? null,
      input.minutes ?? null,
      input.meal_slot ?? null,
      collectTags(input),
      id,
    ]
  );
}

export async function deleteEntry(id: number): Promise<void> {
  const db = getUserDb();
  if (!db) return;
  await db.runAsync('DELETE FROM entries WHERE id = ?', [id]);
}

export async function getEntry(id: number): Promise<Entry | null> {
  const db = getUserDb();
  if (!db) return null;
  return db.getFirstAsync<Entry>('SELECT * FROM entries WHERE id = ?', [id]);
}

export async function getEntriesByDate(date: string): Promise<Entry[]> {
  const db = getUserDb();
  if (!db) return [];
  return db.getAllAsync<Entry>(
    'SELECT * FROM entries WHERE date = ? ORDER BY created_at, id',
    [date]
  );
}

export async function getEntriesInRange(startDate: string, endDate: string): Promise<Entry[]> {
  const db = getUserDb();
  if (!db) return [];
  return db.getAllAsync<Entry>(
    'SELECT * FROM entries WHERE date BETWEEN ? AND ? ORDER BY date DESC, created_at, id',
    [startDate, endDate]
  );
}

export async function togglePinned(id: number): Promise<void> {
  const db = getUserDb();
  if (!db) return;
  await db.runAsync('UPDATE entries SET pinned = 1 - pinned WHERE id = ?', [id]);
}

export async function getPinned(limit: number = 10): Promise<Entry[]> {
  const db = getUserDb();
  if (!db) return [];
  return db.getAllAsync<Entry>(
    'SELECT * FROM entries WHERE pinned = 1 ORDER BY date DESC, id DESC LIMIT ?',
    [limit]
  );
}

// === Library ===

export type LibrarySegment =
  | 'all'
  | 'quotes'
  | 'book'
  | 'youtube'
  | 'music'
  | 'writing'
  | 'moment'
  | 'meditation';

export async function getLibraryEntries(opts: {
  segment: LibrarySegment;
  tag?: string | null;
  query?: string;
  limit?: number;
}): Promise<Entry[]> {
  const db = getUserDb();
  if (!db) return [];
  const where: string[] = [];
  const params: (string | number)[] = [];

  switch (opts.segment) {
    case 'quotes':
      where.push("quote IS NOT NULL AND quote != ''");
      break;
    case 'book':
    case 'youtube':
    case 'music':
      where.push("type = 'media' AND media_kind = ?");
      params.push(opts.segment);
      break;
    case 'writing':
    case 'moment':
      where.push('type = ?');
      params.push(opts.segment);
      break;
    default:
      break;
  }
  if (opts.tag) {
    where.push('tags LIKE ?');
    params.push(`%,${opts.tag},%`);
  }
  if (opts.query && opts.query.trim()) {
    where.push('(title LIKE ? OR quote LIKE ? OR body LIKE ? OR tags LIKE ?)');
    const q = `%${opts.query.trim()}%`;
    params.push(q, q, q, q);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  params.push(opts.limit ?? 200);
  return db.getAllAsync<Entry>(
    `SELECT * FROM entries ${whereSql} ORDER BY date DESC, id DESC LIMIT ?`,
    params
  );
}

export async function getAllTags(limit: number = 20): Promise<{ tag: string; count: number }[]> {
  const db = getUserDb();
  if (!db) return [];
  const rows = await db.getAllAsync<{ tags: string }>(
    "SELECT tags FROM entries WHERE tags != ''"
  );
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const tag of parseTags(row.tags)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function getRecentMediaTitles(kind: MediaKind, limit: number = 5): Promise<string[]> {
  const db = getUserDb();
  if (!db) return [];
  const rows = await db.getAllAsync<{ title: string }>(
    `SELECT DISTINCT title FROM entries
     WHERE type = 'media' AND media_kind = ? AND title IS NOT NULL AND title != ''
     ORDER BY id DESC LIMIT ?`,
    [kind, limit]
  );
  return rows.map((r) => r.title);
}

// === Resurfacing ===

// Same-month-day entry from a past year/month: '그날의 기록'
export async function getOnThisDay(todayIso: string): Promise<Entry | null> {
  const db = getUserDb();
  if (!db) return null;
  return db.getFirstAsync<Entry>(
    `SELECT * FROM entries WHERE strftime('%m-%d', date) = strftime('%m-%d', ?) AND date < ?
     ORDER BY date DESC LIMIT 1`,
    [todayIso, todayIso]
  );
}

// Deterministic daily pick over entries at least 3 days old; pinned entries weighted double
export async function getDailyPick(todayIso: string): Promise<Entry | null> {
  const db = getUserDb();
  if (!db) return null;
  const cutoff = addDays(todayIso, -3);
  let ids = await db.getAllAsync<{ id: number; pinned: number }>(
    'SELECT id, pinned FROM entries WHERE date <= ? ORDER BY id',
    [cutoff]
  );
  if (ids.length === 0) {
    ids = await db.getAllAsync<{ id: number; pinned: number }>(
      'SELECT id, pinned FROM entries ORDER BY id'
    );
  }
  if (ids.length === 0) return null;
  const weighted: number[] = [];
  for (const row of ids) {
    weighted.push(row.id);
    if (row.pinned === 1) weighted.push(row.id);
  }
  const pick = weighted[dailySeed(todayIso) % weighted.length];
  return db.getFirstAsync<Entry>('SELECT * FROM entries WHERE id = ?', [pick]);
}

// === Meditations (existing notes table, read through a local-date lens) ===

export async function getMeditationsByDate(date: string): Promise<DayMeditation[]> {
  const db = getUserDb();
  if (!db) return [];
  const rows = await db.getAllAsync<DayMeditation>(
    `SELECT id, content, book_id, chapter, verse, date(created_at, 'localtime') as date
     FROM notes WHERE date(created_at, 'localtime') = ? ORDER BY created_at`,
    [date]
  );
  for (const n of rows) {
    if (n.book_id) {
      const book = await getBook(n.book_id);
      if (book) n.book_name = book.name_ko;
    }
  }
  return rows;
}

export async function getAllMeditations(limit: number = 200): Promise<DayMeditation[]> {
  const db = getUserDb();
  if (!db) return [];
  const rows = await db.getAllAsync<DayMeditation>(
    `SELECT id, content, book_id, chapter, verse, date(created_at, 'localtime') as date
     FROM notes ORDER BY created_at DESC LIMIT ?`,
    [limit]
  );
  for (const n of rows) {
    if (n.book_id) {
      const book = await getBook(n.book_id);
      if (book) n.book_name = book.name_ko;
    }
  }
  return rows;
}

// === Day logs ===

export async function getDayLog(date: string): Promise<DayLog | null> {
  const db = getUserDb();
  if (!db) return null;
  return db.getFirstAsync<DayLog>('SELECT * FROM day_logs WHERE date = ?', [date]);
}

export async function getDayLogsInRange(startDate: string, endDate: string): Promise<DayLog[]> {
  const db = getUserDb();
  if (!db) return [];
  return db.getAllAsync<DayLog>(
    'SELECT * FROM day_logs WHERE date BETWEEN ? AND ?',
    [startDate, endDate]
  );
}

export async function upsertDayLog(
  date: string,
  patch: Partial<Omit<DayLog, 'date'>>
): Promise<void> {
  const db = getUserDb();
  if (!db) return;
  await db.runAsync('INSERT OR IGNORE INTO day_logs (date) VALUES (?)', [date]);
  const sets: string[] = [];
  const params: (string | number | null)[] = [];
  if (patch.day_title !== undefined) {
    sets.push('day_title = ?');
    params.push(patch.day_title);
  }
  if (patch.workout_done !== undefined) {
    sets.push('workout_done = ?');
    params.push(patch.workout_done);
  }
  if (patch.diet_kept !== undefined) {
    sets.push('diet_kept = ?');
    params.push(patch.diet_kept);
  }
  if (sets.length === 0) return;
  params.push(date);
  await db.runAsync(`UPDATE day_logs SET ${sets.join(', ')} WHERE date = ?`, params);
}

// === Todos ===

export async function getTodosByDate(date: string): Promise<Todo[]> {
  const db = getUserDb();
  if (!db) return [];
  return db.getAllAsync<Todo>(
    'SELECT * FROM todos WHERE date = ? ORDER BY sort_order, id',
    [date]
  );
}

export async function addTodo(date: string, content: string): Promise<number> {
  const db = getUserDb();
  if (!db) return -1;
  const result = await db.runAsync('INSERT INTO todos (date, content) VALUES (?, ?)', [
    date,
    content,
  ]);
  return result.lastInsertRowId;
}

export async function toggleTodo(id: number): Promise<void> {
  const db = getUserDb();
  if (!db) return;
  await db.runAsync('UPDATE todos SET done = 1 - done WHERE id = ?', [id]);
}

export async function deleteTodo(id: number): Promise<void> {
  const db = getUserDb();
  if (!db) return;
  await db.runAsync('DELETE FROM todos WHERE id = ?', [id]);
}

// === Timeline ===

// Dates that carry anything — entries, todos, day logs, or meditation notes — newest first
export async function getActiveDates(limit: number, beforeDate?: string): Promise<string[]> {
  const db = getUserDb();
  if (!db) return [];
  const before = beforeDate ?? addDays(getISODate(), 1);
  const rows = await db.getAllAsync<{ d: string }>(
    `SELECT d FROM (
       SELECT date as d FROM entries
       UNION SELECT date as d FROM todos
       UNION SELECT date as d FROM day_logs
       UNION SELECT date(created_at, 'localtime') as d FROM notes
     ) WHERE d < ? ORDER BY d DESC LIMIT ?`,
    [before, limit]
  );
  return rows.map((r) => r.d);
}

// === Habits & stats ===

export async function getHabitRange(
  startDate: string,
  endDate: string
): Promise<Record<string, HabitDay>> {
  const db = getUserDb();
  if (!db) return {};
  const result: Record<string, HabitDay> = {};
  const ensure = (d: string): HabitDay => {
    if (!result[d]) result[d] = { workout: false, diet: null, meditation: false };
    return result[d];
  };

  const workoutDates = await db.getAllAsync<{ date: string }>(
    "SELECT DISTINCT date FROM entries WHERE type = 'workout' AND date BETWEEN ? AND ?",
    [startDate, endDate]
  );
  for (const r of workoutDates) ensure(r.date).workout = true;

  const dayLogs = await getDayLogsInRange(startDate, endDate);
  for (const l of dayLogs) {
    if (l.workout_done === 1) ensure(l.date).workout = true;
    if (l.diet_kept !== null) ensure(l.date).diet = l.diet_kept === 1;
  }

  // 묵상: reading completed OR a meditation note written that day
  const readings = await db.getAllAsync<{ date: string }>(
    'SELECT date FROM reading_history WHERE completed = 1 AND date BETWEEN ? AND ?',
    [startDate, endDate]
  );
  for (const r of readings) ensure(r.date).meditation = true;
  const noteDates = await db.getAllAsync<{ d: string }>(
    `SELECT DISTINCT date(created_at, 'localtime') as d FROM notes
     WHERE date(created_at, 'localtime') BETWEEN ? AND ?`,
    [startDate, endDate]
  );
  for (const r of noteDates) ensure(r.d).meditation = true;

  return result;
}

export function computeStreak(
  habits: Record<string, HabitDay>,
  key: 'workout' | 'meditation',
  todayIso: string
): number {
  let streak = 0;
  let d = todayIso;
  // Today not yet done doesn't break the streak — start counting from yesterday if needed
  if (!habits[d]?.[key]) d = addDays(d, -1);
  while (habits[d]?.[key]) {
    streak += 1;
    d = addDays(d, -1);
  }
  return streak;
}

export async function getWorkoutMinutesByDate(
  startDate: string,
  endDate: string
): Promise<Record<string, number>> {
  const db = getUserDb();
  if (!db) return {};
  const rows = await db.getAllAsync<{ date: string; total: number }>(
    `SELECT date, SUM(COALESCE(minutes, 0)) as total FROM entries
     WHERE type = 'workout' AND date BETWEEN ? AND ? GROUP BY date`,
    [startDate, endDate]
  );
  const result: Record<string, number> = {};
  for (const r of rows) result[r.date] = r.total;
  return result;
}

export interface MonthlyStats {
  entryCount: number;
  quoteCount: number;
  photoCount: number;
}

export async function getMonthlyStats(startDate: string, endDate: string): Promise<MonthlyStats> {
  const db = getUserDb();
  if (!db) return { entryCount: 0, quoteCount: 0, photoCount: 0 };
  const row = await db.getFirstAsync<{ n: number; q: number; p: number }>(
    `SELECT COUNT(*) as n,
            SUM(CASE WHEN quote IS NOT NULL AND quote != '' THEN 1 ELSE 0 END) as q,
            SUM(CASE WHEN photo_uri IS NOT NULL THEN 1 ELSE 0 END) as p
     FROM entries WHERE date BETWEEN ? AND ?`,
    [startDate, endDate]
  );
  return {
    entryCount: row?.n ?? 0,
    quoteCount: row?.q ?? 0,
    photoCount: row?.p ?? 0,
  };
}

export async function getWeekQuotes(todayIso: string, limit: number = 3): Promise<Entry[]> {
  const db = getUserDb();
  if (!db) return [];
  return db.getAllAsync<Entry>(
    `SELECT * FROM entries WHERE quote IS NOT NULL AND quote != '' AND date BETWEEN ? AND ?
     ORDER BY date DESC, id DESC LIMIT ?`,
    [addDays(todayIso, -6), todayIso, limit]
  );
}

export async function getTodayEntryCount(date: string): Promise<number> {
  const db = getUserDb();
  if (!db) return 0;
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) as n FROM entries WHERE date = ?',
    [date]
  );
  return row?.n ?? 0;
}

// === Photos ===

// Picker cache files are evictable — copy into documentDirectory/photos/ and store a
// RELATIVE path (documentDirectory's absolute path changes across iOS app updates).
export async function persistPhoto(tempUri: string): Promise<string> {
  if (Platform.OS === 'web') return tempUri;
  const FileSystem = require('expo-file-system/legacy');
  const dir = `${FileSystem.documentDirectory}photos`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  const ext = tempUri.includes('.') ? tempUri.slice(tempUri.lastIndexOf('.')) : '.jpg';
  const name = `${Date.now()}-${Math.floor(Math.random() * 10000)}${ext}`;
  await FileSystem.copyAsync({ from: tempUri, to: `${dir}/${name}` });
  return `photos/${name}`;
}

export function photoUriToAbsolute(rel: string | null): string | null {
  if (!rel) return null;
  if (!rel.startsWith('photos/')) return rel;
  if (Platform.OS === 'web') return rel;
  const FileSystem = require('expo-file-system/legacy');
  return `${FileSystem.documentDirectory}${rel}`;
}

export function relativeDaysLabel(fromIso: string, toIso: string): string {
  const days = daysBetween(fromIso, toIso);
  if (days <= 0) return '오늘';
  if (days === 1) return '어제';
  if (days >= 365) {
    const years = Math.floor(days / 365);
    return `${years}년 전`;
  }
  return `${days}일 전`;
}
