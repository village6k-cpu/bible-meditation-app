import test from 'node:test';
import assert from 'node:assert/strict';
import { newId } from '../src/core/ids';
import { extractHashtags, normalizeTags, parseTagInput } from '../src/core/tags';
import { dotLevel, streakOf } from '../src/core/trends';
import { TrendRow } from '../src/core/types';

test('newId — 시간순 정렬, 즉시 연속 생성해도 서로 다르다', () => {
  const a = newId(1000);
  const b = newId(1000);
  const c = newId(2000);
  assert.notEqual(a, b);
  assert.ok(a < c && b < c);
});

test('태그 정규화 — #, 공백, 대소문자, 중복', () => {
  assert.deepEqual(normalizeTags(['#독서', ' 독서 ', '기록 습관', 'Faith']), [
    '독서',
    '기록-습관',
    'faith',
  ]);
});

test('본문 속 해시태그 추출', () => {
  assert.deepEqual(extractHashtags('오늘 #독서 그리고 #기록_습관 완료'), ['독서', '기록_습관']);
});

test('태그 입력 파싱 — 쉼표·공백 혼용', () => {
  assert.deepEqual(parseTagInput('#독서, 신앙  묵상'), ['독서', '신앙', '묵상']);
});

function row(partial: Partial<TrendRow> & { day: string }): TrendRow {
  return {
    workoutDone: false,
    workoutMinutes: 0,
    mealCount: 0,
    mealPracticed: 0,
    verseCount: 0,
    entryCount: 0,
    ...partial,
  };
}

test('먹점 농도 — 식사는 기록/일부 실천/전부 실천의 세 단계', () => {
  assert.equal(dotLevel('meal', row({ day: 'd', mealCount: 0 })), 0);
  assert.equal(dotLevel('meal', row({ day: 'd', mealCount: 2, mealPracticed: 0 })), 1);
  assert.equal(dotLevel('meal', row({ day: 'd', mealCount: 2, mealPracticed: 1 })), 2);
  assert.equal(dotLevel('meal', row({ day: 'd', mealCount: 2, mealPracticed: 2 })), 3);
});

test('스트릭 — 오늘 아직 안 했어도 어제까지의 흐름은 살아 있다', () => {
  const rows = new Map<string, TrendRow>([
    ['2026-08-29', row({ day: '2026-08-29', workoutDone: true })],
    ['2026-08-28', row({ day: '2026-08-28', workoutDone: true })],
    ['2026-08-27', row({ day: '2026-08-27', workoutDone: true })],
  ]);
  assert.equal(streakOf('workout', rows, '2026-08-30'), 3);
});

test('스트릭 — 월 경계를 넘어 이어진다', () => {
  const rows = new Map<string, TrendRow>([
    ['2026-09-01', row({ day: '2026-09-01', verseCount: 1 })],
    ['2026-08-31', row({ day: '2026-08-31', verseCount: 1 })],
    ['2026-08-30', row({ day: '2026-08-30', verseCount: 1 })],
  ]);
  assert.equal(streakOf('verse', rows, '2026-09-01'), 3);
});

test('스트릭 — 끊기면 0', () => {
  const rows = new Map<string, TrendRow>([
    ['2026-08-27', row({ day: '2026-08-27', workoutDone: true })],
  ]);
  assert.equal(streakOf('workout', rows, '2026-08-30'), 0);
});
