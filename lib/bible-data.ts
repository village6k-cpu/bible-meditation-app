import { getBibleDb, getUserDb } from './db';

export interface Book {
  id: number;
  name_ko: string;
  name_abbr: string;
  testament: 'old' | 'new';
  chapter_count: number;
}

export interface Verse {
  book_id: number;
  chapter: number;
  verse: number;
  text: string;
}

export interface Section {
  book_id: number;
  chapter: number;
  start_verse: number;
  end_verse: number;
  title: string | null;
}

export interface DailyReading {
  id: number;
  date: string;
  book_id: number;
  start_chapter: number;
  end_chapter: number;
  completed: number;
  book_name?: string;
}

export interface Note {
  id: number;
  created_at: string;
  updated_at: string;
  book_id: number | null;
  chapter: number | null;
  verse: number | null;
  content: string;
  book_name?: string;
}

// === Bible queries ===

export async function getAllBooks(): Promise<Book[]> {
  const db = getBibleDb();
  if (!db) return [];
  return db.getAllAsync<Book>('SELECT * FROM books ORDER BY id');
}

export async function getBooksByTestament(testament: 'old' | 'new'): Promise<Book[]> {
  const db = getBibleDb();
  if (!db) return [];
  return db.getAllAsync<Book>('SELECT * FROM books WHERE testament = ? ORDER BY id', [testament]);
}

export async function getVerses(bookId: number, chapter: number): Promise<Verse[]> {
  const db = getBibleDb();
  if (!db) return [];
  return db.getAllAsync<Verse>(
    'SELECT * FROM verses WHERE book_id = ? AND chapter = ? ORDER BY verse',
    [bookId, chapter]
  );
}

export async function getVerseCount(bookId: number, chapter: number): Promise<number> {
  const db = getBibleDb();
  if (!db) return 0;
  const row = await db.getFirstAsync<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM verses WHERE book_id = ? AND chapter = ?',
    [bookId, chapter]
  );
  return row?.cnt ?? 0;
}

export async function getSections(bookId: number, chapter: number): Promise<Section[]> {
  const db = getBibleDb();
  if (!db) return [];
  return db.getAllAsync<Section>(
    'SELECT * FROM sections WHERE book_id = ? AND chapter = ? ORDER BY start_verse',
    [bookId, chapter]
  );
}

export async function getRandomVerse(): Promise<(Verse & { book_name: string }) | null> {
  const db = getBibleDb();
  if (!db) return null;
  return db.getFirstAsync<Verse & { book_name: string }>(
    `SELECT v.*, b.name_ko as book_name
     FROM verses v JOIN books b ON v.book_id = b.id
     ORDER BY RANDOM() LIMIT 1`
  );
}

export async function getBook(bookId: number): Promise<Book | null> {
  const db = getBibleDb();
  if (!db) return null;
  return db.getFirstAsync<Book>('SELECT * FROM books WHERE id = ?', [bookId]);
}

// === User data queries ===

export async function getUserName(): Promise<string | null> {
  const db = getUserDb();
  if (!db) return null;
  const result = await db.getFirstAsync<{ name: string }>('SELECT name FROM user_profile WHERE id = 1');
  return result?.name ?? null;
}

export async function setUserName(name: string): Promise<void> {
  const db = getUserDb();
  if (!db) return;
  await db.runAsync(
    'INSERT OR REPLACE INTO user_profile (id, name) VALUES (1, ?)',
    [name]
  );
}

export async function getDailyReadings(date: string): Promise<DailyReading[]> {
  const db = getUserDb();
  if (!db) return [];
  const readings = await db.getAllAsync<DailyReading>(
    'SELECT * FROM daily_readings WHERE date = ? ORDER BY id',
    [date]
  );
  for (const r of readings) {
    const book = await getBook(r.book_id);
    if (book) r.book_name = book.name_ko;
  }
  return readings;
}

