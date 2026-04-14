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

  // expo-sqlite가 실제로 사용하는 디렉토리
  const nativeDir: string = (SQLite as any).defaultDatabaseDirectory ?? '';
  // FileSystem은 file:// URI를 사용하므로 변환
  const dirUri = nativeDir.startsWith('file://') ? nativeDir : `file://${nativeDir}`;
  const bibleDbUri = `${dirUri}/bible.db`;

  // bible.db를 expo-sqlite 디렉토리에 복사
  try {
    const fileInfo = await FileSystem.getInfoAsync(bibleDbUri);
    if (!fileInfo.exists) {
      // 디렉토리 확인/생성
      try {
        const dirInfo = await FileSystem.getInfoAsync(dirUri);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true });
        }
      } catch {}

      const asset = Asset.fromModule(require('../assets/bible/bible.db'));
      await asset.downloadAsync();
      if (asset.localUri) {
        await FileSystem.copyAsync({ from: asset.localUri, to: bibleDbUri });
        console.log('bible.db copied to:', bibleDbUri);
      }
    }
  } catch (e) {
    console.warn('Failed to copy bible.db:', e);
  }

  bibleDb = await SQLite.openDatabaseAsync('bible.db');
  userDb = await SQLite.openDatabaseAsync('user.db');

  // Verify bible DB has data
  try {
    const row = await bibleDb.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM books');
    console.log('Bible DB books count:', row?.c);
  } catch (e) {
    console.warn('Bible DB verification failed:', e);
  }

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
