import test from 'node:test';
import assert from 'node:assert/strict';
import { MIGRATIONS, migrate } from '../src/db/migrations';
import { FakeDb, schemaUpTo } from './sqliteShim';

type AnyDb = Parameters<typeof migrate>[0];

test('v8 — 기존 갈피의 ID를 바꿔도 연결과 외래 키가 보존된다', async () => {
  const db = new FakeDb();
  await schemaUpTo(db, 7, MIGRATIONS);
  await db.execAsync(`
    INSERT INTO tags (id,name,created_at) VALUES ('old','기쁨',1);
    INSERT INTO entries (id,type,day,created_at,updated_at) VALUES ('e','moment','2026-09-10',1,1);
    INSERT INTO entry_tags (entry_id,tag_id) VALUES ('e','old');
  `);
  await migrate(db as unknown as AnyDb);
  assert.deepEqual(await db.getAllAsync('PRAGMA foreign_key_check'),[]);
  assert.deepEqual(await db.getAllAsync('SELECT t.name,et.entry_id FROM entry_tags et JOIN tags t ON t.id=et.tag_id'),[{name:'기쁨',entry_id:'e'}]);
  assert.equal((await db.getFirstAsync<{operation:string}>("SELECT operation FROM sync_changes WHERE entity_type='tags' AND entity_id='old'"))?.operation,'delete');
  assert.equal((await db.getFirstAsync<{foreign_keys:number}>('PRAGMA foreign_keys'))?.foreign_keys,1);
});

