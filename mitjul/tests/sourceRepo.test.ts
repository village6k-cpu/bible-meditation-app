import test from 'node:test';
import assert from 'node:assert/strict';
import { migrate } from '../src/db/migrations';
import { createSource, findSourceByUrl, getSource, renameSource, touchSource } from '../src/db/sourceRepo';
import { FakeDb } from './sqliteShim';

type AnyDb = Parameters<typeof migrate>[0];

async function fresh(): Promise<AnyDb> {
  const db = new FakeDb();
  await migrate(db as unknown as AnyDb);
  return db as unknown as AnyDb;
}

async function addEntry(db: AnyDb, id: string, sourceId: string, extra: Record<string, unknown> = {}) {
  const row = { id, type: 'link', day: '2026-08-01', created_at: 1, updated_at: 1, pinned: 0, revisit_count: 0, source_id: sourceId, title: 't', ...extra };
  const cols = Object.keys(row);
  await db.runAsync(`INSERT INTO entries (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, cols.map((c) => row[c as keyof typeof row]) as never[]);
}

test('createSource — 링크가 있으면 링크로만 찾는다: 제목이 같아도 다른 영상', async () => {
  const db = await fresh();
  const a = await createSource(db, 'video', 'YouTube · aaaaaaaaaaa', null, { url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa' });
  const b = await createSource(db, 'video', 'YouTube · aaaaaaaaaaa', null, { url: 'https://www.youtube.com/watch?v=bbbbbbbbbbb' });
  assert.notEqual(a.id, b.id);
  const again = await createSource(db, 'video', '다른 제목', '채널', { url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa' });
  assert.equal(again.id, a.id);
  assert.equal(again.creator, '채널'); // 비어 있던 채널은 채워진다
  assert.equal((await getSource(db, a.id))?.creator, '채널');
});

test('createSource — 책은 제목으로 한 번만', async () => {
  const db = await fresh();
  const a = await createSource(db, 'book', ' 모모 ', '미하엘 엔데');
  const b = await createSource(db, 'book', '모모', null);
  assert.equal(a.id, b.id);
  assert.equal(b.title, '모모');
});

test('touchSource — 이번에 쓴 태그(비웠으면 빈 것)가 다음 기본값', async () => {
  const db = await fresh();
  const s = await createSource(db, 'book', '월든', null);
  await touchSource(db, s.id, ['독서', '단순함']);
  assert.equal((await getSource(db, s.id))?.last_tags, '독서 단순함');
  await touchSource(db, s.id, []);
  assert.equal((await getSource(db, s.id))?.last_tags, '');
});

test('renameSource — 링크를 바꾸면 옛 링크(정규형 기준)를 쓰던 기록과 얼굴이 따라간다', async () => {
  const db = await fresh();
  const s = await createSource(db, 'video', '강연', null, { url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa', thumbnail_uri: 'images/thumb-a.jpg' });
  await addEntry(db, 'm1', s.id, { url: 'https://youtu.be/aaaaaaaaaaa?si=x', image_uri: 'images/thumb-a.jpg' }); // 공유 링크 형태
  await addEntry(db, 'm2', s.id, { url: null, image_uri: null });
  await addEntry(db, 'm3', s.id, { url: 'https://vimeo.com/76979871', image_uri: 'images/thumb-a.jpg' }); // 기록만의 다른 링크
  const renamed = await renameSource(db, s.id, '강연 (수정)', '채널', 'https://www.youtube.com/watch?v=bbbbbbbbbbb', 'images/thumb-b.jpg');
  assert.equal(renamed.id, s.id);
  const rows = await db.getAllAsync<{ id: string; url: string | null; title: string; image_uri: string | null }>('SELECT id, url, title, image_uri FROM entries ORDER BY id');
  assert.equal(rows[0].url, 'https://www.youtube.com/watch?v=bbbbbbbbbbb');
  assert.equal(rows[1].url, 'https://www.youtube.com/watch?v=bbbbbbbbbbb');
  assert.equal(rows[2].url, 'https://vimeo.com/76979871');
  assert.ok(rows.every((r) => r.title === '강연 (수정)'));
  assert.deepEqual(rows.map((r) => r.image_uri), ['images/thumb-b.jpg', 'images/thumb-b.jpg', 'images/thumb-b.jpg']);
});

test('renameSource — 같은 제목의 출처와 만나면 합쳐진다: 기록은 옮기고 중복은 내린다', async () => {
  const db = await fresh();
  const real = await createSource(db, 'book', '데미안', '헤세');
  await touchSource(db, real.id, ['소설']);
  const typo = await createSource(db, 'book', '데미인', null);
  await addEntry(db, 'q1', typo.id, { type: 'book', quote: '새는 알에서 나오려고 투쟁한다' });
  const survivor = await renameSource(db, typo.id, '데미안', null, null);
  assert.equal(survivor.id, real.id);
  assert.equal(survivor.last_tags, '소설');
  assert.equal(await getSource(db, typo.id), null); // 조용히 내려갔다
  const moved = await db.getFirstAsync<{ source_id: string; title: string; subtitle: string }>("SELECT source_id, title, subtitle FROM entries WHERE id='q1'");
  assert.deepEqual(moved, { source_id: real.id, title: '데미안', subtitle: '헤세' });
  assert.equal((await findSourceByUrl(db, 'x')), null);
});
