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
