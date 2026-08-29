import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';

let bibleDb: SQLite.SQLiteDatabase | null = null;
let userDb: SQLite.SQLiteDatabase | null = null;

export async function initDatabases(): Promise<void> {
  if (Platform.OS === 'web') {
    console.warn('SQLite is not supported on web');
    return;
  }

  // user.db first: personal records must not depend on the bible asset copy succeeding
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
      color TEXT DEFAULT '#7D8B75'
    );

    CREATE TABLE IF NOT EXISTS reading_history (
      date TEXT PRIMARY KEY,
      completed INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      type TEXT NOT NULL CHECK(type IN ('moment','media','writing','meal','workout')),
      media_kind TEXT,
      title TEXT,
      quote TEXT,
      body TEXT,
      link TEXT,
      photo_uri TEXT,
      minutes INTEGER,
      meal_slot TEXT,
      pinned INTEGER NOT NULL DEFAULT 0,
      tags TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
    CREATE INDEX IF NOT EXISTS idx_entries_type ON entries(type, media_kind);

    CREATE TABLE IF NOT EXISTS day_logs (
      date TEXT PRIMARY KEY,
      day_title TEXT,
      workout_done INTEGER NOT NULL DEFAULT 0,
      diet_kept INTEGER
    );

    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      content TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_todos_date ON todos(date);
  `);

  // Bible database: copied from bundled assets on first launch.
  // SDK 54 moved the callback file-system API to 'expo-file-system/legacy'.
  try {
    const FileSystem = require('expo-file-system/legacy');
    const { Asset } = require('expo-asset');

    const bibleDbPath = `${FileSystem.documentDirectory}bible.db`;
    const fileInfo = await FileSystem.getInfoAsync(bibleDbPath);
    if (!fileInfo.exists) {
      const asset = Asset.fromModule(require('../assets/bible/bible.db'));
      await asset.downloadAsync();
      if (asset.localUri) {
        await FileSystem.copyAsync({ from: asset.localUri, to: bibleDbPath });
      }
    }
    bibleDb = await SQLite.openDatabaseAsync('bible.db');
  } catch (e) {
    console.warn('Bible DB init failed:', e);
  }
}

export function getBibleDb(): SQLite.SQLiteDatabase | null {
  return bibleDb;
}

export function getUserDb(): SQLite.SQLiteDatabase | null {
  return userDb;
}
