import test from 'node:test';
import assert from 'node:assert/strict';
import { migrate } from '../src/db/migrations';
import { bindSyncAccount, syncOnce, type RemoteSyncApi } from '../src/db/syncEngine';
import { FakeDb } from './sqliteShim';

type AnyDb = Parameters<typeof migrate>[0];

test('한 번의 동기화는 내 변경을 먼저 보낸 뒤 서버 변경을 받아 온다', async () => {
  const db = new FakeDb();
  await migrate(db as unknown as AnyDb);
  await db.runAsync('DELETE FROM sync_changes');
  await db.runAsync(
    `INSERT INTO entries (id,type,day,created_at,updated_at,pinned,revisit_count,body)
     VALUES ('local','moment','2026-09-09',10,10,0,0,'노트북 기록')`
  );

  const calls: string[] = [];
  const api: RemoteSyncApi = {
    async push(changes) {
      calls.push(`push:${changes.map((change) => change.entity_id).join(',')}`);
    },
    async pull(cursor) {
      calls.push(`pull:${cursor}`);
      return [{
        entity_type: 'entries', entity_id: 'phone', operation: 'upsert', revision: 7,
        payload: {
          id: 'phone', type: 'moment', day: '2026-09-09', created_at: 20, updated_at: 20,
          deleted_at: null, pinned: 0, revisit_count: 0, last_revisited_at: null,
          filed_at: null, source_id: null, title: null, subtitle: null, quote: null,
          body: '휴대폰 기록', url: null, image_uri: null, page: null, slot: null,
          minutes: null, practiced: null, done: null, due_time: null,
        },
      }];
    },
  };

  const result = await syncOnce(db as unknown as AnyDb, api);

  assert.deepEqual(calls, ['push:local', 'pull:0']);
  assert.deepEqual(result, { pushed: 1, pulled: 1 });
  assert.equal((await db.getFirstAsync<{ body: string }>("SELECT body FROM entries WHERE id='phone'"))?.body, '휴대폰 기록');
  assert.equal((await db.getFirstAsync<{ count: number }>('SELECT count(*) AS count FROM sync_changes'))?.count, 0);
});

test('전송이 실패하면 큐를 지우거나 받기를 시작하지 않는다', async () => {
  const db = new FakeDb();
  await migrate(db as unknown as AnyDb);
  await db.runAsync('DELETE FROM sync_changes');
  await db.runAsync(
    `INSERT INTO entries (id,type,day,created_at,updated_at,pinned,revisit_count,body)
     VALUES ('local','moment','2026-09-09',10,10,0,0,'남아야 하는 기록')`
  );
  let pulled = false;
  const api: RemoteSyncApi = {
    async push() { throw new Error('offline'); },
    async pull() { pulled = true; return []; },
  };

  await assert.rejects(() => syncOnce(db as unknown as AnyDb, api), /offline/);
  assert.equal(pulled, false);
  assert.equal((await db.getFirstAsync<{ count: number }>('SELECT count(*) AS count FROM sync_changes'))?.count, 1);
});

test('서버 변경이 한 페이지를 채우면 다음 페이지까지 이어서 받는다', async () => {
  const db = new FakeDb();
  await migrate(db as unknown as AnyDb);
  await db.runAsync('DELETE FROM sync_changes');

  const cursors: number[] = [];
  const record = (index: number) => ({
    entity_type: 'entries' as const,
    entity_id: `remote-${index}`,
    operation: 'upsert' as const,
    revision: index,
    payload: {
      id: `remote-${index}`, type: 'moment', day: '2026-09-09', created_at: index, updated_at: index,
      deleted_at: null, pinned: 0, revisit_count: 0, last_revisited_at: null,
      filed_at: null, source_id: null, title: null, subtitle: null, quote: null,
      body: `원격 기록 ${index}`, url: null, image_uri: null, page: null, slot: null,
      minutes: null, practiced: null, done: null, due_time: null,
    },
  });
  const api: RemoteSyncApi = {
    async push() {},
    async pull(cursor) {
      cursors.push(cursor);
      return cursor === 0
        ? Array.from({ length: 500 }, (_, index) => record(index + 1))
        : [record(501)];
    },
  };

  const result = await syncOnce(db as unknown as AnyDb, api);

  assert.deepEqual(cursors, [0, 500]);
  assert.deepEqual(result, { pushed: 0, pulled: 501 });
  assert.equal((await db.getFirstAsync<{ count: number }>('SELECT count(*) AS count FROM entries'))?.count, 501);
});

test('한 로컬 기록함을 다른 계정에 실수로 섞어 올리지 않는다', async () => {
  const db = new FakeDb();
  await migrate(db as unknown as AnyDb);

  await bindSyncAccount(db as unknown as AnyDb, 'account-a');
  await bindSyncAccount(db as unknown as AnyDb, 'account-a');
  await assert.rejects(() => bindSyncAccount(db as unknown as AnyDb, 'account-b'), /다른 계정/);
});
