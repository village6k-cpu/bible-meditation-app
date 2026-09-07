import { type SQLiteDatabase } from 'expo-sqlite';

// PRAGMA user_version 기반 버전드 마이그레이션.
// 새 버전은 배열 끝에만 추가한다 — 이미 배포된 버전의 SQL은 절대 수정하지 않는다.

interface Migration {
  version: number;
  sql: string;
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE entries (
        id                TEXT PRIMARY KEY,
        type              TEXT NOT NULL CHECK (type IN ('book','video','verse','meal','workout','moment','writing','task')),
        day               TEXT NOT NULL,
        created_at        INTEGER NOT NULL,
        updated_at        INTEGER NOT NULL,
        deleted_at        INTEGER,
        pinned            INTEGER NOT NULL DEFAULT 0,
        revisit_count     INTEGER NOT NULL DEFAULT 0,
        last_revisited_at INTEGER,
        title             TEXT,
        subtitle          TEXT,
        quote             TEXT,
        body              TEXT,
        url               TEXT,
        image_uri         TEXT,
        page              INTEGER,
        slot              TEXT CHECK (slot IN ('breakfast','lunch','dinner','snack')),
        minutes           INTEGER,
        practiced         INTEGER,
        done              INTEGER,
        due_time          TEXT
      );
      CREATE INDEX idx_entries_day      ON entries (day DESC, created_at);
      CREATE INDEX idx_entries_type_day ON entries (type, day DESC);
      CREATE INDEX idx_entries_pinned   ON entries (pinned) WHERE pinned = 1;
      CREATE INDEX idx_entries_annday   ON entries (substr(day, 6));

      CREATE TABLE tags (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE entry_tags (
        entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
        tag_id   TEXT NOT NULL REFERENCES tags(id)    ON DELETE CASCADE,
        PRIMARY KEY (entry_id, tag_id)
      );
      CREATE INDEX idx_entry_tags_tag ON entry_tags (tag_id);

      CREATE TABLE resurfacings (
        entry_id  TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
        shown_day TEXT NOT NULL,
        reaction  TEXT CHECK (reaction IN ('kept','skipped','retired')),
        PRIMARY KEY (entry_id, shown_day)
      );
      CREATE INDEX idx_resurfacings_day ON resurfacings (shown_day DESC);

      CREATE TABLE settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `,
  },
  {
    // 출처 — 책·영상은 한 번만 등록하고 밑줄은 출처에 매달린다
    version: 2,
    sql: `
      CREATE TABLE sources (
        id           TEXT PRIMARY KEY,
        kind         TEXT NOT NULL CHECK (kind IN ('book','video')),
        title        TEXT NOT NULL,
        creator      TEXT,
        created_at   INTEGER NOT NULL,
        last_used_at INTEGER NOT NULL,
        last_tags    TEXT NOT NULL DEFAULT '',
        deleted_at   INTEGER
      );
      CREATE INDEX idx_sources_kind_used ON sources (kind, last_used_at DESC);
      ALTER TABLE entries ADD COLUMN source_id TEXT REFERENCES sources(id);
      CREATE INDEX idx_entries_source ON entries (source_id);
    `,
  },
];

export async function migrate(db: SQLiteDatabase): Promise<void> {
  // WAL은 트랜잭션 밖에서, foreign_keys는 커넥션마다
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  for (const m of MIGRATIONS) {
    if (m.version <= current) continue;
    await db.withTransactionAsync(async () => {
      await db.execAsync(m.sql);
      await db.execAsync(`PRAGMA user_version = ${m.version};`);
    });
  }
}
