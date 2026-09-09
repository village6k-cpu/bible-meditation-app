import test from 'node:test';
import assert from 'node:assert/strict';
import { migrate } from '../src/db/migrations';
import { acknowledgeChanges, applyRemoteRecords, preparePushBatch } from '../src/db/syncRepo';
import { FakeDb } from './sqliteShim';

type AnyDb = Parameters<typeof migrate>[0];

test('태그가 붙은 기록을 두 기기 사이에서 반복 수신해도 관계가 보존된다', async () => {
  const sender = await readyDb();
  const receiver = await readyDb();
  await sender.execAsync(`
    INSERT INTO entries (id,type,day,created_at,updated_at) VALUES ('tagged','moment','2026-09-10',1,1);
    INSERT INTO tags (id,name,created_at) VALUES ('t1','기쁨',1);
    INSERT INTO entry_tags (entry_id,tag_id) VALUES ('tagged','t1');
  `);
  const records = (await preparePushBatch(sender as unknown as AnyDb)).map((row, index) => ({ ...row, revision: index + 1 }));
  await applyRemoteRecords(receiver as unknown as AnyDb, records);
  await applyRemoteRecords(receiver as unknown as AnyDb, records);
  assert.deepEqual(await receiver.getAllAsync('SELECT entry_id,tag_id FROM entry_tags'), [{entry_id:'tagged',tag_id:'t1'}]);
});

async function readyDb(): Promise<FakeDb> {
  const db = new FakeDb();
  await migrate(db as unknown as AnyDb);
  await db.runAsync('DELETE FROM sync_changes');
  return db;
}

test('보낼 변경은 현재 행 전체를 담고, 전송 중 다시 바뀐 행은 확인 처리하지 않는다', async () => {
  const db = await readyDb();
  await db.runAsync(
    "INSERT INTO sources (id,kind,title,created_at,last_used_at,last_tags) VALUES ('s1','book','모모',1,1,'')"
  );
  await db.runAsync(
    `INSERT INTO entries (id,type,day,created_at,updated_at,pinned,revisit_count,source_id,quote)
     VALUES ('e1','book','2026-09-09',10,10,0,0,'s1','처음 문장')`
  );

  // 큐 시각은 데이터 의존 순서가 아니다. 다른 작업과 같은 밀리초에 겹치거나
  // 재시도되면 자식인 기록이 부모인 출처보다 먼저 올 수도 있다.
  await db.runAsync("UPDATE sync_changes SET changed_at = 1 WHERE entity_type = 'entries'");
  await db.runAsync("UPDATE sync_changes SET changed_at = 2 WHERE entity_type = 'sources'");

  const first = await preparePushBatch(db as unknown as AnyDb, 1);
  assert.equal(first[0].entity_type, 'sources');

  const batch = await preparePushBatch(db as unknown as AnyDb);
  const entry = batch.find((c) => c.entity_type === 'entries');
  assert.equal(entry?.payload?.quote, '처음 문장');
  assert.equal(entry?.operation, 'upsert');

  await db.runAsync("UPDATE entries SET quote='전송 중 고친 문장' WHERE id='e1'");
  await acknowledgeChanges(db as unknown as AnyDb, batch);

  assert.equal(
    (await db.getFirstAsync<{ count: number }>("SELECT count(*) AS count FROM sync_changes WHERE entity_type='entries'"))?.count,
    1
  );
  assert.equal(
    (await db.getFirstAsync<{ count: number }>("SELECT count(*) AS count FROM sync_changes WHERE entity_type='sources'"))?.count,
    0
  );
});

test('받은 변경은 관계 순서와 무관하게 적용하고 다시 업로드하지 않는다', async () => {
  const db = await readyDb();
  await applyRemoteRecords(db as unknown as AnyDb, [
    {
      entity_type: 'entries', entity_id: 'e1', operation: 'upsert', revision: 12,
      payload: {
        id: 'e1', type: 'book', day: '2026-09-09', created_at: 10, updated_at: 10,
        deleted_at: null, pinned: 0, revisit_count: 0, last_revisited_at: null, filed_at: 10,
        source_id: 's1', title: '모모', subtitle: null, quote: '다른 기기의 문장', body: null,
        url: null, image_uri: null, page: null, slot: null, minutes: null, practiced: null,
        done: null, due_time: null,
      },
    },
    {
      entity_type: 'sources', entity_id: 's1', operation: 'upsert', revision: 11,
      payload: {
        id: 's1', kind: 'book', title: '모모', creator: null, url: null, thumbnail_uri: null,
        created_at: 1, last_used_at: 1, last_tags: '', deleted_at: null,
      },
    },
  ]);

  assert.equal((await db.getFirstAsync<{ quote: string }>("SELECT quote FROM entries WHERE id='e1'"))?.quote, '다른 기기의 문장');
  assert.equal((await db.getFirstAsync<{ value: string }>("SELECT value FROM sync_meta WHERE key='remote_cursor'"))?.value, '12');
  assert.equal((await db.getFirstAsync<{ count: number }>('SELECT count(*) AS count FROM sync_changes'))?.count, 0);
});

test('아직 보내지 않은 내 변경은 늦게 도착한 원격 값으로 덮지 않는다', async () => {
  const db = await readyDb();
  await db.runAsync(
    `INSERT INTO entries (id,type,day,created_at,updated_at,pinned,revisit_count,body)
     VALUES ('e1','moment','2026-09-09',10,20,0,0,'내 오프라인 기록')`
  );

  await applyRemoteRecords(db as unknown as AnyDb, [{
    entity_type: 'entries', entity_id: 'e1', operation: 'upsert', revision: 21,
    payload: {
      id: 'e1', type: 'moment', day: '2026-09-09', created_at: 10, updated_at: 11,
      deleted_at: null, pinned: 0, revisit_count: 0, last_revisited_at: null, filed_at: null,
      source_id: null, title: null, subtitle: null, quote: null, body: '서버의 옛 기록', url: null,
      image_uri: null, page: null, slot: null, minutes: null, practiced: null, done: null, due_time: null,
    },
  }]);

  assert.equal((await db.getFirstAsync<{ body: string }>("SELECT body FROM entries WHERE id='e1'"))?.body, '내 오프라인 기록');
  assert.equal((await db.getFirstAsync<{ value: string }>("SELECT value FROM sync_meta WHERE key='remote_cursor'"))?.value, '21');
});
