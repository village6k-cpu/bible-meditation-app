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
    })().catch((error: unknown) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

// 자체 점검용 별도 파일. 점검이 진짜 기록함에 줄을 남기면 그건 점검이 아니라 오염이다.
export async function openScratchDb(name: string): Promise<WebDb> {
  const d = await openDb(name);
  await migrate(d as unknown as SQLiteDatabase);
  return d;
}

// 백업을 되돌린 뒤에는 반드시 다시 올린다 — 옛 빌드에서 만든 파일은 스키마가 낮을 수 있고,
// migrate는 user_version을 보고 건너뛰므로 여러 번 불러도 안전하다.
export async function restoreAndMigrate(d: WebDb, bytes: Uint8Array<ArrayBuffer>): Promise<void> {
  await d.restore(bytes);
  await migrate(d as unknown as SQLiteDatabase);
  await d.flush();
}

// 리포지토리 함수들이 기대하는 타입으로 건네준다 (인터페이스가 같다)
export const asSqlite = (d: WebDb) => d as unknown as SQLiteDatabase;
