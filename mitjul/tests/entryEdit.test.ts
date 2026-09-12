import test from 'node:test';
import assert from 'node:assert/strict';
import { migrate } from '../src/db/migrations';
import { createEntry, getEntry, queryLibrary, tagsOf, updateEntry } from '../src/db/entryRepo';
import { FakeDb } from './sqliteShim';

test('묵상을 글로 고치면 같은 기록의 유형과 필터만 바뀌고 본문·사진·갈피는 남는다', async () => {
  const raw = new FakeDb();
  const db = raw as unknown as Parameters<typeof migrate>[0];
  await migrate(db);
  const input = { type: 'verse' as const, day: '2026-09-13', subtitle: '시편 23:1',
    quote: '기존 인용문', body: '반드루넨의 방식\n\n자기의의 제거\n\n동기의 저하의 한계',
    image_uri: 'photos/kept.jpg', tags: ['생각'] };
  const id = await createEntry(db, input);
  const before = await getEntry(db, id);
  await db.runAsync("DELETE FROM sync_changes");
  await updateEntry(db, id, { ...input, type: 'writing' });
  const after = await getEntry(db, id);
  assert.equal(after?.type, 'writing');
  for (const key of ['id', 'day', 'created_at', 'subtitle', 'quote', 'body', 'image_uri'] as const) {
    assert.equal(after?.[key], before?.[key], key);
  }
  assert.deepEqual((await tagsOf(db, [id])).get(id), ['생각']);
  assert.deepEqual((await queryLibrary(db, {type:'writing', sort:'recent'})).map(e=>e.id), [id]);
  assert.equal((await queryLibrary(db, {type:'verse', sort:'recent'})).length, 0);
  assert.deepEqual(await db.getFirstAsync('SELECT operation FROM sync_changes WHERE entity_type=? AND entity_id=?', ['entries', id]), {operation:'upsert'});
});
