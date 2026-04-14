import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';

let bibleDb: SQLite.SQLiteDatabase | null = null;
let userDb: SQLite.SQLiteDatabase | null = null;

export async function initDatabases(): Promise<void> {
  if (Platform.OS === 'web') {
    console.warn('SQLite is not supported on web');
    return;
  }

  const FileSystem = require('expo-file-system');
  const { Asset } = require('expo-asset');

  // 1. 먼저 빈 DB를 열어서 expo-sqlite가 사용하는 실제 경로를 확인
  const tempDb = await SQLite.openDatabaseAsync('bible.db');
  const nativePath = (tempDb as any).databasePath as string;
  console.log('expo-sqlite DB path:', nativePath);

  // 2. books 테이블이 있는지 확인 (이미 복사됐는지 체크)
  let needsCopy = false;
  try {
    const row = await tempDb.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM books');
    console.log('Bible books count:', row?.c);
    needsCopy = !row || row.c === 0;
  } catch {
    // 테이블이 없음 = 빈 DB
    needsCopy = true;
  }

  if (needsCopy) {
    // 3. 닫고, 에셋을 해당 경로에 덮어쓰기
    await tempDb.closeAsync();

    const asset = Asset.fromModule(require('../assets/bible/bible.db'));
    await asset.downloadAsync();

    if (asset.localUri) {
      const targetUri = nativePath.startsWith('file://') ? nativePath : `file://${nativePath}`;
      console.log('Copying bible.db from:', asset.localUri, 'to:', targetUri);
      await FileSystem.copyAsync({ from: asset.localUri, to: targetUri });
    }

    // 4. 다시 열기
    bibleDb = await SQLite.openDatabaseAsync('bible.db');

    // 검증
    try {
      const row = await bibleDb.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM books');
      console.log('After copy - Bible books count:', row?.c);
    } catch (e) {
      console.error('Bible DB still empty after copy:', e);
    }
  } else {
    bibleDb = tempDb;
  }

  userDb = await SQLite.openDatabaseAsync('user.db');

  // Create user tables
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
  `);
}

export function getBibleDb(): SQLite.SQLiteDatabase | null {
  return bibleDb;
}

export function getUserDb(): SQLite.SQLiteDatabase | null {
  return userDb;
}