export async function addDailyReading(date: string, bookId: number, startChapter: number, endChapter: number): Promise<void> {
  const db = getUserDb();
  if (!db) return;
  await db.runAsync(
    'INSERT INTO daily_readings (date, book_id, start_chapter, end_chapter) VALUES (?, ?, ?, ?)',
    [date, bookId, startChapter, endChapter]
  );
}

export async function toggleDailyReading(id: number): Promise<void> {
  const db = getUserDb();
  if (!db) return;
  await db.runAsync(
    'UPDATE daily_readings SET completed = CASE WHEN completed = 0 THEN 1 ELSE 0 END WHERE id = ?',
    [id]
  );
}

export async function addCompletedReading(date: string, bookId: number, chapter: number): Promise<void> {
  const db = getUserDb();
  if (!db) return;
  // 이미 같은 날 같은 장이 있으면 건너뜀
  const existing = await db.getFirstAsync(
    'SELECT id FROM daily_readings WHERE date = ? AND book_id = ? AND start_chapter = ? AND end_chapter = ?',
    [date, bookId, chapter, chapter]
  );
  if (!existing) {
    await db.runAsync(
      'INSERT INTO daily_readings (date, book_id, start_chapter, end_chapter, completed) VALUES (?, ?, ?, ?, 1)',
      [date, bookId, chapter, chapter]
    );
  }
}

export async function deleteDailyReading(id: number): Promise<void> {
  const db = getUserDb();
  if (!db) return;
  await db.runAsync('DELETE FROM daily_readings WHERE id = ?', [id]);
}

export async function getReadingHistory(dates: string[]): Promise<Record<string, boolean>> {
  const db = getUserDb();
  if (!db) return {};
  if (dates.length === 0) return {};
  const placeholders = dates.map(() => '?').join(',');
  const rows = await db.getAllAsync<{ date: string; completed: number }>(
    `SELECT date, completed FROM reading_history WHERE date IN (${placeholders})`,
    dates
  );
  const result: Record<string, boolean> = {};
  for (const row of rows) {
    result[row.date] = row.completed === 1;
  }
  return result;
}

export async function markDayCompleted(date: string): Promise<void> {
  const db = getUserDb();
  if (!db) return;
  await db.runAsync(
    'INSERT OR REPLACE INTO reading_history (date, completed) VALUES (?, 1)',
    [date]
  );
}

// === Notes ===

export async function getAllNotes(): Promise<Note[]> {
  const db = getUserDb();
  if (!db) return [];
  const notes = await db.getAllAsync<Note>(
    'SELECT * FROM notes ORDER BY created_at DESC'
  );
  for (const n of notes) {
    if (n.book_id) {
      const book = await getBook(n.book_id);
      if (book) n.book_name = book.name_ko;
    }
  }
  return notes;
}

export async function getNote(id: number): Promise<Note | null> {
  const db = getUserDb();
  if (!db) return null;
  const note = await db.getFirstAsync<Note>('SELECT * FROM notes WHERE id = ?', [id]);
  if (note?.book_id) {
    const book = await getBook(note.book_id);
    if (book) note.book_name = book.name_ko;
  }
  return note;
}

export async function saveNote(content: string, bookId?: number, chapter?: number, verse?: number): Promise<number> {
  const db = getUserDb();
  if (!db) return -1;
  const result = await db.runAsync(
    'INSERT INTO notes (content, book_id, chapter, verse) VALUES (?, ?, ?, ?)',
    [content, bookId ?? null, chapter ?? null, verse ?? null]
  );
  return result.lastInsertRowId;
}

export async function updateNote(id: number, content: string): Promise<void> {
  const db = getUserDb();
  if (!db) return;
  await db.runAsync(
    "UPDATE notes SET content = ?, updated_at = datetime('now') WHERE id = ?",
    [content, id]
  );
}

export async function deleteNote(id: number): Promise<void> {
  const db = getUserDb();
  if (!db) return;
  await db.runAsync('DELETE FROM notes WHERE id = ?', [id]);
}

// === 하이라이트 ===

