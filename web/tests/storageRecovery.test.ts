import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import initSqlite from '@sqlite.org/sqlite-wasm';

// 실제 워커와 SQLite WASM을 실행한다. 브라우저 파일 API/IndexedDB만 격리한다.
// 실제 SAHPool은 실패 Promise를 이름별로 보관하며 초기화 실패 시 디렉터리를 정리할 수 있다.
const compiled = ts.transpileModule(
  readFileSync(new URL('../src/db/worker.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;

type Directory = 'present' | 'missing' | 'unknown' | 'unavailable';
type Reply = { ok: boolean; result: any; error?: string };

async function fixture(options: {
  directory?: Directory;
  failInstalls?: number;
  removesDirectoryOnFailure?: boolean;
  snapshot?: Uint8Array;
  snapshotReadError?: boolean;
} = {}) {
  const sqlite = await initSqlite();
  let directory = options.directory ?? 'missing';
  let actualInstalls = 0;
  let cachedFailure: Error | null = null;
  const dbs: InstanceType<typeof sqlite.oo1.DB>[] = [];
  const invalidState = new DOMException('The object is in an invalid state.', 'InvalidStateError');
  const pool = {
    OpfsSAHPoolDb: function () {
      const db = new sqlite.oo1.DB(':memory:');
      dbs.push(db);
      return db;
    },
  };
  const getDirectory = async () => {
    if (directory === 'unknown') throw invalidState;
    return {
      async getDirectoryHandle(name: string, opts: { create: boolean }) {
        assert.equal(name, '.mitjul-vfs');
        assert.equal(opts.create, false);
        if (directory === 'missing') throw new DOMException('Not found', 'NotFoundError');
        return {};
      },
    };
  };
  const indexedDB = {
    open() {
      const request: any = {};
      queueMicrotask(() => {
        request.result = {
          close() {},
          transaction() {
            return { objectStore() { return { get() {
              const read: any = {};
              queueMicrotask(() => {
                if (options.snapshotReadError) {
                  read.error = new DOMException('Snapshot unavailable', 'UnknownError');
                  read.onerror();
                } else {
                  read.result = options.snapshot;
                  read.onsuccess();
                }
              });
              return read;
            } }; } };
          },
        };
        request.onsuccess();
      });
      return request;
    },
  };
  let reply!: Reply;
  const self = {
    onmessage: null as unknown as (event: { data: unknown }) => Promise<void>,
    postMessage(value: Reply) { reply = value; },
  };
  runInNewContext(compiled, {
    exports: {}, self, indexedDB, Error, DOMException, Uint8Array, setTimeout, clearTimeout,
    navigator: { storage: directory === 'unavailable' ? {} : { getDirectory } },
    require(name: string) {
      assert.equal(name, '@sqlite.org/sqlite-wasm');
      return { default: async () => ({
        ...sqlite,
        async installOpfsSAHPoolVfs(opts: { forceReinitIfPreviouslyFailed?: boolean }) {
          if (cachedFailure && !opts.forceReinitIfPreviouslyFailed) throw cachedFailure;
          actualInstalls++;
          if (actualInstalls <= (options.failInstalls ?? 0)) {
            if (options.removesDirectoryOnFailure) directory = 'missing';
            cachedFailure = invalidState;
            throw invalidState;
          }
          directory = 'present';
          return pool;
        },
      }) };
    },
  });
  return {
    async call(op: string, sql?: string): Promise<Reply> {
      await self.onmessage({ data: { id: 1, op, sql } });
      return reply;
    },
    get actualInstalls() { return actualInstalls; },
    setDirectory(value: Directory) { directory = value; },
    close() { for (const db of dbs) db.close(); },
  };
}

test('OPFS 존재 확인 자체가 실패하면 빈 임시 기록함을 만들지 않는다', async () => {
  const worker = await fixture({ directory: 'unknown', failInstalls: 99 });
  assert.equal((await worker.call('open')).result.engine, 'blocked');
});

test('기존 OPFS 디렉터리가 초기화 실패 뒤 사라져도 빈 기록함을 만들지 않는다', async () => {
  const worker = await fixture({ directory: 'present', failInstalls: 99, removesDirectoryOnFailure: true });
  assert.equal((await worker.call('open')).result.engine, 'blocked');
  assert.ok(worker.actualInstalls <= 1);
});

test('처음부터 빈 저장소의 일시적인 초기화 실패는 캐시된 실패 대신 실제 재시도를 한다', async () => {
  const worker = await fixture({ failInstalls: 1 });
  try {
    assert.equal((await worker.call('open')).result.engine, 'opfs');
    assert.equal(worker.actualInstalls, 2);
  } finally { worker.close(); }
});

test('이전 IndexedDB 기록은 OPFS가 회복돼도 빈 OPFS 뒤에 숨지 않는다', async () => {
  const sqlite = await initSqlite();
  const original = new sqlite.oo1.DB(':memory:');
  original.exec("CREATE TABLE entries(body TEXT); INSERT INTO entries VALUES ('폰에서 아직 보내지 않은 기록')");
  const snapshot = sqlite.capi.sqlite3_js_db_export(original.pointer!);
  original.close();
  const worker = await fixture({ snapshot });
  assert.equal((await worker.call('open')).result.engine, 'memory');
  const found = await worker.call('first', 'SELECT body FROM entries');
  assert.equal(found.result.body, '폰에서 아직 보내지 않은 기록');
  assert.equal(worker.actualInstalls, 0);
});

test('IndexedDB 읽기 오류를 기록 없음으로 바꾸지 않는다', async () => {
  const worker = await fixture({ failInstalls: 99, snapshotReadError: true });
  const opened = await worker.call('open');
  assert.equal(opened.ok, false);
  assert.match(opened.error!, /Snapshot unavailable/);
});

test('기존 OPFS와 IndexedDB 기록이 함께 있으면 어느 쪽도 자동으로 덮지 않는다', async () => {
  const worker = await fixture({ directory: 'present', snapshot: new Uint8Array([1]) });
  assert.equal((await worker.call('open')).result.engine, 'blocked');
  assert.equal(worker.actualInstalls, 0);
});

test('기존 기록함이 잠겼을 때는 강제 재초기화하지 않는다', async () => {
  const worker = await fixture({ directory: 'present', failInstalls: 99 });
  assert.equal((await worker.call('open')).result.engine, 'blocked');
  assert.ok(worker.actualInstalls <= 1);
});

test('OPFS 없는 브라우저는 IndexedDB 경로를 사용할 수 있다', async () => {
  const worker = await fixture({ directory: 'unavailable', failInstalls: 99 });
  assert.equal((await worker.call('open')).result.engine, 'memory');
});

test('기존 기록이 없는 것이 확실한 초기화 실패에만 IndexedDB로 전환한다', async () => {
  const worker = await fixture({ failInstalls: 99 });
  assert.equal((await worker.call('open')).result.engine, 'memory');
});

test('저장 상태 점검은 기록 내용 없이 엔진·파일 접근·스냅숏 크기만 반환한다', async () => {
  const sqlite = await initSqlite();
  const original = new sqlite.oo1.DB(':memory:');
  original.exec("CREATE TABLE entries(body TEXT); INSERT INTO entries VALUES ('점검에 노출되면 안 되는 본문')");
  const snapshot = sqlite.capi.sqlite3_js_db_export(original.pointer!);
  original.close();
  const worker = await fixture({ snapshot });
  await worker.call('open');
  const before = (await worker.call('serialize')).result;
  const reply = await worker.call('storageHealth');
  assert.equal(reply.ok, true);
  assert.equal(reply.result.engine, 'memory');
  assert.equal(reply.result.directory.state, 'missing');
  assert.equal(reply.result.snapshot.bytes, snapshot.byteLength);
  assert.equal(reply.result.snapshot.error, null);
  assert.equal(JSON.stringify(reply.result).includes('점검에 노출되면'), false);
  assert.deepEqual((await worker.call('serialize')).result, before);
  assert.equal(worker.actualInstalls, 0, '점검은 SAHPool을 재초기화하지 않는다');
});

test('점검 중 현재 OPFS 접근이 실패해도 최초 열기 결과는 바꾸지 않는다', async () => {
  const worker = await fixture();
  try {
    await worker.call('open');
    worker.setDirectory('unknown');
    const reply = await worker.call('storageHealth');
    assert.equal(reply.ok, true);
    assert.equal(reply.result.engine, 'opfs');
    assert.equal(reply.result.openingError, null);
    assert.equal(reply.result.directory.state, 'unknown');
    assert.match(reply.result.directory.error, /InvalidStateError/);
    worker.setDirectory('present');
    assert.equal((await worker.call('storageHealth')).result.openingError, null);
    assert.equal(worker.actualInstalls, 1);
  } finally { worker.close(); }
});
