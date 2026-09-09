import test from 'node:test';
import assert from 'node:assert/strict';
import { ResurfaceCandidate, pickDeck } from '../src/core/resurface';

function candidate(partial: Partial<ResurfaceCandidate> & { id: string }): ResurfaceCandidate {
  return {
    type: 'book',
    day: '2026-01-10',
    pinned: 0,
    hasText: true,
    lastShownDay: null,
    skipped: false,
    retired: false,
    ...partial,
  };
}

const TODAY = '2026-08-30';

test('같은 날, 같은 후보면 항상 같은 덱', () => {
  const pool = Array.from({ length: 20 }, (_, i) => candidate({ id: `e${i}` }));
  const a = pickDeck(TODAY, pool);
  const b = pickDeck(TODAY, pool);
  assert.deepEqual(a, b);
});

test('후보 배열의 순서가 달라도 덱은 같다', () => {
  const pool = Array.from({ length: 12 }, (_, i) => candidate({ id: `e${i}` }));
  const shuffled = [...pool].reverse();
  assert.deepEqual(pickDeck(TODAY, pool), pickDeck(TODAY, shuffled));
});

test('그날의 기록 슬롯 — 같은 월·일의 가장 오래된 해가 뽑힌다', () => {
  const deck = pickDeck(TODAY, [
    candidate({ id: 'far', day: '2023-08-30' }),
    candidate({ id: 'near', day: '2025-08-30' }),
    candidate({ id: 'other', day: '2025-01-01' }),
  ]);
  const ann = deck.find((d) => d.slot === 'anniversary');
  assert.equal(ann?.id, 'far');
});

test('아껴둔 밑줄 슬롯 — 노출 이력 없는 pinned가 우선', () => {
  const deck = pickDeck(TODAY, [
    candidate({ id: 'p-shown', pinned: 1, lastShownDay: '2026-08-01' }),
    candidate({ id: 'p-never', pinned: 1 }),
    candidate({ id: 'plain' }),
  ]);
  const pinned = deck.find((d) => d.slot === 'pinned');
  assert.equal(pinned?.id, 'p-never');
});

test('보내준(retired) 기록은 어떤 슬롯에도 나오지 않는다', () => {
  const deck = pickDeck(TODAY, [
    candidate({ id: 'gone', day: '2025-08-30', pinned: 1, retired: true }),
    candidate({ id: 'alive' }),
  ]);
  assert.ok(deck.every((d) => d.id !== 'gone'));
});

test('잊힌 문장 슬롯 — 30일 내 노출된 기록은 제외', () => {
  const deck = pickDeck(TODAY, [
    candidate({ id: 'recent', lastShownDay: '2026-08-20' }),
    candidate({ id: 'old', lastShownDay: '2026-06-01' }),
  ]);
  const forgotten = deck.find((d) => d.slot === 'forgotten');
  assert.equal(forgotten?.id, 'old');
});

test('오늘 날짜의 기록은 덱에 오르지 않는다', () => {
  const deck = pickDeck(TODAY, [candidate({ id: 'today', day: TODAY })]);
  assert.equal(deck.length, 0);
});

test('한 기록이 두 슬롯을 차지하지 않는다', () => {
  // 기념일이자 pinned인 단 하나의 후보 — anniversary 슬롯만 차지해야 한다
  const deck = pickDeck(TODAY, [candidate({ id: 'only', day: '2024-08-30', pinned: 1 })]);
  assert.equal(deck.filter((d) => d.id === 'only').length, 1);
});

test('빈 서재면 빈 덱', () => {
  assert.deepEqual(pickDeck(TODAY, []), []);
});