export interface Highlight {
  book_id: number;
  chapter: number;
  verse: number;
  color: string;
}

export async function getHighlights(bookId: number, chapter: number): Promise<Record<number, string>> {
  const db = getUserDb();
  if (!db) return {};
  const rows = await db.getAllAsync<Highlight>(
    'SELECT * FROM highlights WHERE book_id = ? AND chapter = ?',
    [bookId, chapter]
  );
  const map: Record<number, string> = {};
  for (const r of rows) map[r.verse] = r.color;
  return map;
}

export async function setHighlight(bookId: number, chapter: number, verse: number, color: string | null): Promise<void> {
  const db = getUserDb();
  if (!db) return;
  await db.runAsync('DELETE FROM highlights WHERE book_id = ? AND chapter = ? AND verse = ?', [bookId, chapter, verse]);
  if (color) {
    await db.runAsync('INSERT INTO highlights (book_id, chapter, verse, color) VALUES (?, ?, ?, ?)', [bookId, chapter, verse, color]);
  }
}

export async function getAllHighlights(): Promise<(Highlight & { text: string; book_name: string })[]> {
  const userDb = getUserDb();
  const bibleDb = getBibleDb();
  if (!userDb || !bibleDb) return [];

  const highlights = await userDb.getAllAsync<Highlight>('SELECT * FROM highlights ORDER BY book_id, chapter, verse');
  const result: (Highlight & { text: string; book_name: string })[] = [];

  for (const h of highlights) {
    const verse = await bibleDb.getFirstAsync<{ text: string }>(
      'SELECT text FROM verses WHERE book_id = ? AND chapter = ? AND verse = ?',
      [h.book_id, h.chapter, h.verse]
    );
    const book = await bibleDb.getFirstAsync<{ name_ko: string }>(
      'SELECT name_ko FROM books WHERE id = ?',
      [h.book_id]
    );
    if (verse && book) {
      result.push({ ...h, text: verse.text, book_name: book.name_ko });
    }
  }
  return result;
}

// === 주간 경건생활 트래킹 ===

export async function logChapterRead(date: string, bookId: number, chapter: number): Promise<void> {
  const db = getUserDb();
  if (!db) return;
  // 같은 날 같은 장 중복 방지
  const existing = await db.getFirstAsync(
    'SELECT id FROM reading_log WHERE date = ? AND book_id = ? AND chapter = ?',
    [date, bookId, chapter]
  );
  if (!existing) {
    await db.runAsync(
      'INSERT INTO reading_log (date, book_id, chapter) VALUES (?, ?, ?)',
      [date, bookId, chapter]
    );
  }
}

export async function logPrayer(date: string): Promise<void> {
  const db = getUserDb();
  if (!db) return;
  // 하루 1회만
  const existing = await db.getFirstAsync(
    'SELECT id FROM prayer_log WHERE date = ?',
    [date]
  );
  if (!existing) {
    await db.runAsync('INSERT INTO prayer_log (date) VALUES (?)', [date]);
  }
}

export async function hasPrayedToday(date: string): Promise<boolean> {
  const db = getUserDb();
  if (!db) return false;
  const row = await db.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) as c FROM prayer_log WHERE date = ?',
    [date]
  );
  return (row?.c ?? 0) > 0;
}

export async function getWeeklyChaptersRead(weekDates: string[]): Promise<number> {
  const db = getUserDb();
  if (!db) return 0;
  if (weekDates.length === 0) return 0;
  const placeholders = weekDates.map(() => '?').join(',');
  const row = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM reading_log WHERE date IN (${placeholders})`,
    weekDates
  );
  return row?.c ?? 0;
}

export async function getWeeklyPrayerCount(weekDates: string[]): Promise<number> {
  const db = getUserDb();
  if (!db) return 0;
  if (weekDates.length === 0) return 0;
  const placeholders = weekDates.map(() => '?').join(',');
  const row = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM prayer_log WHERE date IN (${placeholders})`,
    weekDates
  );
  return row?.c ?? 0;
}

