// node:sqlite 위에 expo-sqlite의 비동기 인터페이스를 얹은 테스트용 얇은 껍데기 —
// 마이그레이션·리포지토리를 실제 SQLite에서 돌려 본다.
import { DatabaseSync } from 'node:sqlite';

export class FakeDb {
  private db = new DatabaseSync(':memory:');
  async execAsync(sql: string): Promise<void> {
    this.db.exec(sql);
  }
  // node:sqlite는 프로토타입 없는 객체를 돌려준다 — deepEqual이 헷갈리지 않게 보통 객체로
  async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const row = this.db.prepare(sql).get(...(params as never[])) as T | undefined;
    return row ? ({ ...row } as T) : null;
  }
  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return (this.db.prepare(sql).all(...(params as never[])) as T[]).map((r) => ({ ...r }));
  }
  async runAsync(sql: string, params: unknown[] = []): Promise<void> {
    this.db.prepare(sql).run(...(params as never[]));
  }
  async withTransactionAsync(fn: () => Promise<void>): Promise<void> {
    this.db.exec('BEGIN');
    try {
      await fn();
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  raw(): DatabaseSync {
    return this.db;
  }
}

// 어떤 버전까지의 스키마만 깔아 두고(옛 판의 DB를 흉내), 그 위에 옛 기록을 심는다
export async function schemaUpTo(db: FakeDb, version: number, migrations: { version: number; sql: string }[]) {
  for (const m of migrations) {
    if (m.version > version) break;
    await db.execAsync(m.sql);
  }
  await db.execAsync(`PRAGMA user_version = ${version};`);
}
