import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db/sqlite';

test('자체 점검 파일 이름이 워커에 전달돼 기본 기록함을 건드리지 않는다', async () => {
  const previous = globalThis.Worker;
  const messages: { id: number; op: string; opts?: { name?: string } }[] = [];
  class FakeWorker {
    onmessage?: (event: { data: unknown }) => void;
    postMessage(message: (typeof messages)[number]) {
      messages.push(message);
      queueMicrotask(() => this.onmessage?.({
        data: { id: message.id, ok: true, result: { engine: 'opfs', opfsError: null } },
      }));
    }
  }
  globalThis.Worker = FakeWorker as unknown as typeof Worker;
  try {
    await openDb('mitjul-selftest.db');
    assert.deepEqual(messages[0].opts, { name: 'mitjul-selftest.db' });
    await openDb();
    assert.equal(messages[1].opts, undefined);
  } finally {
    globalThis.Worker = previous;
  }
});

test('기존 OPFS가 잠겨 있으면 질의 가능한 기록함을 반환하지 않고 안전한 재시도 방법을 알린다', async () => {
  const previous = globalThis.Worker;
  const operations: string[] = [];
  let terminated = false;
  class LockedWorker {
    onmessage?: (event: { data: unknown }) => void;
    postMessage(message: { id: number; op: string }) {
      operations.push(message.op);
      queueMicrotask(() => this.onmessage?.({
        data: { id: message.id, ok: true, result: { engine: 'blocked', opfsError: 'Access Handles cannot be created' } },
      }));
    }
    terminate() { terminated = true; }
  }
  globalThis.Worker = LockedWorker as unknown as typeof Worker;
  try {
    await assert.rejects(openDb(), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /다른 Ledger 탭/);
      assert.match(error.message, /저장소를 삭제하지/);
      return true;
    });
    assert.deepEqual(operations, ['open']);
    assert.equal(terminated, true);
  } finally {
    globalThis.Worker = previous;
  }
});

test('저장소 읽기에 실패한 워커는 종료하고 오류를 숨기지 않는다', async () => {
  const previous = globalThis.Worker;
  let terminated = false;
  class FailedWorker {
    onmessage?: (event: { data: unknown }) => void;
    postMessage(message: { id: number }) {
      queueMicrotask(() => this.onmessage?.({
        data: { id: message.id, ok: false, error: '기존 저장소를 읽지 못했습니다' },
      }));
    }
    terminate() { terminated = true; }
  }
  globalThis.Worker = FailedWorker as unknown as typeof Worker;
  try {
    await assert.rejects(openDb(), /기존 저장소를 읽지 못했습니다/);
    assert.equal(terminated, true);
  } finally { globalThis.Worker = previous; }
});
