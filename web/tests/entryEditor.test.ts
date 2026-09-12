import test from 'node:test';
import assert from 'node:assert/strict';
import { h } from 'preact';
import { render } from 'preact-render-to-string';
import { migrate } from '../../mitjul/src/db/migrations';
import { createEntry, getEntry, tagsOf } from '../../mitjul/src/db/entryRepo';
import { FakeDb } from '../../mitjul/tests/sqliteShim';
import { CaptureSheet } from '../src/ui/sheets/Capture';

test('새 글·묵상에도 사진 추가 버튼이 명시적으로 표시된다', () => {
  for (const presetType of ['writing', 'verse'] as const) {
    const html = render(h(CaptureSheet, {handle:{} as any, presetType, presetText:'',
      onClose() {}, setGuard() {}, toast() {}}));
    assert.match(html, /사진 추가/);
  }
});

async function editor() {
  const module = await import('../src/ui/parts/EntryEditor').catch((e) => {
    if (e.code === 'ERR_MODULE_NOT_FOUND') return {};
    throw e;
  });
  assert.equal(typeof module.EntryEditor, 'function', '고치기에 유형 변경과 사진 첨부가 있어야 한다');
  return module;
}

test('글·묵상 편집에서 유형 변경과 사진 추가가 항상 보인다', async () => {
  const { EntryEditor, draftOf } = await editor();
  for (const type of ['writing', 'verse']) {
    const e = {type, body:'보존할 글', title:null, subtitle:null, quote:null, page:null, image_uri:null};
    const html = render(h(EntryEditor, {draft:draftOf(e, []), entry:e, busy:false,
      preview:null, onChange() {}, onPick() {}, onRemove() {}}));
    assert.match(html, /aria-label="기록 유형"/);
    assert.match(html, /aria-pressed="true"[^>]*>.*?(글|묵상)/);
    assert.match(html, /사진 추가/);
    assert.match(html, /보존할 글/);
  }
});

test('유형 변경 중 원래 인용문·본문 주소는 사라지지 않고 계속 고칠 수 있다', async () => {
  const { EntryEditor, draftOf, inputOf } = await editor();
  const e = {type:'verse', day:'2026-09-13', source_id:null, title:null, subtitle:'시편 23:1',
    quote:'기존 말씀', body:'기존 묵상', page:null, image_uri:'photos/kept.jpg'};
  const draft = {...draftOf(e, ['생각']), type:'writing'};
  const input = inputOf(e, draft);
  assert.equal(input.type, 'writing');
  assert.equal(input.subtitle, '시편 23:1');
  assert.equal(input.quote, '기존 말씀');
  assert.equal(input.body, '기존 묵상');
  assert.equal(input.image_uri, 'photos/kept.jpg');
  assert.deepEqual(input.tags, ['생각']);
  const html = render(h(EntryEditor, {draft, entry:e, busy:false, preview:null,
    onChange() {}, onPick() {}, onRemove() {}}));
  assert.match(html, /시편 23:1/);
  assert.match(html, /기존 말씀/);
  assert.match(html, /사진 바꾸기/);
  assert.match(html, /사진 떼기/);
});

test('수정 저장은 글·사진과 갈피를 함께 반영하고 사진 전송을 대기시킨다', async () => {
  const { draftOf, saveEdit } = await editor();
  const raw = new FakeDb();
  const db = raw as unknown as Parameters<typeof migrate>[0];
  await migrate(db);
  const id = await createEntry(db, {type:'verse', day:'2026-09-13', body:'기존 글', tags:['생각']});
  const entry = await getEntry(db, id);
  const handle = Object.assign(raw, {async flush() {}});
  await saveEdit(handle, entry, {...draftOf(entry, ['생각']), type:'writing', image_uri:'photos/new.jpg'});
  assert.equal((await getEntry(db, id))?.type, 'writing');
  assert.equal((await getEntry(db, id))?.image_uri, 'photos/new.jpg');
  assert.deepEqual((await tagsOf(db, [id])).get(id), ['생각']);
  assert.deepEqual(await db.getFirstAsync('SELECT action,state FROM photo_jobs WHERE photo_uri=?', ['photos/new.jpg']), {action:'upload',state:'pending'});
});

test('갈피 저장 실패는 유형·사진 변경도 되돌리고 기존 기록을 보존한다', async () => {
  const { draftOf, saveEdit } = await editor();
  const raw = new FakeDb();
  const db = raw as unknown as Parameters<typeof migrate>[0];
  await migrate(db);
  const id = await createEntry(db, {type:'verse', day:'2026-09-13', body:'원본', image_uri:'photos/original.jpg', tags:['보존']});
  const entry = await getEntry(db, id);
  await raw.execAsync("CREATE TRIGGER fail_edit_tags BEFORE INSERT ON entry_tags BEGIN SELECT RAISE(ABORT, '저장 실패'); END");
  await assert.rejects(() => saveEdit(Object.assign(raw, {async flush() {}}), entry,
    {...draftOf(entry, ['새갈피']), type:'writing', image_uri:'photos/new.jpg'}), /저장 실패/);
  assert.equal((await getEntry(db, id))?.type, 'verse');
  assert.equal((await getEntry(db, id))?.image_uri, 'photos/original.jpg');
  assert.deepEqual((await tagsOf(db, [id])).get(id), ['보존']);
});
