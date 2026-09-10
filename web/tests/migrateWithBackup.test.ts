import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateWithBackup } from '../src/sync/migrateWithBackup';

test('백업 공유를 취소하면 연결 이전을 실행하지 않는다', async () => {
  let moved = false;
  const result = await migrateWithBackup(async () => 'cancelled', async () => { moved = true; });
  assert.equal(result, false);
  assert.equal(moved, false);
});

test('백업 실패는 그대로 알리고 이전을 실행하지 않는다', async () => {
  let moved = false;
  await assert.rejects(() => migrateWithBackup(async () => { throw new Error('백업 실패'); }, async () => { moved = true; }), /백업 실패/);
  assert.equal(moved, false);
});

test('백업 전달 완료 뒤에만 연결을 이전한다', async () => {
  const events: string[] = [];
  const result = await migrateWithBackup(async () => { events.push('backup'); return 'downloaded'; }, async () => { events.push('move'); });
  assert.equal(result, true);
  assert.deepEqual(events, ['backup', 'move']);
});
