import test from 'node:test';
import assert from 'node:assert/strict';
import { getSyncState, publishSyncState, subscribeSyncState, type SyncState } from '../src/sync/state';

test('화면을 그린 뒤 구독하기 전에 끝난 로그인 결과도 즉시 전달한다', () => {
  const seen: SyncState[] = [];
  const signedOut: SyncState = { phase: 'signed-out', email: null, lastSyncedAt: null, error: null };
  publishSyncState(signedOut);
  const rendered = getSyncState();
  const failed: SyncState = { ...signedOut, error: '로그인 취소' };
  publishSyncState(failed);
  const unsubscribe = subscribeSyncState((next) => seen.push(next));
  try {
    assert.equal(rendered.error, null);
    assert.deepEqual(seen, [failed]);
    const signedIn: SyncState = { phase: 'idle', email: 'test@example.com', lastSyncedAt: null, error: null };
    publishSyncState(signedIn);
    assert.deepEqual(seen, [failed, signedIn]);
    unsubscribe();
    publishSyncState(signedOut);
    assert.equal(seen.length, 2);
  } finally {
    unsubscribe();
    publishSyncState(signedOut);
  }
});
