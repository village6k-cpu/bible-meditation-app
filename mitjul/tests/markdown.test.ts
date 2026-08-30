import test from 'node:test';
import assert from 'node:assert/strict';
import { ExportEntry, buildDailyNote, buildRangeNote } from '../src/core/markdown';
import { Entry } from '../src/core/types';

let seq = 0;
function entry(partial: Partial<Entry> & { type: Entry['type'] }, tags: string[] = []): ExportEntry {
  seq += 1;
  return {
    id: `e${String(seq).padStart(3, '0')}`,
    day: '2026-08-30',
    created_at: 1000 + seq,
    updated_at: 1000 + seq,
    deleted_at: null,
    pinned: 0,
    revisit_count: 0,
    last_revisited_at: null,
    title: null,
    subtitle: null,
    quote: null,
    body: null,
    url: null,
    image_uri: null,
    page: null,
    slot: null,
    minutes: null,
    practiced: null,
    done: null,
    due_time: null,
    ...partial,
    tags,
  };
}

test('데일리 노트 — 프런트매터, 유형 섹션, 인용 관례', () => {
  const md = buildDailyNote('2026-08-30', [
    entry(
      { type: 'book', title: '모모', subtitle: '미하엘 엔데', quote: '시간을 재는 달력과 시계', page: 57 },
      ['독서']
    ),
    entry({ type: 'verse', subtitle: '시편 23:1', body: '목자이신 하나님' }, ['말씀']),
    entry({ type: 'workout', title: '달리기', minutes: 30, practiced: 1 }),
    entry({ type: 'task', title: '원고 마감', done: 1 }),
  ]);

  assert.ok(md.startsWith('---\ndate: 2026-08-30\ntypes: [book, verse, workout, task]\n'));
  assert.ok(md.includes('tags: [독서, 말씀]'));
  assert.ok(md.includes('# 8월 30일 일요일'));
  assert.ok(md.includes('## 책'));
  assert.ok(md.includes('> 시간을 재는 달력과 시계'));
  assert.ok(md.includes('> — 미하엘 엔데, 『모모』, p.57'));
  assert.ok(md.includes('## 묵상'));
  assert.ok(md.includes('**시편 23:1**'));
  assert.ok(md.includes('## 운동'));
  assert.ok(md.includes('달리기 30분'));
  assert.ok(md.includes('- [x] 원고 마감'));
  assert.ok(md.includes('#독서'));
});

test('프런트매터 태그는 정렬되고 특수문자는 따옴표로 감싼다', () => {
  const md = buildDailyNote('2026-08-30', [
    entry({ type: 'moment', body: '좋은 날' }, ['b-tag', 'a:tag']),
  ]);
  assert.ok(md.includes('tags: ["a:tag", b-tag]'));
});

test('삭제된 기록은 내보내지 않는다', () => {
  const md = buildDailyNote('2026-08-30', [
    entry({ type: 'moment', body: '남는 기록' }),
    entry({ type: 'moment', body: '지운 기록', deleted_at: 123 }),
  ]);
  assert.ok(md.includes('남는 기록'));
  assert.ok(!md.includes('지운 기록'));
});

test('빌더는 결정적이다 — 두 번 불러도 바이트까지 같다', () => {
  const entries = [
    entry({ type: 'writing', title: '어느 저녁', body: '골목의 빛' }, ['산문']),
    entry({ type: 'meal', slot: 'dinner', body: '미역국', practiced: 1 }),
  ];
  assert.equal(buildDailyNote('2026-08-30', entries), buildDailyNote('2026-08-30', entries));
});

test('기간 노트 — 기록 없는 날은 건너뛴다', () => {
  const md = buildRangeNote([
    { day: '2026-08-29', entries: [] },
    { day: '2026-08-30', entries: [entry({ type: 'moment', body: '하루' })] },
  ]);
  assert.ok(!md.includes('8월 29일'));
  assert.ok(md.includes('8월 30일'));
});

test('사진은 임베드가 아니라 파일명 한 줄', () => {
  const md = buildDailyNote('2026-08-30', [
    entry({ type: 'moment', body: '노을', image_uri: 'images/abc.jpg' }),
  ]);
  assert.ok(md.includes('사진: images/abc.jpg'));
  assert.ok(!md.includes('![['));
});
