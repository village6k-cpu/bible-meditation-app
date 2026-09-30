import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeDb, schemaUpTo } from './sqliteShim';
import { MIGRATIONS, migrate } from '../src/db/migrations';
import { createSource, getSource, mergeSources, renameSource, deleteSource } from '../src/db/sourceRepo';
import { createEntry } from '../src/db/entryRepo';
import { saveLibraryItem, listLibrary } from '../src/db/libraryRepo';
import { libraryInfo, filterLibrary, EMPTY_LIBRARY_FILTERS, librarySummary, libraryMarkdown, type LibraryInfo } from '../src/core/library';
import { acknowledgeChanges, preparePushBatch, applyRemoteRecords } from '../src/db/syncRepo';

type Db = Parameters<typeof migrate>[0];
const info: LibraryInfo = { version: 1, kind: 'book', status: 'completed', rating: 4.5, review: '다시 읽고 싶은 책', started_on: '2026-09-01', finished_on: '2026-09-30' };
async function setup() { const db = new FakeDb(); await migrate(db as unknown as Db); return db as unknown as Db; }

test('표지는 감상 JSON으로 두 기록함에 전달되고 기존 사진·리뷰·별점은 보존된다',async()=>{
  const a=await setup(), b=await setup();
  const source=await saveLibraryItem(a,{title:'모모',creator:'엔데',url:null,info});
  const entry=await createEntry(a,{type:'book',day:'2026-09-30',source_id:source.id,image_uri:'photos/user.jpg',body:'내 메모'});
  const catalog={provider:'kakao' as const,id:'9781234567890',image:'https://search1.kakaocdn.net/thumb/cover.jpg',url:'https://search.daum.net/search?w=bookpage&q=9781234567890',year:'2026'};
  await saveLibraryItem(a,{id:source.id,title:'모모',creator:'엔데',url:null,info:{...info,catalog}});
  const batch=await preparePushBatch(a);await applyRemoteRecords(b,batch.map((v,i)=>({...v,revision:i+1})));
  const received=(await getSource(b,source.id))!;
  assert.deepEqual(libraryInfo(received),{...info,catalog});assert.equal(received.thumbnail_uri,null);
  assert.equal((await b.getFirstAsync<{image_uri:string}>('SELECT image_uri FROM entries WHERE id=?',[entry]))?.image_uri,'photos/user.jpg');
  assert.deepEqual(libraryInfo({...received,library_json:JSON.stringify({...info,catalog:{...catalog,image:'https://evil.test'}})}),info);
  await assert.rejects(saveLibraryItem(a,{title:'다른 표기',creator:'다른 저자 표기',url:null,info:{...info,catalog}}),/이미/);
});

test('서재: v8 기록·출처·사진 참조를 보존하고 감상 정보를 추가한다', async () => {
  const raw = new FakeDb();
  await schemaUpTo(raw, 8, MIGRATIONS);
  const db = raw as unknown as Db;
  const source = await createSource(db, 'book', '모모', '엔데');
  const entry = await createEntry(db, {type:'book',day:'2026-09-30',source_id:source.id,quote:'밑줄',image_uri:'photos/kept.jpg'});
  await migrate(db);
  const saved = await saveLibraryItem(db, {id:source.id,title:'모모',creator:'엔데',url:null,info});
  assert.equal(saved.id, source.id);
  assert.equal(libraryInfo(saved)?.rating, 4.5);
  assert.equal((await db.getFirstAsync<{image_uri:string}>('SELECT image_uri FROM entries WHERE id=?',[entry]))?.image_uri, 'photos/kept.jpg');
  assert.deepEqual(await db.getAllAsync('PRAGMA foreign_key_check'), []);
});

test('서재: 기존 출처를 재사용하고 동명의 다른 종류·창작자는 구분한다', async () => {
  const db = await setup();
  const source = await createSource(db, 'book', '모모', '엔데');
  const saved = await saveLibraryItem(db, {title:' 모모 ',creator:'엔데',url:null,info});
  assert.equal(saved.id, source.id);
  await assert.rejects(saveLibraryItem(db, {title:'모모',creator:'엔데',url:null,info}), /이미/);
  const film = await saveLibraryItem(db, {title:'모모',creator:'감독',url:null,info:{...info,kind:'film'}});
  const music = await saveLibraryItem(db, {title:'모모',creator:'감독',url:null,info:{...info,kind:'music'}});
  assert.notEqual(film.id, music.id);
  assert.equal((await listLibrary(db)).length,3);
});

test('서재: 리뷰·반점·날짜가 두 기록함 사이를 왕복하며 구버전 필드 누락이 로컬 리뷰를 지우지 않는다', async () => {
  const a = await setup(); const b = await setup();
  const item = await saveLibraryItem(a,{title:'모모',creator:'엔데',url:null,info});
  const batch = await preparePushBatch(a);
  await applyRemoteRecords(b,batch.map((row,i)=>({...row,revision:i+1})));
  assert.deepEqual(libraryInfo((await getSource(b,item.id))!),info);
  await saveLibraryItem(b,{id:item.id,title:'모모',creator:'엔데',url:null,info:{...info,rating:5,review:'다른 기기에서 쓴 리뷰'}});
  await acknowledgeChanges(a,batch);
  const back = await preparePushBatch(b);
  await applyRemoteRecords(a,back.map(row=>({...row,revision:10})));
  assert.equal(libraryInfo((await getSource(a,item.id))!)?.review,'다른 기기에서 쓴 리뷰');
  const oldPayload = {...back[0].payload}; delete oldPayload.library_json;
  await applyRemoteRecords(a,[{...back[0],payload:oldPayload,revision:11}]);
  assert.equal(libraryInfo((await getSource(a,item.id))!)?.rating,5);
});

