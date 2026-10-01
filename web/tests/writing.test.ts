import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { h } from 'preact';
import { render } from 'preact-render-to-string';
import { migrate } from '../../mitjul/src/db/migrations';
import { getEntry, deleteEntry } from '../../mitjul/src/db/entryRepo';
import { FakeDb } from '../../mitjul/tests/sqliteShim';
import { blankWriting, saveWriting, type WritingSession } from '../src/ui/parts/writingDraft';
import { draftOf } from '../src/ui/parts/EntryEditor';
import { CaptureSheet } from '../src/ui/sheets/Capture';
import { Navigation } from '../src/ui/parts/Navigation';

async function setup() {
  const db=new FakeDb();await migrate(db as any);
  return Object.assign(db,{async flush(){}}) as any;
}
test('글·묵상은 처음부터 전체 화면 원고 편집기로 열리고 빠른 캡처는 유지된다',()=>{
  for(const type of ['writing','verse'] as const){
    const html=render(h(CaptureSheet,{handle:{} as any,presetType:type,presetText:'원고',onClose(){},setGuard(){},toast(){}}));
    assert.match(html,/sheet writing-sheet/);assert.match(html,/writing-text/);
    assert.match(html,/원고/);assert.match(html,/이어서 작성/);assert.match(html,/사진 추가/);
  }
  const quick=render(h(CaptureSheet,{handle:{} as any,presetType:null,presetText:'',onClose(){},setGuard(){},toast(){}}));
  assert.match(quick,/몰입해서 쓰기/);assert.match(quick,/자동 인식/);
});
test('원고 저장은 문단·공백·시간·링크를 그대로 두고 같은 기록에 이어 쓴다',async()=>{
  const db=await setup();const session:WritingSession={id:null,day:'2026-10-01'};
  const body='  아침 10:30에 30분 걸었다.\n\n\n"인용문" #생각 https://example.com\n  끝  ';
  const draft={...draftOf(blankWriting('writing',session.day),[]),title:'원고',body,image_uri:'photos/kept.jpg'};
  await saveWriting(db,session,draft);const id=session.id!;
  assert.equal((await getEntry(db,id))?.body,body);
  await saveWriting(db,session,{...draft,body:body+'\n다음 문단'});
  assert.equal(session.id,id);
  assert.equal((await getEntry(db,id))?.body,body+'\n다음 문단');
  assert.equal((await getEntry(db,id))?.image_uri,'photos/kept.jpg');
  assert.equal((await db.getFirstAsync('SELECT COUNT(*) AS n FROM entries')).n,1);
});
test('파일 반영 실패 뒤 다시 저장해도 원고가 중복 생성되지 않는다',async()=>{
  const db=await setup();const session:WritingSession={id:null,day:'2026-10-01'};
  const draft={...draftOf(blankWriting('verse',session.day),[]),body:'보존',quote:'말씀'};
  db.flush=async()=>{throw Error('파일 실패');};
  await assert.rejects(saveWriting(db,session,draft),/파일 실패/);
  const id=session.id;assert.ok(id);
  db.flush=async()=>{};await saveWriting(db,session,draft);
  assert.equal(session.id,id);assert.equal((await db.getFirstAsync('SELECT COUNT(*) AS n FROM entries')).n,1);
});
test('원고 트랜잭션 실패는 기록 ID와 부분 저장을 남기지 않는다',async()=>{
  const db=await setup();const session:WritingSession={id:null,day:'2026-10-01'};
  await db.execAsync("CREATE TRIGGER fail_writing BEFORE INSERT ON entry_tags BEGIN SELECT RAISE(ABORT, '갈피 실패'); END");
  const draft={...draftOf(blankWriting('writing',session.day),[]),body:'원고',tags:'실패'};
  await assert.rejects(saveWriting(db,session,draft),/갈피 실패/);
  assert.equal(session.id,null);assert.equal((await db.getFirstAsync('SELECT COUNT(*) AS n FROM entries')).n,0);
});
test('다른 화면에서 삭제한 원고는 저장으로 되살리지 않는다',async()=>{
  const db=await setup();const session:WritingSession={id:null,day:'2026-10-01'};
  const draft={...draftOf(blankWriting('writing',session.day),[]),body:'원고'};
  await saveWriting(db,session,draft);await deleteEntry(db,session.id!);
  await assert.rejects(saveWriting(db,session,draft),/찾을 수 없습니다/);
});
test('다섯 모바일 탭은 같은 폭이며 적기는 그리드 밖, 데스크톱 원고는 팝업 제한 밖이다',()=>{
  const html=render(h(Navigation,{tab:'library',onTab(){},onCompose(){},toast:null}));
  assert.equal((html.match(/class="stroke"/g)||[]).length,5);
  assert.equal((html.match(/class="fab"/g)||[]).length,1);
  for(const label of ['수집함','기록','서재','검토','지표','적기'])assert.ok(html.includes(label));
  const css=readFileSync(new URL('../src/ui/styles.css',import.meta.url),'utf8');
  assert.match(css,/nav\.tabbar \{ display: grid; grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(css,/nav\.tabbar \.fab \{\s*position: absolute/);
  assert.match(css,/\.sheet\.writing-sheet \{\s*inset: 0;\s*transform: none;\s*width: 100%;\s*height: 100%;\s*max-height: none/);
});
