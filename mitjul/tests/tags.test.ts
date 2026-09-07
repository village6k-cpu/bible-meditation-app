import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTagInput } from '../src/core/tags';

// 출처의 last_tags는 tags.join(' ')로 저장되고, 컴포저는 그 문자열을 태그 입력칸에 그대로 되살린다.
// 이 왕복이 깨지면 "같은 책이면 태그를 다시 적을 일이 없다"는 약속이 깨진다.
test('last_tags 왕복 — join(" ")한 태그를 다시 파싱하면 같은 태그', () => {
  const tags = ['독서', '기록-습관', 'faith'];
  assert.deepEqual(parseTagInput(tags.join(' ')), tags);
});

test('태그 입력 — #·쉼표·공백 어느 쪽으로 적어도 같은 태그', () => {
  assert.deepEqual(parseTagInput('#독서 #신앙'), ['독서', '신앙']);
  assert.deepEqual(parseTagInput('독서, 신앙'), ['독서', '신앙']);
  assert.deepEqual(parseTagInput('독서,신앙 독서'), ['독서', '신앙']);
  assert.deepEqual(parseTagInput('   '), []);
});
