import test from 'node:test';
import assert from 'node:assert/strict';
import { migrate } from '../src/db/migrations';
import { unfiledCount } from '../src/db/entryRepo';
import { allSources, createSource, deleteSource, findMergeTarget, findSourceByUrl, getSource, mergeSources, renameSource, touchSource } from '../src/db/sourceRepo';
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

test('deleteSource — 출처는 내려가고 밑줄은 남되 출처에서 떨어진다', async () => {
  const db = await fresh();
  const s = await createSource(db, 'book', '데미안', '헤세');
  await addEntry(db, 'q1', s.id, { type: 'book', title: '데미안', subtitle: '헤세', quote: '새는 알에서' });
  await addEntry(db, 'q2', s.id, { type: 'book', title: '데미안', deleted_at: 1 }); // 이미 지운 기록
  await deleteSource(db, s.id);
  assert.equal(await getSource(db, s.id), null);
  const rows = await db.getAllAsync<{ id: string; source_id: string | null; title: string; quote: string | null }>('SELECT id, source_id, title, quote FROM entries ORDER BY id');
  // 기록은 남고, 무엇을 읽었는지도 남는다 — 출처와의 끈만 끊긴다
  assert.deepEqual(rows.map((r) => r.source_id), [null, null]);
  assert.equal(rows[0].title, '데미안');
  assert.equal(rows[0].quote, '새는 알에서');
  // 검토 큐의 진짜 조건으로 센다 — filed_at까지 봐야 한다.
  // 출처가 있는 기록은 만들 때 filed_at이 찍히므로, 그걸 안 지우면 출처도 없고 검토에도 없는 미아가 된다.
  assert.equal(await unfiledCount(db), 1);
});

test('mergeSources — 사용자가 지목한 대로 합친다: 비어 있던 칸만 채우고 기록을 옮긴다', async () => {
  const db = await fresh();
  const keep = await createSource(db, 'book', '데미안', null);
  const drop = await createSource(db, 'book', '데미인', '헤세');
  await addEntry(db, 'q1', drop.id, { type: 'book', title: '데미인', subtitle: '헤세' });
  await addEntry(db, 'q2', drop.id, { type: 'book', title: '데미인', deleted_at: 1 });
  const merged = await mergeSources(db, drop.id, keep.id);
  assert.equal(merged.id, keep.id);
  assert.equal(merged.title, '데미안'); // 남는 쪽 제목이 이긴다
  assert.equal(merged.creator, '헤세'); // 비어 있던 저자는 사라지는 쪽에서 채운다
  assert.equal(await getSource(db, drop.id), null);
  const rows = await db.getAllAsync<{ id: string; source_id: string; title: string }>('SELECT id, source_id, title FROM entries ORDER BY id');
  // 지운 기록까지 옮긴다 — 죽은 출처를 가리키는 참조를 남기지 않는다
  assert.deepEqual(rows.map((r) => r.source_id), [keep.id, keep.id]);
  assert.equal(rows[0].title, '데미안'); // 살아 있는 기록만 얼굴을 새로 받는다
  assert.equal(rows[1].title, '데미인');
});

test('mergeSources — 같은 출처끼리는 거부한다', async () => {
  const db = await fresh();
  const s = await createSource(db, 'book', '데미안', null);
  await assert.rejects(() => mergeSources(db, s.id, s.id));
});

test('findMergeTarget — 화면이 미리 물어볼 수 있게, 합쳐질 상대를 먼저 알려준다', async () => {
  const db = await fresh();
  const real = await createSource(db, 'book', '데미안', '헤세');
  const typo = await createSource(db, 'book', '데미인', null);
  // 제목을 '데미안'으로 고치면 real과 합쳐진다 — 고치기 전에 알 수 있다
  assert.equal((await findMergeTarget(db, typo.id, 'book', '데미안', null))?.id, real.id);
  // 안 겹치는 제목이면 상대가 없다
  assert.equal(await findMergeTarget(db, typo.id, 'book', '데미안2', null), null);
  // 자기 자신은 상대가 아니다
  assert.equal(await findMergeTarget(db, real.id, 'book', '데미안', null), null);
});

test('allSources — 출처마다 매달린 살아 있는 밑줄 수를 함께 센다', async () => {
  const db = await fresh();
  const a = await createSource(db, 'book', '데미안', null);
  const b = await createSource(db, 'book', '월든', null);
  await addEntry(db, 'q1', a.id, { type: 'book' });
  await addEntry(db, 'q2', a.id, { type: 'book' });
  await addEntry(db, 'q3', a.id, { type: 'book', deleted_at: 1 }); // 지운 것은 안 센다
  const rows = await allSources(db);
  const byId = new Map(rows.map((r) => [r.id, r.entry_count]));
  assert.equal(byId.get(a.id), 2);
  assert.equal(byId.get(b.id), 0); // 등록만 하고 안 쓴 출처도 목록에 나온다
  await deleteSource(db, b.id);
  assert.equal((await allSources(db)).length, 1); // 내려간 출처는 빠진다
});

test('deleteSource — 갈피가 붙은 기록은 검토로 다시 부르지 않는다: 갈피가 곧 구조다', async () => {
  const db = await fresh();
  const s = await createSource(db, 'book', '월든', null);
  await addEntry(db, 'q1', s.id, { type: 'book', filed_at: 100 });
  await addEntry(db, 'q2', s.id, { type: 'book', filed_at: 100 });
  await db.runAsync("INSERT INTO tags (id, name, created_at) VALUES ('t1', '단순함', 1)");
  await db.runAsync("INSERT INTO entry_tags (entry_id, tag_id) VALUES ('q2', 't1')");
  await deleteSource(db, s.id);
  // 갈피 없는 q1만 돌아온다. q2는 갈피가 있으니 이미 정리된 기록이다.
  assert.equal(await unfiledCount(db), 1);
  const rows = await db.getAllAsync<{ id: string; filed_at: number | null }>('SELECT id, filed_at FROM entries ORDER BY id');
  assert.equal(rows[0].filed_at, null);
  assert.equal(rows[1].filed_at, 100);
});