test('서재: 잘못된 별점·날짜·링크를 거부하고 삭제한 작품은 편집으로 되살리지 않는다', async () => {
  const db = await setup();
  for(const bad of [{...info,rating:6},{...info,rating:1.2},{...info,finished_on:'2026-02-30'},{...info,started_on:'2026-10-01'}]) {
    await assert.rejects(saveLibraryItem(db,{title:'테스트',creator:null,url:null,info:bad}));
  }
  await assert.rejects(saveLibraryItem(db,{title:'테스트',creator:null,url:'javascript:alert(1)',info}));
  const saved = await saveLibraryItem(db,{title:'테스트',creator:null,url:null,info});
  await deleteSource(db,saved.id);
  await assert.rejects(saveLibraryItem(db,{id:saved.id,title:'테스트',creator:null,url:null,info}),/찾/);
});

test('서재: 기존 출처 합치기는 리뷰를 보존하고 서로 다른 리뷰를 조용히 버리지 않는다', async () => {
  const db = await setup();
  const a = await saveLibraryItem(db,{title:'책 A',creator:null,url:null,info});
  const b = await createSource(db,'book','책 B',null);
  await mergeSources(db,a.id,b.id);
  assert.deepEqual(libraryInfo((await getSource(db,b.id))!),info);
  const c = await saveLibraryItem(db,{title:'책 C',creator:null,url:null,info:{...info,rating:2}});
  await assert.rejects(mergeSources(db,c.id,b.id),/감상/);
  await assert.rejects(renameSource(db,c.id,'책 B',null,null),/감상/);
  assert.ok(await getSource(db,c.id));
  const film = await createSource(db,'video','영화 출처',null);
  await assert.rejects(mergeSources(db,c.id,film.id),/서로 다른 출처 종류/);
  assert.deepEqual(libraryInfo((await getSource(db,c.id))!),{...info,rating:2});
});

test('서재: 종류·완료연도·리뷰 검색·별점 정렬과 미평가 제외 집계', async () => {
  const db = await setup();
  await saveLibraryItem(db,{title:'올해 책',creator:'작가',url:null,info});
  await saveLibraryItem(db,{title:'지난 영화',creator:'감독',url:null,info:{...info,kind:'film',rating:5,started_on:null,finished_on:'2025-10-01'}});
  await createSource(db,'book','기존 밑줄 책',null);
  const items=await listLibrary(db);
  assert.equal(filterLibrary(items,{...EMPTY_LIBRARY_FILTERS,year:'2026',q:'다시'}).length,1);
  assert.equal(filterLibrary(items,{...EMPTY_LIBRARY_FILTERS,kind:'film',sort:'rating'})[0].title,'지난 영화');
  assert.equal(filterLibrary(items,{...EMPTY_LIBRARY_FILTERS,status:'untracked'}).length,1);
  assert.deepEqual(librarySummary(items,'2026'),{total:3,completed:2,thisYear:1,active:0,planned:0,average:4.75});
});

test('서재: 제목·공통 링크 변경은 연결 메모에 전파하되 개별 링크와 사진은 보존한다', async()=>{
  const db=await setup();
  const source=await saveLibraryItem(db,{title:'책',creator:'작가',url:'https://example.com/old',info});
  const a=await createEntry(db,{type:'writing',day:'2026-09-30',source_id:source.id,url:source.url,image_uri:'photos/kept.jpg',body:'원문'});
  const b=await createEntry(db,{type:'writing',day:'2026-09-30',source_id:source.id,url:'https://example.com/individual',body:'개별 메모'});
  await saveLibraryItem(db,{id:source.id,title:'책 수정',creator:'작가 수정',url:'https://example.com/new',info});
  const row=await db.getFirstAsync('SELECT title,subtitle,url,image_uri,body FROM entries WHERE id=?',[a]);
  assert.deepEqual(row,{title:'책 수정',subtitle:'작가 수정',url:'https://example.com/new',image_uri:'photos/kept.jpg',body:'원문'});
  assert.equal((await db.getFirstAsync<{url:string}>('SELECT url FROM entries WHERE id=?',[b]))?.url,'https://example.com/individual');
  assert.match(libraryMarkdown(await listLibrary(db)),/4.5 \/ 5/);
  assert.match(libraryMarkdown(await listLibrary(db)),/다시 읽고 싶은 책/);
});

test('서재: 연결 기록 변경 실패 시 별점·리뷰·제목도 원자적으로 되돌린다',async()=>{
  const db=await setup();
  const source=await saveLibraryItem(db,{title:'원본',creator:null,url:null,info});
  await createEntry(db,{type:'writing',day:'2026-09-30',source_id:source.id,body:'보존'});
  await db.execAsync("CREATE TRIGGER fail_library_update BEFORE UPDATE ON entries BEGIN SELECT RAISE(ABORT, '기록 수정 실패'); END");
  await assert.rejects(saveLibraryItem(db,{id:source.id,title:'변경',creator:null,url:null,info:{...info,rating:1,review:'변경'}}),/기록 수정 실패/);
  const kept=(await getSource(db,source.id))!;
  assert.equal(kept.title,'원본');
  assert.deepEqual(libraryInfo(kept),info);
});
