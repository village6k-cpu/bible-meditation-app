import test from 'node:test';
import assert from 'node:assert/strict';
import { h } from 'preact';
import { render } from 'preact-render-to-string';
import { SyncStatus } from '../src/ui/parts/SyncStatus';

test('홈 화면은 완료·대기·오프라인·실패를 구분하며 저장소 선택을 요구하지 않는다', () => {
  const connected = { phase: 'idle' as const, email: 'test@example.com', lastSyncedAt: 123, error: null };
  const draw = (state: any, online = true) => render(h(SyncStatus, { state, online, onOpen() {} }));
  assert.match(draw(connected), /동기화 완료/);
  assert.match(draw({ ...connected, phase: 'pending' }), /전송 대기/);
  assert.doesNotMatch(draw({ ...connected, phase: 'pending' }), /동기화 완료/);
  assert.match(draw(connected, false), /오프라인.*연결되면 자동/);
  assert.match(draw({ ...connected, phase: 'error', error: '사진 연결 필요' }), /사진 연결 필요/);
  assert.doesNotMatch(draw(connected), /내보내기|대체 기록함|OPFS/);
});
