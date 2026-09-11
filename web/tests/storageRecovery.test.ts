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
  selectedSnapshot?: boolean;
  archive?: Uint8Array;
  writeFails?: boolean;
  lockHeld?: boolean;
} = {}) {
  const sqlite = await initSqlite();
  let directory = options.directory ?? 'missing';
  let actualInstalls = 0;
  let cachedFailure: Error | null = null;
  const stored = new Map<string, unknown>([['snapshot', options.snapshot], ['selected-engine', options.selectedSnapshot ? 'snapshot' : undefined]]);
  stored.set('recovery-snapshot-v1', options.archive);
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
            const tx: any = { objectStore() { return { get(key: string) {
              const read: any = {};
              queueMicrotask(() => {
                if (options.snapshotReadError) {
                  read.error = new DOMException('Snapshot unavailable', 'UnknownError');
                  read.onerror();
                } else {
                  read.result = stored.get(key);
                  read.onsuccess();
                }
              });
              return read;
            }, put(value: unknown, key: string) {
              queueMicrotask(() => {
                if (options.writeFails) {
                  tx.error = new DOMException('Disk full', 'QuotaExceededError');
                  tx.onabort?.();
                  tx.onerror?.();
                } else {
                  stored.set(key, value);
                  tx.oncomplete?.();
                }
              });
            } }; } };
            return tx;
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
    navigator: {
      storage: directory === 'unavailable' ? {} : { getDirectory },
      locks: { request: async (_name: string, _opts: unknown, fn: (lock: unknown) => unknown) => fn(options.lockHeld ? null : {}) },
    },
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
    get snapshot() { return stored.get('snapshot') as Uint8Array; },
    get selectedSnapshot() { return stored.get('selected-engine') === 'snapshot'; },
    get archive() { return stored.get('recovery-snapshot-v1') as Uint8Array; },
    failWrites() { options.writeFails = true; },
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

test('손상된 스냅숏은 OPFS가 있어도 원본을 자동으로 덮지 않는다', async () => {
  const worker = await fixture({ directory: 'present', snapshot: new Uint8Array([1]) });
  assert.equal((await worker.call('open')).ok, false);
  assert.equal(worker.actualInstalls, 0);
});

test('두 저장소가 있어도 선택 없이 기존 스냅숏을 자동 보존·재개하고 새 기록을 다시 연다', async () => {
  const sqlite = await initSqlite();
  const original = new sqlite.oo1.DB(':memory:');
  original.exec("CREATE TABLE entries(body TEXT); INSERT INTO entries VALUES ('아이폰에서 보던 기록')");
  const snapshot = sqlite.capi.sqlite3_js_db_export(original.pointer!);
  original.close();
  const worker = await fixture({ directory: 'present', snapshot });
  const opened = await worker.call('open');
  assert.equal(opened.result.engine, 'memory');
  assert.equal((await worker.call('first', 'SELECT body FROM entries')).result.body, '아이폰에서 보던 기록');
  assert.deepEqual(worker.snapshot, snapshot, '열기만으로 원본 스냅숏을 덮지 않는다');
  assert.equal(worker.actualInstalls, 0, 'OPFS 원본은 초기화하지 않는다');
  assert.equal(worker.selectedSnapshot, true);
  assert.deepEqual(worker.archive, snapshot);
  await worker.call('run', "INSERT INTO entries VALUES ('복구 후 새 기록')");
  await worker.call('flush');
  const reopened = await fixture({ directory: 'present', snapshot: worker.snapshot, selectedSnapshot: worker.selectedSnapshot, archive: worker.archive });
  assert.equal((await reopened.call('open')).result.engine, 'memory');
  assert.equal((await reopened.call('first', 'SELECT COUNT(*) AS n FROM entries')).result.n, 2);
  assert.equal(reopened.actualInstalls, 0);
  assert.deepEqual(reopened.archive, snapshot, '처음 안전 사본을 새 스냅숏으로 덮지 않는다');
});

test('IndexedDB 저장 성공 응답 전 기록을 영속화하여 별도 flush 없이 재실행해도 남는다', async () => {
  const worker = await fixture({ directory: 'unavailable' });
  await worker.call('open');
  await worker.call('exec', 'CREATE TABLE entries(body TEXT)');
  const saved = await worker.call('run', "INSERT INTO entries VALUES ('자동 저장')");
  assert.equal(saved.ok, true);
  const reopened = await fixture({ directory: 'unavailable', snapshot: worker.snapshot });
  await reopened.call('open');
  assert.equal((await reopened.call('first', 'SELECT body FROM entries')).result.body, '자동 저장');
});

test('디스크 저장 실패를 저장 성공으로 응답하지 않는다', async () => {
  const worker = await fixture({ directory: 'unavailable' });
  await worker.call('open');
  await worker.call('exec', 'CREATE TABLE entries(body TEXT)');
  const before = worker.snapshot?.slice();
  worker.failWrites();
  const saved = await worker.call('run', "INSERT INTO entries VALUES ('저장 실패 기록')");
  assert.equal(saved.ok, false);
  assert.match(saved.error!, /Disk full/);
  assert.deepEqual(worker.snapshot, before);
});

test('열려 있는 기록함과 다른 탭이 같은 스냅숏을 동시에 덮어쓰지 않는다', async () => {
  const worker = await fixture({ lockHeld: true, directory: 'unavailable' });
  assert.equal((await worker.call('open')).result.engine, 'blocked');
  assert.equal(worker.actualInstalls, 0);
});

test('손상된 대체 기록은 선택 상태를 저장하거나 원본을 덮지 않는다', async () => {
  const snapshot = new Uint8Array([1, 2, 3]);
  const worker = await fixture({ directory: 'present', snapshot });
  assert.equal((await worker.call('open')).ok, false);
  assert.equal(worker.selectedSnapshot, false);
  assert.deepEqual(worker.snapshot, snapshot);
  assert.equal(worker.actualInstalls, 0);
});

test('진행 중인 트랜잭션이나 롤백 기록은 재실행 스냅숏에 남지 않는다', async () => {
  const worker = await fixture({ directory: 'unavailable' });
  await worker.call('open');
  await worker.call('exec', 'CREATE TABLE entries(body TEXT)');
  const before = worker.snapshot.slice();
  await worker.call('begin');
  await worker.call('run', "INSERT INTO entries VALUES ('롤백할 글')");
  await worker.call('flush');
  assert.deepEqual(worker.snapshot, before);
  await worker.call('rollback');
  await worker.call('flush');
  const reopened = await fixture({ directory: 'unavailable', snapshot: worker.snapshot });
  await reopened.call('open');
  assert.equal((await reopened.call('first', 'SELECT COUNT(*) AS n FROM entries')).result.n, 0);
});

test('선택했던 대체 기록이 없어졌으면 빈 기록함으로 전환하지 않는다', async () => {
  const worker = await fixture({ directory: 'present', selectedSnapshot: true });
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
