import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

const DB_PATH = path.join(__dirname, '..', 'assets', 'bible', 'bible.db');
const CSV_PATH = path.join(__dirname, 'KorRV.csv');
const BOOKS_PATH = path.join(__dirname, 'book-names-ko.json');
const SECTIONS_PATH = path.join(__dirname, 'sections-ko.json');

// Ensure output directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// Remove existing DB
if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

const db = new Database(DB_PATH);

// Create tables
db.exec(`
  CREATE TABLE books (
    id INTEGER PRIMARY KEY,
    name_ko TEXT NOT NULL,
    name_abbr TEXT NOT NULL,
    testament TEXT NOT NULL,
    chapter_count INTEGER NOT NULL
  );

  CREATE TABLE verses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL REFERENCES books(id),
    chapter INTEGER NOT NULL,
    verse INTEGER NOT NULL,
    text TEXT NOT NULL
  );

  CREATE TABLE sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL REFERENCES books(id),
    chapter INTEGER NOT NULL,
    start_verse INTEGER NOT NULL,
    end_verse INTEGER NOT NULL,
    title TEXT
  );

  CREATE INDEX idx_verses_book_chapter ON verses(book_id, chapter);
  CREATE INDEX idx_sections_book_chapter ON sections(book_id, chapter);
`);

// Insert books and build English→ID map
const books: Array<{ id: number; name_en: string; name_ko: string; name_abbr: string; testament: string; chapter_count: number }> =
  JSON.parse(fs.readFileSync(BOOKS_PATH, 'utf-8'));

const nameToId = new Map<string, number>();
const insertBook = db.prepare('INSERT INTO books (id, name_ko, name_abbr, testament, chapter_count) VALUES (?, ?, ?, ?, ?)');
for (const book of books) {
  insertBook.run(book.id, book.name_ko, book.name_abbr, book.testament, book.chapter_count);
  nameToId.set(book.name_en, book.id);
}
console.log(`Inserted ${books.length} books`);

// Parse CSV and insert verses
const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
const lines = csvContent.split('\n').slice(1); // skip header

const insertVerse = db.prepare('INSERT INTO verses (book_id, chapter, verse, text) VALUES (?, ?, ?, ?)');

let verseCount = 0;
const insertVerses = db.transaction(() => {
  for (const line of lines) {
    if (!line.trim()) continue;
    // CSV format: Book,Chapter,Verse,Text
    // Text may contain commas, so only split first 3 commas
    const firstComma = line.indexOf(',');
    const secondComma = line.indexOf(',', firstComma + 1);
    const thirdComma = line.indexOf(',', secondComma + 1);

    const bookName = line.substring(0, firstComma);
    const chapter = parseInt(line.substring(firstComma + 1, secondComma));
    const verse = parseInt(line.substring(secondComma + 1, thirdComma));
    const text = line.substring(thirdComma + 1).trim();

    const bookId = nameToId.get(bookName);
    if (!bookId) {
      console.warn(`Unknown book: ${bookName}`);
      continue;
    }

    insertVerse.run(bookId, chapter, verse, text);
    verseCount++;
  }
});
insertVerses();
console.log(`Inserted ${verseCount} verses`);

// Insert sections
const sections: Array<{ book_id: number; chapter: number; start_verse: number; end_verse: number; title: string }> =
  JSON.parse(fs.readFileSync(SECTIONS_PATH, 'utf-8'));

const insertSection = db.prepare('INSERT INTO sections (book_id, chapter, start_verse, end_verse, title) VALUES (?, ?, ?, ?, ?)');
for (const s of sections) {
  insertSection.run(s.book_id, s.chapter, s.start_verse, s.end_verse, s.title);
}
console.log(`Inserted ${sections.length} sections`);

db.close();
console.log(`Bible DB created at ${DB_PATH}`);