export async function getDailyChaptersRead(date: string): Promise<number> {
  const db = getUserDb();
  if (!db) return 0;
  const row = await db.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) as c FROM reading_log WHERE date = ?',
    [date]
  );
  return row?.c ?? 0;
}

export async function getWeeklyDailyDetail(weekDates: string[]): Promise<{ date: string; chapters: number; prayed: boolean }[]> {
  const db = getUserDb();
  if (!db) return [];
  const result = [];
  for (const date of weekDates) {
    const chapters = await getDailyChaptersRead(date);
    const prayed = await hasPrayedToday(date);
    result.push({ date, chapters, prayed });
  }
  return result;
}

// === 기도제목 ===

export interface PrayerRequest {
  id: number;
  content: string;
  created_at: string;
  answered: number;
  answered_at: string | null;
}

export async function getAllPrayerRequests(): Promise<PrayerRequest[]> {
  const db = getUserDb();
  if (!db) return [];
  return db.getAllAsync<PrayerRequest>('SELECT * FROM prayer_requests ORDER BY answered ASC, created_at DESC');
}

export async function addPrayerRequest(content: string): Promise<void> {
  const db = getUserDb();
  if (!db) return;
  await db.runAsync('INSERT INTO prayer_requests (content) VALUES (?)', [content]);
}

export async function togglePrayerAnswered(id: number): Promise<void> {
  const db = getUserDb();
  if (!db) return;
  await db.runAsync(
    "UPDATE prayer_requests SET answered = CASE WHEN answered = 0 THEN 1 ELSE 0 END, answered_at = CASE WHEN answered = 0 THEN datetime('now') ELSE NULL END WHERE id = ?",
    [id]
  );
}

export async function deletePrayerRequest(id: number): Promise<void> {
  const db = getUserDb();
  if (!db) return;
  await db.runAsync('DELETE FROM prayer_requests WHERE id = ?', [id]);
}

// === 성경통독 체크표 ===

export interface BookProgress {
  bookId: number;
  name: string;
  testament: string;
  totalChapters: number;
  readChapters: number;
}

export async function getBibleCompletionProgress(): Promise<BookProgress[]> {
  const bibleDb = getBibleDb();
  const userDb = getUserDb();
  if (!bibleDb || !userDb) return [];

  const books = await bibleDb.getAllAsync<{ id: number; name_ko: string; testament: string; chapter_count: number }>(
    'SELECT id, name_ko, testament, chapter_count FROM books ORDER BY id'
  );

  const readRows = await userDb.getAllAsync<{ book_id: number; chapter: number }>(
    'SELECT DISTINCT book_id, chapter FROM reading_log'
  );

  const readMap = new Map<number, Set<number>>();
  for (const r of readRows) {
    if (!readMap.has(r.book_id)) readMap.set(r.book_id, new Set());
    readMap.get(r.book_id)!.add(r.chapter);
  }

  return books.map((b) => ({
    bookId: b.id,
    name: b.name_ko,
    testament: b.testament,
    totalChapters: b.chapter_count,
    readChapters: readMap.get(b.id)?.size ?? 0,
  }));
}

export async function getTotalBibleProgress(): Promise<{ read: number; total: number }> {
  const progress = await getBibleCompletionProgress();
  const read = progress.reduce((sum, b) => sum + b.readChapters, 0);
  const total = progress.reduce((sum, b) => sum + b.totalChapters, 0);
  return { read, total };
}

// 권별 회독 횟수 (모든 장을 N번 이상 읽으면 N회독)
export interface BookReadCount {
  bookId: number;
  name: string;
  completions: number; // 회독 횟수
}

