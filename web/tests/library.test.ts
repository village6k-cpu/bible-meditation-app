import test from 'node:test';
import assert from 'node:assert/strict';
import { h } from 'preact';
import { render } from 'preact-render-to-string';
import { LibraryView, Rating } from '../src/ui/parts/LibraryView';
import { LibraryEditor } from '../src/ui/parts/LibraryEditor';
import { EMPTY_LIBRARY_FILTERS, libraryItem, type LibraryInfo } from '../../mitjul/src/core/library';
import type { Source } from '../../mitjul/src/core/types';

const info: LibraryInfo = {version:1,kind:'film',status:'completed',rating:4.5,review:'다시 보고 싶은 영화',started_on:null,finished_on:'2026-09-30'};
const source: Source = {id:'film-1',kind:'video',title:'인터스텔라',creator:'크리스토퍼 놀런',url:null,thumbnail_uri:null,created_at:1,last_used_at:1,last_tags:'',deleted_at:null,library_json:JSON.stringify(info)};
const props = {items:[libraryItem({...source,entry_count:2})],filters:EMPTY_LIBRARY_FILTERS,today:'2026-09-30',
  onFilters() {},onOpen() {},onAdd() {},onExport() {},loading:false,error:null};

test('서재에는 작품 종류·감상 상태·반점·리뷰·메모 수와 검색/정렬 도구가 보인다',()=>{
  const html=render(h(LibraryView,props));
  for(const text of ['인터스텔라','크리스토퍼 놀런','다시 보고 싶은 영화','메모 2','2026-09-30 완료','팟캐스트','감상 예정','서재 검색','서재 정렬','4점 이상']) assert.ok(html.includes(text),text);
  assert.match(html,/aria-label="별점 4.5점 \/ 5점"/);
  assert.match(render(h(Rating,{value:4.5})),/width:50%/);
  assert.match(render(h(Rating,{value:null})),/미평가/);
});

test('빈 서재와 필터 결과 없음은 구별하고 기존 출처를 완료로 꾸미지 않는다',()=>{
  assert.match(render(h(LibraryView,{...props,items:[]})),/첫 작품 추가/);
  const filtered=render(h(LibraryView,{...props,filters:{...EMPTY_LIBRARY_FILTERS,kind:'book'}}));
  assert.match(filtered,/조건에 맞는 작품이 없습니다/);
  assert.match(filtered,/필터 초기화/);
  const html=render(h(LibraryView,{...props,items:[libraryItem({...source,library_json:null,entry_count:2})]}));
  assert.match(html,/상태 미지정/);
  assert.match(html,/날짜 미지정/);
  assert.doesNotMatch(html,/2026-09-30 완료/);
});

test('감상 편집에 제목·종류·반점·날짜·리뷰가 복원되고 연결된 기록 영향이 명시된다',()=>{
  const html=render(h(LibraryEditor,{source,noteCount:2,today:'2026-09-30',async onSave() {},onClose() {},setGuard() {}}));
  for(const text of ['인터스텔라','다시 보고 싶은 영화','4.5점','감상 상태','시작일','완료일','연결된 밑줄·메모 2개','본문과 사진은 그대로']) assert.ok(html.includes(text),text);
  assert.match(html,/<option selected value="film">/);
  assert.match(html,/<option selected value="4.5">/);
});
