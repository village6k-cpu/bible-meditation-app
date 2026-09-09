import test from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseSyncApi } from '../src/sync/supabaseApi';

test('Supabase 어댑터는 로그인한 사용자 소유로 올리고 커서 뒤만 받는다', async () => {
  const seen: { table?: string; rows?: unknown; conflict?: string; cursor?: number } = {};
  const remote = {
    entity_type: 'entries', entity_id: 'e2', operation: 'delete', payload: null, revision: 9,
  };
  const query = {
    upsert(rows: unknown, options: { onConflict: string }) {
      seen.rows = rows;
      seen.conflict = options.onConflict;
      return Promise.resolve({ error: null });
    },
    select() { return this; },
    gt(_column: string, cursor: number) { seen.cursor = cursor; return this; },
    order() { return this; },
    limit() { return Promise.resolve({ data: [remote], error: null }); },
  };
  const client = {
    from(table: string) { seen.table = table; return query; },
  };
  const api = createSupabaseSyncApi(client as never, 'user-1');

  await api.push([{
    entity_type: 'entries', entity_id: 'e1', operation: 'upsert', changed_at: 3,
    payload: { id: 'e1', body: '기록' },
  }]);
  const pulled = await api.pull(7);

  assert.equal(seen.table, 'ledger_sync_records');
  assert.equal(seen.conflict, 'owner_id,entity_type,entity_id');
  assert.deepEqual(seen.rows, [{
    owner_id: 'user-1', entity_type: 'entries', entity_id: 'e1', operation: 'upsert',
    payload: { id: 'e1', body: '기록' },
  }]);
  assert.equal(seen.cursor, 7);
  assert.deepEqual(pulled, [remote]);
});

test('Supabase 오류는 성공처럼 삼키지 않는다', async () => {
  const client = {
    from() {
      return { upsert() { return Promise.resolve({ error: new Error('권한 없음') }); } };
    },
  };
  const api = createSupabaseSyncApi(client as never, 'user-1');
  await assert.rejects(
    () => api.push([{ entity_type: 'entries', entity_id: 'e1', operation: 'delete', changed_at: 1, payload: null }]),
    /권한 없음/
  );
});
