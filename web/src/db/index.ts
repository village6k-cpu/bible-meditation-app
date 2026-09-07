import { migrate } from '@db/migrations';
import type { SQLiteDatabase } from 'expo-sqlite';
import { openDb, type WebDb } from './sqlite';

// 네이티브 앱의 db 레이어를 그대로 쓴다 — 여는 방법만 브라우저 것으로.
let ready: Promise<WebDb> | null = null;

export function db(): Promise<WebDb> {
  if (!ready) {
    ready = (async () => {
      const d = await openDb();
      await migrate(d as unknown as SQLiteDatabase);
      await d.flush();
      return d;
    })();
  }
  return ready;
}

// 리포지토리 함수들이 기대하는 타입으로 건네준다 (인터페이스가 같다)
export const asSqlite = (d: WebDb) => d as unknown as SQLiteDatabase;