export async function getBookCompletions(): Promise<BookReadCount[]> {
  const bibleDb = getBibleDb();
  const userDb = getUserDb();
  if (!bibleDb || !userDb) return [];

  const books = await bibleDb.getAllAsync<{ id: number; name_ko: string; chapter_count: number }>(
    'SELECT id, name_ko, chapter_count FROM books ORDER BY id'
  );

  // 각 장별 읽은 횟수
  const readCounts = await userDb.getAllAsync<{ book_id: number; chapter: number; cnt: number }>(
    'SELECT book_id, chapter, COUNT(*) as cnt FROM reading_log GROUP BY book_id, chapter'
  );

  const countMap = new Map<string, number>();
  for (const r of readCounts) {
    countMap.set(`${r.book_id}:${r.chapter}`, r.cnt);
  }

  return books.map((b) => {
    if (b.chapter_count === 0) return { bookId: b.id, name: b.name_ko, completions: 0 };

    // 모든 장의 읽은 횟수 중 최솟값 = 회독 횟수
    let minReads = Infinity;
    for (let ch = 1; ch <= b.chapter_count; ch++) {
      const cnt = countMap.get(`${b.id}:${ch}`) ?? 0;
      minReads = Math.min(minReads, cnt);
    }

    return { bookId: b.id, name: b.name_ko, completions: minReads === Infinity ? 0 : minReads };
  }).filter((b) => b.completions > 0);
}

// === 가족 게시판 ===

export interface BoardPost {
  id: number;
  author: string;
  title: string;
  content: string;
  category: string;
  created_at: string;
  views: number;
  likes: number;
  comment_count?: number;
}

export interface BoardComment {
  id: number;
  post_id: number;
  author: string;
  content: string;
  created_at: string;
}

export async function getAllPosts(category?: string): Promise<BoardPost[]> {
  const db = getUserDb();
  if (!db) return [];
  const query = category && category !== 'all'
    ? 'SELECT p.*, (SELECT COUNT(*) FROM board_comments c WHERE c.post_id = p.id) as comment_count FROM board_posts p WHERE p.category = ? ORDER BY p.created_at DESC'
    : 'SELECT p.*, (SELECT COUNT(*) FROM board_comments c WHERE c.post_id = p.id) as comment_count FROM board_posts p ORDER BY p.created_at DESC';
  const params = category && category !== 'all' ? [category] : [];
  return db.getAllAsync<BoardPost>(query, params);
}

export async function getPost(id: number): Promise<BoardPost | null> {
  const db = getUserDb();
  if (!db) return null;
  await db.runAsync('UPDATE board_posts SET views = views + 1 WHERE id = ?', [id]);
  return db.getFirstAsync<BoardPost>(
    'SELECT p.*, (SELECT COUNT(*) FROM board_comments c WHERE c.post_id = p.id) as comment_count FROM board_posts p WHERE p.id = ?',
    [id]
  );
}

export async function createPost(author: string, title: string, content: string, category: string): Promise<void> {
  const db = getUserDb();
  if (!db) return;
  await db.runAsync(
    'INSERT INTO board_posts (author, title, content, category) VALUES (?, ?, ?, ?)',
    [author, title, content, category]
  );
}

export async function likePost(id: number): Promise<void> {
  const db = getUserDb();
  if (!db) return;
  await db.runAsync('UPDATE board_posts SET likes = likes + 1 WHERE id = ?', [id]);
}

export async function deletePost(id: number): Promise<void> {
  const db = getUserDb();
  if (!db) return;
  await db.runAsync('DELETE FROM board_comments WHERE post_id = ?', [id]);
  await db.runAsync('DELETE FROM board_posts WHERE id = ?', [id]);
}

export async function getComments(postId: number): Promise<BoardComment[]> {
  const db = getUserDb();
  if (!db) return [];
  return db.getAllAsync<BoardComment>(
    'SELECT * FROM board_comments WHERE post_id = ? ORDER BY created_at ASC',
    [postId]
  );
}

export async function addComment(postId: number, author: string, content: string): Promise<void> {
  const db = getUserDb();
  if (!db) return;
  await db.runAsync(
    'INSERT INTO board_comments (post_id, author, content) VALUES (?, ?, ?)',
    [postId, author, content]
  );
}
