import { type SQLiteDatabase } from 'expo-sqlite';
import { canonicalLinkUrl } from '../core/links';

// PRAGMA user_version 기반 버전드 마이그레이션.
// 새 버전은 배열 끝에만 추가한다 — 이미 배포된 버전의 SQL은 절대 수정하지 않는다.

interface Migration {
  version: number;
  sql: string;
  after?: (db: SQLiteDatabase) => Promise<void>; // SQL만으로 안 되는 정리 — 같은 트랜잭션 안에서
  // 테이블을 다시 지어야 하는 마이그레이션 (CHECK 제약 변경 등).
  // 참조하는 테이블을 드롭하는 동안 외래 키가 켜져 있으면 자식 행이 함께 지워지므로 잠시 끈다.
  rebuild?: boolean;
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
  {
    // 영상과 글을 '링크' 하나로 합친다 — 인터넷에서 본 것은 형식이 아니라 출처의 종류로 갈린다.
    // 그리고 filed_at: 구조가 붙었는지를 앱이 판단해 검토 큐를 만든다.
    // CHECK 제약을 바꾸려면 테이블을 다시 지어야 한다 (SQLite).
    version: 6,
    rebuild: true,
    sql: `
      CREATE TABLE sources_new (
        id            TEXT PRIMARY KEY,
        kind          TEXT NOT NULL CHECK (kind IN ('book','video','article')),
        title         TEXT NOT NULL,
        creator       TEXT,
        url           TEXT,
        thumbnail_uri TEXT,
        created_at    INTEGER NOT NULL,
        last_used_at  INTEGER NOT NULL,
        last_tags     TEXT NOT NULL DEFAULT '',
        deleted_at    INTEGER
      );
      INSERT INTO sources_new (id, kind, title, creator, url, thumbnail_uri, created_at, last_used_at, last_tags, deleted_at)
        SELECT id, kind, title, creator, url, thumbnail_uri, created_at, last_used_at, last_tags, deleted_at FROM sources;
      DROP TABLE sources;
      ALTER TABLE sources_new RENAME TO sources;
      CREATE INDEX idx_sources_kind_used ON sources (kind, last_used_at DESC);
      CREATE INDEX idx_sources_url ON sources (kind, url);

      CREATE TABLE entries_new (
        id                TEXT PRIMARY KEY,
        type              TEXT NOT NULL CHECK (type IN ('book','link','verse','meal','workout','moment','writing','task')),
        day               TEXT NOT NULL,
        created_at        INTEGER NOT NULL,
        updated_at        INTEGER NOT NULL,
        deleted_at        INTEGER,
        pinned            INTEGER NOT NULL DEFAULT 0,
        revisit_count     INTEGER NOT NULL DEFAULT 0,
        last_revisited_at INTEGER,
        filed_at          INTEGER,
        source_id         TEXT REFERENCES sources(id),
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
      INSERT INTO entries_new (id, type, day, created_at, updated_at, deleted_at, pinned, revisit_count,
                               last_revisited_at, filed_at, source_id, title, subtitle, quote, body, url,
                               image_uri, page, slot, minutes, practiced, done, due_time)
        SELECT id,
               CASE WHEN type = 'video' THEN 'link' ELSE type END,
               day, created_at, updated_at, deleted_at, pinned, revisit_count, last_revisited_at,
               NULL, source_id, title, subtitle, quote, body, url, image_uri, page, slot, minutes,
               practiced, done, due_time
        FROM entries;
      DROP TABLE entries;
      ALTER TABLE entries_new RENAME TO entries;
      CREATE INDEX idx_entries_day      ON entries (day DESC, created_at);
      CREATE INDEX idx_entries_type_day ON entries (type, day DESC);
      CREATE INDEX idx_entries_pinned   ON entries (pinned) WHERE pinned = 1;
      CREATE INDEX idx_entries_annday   ON entries (substr(day, 6));
      CREATE INDEX idx_entries_source   ON entries (source_id);
      CREATE INDEX idx_entries_filed    ON entries (filed_at) WHERE filed_at IS NULL;

      -- 이미 구조가 붙은(출처나 태그가 있는) 옛 기록은 검토 큐에 올리지 않는다
      UPDATE entries SET filed_at = updated_at
        WHERE source_id IS NOT NULL
           OR id IN (SELECT entry_id FROM entry_tags);
    `,
  },
  {
    // 기기 간 동기화는 앱의 표를 그대로 복제하되, 기기 전용 설정은 보내지 않는다.
    // 트리거가 변경 대상을 한 건으로 합쳐 두면 오프라인에서 오래 쓴 뒤에도 전송량이 불어나지 않는다.
    version: 7,
    sql: `
      CREATE TABLE sync_control (
        id              INTEGER PRIMARY KEY CHECK (id = 1),
        applying_remote INTEGER NOT NULL DEFAULT 0 CHECK (applying_remote IN (0, 1))
      );
      INSERT INTO sync_control (id, applying_remote) VALUES (1, 0);

      CREATE TABLE sync_meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      INSERT INTO sync_meta (key, value) VALUES ('remote_cursor', '0');

      CREATE TABLE sync_changes (
        entity_type TEXT NOT NULL,
        entity_id   TEXT NOT NULL,
        operation   TEXT NOT NULL CHECK (operation IN ('upsert', 'delete')),
        changed_at  INTEGER NOT NULL,
        PRIMARY KEY (entity_type, entity_id)
      );
      CREATE INDEX idx_sync_changes_changed ON sync_changes (changed_at, entity_type, entity_id);

      -- 사진 파일은 OPFS와 Google Photos에 두고, 동기화 DB에는 안정적인 media item ID만 둔다.
      CREATE TABLE photo_links (
        photo_uri     TEXT PRIMARY KEY,
        media_item_id TEXT NOT NULL,
        album_id      TEXT NOT NULL,
        created_at    INTEGER NOT NULL,
        updated_at    INTEGER NOT NULL
      );

      -- 업로드·다운로드 실패는 기록 저장과 분리해 다시 시도한다. 이 표 자체는 기기 밖으로 보내지 않는다.
      CREATE TABLE photo_jobs (
        photo_uri  TEXT PRIMARY KEY,
        action     TEXT NOT NULL CHECK (action IN ('upload', 'download')),
        state      TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'running', 'failed')),
        attempts   INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX idx_photo_jobs_state ON photo_jobs (state, updated_at);

      CREATE TRIGGER sync_entries_insert AFTER INSERT ON entries
      WHEN (SELECT applying_remote FROM sync_control WHERE id = 1) = 0
      BEGIN
        INSERT INTO sync_changes VALUES ('entries', NEW.id, 'upsert', unixepoch('subsec') * 1000)
        ON CONFLICT(entity_type, entity_id) DO UPDATE SET operation = 'upsert', changed_at = sync_changes.changed_at + 1;
      END;
      CREATE TRIGGER sync_entries_update AFTER UPDATE ON entries
      WHEN (SELECT applying_remote FROM sync_control WHERE id = 1) = 0
      BEGIN
        INSERT INTO sync_changes VALUES ('entries', NEW.id, 'upsert', unixepoch('subsec') * 1000)
        ON CONFLICT(entity_type, entity_id) DO UPDATE SET operation = 'upsert', changed_at = sync_changes.changed_at + 1;
      END;
      CREATE TRIGGER sync_entries_delete AFTER DELETE ON entries
      WHEN (SELECT applying_remote FROM sync_control WHERE id = 1) = 0
      BEGIN
        INSERT INTO sync_changes VALUES ('entries', OLD.id, 'delete', unixepoch('subsec') * 1000)
        ON CONFLICT(entity_type, entity_id) DO UPDATE SET operation = 'delete', changed_at = sync_changes.changed_at + 1;
      END;

      CREATE TRIGGER photo_job_entries_insert AFTER INSERT ON entries
      WHEN (SELECT applying_remote FROM sync_control WHERE id = 1) = 0
        AND NEW.deleted_at IS NULL AND NEW.image_uri LIKE 'photos/%'
      BEGIN
        INSERT INTO photo_jobs (photo_uri, action, state, attempts, last_error, updated_at)
        VALUES (NEW.image_uri, 'upload', 'pending', 0, NULL, unixepoch('subsec') * 1000)
        ON CONFLICT(photo_uri) DO UPDATE SET action = 'upload', state = 'pending', attempts = 0,
          last_error = NULL, updated_at = excluded.updated_at;
      END;
      CREATE TRIGGER photo_job_entries_update AFTER UPDATE ON entries
      WHEN (SELECT applying_remote FROM sync_control WHERE id = 1) = 0
        AND NEW.deleted_at IS NULL AND NEW.image_uri LIKE 'photos/%'
        AND (OLD.image_uri IS NOT NEW.image_uri OR OLD.deleted_at IS NOT NULL)
      BEGIN
        INSERT INTO photo_jobs (photo_uri, action, state, attempts, last_error, updated_at)
        VALUES (NEW.image_uri, 'upload', 'pending', 0, NULL, unixepoch('subsec') * 1000)
        ON CONFLICT(photo_uri) DO UPDATE SET action = 'upload', state = 'pending', attempts = 0,
          last_error = NULL, updated_at = excluded.updated_at;
      END;
      CREATE TRIGGER photo_unlink_entries_update AFTER UPDATE ON entries
      WHEN (SELECT applying_remote FROM sync_control WHERE id = 1) = 0
        AND OLD.image_uri LIKE 'photos/%'
        AND (OLD.image_uri IS NOT NEW.image_uri OR (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL))
      BEGIN
        DELETE FROM photo_jobs WHERE photo_uri = OLD.image_uri
          AND NOT EXISTS (SELECT 1 FROM entries WHERE deleted_at IS NULL AND image_uri = OLD.image_uri);
        DELETE FROM photo_links WHERE photo_uri = OLD.image_uri
          AND NOT EXISTS (SELECT 1 FROM entries WHERE deleted_at IS NULL AND image_uri = OLD.image_uri);
      END;

      CREATE TRIGGER sync_sources_insert AFTER INSERT ON sources
      WHEN (SELECT applying_remote FROM sync_control WHERE id = 1) = 0
      BEGIN
        INSERT INTO sync_changes VALUES ('sources', NEW.id, 'upsert', unixepoch('subsec') * 1000)
        ON CONFLICT(entity_type, entity_id) DO UPDATE SET operation = 'upsert', changed_at = sync_changes.changed_at + 1;
      END;
      CREATE TRIGGER sync_sources_update AFTER UPDATE ON sources
      WHEN (SELECT applying_remote FROM sync_control WHERE id = 1) = 0
      BEGIN
        INSERT INTO sync_changes VALUES ('sources', NEW.id, 'upsert', unixepoch('subsec') * 1000)
        ON CONFLICT(entity_type, entity_id) DO UPDATE SET operation = 'upsert', changed_at = sync_changes.changed_at + 1;
      END;
      CREATE TRIGGER sync_sources_delete AFTER DELETE ON sources
      WHEN (SELECT applying_remote FROM sync_control WHERE id = 1) = 0
      BEGIN
        INSERT INTO sync_changes VALUES ('sources', OLD.id, 'delete', unixepoch('subsec') * 1000)
        ON CONFLICT(entity_type, entity_id) DO UPDATE SET operation = 'delete', changed_at = sync_changes.changed_at + 1;
      END;

      CREATE TRIGGER sync_tags_insert AFTER INSERT ON tags
      WHEN (SELECT applying_remote FROM sync_control WHERE id = 1) = 0
      BEGIN
        INSERT INTO sync_changes VALUES ('tags', NEW.id, 'upsert', unixepoch('subsec') * 1000)
        ON CONFLICT(entity_type, entity_id) DO UPDATE SET operation = 'upsert', changed_at = sync_changes.changed_at + 1;
      END;
      CREATE TRIGGER sync_tags_update AFTER UPDATE ON tags
      WHEN (SELECT applying_remote FROM sync_control WHERE id = 1) = 0
      BEGIN
        INSERT INTO sync_changes VALUES ('tags', NEW.id, 'upsert', unixepoch('subsec') * 1000)
        ON CONFLICT(entity_type, entity_id) DO UPDATE SET operation = 'upsert', changed_at = sync_changes.changed_at + 1;
      END;
      CREATE TRIGGER sync_tags_delete AFTER DELETE ON tags
      WHEN (SELECT applying_remote FROM sync_control WHERE id = 1) = 0
      BEGIN
        INSERT INTO sync_changes VALUES ('tags', OLD.id, 'delete', unixepoch('subsec') * 1000)
        ON CONFLICT(entity_type, entity_id) DO UPDATE SET operation = 'delete', changed_at = sync_changes.changed_at + 1;
      END;

      CREATE TRIGGER sync_entry_tags_insert AFTER INSERT ON entry_tags
      WHEN (SELECT applying_remote FROM sync_control WHERE id = 1) = 0
      BEGIN
        INSERT INTO sync_changes VALUES ('entry_tags', NEW.entry_id || char(31) || NEW.tag_id, 'upsert', unixepoch('subsec') * 1000)
        ON CONFLICT(entity_type, entity_id) DO UPDATE SET operation = 'upsert', changed_at = sync_changes.changed_at + 1;
      END;
      CREATE TRIGGER sync_entry_tags_delete AFTER DELETE ON entry_tags
      WHEN (SELECT applying_remote FROM sync_control WHERE id = 1) = 0
      BEGIN
        INSERT INTO sync_changes VALUES ('entry_tags', OLD.entry_id || char(31) || OLD.tag_id, 'delete', unixepoch('subsec') * 1000)
        ON CONFLICT(entity_type, entity_id) DO UPDATE SET operation = 'delete', changed_at = sync_changes.changed_at + 1;
      END;

      CREATE TRIGGER sync_resurfacings_insert AFTER INSERT ON resurfacings
      WHEN (SELECT applying_remote FROM sync_control WHERE id = 1) = 0
      BEGIN
        INSERT INTO sync_changes VALUES ('resurfacings', NEW.entry_id || char(31) || NEW.shown_day, 'upsert', unixepoch('subsec') * 1000)
        ON CONFLICT(entity_type, entity_id) DO UPDATE SET operation = 'upsert', changed_at = sync_changes.changed_at + 1;
      END;
      CREATE TRIGGER sync_resurfacings_update AFTER UPDATE ON resurfacings
      WHEN (SELECT applying_remote FROM sync_control WHERE id = 1) = 0
      BEGIN
        INSERT INTO sync_changes VALUES ('resurfacings', NEW.entry_id || char(31) || NEW.shown_day, 'upsert', unixepoch('subsec') * 1000)
        ON CONFLICT(entity_type, entity_id) DO UPDATE SET operation = 'upsert', changed_at = sync_changes.changed_at + 1;
      END;
      CREATE TRIGGER sync_resurfacings_delete AFTER DELETE ON resurfacings
      WHEN (SELECT applying_remote FROM sync_control WHERE id = 1) = 0
      BEGIN
        INSERT INTO sync_changes VALUES ('resurfacings', OLD.entry_id || char(31) || OLD.shown_day, 'delete', unixepoch('subsec') * 1000)
        ON CONFLICT(entity_type, entity_id) DO UPDATE SET operation = 'delete', changed_at = sync_changes.changed_at + 1;
      END;

      CREATE TRIGGER sync_photo_links_insert AFTER INSERT ON photo_links
      WHEN (SELECT applying_remote FROM sync_control WHERE id = 1) = 0
      BEGIN
        INSERT INTO sync_changes VALUES ('photo_links', NEW.photo_uri, 'upsert', unixepoch('subsec') * 1000)
        ON CONFLICT(entity_type, entity_id) DO UPDATE SET operation = 'upsert', changed_at = sync_changes.changed_at + 1;
      END;
      CREATE TRIGGER sync_photo_links_update AFTER UPDATE ON photo_links
      WHEN (SELECT applying_remote FROM sync_control WHERE id = 1) = 0
      BEGIN
        INSERT INTO sync_changes VALUES ('photo_links', NEW.photo_uri, 'upsert', unixepoch('subsec') * 1000)
        ON CONFLICT(entity_type, entity_id) DO UPDATE SET operation = 'upsert', changed_at = sync_changes.changed_at + 1;
      END;
      CREATE TRIGGER sync_photo_links_delete AFTER DELETE ON photo_links
      WHEN (SELECT applying_remote FROM sync_control WHERE id = 1) = 0
      BEGIN
        INSERT INTO sync_changes VALUES ('photo_links', OLD.photo_uri, 'delete', unixepoch('subsec') * 1000)
        ON CONFLICT(entity_type, entity_id) DO UPDATE SET operation = 'delete', changed_at = sync_changes.changed_at + 1;
      END;

      -- 업그레이드 전부터 있던 기록도 첫 로그인 때 서버로 올라가야 한다.
      INSERT INTO sync_changes SELECT 'entries', id, 'upsert', unixepoch('subsec') * 1000 FROM entries;
      INSERT INTO sync_changes SELECT 'sources', id, 'upsert', unixepoch('subsec') * 1000 FROM sources;
      INSERT INTO sync_changes SELECT 'tags', id, 'upsert', unixepoch('subsec') * 1000 FROM tags;
      INSERT INTO sync_changes SELECT 'entry_tags', entry_id || char(31) || tag_id, 'upsert', unixepoch('subsec') * 1000 FROM entry_tags;
      INSERT INTO sync_changes SELECT 'resurfacings', entry_id || char(31) || shown_day, 'upsert', unixepoch('subsec') * 1000 FROM resurfacings;
      INSERT INTO photo_jobs (photo_uri, action, state, updated_at)
        SELECT DISTINCT image_uri, 'upload', 'pending', unixepoch('subsec') * 1000
        FROM entries
        WHERE deleted_at IS NULL AND image_uri LIKE 'photos/%';
    `,
  },
  {
    version: 8,
    rebuild: true,
    // 기기마다 달랐던 갈피 ID를 이름의 UTF-8로 맞춘다. 참조도 같은 트랜잭션에서 옮긴다.
    // 이미 서버에 갔을 수 있는 옛 ID는 삭제 기록으로 남겨 다른 기기에서 되살아나지 않게 한다.
    sql: `
      UPDATE sync_control SET applying_remote = 1 WHERE id = 1;
      INSERT INTO sync_changes
        SELECT 'entry_tags', entry_id || char(31) || tag_id, 'delete', unixepoch('subsec') * 1000
        FROM entry_tags WHERE tag_id != (SELECT 'tag:' || lower(hex(name)) FROM tags WHERE id = tag_id)
        ON CONFLICT(entity_type, entity_id) DO UPDATE SET operation='delete', changed_at=sync_changes.changed_at+1;
      INSERT INTO sync_changes
        SELECT 'tags', id, 'delete', unixepoch('subsec') * 1000 FROM tags WHERE id != 'tag:' || lower(hex(name))
        ON CONFLICT(entity_type, entity_id) DO UPDATE SET operation='delete', changed_at=sync_changes.changed_at+1;
      UPDATE entry_tags SET tag_id = (SELECT 'tag:' || lower(hex(name)) FROM tags WHERE id = tag_id);
      UPDATE tags SET id = 'tag:' || lower(hex(name));
      INSERT INTO sync_changes
        SELECT 'tags', id, 'upsert', unixepoch('subsec') * 1000 FROM tags WHERE true
        ON CONFLICT(entity_type, entity_id) DO UPDATE SET operation='upsert', changed_at=sync_changes.changed_at+1;
      INSERT INTO sync_changes
        SELECT 'entry_tags', entry_id || char(31) || tag_id, 'upsert', unixepoch('subsec') * 1000 FROM entry_tags WHERE true
        ON CONFLICT(entity_type, entity_id) DO UPDATE SET operation='upsert', changed_at=sync_changes.changed_at+1;
      UPDATE sync_control SET applying_remote = 0 WHERE id = 1;
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
    // 테이블을 다시 짓는 동안에는 외래 키를 끄고(자식 행이 딸려 지워지지 않도록),
    // 이름 바꾸기가 다른 테이블의 참조를 손대지 않게 legacy 모드로 둔다. 둘 다 트랜잭션 밖에서.
    if (m.rebuild) {
      await db.execAsync('PRAGMA foreign_keys = OFF;');
      await db.execAsync('PRAGMA legacy_alter_table = ON;');
    }
    try {
      await db.withTransactionAsync(async () => {
        await db.execAsync(m.sql);
        if (m.after) await m.after(db);
        await db.execAsync(`PRAGMA user_version = ${m.version};`);
      });
    } finally {
      if (m.rebuild) {
        await db.execAsync('PRAGMA legacy_alter_table = OFF;');
        await db.execAsync('PRAGMA foreign_keys = ON;');
      }
    }
  }
}