function insertEntry(db: FakeDb, e: Record<string, unknown>) {
  const cols = Object.keys(e);
  return db.runAsync(
    `INSERT INTO entries (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
    cols.map((c) => e[c])
  );
}

test('빈 DB — 끝 버전까지 올라가고 표가 다 있다', async () => {
  const db = new FakeDb();
  await migrate(db as unknown as AnyDb);
  const v = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  assert.equal(v?.user_version, MIGRATIONS[MIGRATIONS.length - 1].version);
  const cols = (await db.getAllAsync<{ name: string }>('PRAGMA table_info(sources)')).map((c) => c.name);
  assert.ok(cols.includes('url') && cols.includes('thumbnail_uri'));
});

test('v2 DB — 출처 없이 남긴 책·영상 기록을 제목별 출처로 잇고, 있던 출처는 재사용한다', async () => {
  const db = new FakeDb();
  await schemaUpTo(db, 2, MIGRATIONS);
  const base = { day: '2026-08-01', updated_at: 0, pinned: 0, revisit_count: 0 };
  await insertEntry(db, { ...base, id: 'e1', type: 'book', created_at: 100, title: '모모', subtitle: '미하엘 엔데', quote: 'q1' });
  await insertEntry(db, { ...base, id: 'e2', type: 'book', created_at: 200, title: '모모', subtitle: '미하엘 엔데', quote: 'q2' });
  await insertEntry(db, { ...base, id: 'e3', type: 'book', created_at: 300, title: '모모', deleted_at: 300, quote: 'q3' });
  await insertEntry(db, { ...base, id: 'e4', type: 'book', created_at: 400, quote: 'q4' }); // 제목 없음
  await insertEntry(db, { ...base, id: 'e7', type: 'book', created_at: 700, title: '데미안', subtitle: '헤세', quote: 'q7' });
  await insertEntry(db, { ...base, id: 'e8', type: 'moment', created_at: 800, title: '제목 있는 순간', body: 'b' });
  await db.runAsync(
    "INSERT INTO sources (id,kind,title,creator,created_at,last_used_at,last_tags) VALUES ('s-demian','book','데미안','헤세',50,50,'소설')"
  );
  await migrate(db as unknown as AnyDb);

  const sources = await db.getAllAsync<{ id: string; title: string; creator: string | null }>(
    'SELECT id, title, creator FROM sources WHERE deleted_at IS NULL ORDER BY title'
  );
  assert.deepEqual(sources.map((s) => s.title), ['데미안', '모모']);
  assert.equal(sources.find((s) => s.title === '모모')?.creator, '미하엘 엔데');
  const momo = await db.getAllAsync<{ source_id: string | null }>("SELECT source_id FROM entries WHERE title='모모'");
  assert.equal(new Set(momo.map((r) => r.source_id)).size, 1);
  assert.equal((await db.getFirstAsync<{ source_id: string }>("SELECT source_id FROM entries WHERE id='e7'"))?.source_id, 's-demian');
  for (const id of ['e4', 'e8']) {
    assert.equal((await db.getFirstAsync<{ source_id: string | null }>(`SELECT source_id FROM entries WHERE id='${id}'`))?.source_id, null);
  }
});

test('v2 DB — 영상 출처의 링크는 살아 있는 메모에서 오고, 지워진 메모의 링크는 바로잡힌다', async () => {
  const db = new FakeDb();
  await schemaUpTo(db, 2, MIGRATIONS);
  const base = { day: '2026-08-01', updated_at: 0, pinned: 0, revisit_count: 0, type: 'video', title: 'Vid V' };
  await insertEntry(db, { ...base, id: 'v1', created_at: 100, url: 'https://youtu.be/aaaaaaaaaaa', body: 'a' });
  await insertEntry(db, { ...base, id: 'v2', created_at: 200, url: 'https://youtu.be/bbbbbbbbbbb', body: 'b' });
  await insertEntry(db, { ...base, id: 'v3', created_at: 300, url: 'https://youtu.be/ccccccccccc', body: 'deleted', deleted_at: 300 });
  await migrate(db as unknown as AnyDb);
  const src = await db.getFirstAsync<{ url: string }>("SELECT url FROM sources WHERE kind='video'");
  // 지워진 메모(c)가 아니라 살아 있는 최신 메모(b)의 링크, 그것도 정규형으로
  assert.equal(src?.url, 'https://www.youtube.com/watch?v=bbbbbbbbbbb');
});

test('v4 DB — 원본 링크로 저장된 영상 출처는 정규형이 되고, 같은 영상은 최근 것에 합쳐진다', async () => {
  const db = new FakeDb();
  await schemaUpTo(db, 4, MIGRATIONS);
  await db.runAsync(
    "INSERT INTO sources (id,kind,title,creator,url,created_at,last_used_at,last_tags) VALUES ('s-old','video','강연','채널','https://www.youtube.com/watch?v=dQw4w9WgXcQ',100,100,'')"
  );
  await db.runAsync(
    "INSERT INTO sources (id,kind,title,creator,url,created_at,last_used_at,last_tags) VALUES ('s-new','video','강연','채널','https://youtu.be/dQw4w9WgXcQ?si=abc',200,200,'기록')"
  );
  const base = { day: '2026-08-01', updated_at: 0, pinned: 0, revisit_count: 0, type: 'video', title: '강연' };
  await insertEntry(db, { ...base, id: 'm1', created_at: 100, source_id: 's-old', url: 'https://youtu.be/dQw4w9WgXcQ?t=90', body: 'old memo' });
  await insertEntry(db, { ...base, id: 'm2', created_at: 200, source_id: 's-new', url: 'https://youtu.be/dQw4w9WgXcQ?si=abc', body: 'new memo' });
  await migrate(db as unknown as AnyDb);

  const live = await db.getAllAsync<{ id: string; url: string }>("SELECT id, url FROM sources WHERE kind='video' AND deleted_at IS NULL");
  assert.deepEqual(live, [{ id: 's-new', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }]);
  const moved = await db.getFirstAsync<{ source_id: string; url: string }>("SELECT source_id, url FROM entries WHERE id='m1'");
  assert.equal(moved?.source_id, 's-new');
  assert.equal(moved?.url, 'https://youtu.be/dQw4w9WgXcQ?t=90'); // 기록의 시점은 그대로
});

test('v6 — 영상이 링크가 되고, 표를 다시 지어도 갈피·되새김은 살아남는다', async () => {
  const db = new FakeDb();
  await schemaUpTo(db, 5, MIGRATIONS);
  const base = { day: '2026-08-01', updated_at: 0, pinned: 0, revisit_count: 0 };
  await insertEntry(db, { ...base, id: 'v1', type: 'video', created_at: 100, title: '강연', url: 'https://youtu.be/aaaaaaaaaaa' });
  await insertEntry(db, { ...base, id: 'b1', type: 'book', created_at: 200, quote: '문장' });
  await insertEntry(db, { ...base, id: 'm1', type: 'moment', created_at: 300, body: '구조 없는 기록' });
  await db.runAsync("INSERT INTO tags (id,name,created_at) VALUES ('t1','독서',1)");
  await db.runAsync("INSERT INTO entry_tags (entry_id,tag_id) VALUES ('b1','t1')");
  await db.runAsync("INSERT INTO resurfacings (entry_id,shown_day) VALUES ('b1','2026-08-02')");

  await migrate(db as unknown as AnyDb);

  const types = await db.getAllAsync<{ id: string; type: string }>('SELECT id, type FROM entries ORDER BY id');
  assert.deepEqual(types, [
    { id: 'b1', type: 'book' },
    { id: 'm1', type: 'moment' },
    { id: 'v1', type: 'link' },
  ]);
  // 자식 행이 딸려 지워지지 않았다
  assert.equal((await db.getAllAsync('SELECT * FROM entry_tags')).length, 1);
  assert.equal((await db.getAllAsync('SELECT * FROM resurfacings')).length, 1);
  // 구조가 붙은 기록만 검토 큐에서 빠진다
  const filed = await db.getAllAsync<{ id: string; filed_at: number | null }>(
    'SELECT id, filed_at FROM entries ORDER BY id'
  );
  assert.notEqual(filed[0].filed_at, null); // b1: 갈피가 있다
  assert.equal(filed[1].filed_at, null); // m1: 아직 구조가 없다
  // 외래 키가 다시 켜져 있고 링크 종류가 넓어졌다
  const fk = await db.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys');
  assert.equal(fk?.foreign_keys, 1);
  await db.runAsync(
    "INSERT INTO sources (id,kind,title,created_at,last_used_at,last_tags) VALUES ('s-a','article','어느 글',1,1,'')"
  );
});

test('v7 — 기존 기록을 첫 동기화 큐에 넣고, 같은 대상의 변경은 한 건으로 합친다', async () => {
  const db = new FakeDb();
  await schemaUpTo(db, 6, MIGRATIONS);
  await db.runAsync(
    "INSERT INTO sources (id,kind,title,created_at,last_used_at,last_tags) VALUES ('s1','book','모모',1,1,'')"
  );
  await insertEntry(db, {
    id: 'e1', type: 'book', day: '2026-09-09', created_at: 10, updated_at: 10,
    pinned: 0, revisit_count: 0, source_id: 's1', quote: '처음 문장',
  });
  await db.runAsync("INSERT INTO tags (id,name,created_at) VALUES ('t1','독서',1)");
  await db.runAsync("INSERT INTO entry_tags (entry_id,tag_id) VALUES ('e1','t1')");
  await db.runAsync("INSERT INTO resurfacings (entry_id,shown_day,reaction) VALUES ('e1','2026-09-09','kept')");
  await db.runAsync("INSERT INTO settings (key,value) VALUES ('deck','로컬 전용')");

  await migrate(db as unknown as AnyDb);

  const queued = await db.getAllAsync<{ entity_type: string; operation: string }>(
    'SELECT entity_type, operation FROM sync_changes ORDER BY entity_type'
  );
  assert.deepEqual(queued, [
    { entity_type: 'entries', operation: 'upsert' },
    { entity_type: 'entry_tags', operation: 'delete' },
    { entity_type: 'entry_tags', operation: 'upsert' },
    { entity_type: 'resurfacings', operation: 'upsert' },
    { entity_type: 'sources', operation: 'upsert' },
    { entity_type: 'tags', operation: 'delete' },
    { entity_type: 'tags', operation: 'upsert' },
  ]);

  await db.runAsync("UPDATE entries SET quote='두 번째 문장' WHERE id='e1'");
  await db.runAsync("UPDATE entries SET quote='마지막 문장' WHERE id='e1'");
  assert.equal(
    (await db.getFirstAsync<{ count: number }>("SELECT count(*) AS count FROM sync_changes WHERE entity_type='entries' AND entity_id='e1'"))?.count,
    1
  );

  const tagId = (await db.getFirstAsync<{id:string}>("SELECT id FROM tags WHERE name='독서'"))!.id;
  await db.runAsync("DELETE FROM entry_tags WHERE entry_id='e1' AND tag_id=?", [tagId]);
  const removed = await db.getFirstAsync<{ operation: string }>(
    "SELECT operation FROM sync_changes WHERE entity_type='entry_tags' AND entity_id=?", [`e1${String.fromCharCode(31)}${tagId}`]
  );
  assert.equal(removed?.operation, 'delete');
});

test('v7 — 원격 기록을 적용하는 동안 생긴 변경은 다시 업로드 큐에 넣지 않는다', async () => {
  const db = new FakeDb();
  await migrate(db as unknown as AnyDb);
  await db.runAsync('DELETE FROM sync_changes');
  await db.runAsync('UPDATE sync_control SET applying_remote=1 WHERE id=1');
  await insertEntry(db, {
    id: 'remote-e1', type: 'moment', day: '2026-09-09', created_at: 10, updated_at: 10,
    pinned: 0, revisit_count: 0, body: '다른 기기에서 온 기록',
  });
  await db.runAsync('UPDATE sync_control SET applying_remote=0 WHERE id=1');

  assert.equal((await db.getFirstAsync<{ count: number }>('SELECT count(*) AS count FROM sync_changes'))?.count, 0);
});

test('v7 — 새 로컬 사진은 업로드 대기열에 넣고 기록에서 빼면 원격 연결만 끊는다', async () => {
  const db = new FakeDb();
  await migrate(db as unknown as AnyDb);
  await db.runAsync('DELETE FROM sync_changes');
  await db.runAsync(
    `INSERT INTO entries (id,type,day,created_at,updated_at,pinned,revisit_count,image_uri)
     VALUES ('e1','meal','2026-09-09',10,10,0,0,'photos/a.jpg')`
  );
  assert.equal(
    (await db.getFirstAsync<{ action: string }>("SELECT action FROM photo_jobs WHERE photo_uri='photos/a.jpg'"))?.action,
    'upload'
  );

  await db.runAsync(
    "INSERT INTO photo_links (photo_uri,media_item_id,album_id,created_at,updated_at) VALUES ('photos/a.jpg','media-1','album-1',10,10)"
  );
  await db.runAsync("UPDATE entries SET image_uri=NULL WHERE id='e1'");

  assert.equal(await db.getFirstAsync("SELECT 1 FROM photo_links WHERE photo_uri='photos/a.jpg'"), null);
  assert.equal(
    (await db.getFirstAsync<{ operation: string }>("SELECT operation FROM sync_changes WHERE entity_type='photo_links' AND entity_id='photos/a.jpg'"))?.operation,
    'delete'
  );
});
