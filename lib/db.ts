import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';

let bibleDb: SQLite.SQLiteDatabase | null = null;
let userDb: SQLite.SQLiteDatabase | null = null;

export async function initDatabases(): Promise<void> {
  if (Platform.OS === 'web') {
    console.warn('SQLite is not supported on web');
    return;
  }

  // Copy bible.db from assets to expo-sqlite's default directory
  const FileSystem = require('expo-file-system');
  const { Asset } = require('expo-asset');

  const sqliteDir = `${FileSystem.documentDirectory}SQLite`;
  const bibleDbPath = `${sqliteDir}/bible.db`;

  const dirInfo = await FileSystem.getInfoAsync(sqliteDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
  }

  const fileInfo = await FileSystem.getInfoAsync(bibleDbPath);
  if (!fileInfo.exists) {
    const asset = Asset.fromModule(require('../assets/bible/bible.db'));
    await asset.downloadAsync();
    if (asset.localUri) {
      await FileSystem.copyAsync({ from: asset.localUri, to: bibleDbPath });
    }
  }

  bibleDb = await SQLite.openDatabaseAsync('bible.db');
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
