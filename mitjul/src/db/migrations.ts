import { type SQLiteDatabase } from 'expo-sqlite';
import { canonicalLinkUrl } from '../core/links';

// PRAGMA user_version 기반 버전드 마이그레이션.
// 새 버전은 배열 끝에만 추가한다 — 이미 배포된 버전의 SQL은 절대 수정하지 않는다.

interface Migration {
  version: number;
  sql: string;
  after?: (db: SQLiteDatabase) => Promise<void>; // SQL만으로 안 되는 정리 — 같은 트랜잭션 안에서
}

// 링크로 출처를 찾으려면 저장된 링크가 정규형이어야 한다. 이전 판이 남긴 원본 링크를 정규형으로 고치고,
// 같은 영상이 둘이면 최근 것에 합친다 (기록의 링크는 시점을 지닌 채 그대로 둔다).
async function canonicalizeVideoSources(db: SQLiteDatabase): Promise<void> {
  const rows = await db.getAllAsync<{ id: string; url: string }>(
    "SELECT id, url FROM sources WHERE kind = 'video' AND url IS NOT NULL AND url != '' AND deleted_at IS NULL ORDER BY last_used_at DESC"
  );
  const survivors = new Map<string, string>();
  const now = Date.now();
  for (const r of rows) {
    const canon = canonicalLinkUrl(r.url);
    const survivor = survivors.get(canon);
    if (survivor) {
      await db.runAsync('UPDATE entries SET source_id = ? WHERE source_id = ?', [survivor, r.id]);
      await db.runAsync('UPDATE sources SET deleted_at = ? WHERE id = ?', [now, r.id]);
      continue;
    }
    survivors.set(canon, r.id);
    if (canon !== r.url) await db.runAsync('UPDATE sources SET url = ? WHERE id = ?', [canon, r.id]);
  }
}

export const MIGRATIONS: Migration[] = [
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
  {
    // 영상 출처는 링크를 지닌다. 출처 없이 남긴 옛 책·영상 기록은 같은 제목의 출처에 잇고,
    // 없으면 (유형, 제목)마다 출처를 하나 만든다 — 업그레이드 뒤 서가가 비어 있지 않도록.
    version: 3,
    sql: `
      ALTER TABLE sources ADD COLUMN url TEXT;

      UPDATE entries SET source_id = (
        SELECT s.id FROM sources s
        WHERE s.kind = entries.type AND s.title = entries.title AND s.deleted_at IS NULL
        ORDER BY s.last_used_at DESC LIMIT 1
      )
      WHERE source_id IS NULL AND type IN ('book','video') AND title IS NOT NULL AND title != '';

      INSERT INTO sources (id, kind, title, creator, created_at, last_used_at, last_tags)
        SELECT lower(hex(randomblob(8))), type, title, MAX(subtitle), MIN(created_at), MAX(created_at), ''
        FROM entries
        WHERE source_id IS NULL AND type IN ('book','video')
          AND title IS NOT NULL AND title != '' AND deleted_at IS NULL
        GROUP BY type, title;

      UPDATE entries SET source_id = (
        SELECT s.id FROM sources s
        WHERE s.kind = entries.type AND s.title = entries.title AND s.deleted_at IS NULL
        ORDER BY s.last_used_at DESC LIMIT 1
      )
      WHERE source_id IS NULL AND type IN ('book','video') AND title IS NOT NULL AND title != '';

      UPDATE sources SET url = (
        SELECT e.url FROM entries e
        WHERE e.source_id = sources.id AND e.url IS NOT NULL AND e.url != ''
        ORDER BY e.created_at DESC LIMIT 1
      )
      WHERE kind = 'video' AND url IS NULL;
    `,
  },
  {
    // 링크를 붙여넣으면 썸네일이 뜬다 — 출처가 내려받아 둔 썸네일을 지니고, 링크로 출처를 찾는다
    version: 4,
    sql: `
      ALTER TABLE sources ADD COLUMN thumbnail_uri TEXT;
      CREATE INDEX idx_sources_url ON sources (kind, url);
    `,
  },
  {
    // v3가 지워진 메모의 링크를 출처에 옮겨 둔 것을 살아 있는 메모의 링크로 바로잡고,
    // 영상 출처의 링크를 정규형으로 고친다 (붙여넣은 링크로 출처를 찾을 수 있도록)
    version: 5,
    sql: `
      UPDATE sources SET url = (
        SELECT e.url FROM entries e
        WHERE e.source_id = sources.id AND e.deleted_at IS NULL AND e.url IS NOT NULL AND e.url != ''
        ORDER BY e.created_at DESC LIMIT 1
      )
      WHERE kind = 'video' AND deleted_at IS NULL AND url IS NOT NULL
        AND EXISTS (SELECT 1 FROM entries d WHERE d.source_id = sources.id AND d.deleted_at IS NOT NULL AND d.url = sources.url)
        AND NOT EXISTS (SELECT 1 FROM entries l WHERE l.source_id = sources.id AND l.deleted_at IS NULL AND l.url = sources.url);
    `,
    after: canonicalizeVideoSources,
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
      if (m.after) await m.after(db);
      await db.execAsync(`PRAGMA user_version = ${m.version};`);
    });
  }
}
