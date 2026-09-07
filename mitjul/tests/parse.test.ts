import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCapture } from '../src/core/parse';

// 한 칸에 아무거나 넣으면 구조가 붙는다 — 이 앱이 노션과 갈리는 지점이라 규칙을 못 박아 둔다.

test('링크 — 붙여넣으면 링크 기록', () => {
  const c = parseCapture('https://youtu.be/dQw4w9WgXcQ 기록에 대한 강연');
  assert.equal(c.type, 'link');
  assert.equal(c.url, 'https://youtu.be/dQw4w9WgXcQ');
  assert.equal(c.body, '기록에 대한 강연');
  assert.ok(c.confident);
  assert.ok(c.signals.some((s) => s.kind === 'url'));
});

test('쪽수 — 책 밑줄로', () => {
  const c = parseCapture('시간은 삶이며 삶은 마음속에 깃들여 있다 p.57');
  assert.equal(c.type, 'book');
  assert.equal(c.page, 57);
  assert.equal(c.body, '시간은 삶이며 삶은 마음속에 깃들여 있다');
  assert.ok(c.confident);
});

test('쪽수 표기 여러 가지', () => {
  for (const [text, page] of [
    ['p.57 문장', 57],
    ['p 120 문장', 120],
    ['문장 240쪽', 240],
    ['문장 88p', 88],
    ['문장 12페이지', 12],
    ['p.57-58 문장', 57],
  ] as [string, number][]) {
    assert.equal(parseCapture(text).page, page, text);
  }
});

test('본문 주소 — 묵상으로, 약어는 정식 이름으로 편다', () => {
  const c = parseCapture('시 23:1 여호와는 나의 목자시니');
  assert.equal(c.type, 'verse');
  assert.equal(c.subtitle, '시편 23:1');
  const range = parseCapture('롬 8:28-30 모든 것이 합력하여');
  assert.equal(range.subtitle, '로마서 8:28-30');
  const chapter = parseCapture('창세기 1장 읽음');
  assert.equal(chapter.subtitle, '창세기 1장');
  const full = parseCapture('요한복음 3:16');
  assert.equal(full.subtitle, '요한복음 3:16');
});

test('본문 주소의 콜론을 시각으로 읽지 않는다', () => {
  const c = parseCapture('시편 23:1 묵상');
  assert.equal(c.dueTime, null);
  assert.equal(c.subtitle, '시편 23:1');
});

test('해시태그는 갈피로 걷어낸다', () => {
  const c = parseCapture('오늘 본 것 #기록 #습관');
  assert.deepEqual(c.tags, ['기록', '습관']);
  assert.equal(c.body, '오늘 본 것');
});

test('식사 — 때를 알아본다', () => {
  const c = parseCapture('점심 김치찌개');
  assert.equal(c.type, 'meal');
  assert.equal(c.slot, 'lunch');
  assert.equal(c.body, '김치찌개');
  assert.equal(parseCapture('아침 토스트').slot, 'breakfast');
  assert.equal(parseCapture('야식 라면').slot, 'snack');
});

test('운동 — 종류와 분', () => {
  const c = parseCapture('달리기 30분');
  assert.equal(c.type, 'workout');
  assert.equal(c.minutes, 30);
  assert.equal(c.title, '달리기');
  assert.equal(parseCapture('헬스 1시간 20분').minutes, 80);
  assert.equal(parseCapture('요가 1시간').minutes, 60);
});

test('할 일 — 체크박스와 시각', () => {
  const c = parseCapture('- [ ] 원고 보내기 14:00');
  assert.equal(c.type, 'task');
  assert.equal(c.done, false);
  assert.equal(c.dueTime, '14:00');
  assert.equal(c.title, '원고 보내기');
  const done = parseCapture('[x] 장보기');
  assert.equal(done.type, 'task');
  assert.equal(done.done, true);
  assert.equal(parseCapture('할 일: 전화하기').type, 'task');
});

test('시각 — 오전·오후를 24시로', () => {
  assert.equal(parseCapture('- [ ] 회의 오후 3시').dueTime, '15:00');
  assert.equal(parseCapture('- [ ] 회의 오전 9시 30분').dueTime, '09:30');
  assert.equal(parseCapture('- [ ] 회의 오후 12시').dueTime, '12:00');
});

test('인용 — 따옴표와 인용 줄', () => {
  const q = parseCapture('"우리는 우리가 반복하는 것이다"');
  assert.equal(q.quote, '우리는 우리가 반복하는 것이다');
  assert.equal(q.type, 'book');
  assert.equal(q.confident, false); // 책일 확률이 높지만 확신하지 않는다
  assert.equal(parseCapture('> 옮겨 적은 문장').quote, '옮겨 적은 문장');
});

test('아무 신호도 없으면 순간', () => {
  const c = parseCapture('골목에 빛이 좋았다');
  assert.equal(c.type, 'moment');
  assert.equal(c.body, '골목에 빛이 좋았다');
  assert.ok(c.confident);
});

test('긴 글은 글로', () => {
  const c = parseCapture('가'.repeat(300));
  assert.equal(c.type, 'writing');
  assert.equal(parseCapture('글: 어느 저녁에 대하여').type, 'writing');
});

test('빈 입력은 조용히', () => {
  const c = parseCapture('');
  assert.equal(c.type, 'moment');
  assert.equal(c.confident, false);
  assert.equal(c.body, null);
  assert.deepEqual(c.tags, []);
  assert.deepEqual(c.signals, []);
});

test('신호가 섞여도 우선순위대로 — 링크가 가장 세다', () => {
  const c = parseCapture('https://example.com/a 점심 30분 #메모');
  assert.equal(c.type, 'link');
  assert.deepEqual(c.tags, ['메모']);
  assert.equal(c.minutes, 30);
  assert.equal(c.slot, 'lunch');
});

test('신호 칩은 원문 위치 순으로 돌려준다', () => {
  const c = parseCapture('#첫태그 p.57 문장 https://example.com/x');
  const kinds = c.signals.map((s) => s.kind);
  assert.deepEqual(kinds, ['tag', 'page', 'url']);
});
