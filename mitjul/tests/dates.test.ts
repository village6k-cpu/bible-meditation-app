import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  agoLabelKo,
  annKeyOf,
  dayKeyOf,
  daysBetween,
  hashDay,
  mondayOf,
  mulberry32,
  rangeOfDays,
} from '../src/core/dates';

test('새벽 4시 이전의 기록은 전날에 속한다', () => {
  assert.equal(dayKeyOf(new Date(2026, 7, 30, 0, 30)), '2026-08-29');
  assert.equal(dayKeyOf(new Date(2026, 7, 30, 3, 59)), '2026-08-29');
  assert.equal(dayKeyOf(new Date(2026, 7, 30, 4, 0)), '2026-08-30');
  assert.equal(dayKeyOf(new Date(2026, 7, 30, 23, 59)), '2026-08-30');
});

test('새벽 경계가 월초에서도 옳다', () => {
  assert.equal(dayKeyOf(new Date(2026, 8, 1, 1, 0)), '2026-08-31');
  assert.equal(dayKeyOf(new Date(2026, 0, 1, 2, 0)), '2025-12-31');
});

test('addDays와 daysBetween이 월·년 경계를 넘는다', () => {
  assert.equal(addDays('2026-08-31', 1), '2026-09-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(addDays('2024-02-28', 1), '2024-02-29'); // 윤년
  assert.equal(daysBetween('2026-08-01', '2026-09-01'), 31);
  assert.equal(daysBetween('2026-08-30', '2026-08-30'), 0);
});

test('annKeyOf는 월-일만 남긴다', () => {
  assert.equal(annKeyOf('2026-08-30'), '08-30');
  assert.equal(annKeyOf('2024-02-29'), '02-29');
});

test('mondayOf는 월요일 시작 주를 계산한다', () => {
  assert.equal(mondayOf('2026-08-30'), '2026-08-24'); // 일요일 → 그 주 월요일
  assert.equal(mondayOf('2026-08-24'), '2026-08-24'); // 월요일 자기 자신
  assert.equal(mondayOf('2026-09-01'), '2026-08-31'); // 화요일, 월 경계 너머
});

test('rangeOfDays는 양끝 포함', () => {
  assert.deepEqual(rangeOfDays('2026-08-30', '2026-09-01'), [
    '2026-08-30',
    '2026-08-31',
    '2026-09-01',
  ]);
});

test('agoLabelKo', () => {
  assert.equal(agoLabelKo('2026-08-30', '2026-08-30'), '오늘');
  assert.equal(agoLabelKo('2026-08-29', '2026-08-30'), '어제');
  assert.equal(agoLabelKo('2026-08-01', '2026-08-30'), '29일 전');
  assert.equal(agoLabelKo('2025-08-30', '2026-08-30'), '1년 전 오늘');
  assert.equal(agoLabelKo('2024-08-30', '2026-08-30'), '2년 전 오늘');
});

test('hashDay와 mulberry32는 결정적이다 — 같은 날엔 같은 난수열', () => {
  const a = mulberry32(hashDay('2026-08-30'));
  const b = mulberry32(hashDay('2026-08-30'));
  const seqA = [a(), a(), a()];
  const seqB = [b(), b(), b()];
  assert.deepEqual(seqA, seqB);
  for (const v of seqA) {
    assert.ok(v >= 0 && v < 1);
  }
  // 다른 날은 다른 시드
  assert.notEqual(hashDay('2026-08-30'), hashDay('2026-08-31'));
});
