import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { File, Paths } from 'expo-file-system/next';

let bibleDb: SQLite.SQLiteDatabase | null = null;
let userDb: SQLite.SQLiteDatabase | null = null;

export async function initDatabases(): Promise<void> {
  if (Platform.OS === 'web') {
    console.warn('SQLite is not supported on web');
    return;
  }

  const { Asset } = require('expo-asset');

  // 1. 빈 DB 열어서 expo-sqlite 실제 경로 확인
  const tempDb = await SQLite.openDatabaseAsync('bible.db');
  const dbPath = (tempDb as any).databasePath as string;
  console.log('expo-sqlite DB path:', dbPath);

  // 2. books 테이블 존재 확인
  let needsCopy = false;
  try {
    const row = await tempDb.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM books');
    needsCopy = !row || row.c === 0;
  } catch {
    needsCopy = true;
  }

  if (needsCopy) {
    await tempDb.closeAsync();

    // 3. 에셋 다운로드
    const asset = Asset.fromModule(require('../assets/bible/bible.db'));
    await asset.downloadAsync();

    if (asset.localUri) {
      console.log('Asset localUri:', asset.localUri);
      console.log('Target path:', dbPath);

      // 새 File API로 빈 DB 삭제 후 복사
      try {
        const targetFile = new File(dbPath);
        if (targetFile.exists) {
          targetFile.delete();
        }

        const sourceUri = asset.localUri.replace('file://', '');
        const sourceFile = new File(sourceUri);
        sourceFile.copy(targetFile);
        console.log('bible.db copied successfully');
      } catch (e) {
        console.error('File copy failed:', e);
      }
    }

    bibleDb = await SQLite.openDatabaseAsync('bible.db');

    try {
      const row = await bibleDb.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM books');
      console.log('Bible books count:', row?.c);
    } catch (e) {
      console.error('Bible DB still empty:', e);
    }
  } else {
    bibleDb = tempDb;
    console.log('Bible DB already loaded');
  }

  userDb = await SQLite.openDatabaseAsync('user.db');

  await userDb.execAsync(`
    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY DEFAULT 1,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      book_id INTEGER NOT NULL,
      start_chapter INTEGER NOT NULL,
      end_chapter INTEGER NOT NULL,
      completed INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      book_id INTEGER,
      chapter INTEGER,
      verse INTEGER,
      content TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS highlights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      color TEXT DEFAULT '#C15F3C'
    );

    CREATE TABLE IF NOT EXISTS reading_history (
      date TEXT PRIMARY KEY,
      completed INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS reading_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      book_id INTEGER NOT NULL,
      chapter INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS prayer_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS weekly_goals (
      id INTEGER PRIMARY KEY DEFAULT 1,
      reading_chapters INTEGER NOT NULL DEFAULT 10,
      prayer_count INTEGER NOT NULL DEFAULT 4
    );

    INSERT OR IGNORE INTO weekly_goals (id, reading_chapters, prayer_count) VALUES (1, 10, 4);

    CREATE TABLE IF NOT EXISTS prayer_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      answered INTEGER DEFAULT 0,
      answered_at TEXT
    );
  `);
}

export function getBibleDb(): SQLite.SQLiteDatabase | null {
  return bibleDb;
}

export function getUserDb(): SQLite.SQLiteDatabase | null {
  return userDb;
}
