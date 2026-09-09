import test from 'node:test';
import assert from 'node:assert/strict';
import { migrate } from '../src/db/migrations';
import { processPhotoJobs, type PhotoRemote, type PhotoStore } from '../src/db/photoSync';
import { applyRemoteRecords } from '../src/db/syncRepo';
import { FakeDb } from './sqliteShim';

type AnyDb = Parameters<typeof migrate>[0];

test('앱 종료로 running에 남은 사진 작업도 재개한다', async () => {
  const db=new FakeDb();
  await migrate(db as unknown as AnyDb);
  await db.execAsync("INSERT INTO entries (id,type,day,created_at,updated_at,image_uri) VALUES ('e','meal','2026-09-10',1,1,'photos/retry.jpg')");
  await db.runAsync("UPDATE photo_jobs SET state='running'");
  const result=await processPhotoJobs(db as unknown as AnyDb,{async read(){return new Uint8Array([1]);},async write(){}},{async upload(){return {mediaItemId:'m',albumId:'a'};},async download(){throw new Error('unexpected');}});
  assert.equal(result.completed,1);
});

test('사진을 올리는 사이 기록에서 빼면 원격 연결을 되살리지 않는다', async () => {
  const db=new FakeDb();
  await migrate(db as unknown as AnyDb);
  await db.execAsync("INSERT INTO entries (id,type,day,created_at,updated_at,image_uri) VALUES ('e','meal','2026-09-10',1,1,'photos/deleted.jpg')");
  await processPhotoJobs(db as unknown as AnyDb,{async read(){return new Uint8Array([1]);},async write(){}},{async upload(){await db.runAsync("UPDATE entries SET image_uri=NULL WHERE id='e'");return {mediaItemId:'m',albumId:'a'};},async download(){throw new Error('unexpected');}});
  assert.equal(await db.getFirstAsync('SELECT * FROM photo_links'),null);
});

test('로컬 사진을 기록 날짜의 월 앨범에 올리고 media item ID만 DB에 남긴다', async () => {
  const db = new FakeDb();
  await migrate(db as unknown as AnyDb);
  await db.runAsync(
    `INSERT INTO entries (id,type,day,created_at,updated_at,pinned,revisit_count,image_uri)
     VALUES ('e1','meal','2026-09-09',10,10,0,0,'photos/a.jpg')`
  );
  const uploaded: { month?: string; bytes?: number[] } = {};
  const store: PhotoStore = {
    async read() { return new Uint8Array([1, 2, 3]); },
    async write() {},
  };
  const remote: PhotoRemote = {
    async upload(input) {
      uploaded.month = input.month;
      uploaded.bytes = Array.from(input.bytes);
      return { mediaItemId: 'media-1', albumId: 'album-1' };
    },
    async download() { throw new Error('호출되면 안 됨'); },
  };

  const result = await processPhotoJobs(db as unknown as AnyDb, store, remote);

  assert.deepEqual(uploaded, { month: '2026-09', bytes: [1, 2, 3] });
  assert.deepEqual(result, { completed: 1, failed: 0 });
  assert.deepEqual(
    await db.getFirstAsync("SELECT media_item_id,album_id FROM photo_links WHERE photo_uri='photos/a.jpg'"),
    { media_item_id: 'media-1', album_id: 'album-1' }
  );
  assert.equal(await db.getFirstAsync("SELECT 1 FROM photo_jobs WHERE photo_uri='photos/a.jpg'"), null);
});

test('다른 기기의 media item ID를 받으면 사진을 내려받아 로컬 캐시에 둔다', async () => {
  const db = new FakeDb();
  await migrate(db as unknown as AnyDb);
  await db.runAsync('DELETE FROM sync_changes');
  await applyRemoteRecords(db as unknown as AnyDb, [{
    entity_type: 'photo_links', entity_id: 'photos/b.jpg', operation: 'upsert', revision: 4,
    payload: {
      photo_uri: 'photos/b.jpg', media_item_id: 'media-2', album_id: 'album-2',
      created_at: 10, updated_at: 10,
    },
  }]);
  const written: { ref?: string; bytes?: number[] } = {};
  const store: PhotoStore = {
    async read() { return null; },
    async write(ref, bytes) { written.ref = ref; written.bytes = Array.from(bytes); },
  };
  const remote: PhotoRemote = {
    async upload() { throw new Error('호출되면 안 됨'); },
    async download(mediaItemId) {
      assert.equal(mediaItemId, 'media-2');
      return new Uint8Array([4, 5]);
    },
  };

  const result = await processPhotoJobs(db as unknown as AnyDb, store, remote);

  assert.deepEqual(written, { ref: 'photos/b.jpg', bytes: [4, 5] });
  assert.deepEqual(result, { completed: 1, failed: 0 });
});

test('사진 전송 실패는 기록을 지우지 않고 재시도 상태로 남긴다', async () => {
  const db = new FakeDb();
  await migrate(db as unknown as AnyDb);
  await db.runAsync(
    `INSERT INTO entries (id,type,day,created_at,updated_at,pinned,revisit_count,image_uri)
     VALUES ('e1','meal','2026-09-09',10,10,0,0,'photos/a.jpg')`
  );
  const store: PhotoStore = {
    async read() { return new Uint8Array([1]); },
    async write() {},
  };
  const remote: PhotoRemote = {
    async upload() { throw new Error('Google Photos 잠시 멈춤'); },
    async download() { throw new Error('호출되면 안 됨'); },
  };

  const result = await processPhotoJobs(db as unknown as AnyDb, store, remote);

  assert.deepEqual(result, { completed: 0, failed: 1 });
  assert.equal((await db.getFirstAsync<{ body: string | null }>("SELECT body FROM entries WHERE id='e1'"))?.body, null);
  assert.deepEqual(
    await db.getFirstAsync("SELECT state,attempts,last_error FROM photo_jobs WHERE photo_uri='photos/a.jpg'"),
    { state: 'failed', attempts: 1, last_error: 'Google Photos 잠시 멈춤' }
  );
});
