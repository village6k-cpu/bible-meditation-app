/// <reference lib="webworker" />
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import type { StorageHealth, OpenOptions } from './sqlite';

// SQLite는 워커에서 산다. OPFS의 동기 접근 핸들이 워커에만 노출되기 때문이고,
// 덕분에 큰 질의가 화면을 붙잡지도 않는다.
// 바깥과는 다섯 개의 연산만 주고받는다 — 네이티브 앱의 db 레이어가 쓰던 그 다섯.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const VFS_NAME = 'mitjul-vfs';
let dbName = 'mitjul.db';
const dbPath = () => `/${dbName}`;
let idbName = 'mitjul-store';
const IDB_STORE = 'db';
const IDB_KEY = 'snapshot';
const SELECTED_ENGINE_KEY = 'selected-engine';

let s3: Any = null;
let raw: Any = null;
let pool: Any = null;
// 세 번째 상태가 있다: OPFS에 이 앱의 저장소가 분명히 있는데 열지 못한 경우.
// 그때 메모리로 물러서면 '두 번째 빈 기록함'이 열려 사용자가 거기에 적기 시작한다.
// 그건 물러서기가 아니라 조용한 데이터 분실이므로, 열지 않고 멈춘다.
let engine: 'opfs' | 'memory' | 'blocked' = 'memory';
let saveTimer: ReturnType<typeof setTimeout> | null = null;

/* ── 메모리로 물러났을 때 쓰는 스냅숏 상자 ── */
function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(idbName, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbRead(key: string): Promise<unknown> {
  const d = await idb();
  return new Promise((resolve, reject) => {
    const r = d.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key);
    r.onsuccess = () => resolve(r.result ?? null);
    r.onerror = () => reject(r.error);
  });
}
async function idbGet(): Promise<Uint8Array | null> {
  return (await idbRead(IDB_KEY)) as Uint8Array | null;
}
async function idbWrite(key: string, value: unknown): Promise<void> {
  const d = await idb();
  await new Promise<void>((resolve, reject) => {
    const tx = d.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function serialize(): Uint8Array {
  return s3.capi.sqlite3_js_db_export(raw.pointer) as Uint8Array;
}

async function flush(): Promise<void> {
  if (engine !== 'memory') return;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  await idbWrite(IDB_KEY, serialize());
}

function touch(): void {
  if (engine !== 'memory') return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void flush();
  }, 400);
}

function deserializeInto(target: Any, bytes: Uint8Array): void {
  const p = s3.wasm.allocFromTypedArray(bytes);
  const rc = s3.capi.sqlite3_deserialize(
    target.pointer,
    'main',
    p,
    bytes.byteLength,
    bytes.byteLength,
    s3.capi.SQLITE_DESERIALIZE_FREEONCLOSE | s3.capi.SQLITE_DESERIALIZE_RESIZEABLE
  );
  target.checkRc(rc);
}

let opfsError: string | null = null;

// SAHPool은 '한 엔진에 하나' 규칙이 있어 두 번째 탭에서는 열리지 않는다.
// 그 경우와 '이 브라우저에 OPFS가 아예 없다'는 경우를 구분해야 한다 — 앞은 멈춰야 하고 뒤는 물러서도 된다.
type PoolDirectory = 'present' | 'missing' | 'unknown' | 'unavailable';

async function inspectPoolDirectory(): Promise<StorageHealth['directory']> {
  if (typeof navigator.storage?.getDirectory !== 'function') return { state: 'unavailable', error: null };
  try {
    const root = await navigator.storage.getDirectory();
    try {
      await root.getDirectoryHandle('.' + VFS_NAME, { create: false });
      return { state: 'present', error: null };
    } catch (e) {
      // NotFoundError만 '없음'이다. 접근 오류를 없음으로 바꾸면 빈 기록함이 열린다.
      if (e instanceof Error && e.name === 'NotFoundError') return { state: 'missing', error: null };
      throw e;
    }
  } catch (e) {
    return { state: 'unknown', error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) };
  }
}

async function poolDirectory(): Promise<PoolDirectory> {
  const result = await inspectPoolDirectory();
  if (result.error) opfsError = result.error;
  return result.state;
}

async function storageHealth(): Promise<StorageHealth> {
  const directory = await inspectPoolDirectory();
  let snapshot: StorageHealth['snapshot'];
  try {
    snapshot = { bytes: (await idbGet())?.byteLength ?? 0, error: null };
  } catch (e) {
    snapshot = { bytes: null, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) };
  }
  return { engine, openingError: opfsError, directory, snapshot };
}

async function open(opts: OpenOptions = {}): Promise<{
  engine: string;
  opfsError: string | null;
  recovery?: 'snapshot';
}> {
  if (opts.name) {
    dbName = opts.name;
    idbName = `mitjul-store-${opts.name}`;
  }
  s3 = await (sqlite3InitModule as (o?: unknown) => Promise<Any>)({
    print: () => {},
    printErr: () => {},
  });
  // 먼저 이전 대체 저장소를 읽는다. 읽기 실패를 '기록 없음'으로 삼지 않는다.
  const saved = await idbGet();
  const selectedSnapshot = opts.recovery === 'snapshot' || (await idbRead(SELECTED_ENGINE_KEY)) === 'snapshot';
  const before = await poolDirectory();
  if (selectedSnapshot && !saved?.byteLength) {
    engine = 'blocked';
    opfsError = '선택했던 대체 기록함을 찾을 수 없습니다. 빈 기록함으로 전환하지 않았습니다. 백업을 보관해 주세요.';
    return { engine, opfsError };
  }
  if (saved && saved.byteLength > 0) {
    if (before === 'present' && !selectedSnapshot) {
      engine = 'blocked';
      opfsError = '이전에 쓰던 대체 기록함과 파일 저장소 폴더가 함께 있습니다. 폴더 안의 기록은 아직 비교하지 않았습니다.';
      return { engine, opfsError, recovery: 'snapshot' };
    }
    // 사용자 선택은 유효한 Ledger 스냅숏을 확인한 뒤에만 기억한다.
    // 파일 저장소는 초기화·삭제·병합하지 않는다. 폴더 존재는 기록 충돌의 증거가 아니다.
    assertOurDb(saved);
    // OPFS가 회복되어도 대체 저장소에서 적은 미전송 기록을 버리고 새 DB를 열지 않는다.
    engine = 'memory';
    raw = new s3.oo1.DB(':memory:', 'c');
    deserializeInto(raw, saved);
    if (opts.recovery === 'snapshot') await idbWrite(SELECTED_ENGINE_KEY, 'snapshot');
    opfsError ??= '이전에 사용하던 대체 저장소의 기록을 이어서 열었습니다.';
    return { engine, opfsError };
  }
  if (before === 'unknown') {
    engine = 'blocked';
    return { engine, opfsError };
  }
  // 같은 VFS 이름의 실패는 캐시된다. 기존 저장소가 없음을 전후로 확인한 경우에만
  // 실제 재초기화한다. 기존 파일이나 확인 불가 상태에는 강제 재시도를 하지 않는다.
  for (let attempt = 0; attempt < 2; attempt++) {
    if (before === 'unavailable') {
      opfsError = '이 브라우저에 OPFS API가 없습니다.';
      break;
    }
    try {
      pool = await s3.installOpfsSAHPoolVfs({
        name: VFS_NAME,
        initialCapacity: 4,
        forceReinitIfPreviouslyFailed: attempt > 0,
      });
      raw = new pool.OpfsSAHPoolDb(dbPath());
      engine = 'opfs';
      opfsError = null;
      return { engine, opfsError };
    } catch (e) {
      opfsError = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      pool = null;
    }
    // SAHPool의 실패 정리 후 디렉터리가 없어져도, 시도 전에 있던 기록을 잊지 않는다.
    if (before === 'present' || (await poolDirectory()) !== 'missing') {
      engine = 'blocked';
      return { engine, opfsError };
    }
  }
  engine = 'memory';
  raw = new s3.oo1.DB(':memory:', 'c');
  return { engine, opfsError };
}

function rows(sql: string, params: unknown[]): unknown[] {
  return raw.exec({
    sql,
    bind: params && params.length ? (params as never[]) : undefined,
    rowMode: 'object',
    returnValue: 'resultRows',
  }) as unknown[];
}

// 넘겨받은 바이트가 이 앱의 DB인지 먼저 본다 — 아니면 손대지 않는다
function assertOurDb(bytes: Uint8Array): void {
  const probe = new s3.oo1.DB(':memory:', 'c');
  try {
    deserializeInto(probe, bytes);
    const n = probe.exec({
      sql: "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='entries'",
      rowMode: 0,
      returnValue: 'resultRows',
    }) as number[];
    if (!n[0]) throw new Error('Ledger의 백업 파일이 아닙니다 (entries 표 없음).');
  } finally {
    probe.close();
  }
}

// ── 사진 ──
// SAHPool VFS는 자기 디렉터리('.mitjul-vfs')를 독점한다. 사진은 그 바깥의 별도 디렉터리에 둔다.
// 쓰기는 동기 접근 핸들로 — 이 길만이 OPFS가 열리는 모든 판에서 함께 열린다.
const PHOTO_DIR = 'photos';

async function photoDir(): Promise<Any> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(PHOTO_DIR, { create: true });
}

async function writePhoto(name: string, bytes: Uint8Array): Promise<void> {
  const dir = await photoDir();
  const file = await dir.getFileHandle(name, { create: true });
  const access = await file.createSyncAccessHandle();
  try {
    access.truncate(0);
    access.write(bytes, { at: 0 });
    access.flush();
  } finally {
    access.close();
  }
}

async function deletePhoto(name: string): Promise<void> {
  const dir = await photoDir();
  await dir.removeEntry(name).catch(() => {});
}

async function listPhotos(): Promise<{ name: string; size: number }[]> {
  const dir = await photoDir();
  const out: { name: string; size: number }[] = [];
  for await (const [name, handle] of dir.entries() as AsyncIterable<[string, Any]>) {
    if (handle.kind !== 'file') continue;
    const f = await handle.getFile();
    out.push({ name, size: f.size });
  }
  out.sort((a, b) => (a.name < b.name ? -1 : 1));
  return out;
}

type Req = {
  id: number;
  op: string;
  sql?: string;
  params?: unknown[];
  bytes?: Uint8Array;
  name?: string;
  opts?: OpenOptions;
};

self.onmessage = async (ev: MessageEvent<Req>) => {
  const { id, op, sql, params } = ev.data;
  try {
    let result: unknown = null;
    switch (op) {
      case 'open':
        result = await open(ev.data.opts ?? {});
        break;
      case 'storageHealth':
        result = await storageHealth();
        break;
      case 'exec':
        raw.exec(sql!);
        touch();
        break;
      case 'run':
        raw.exec({
          sql: sql!,
          bind: params && params.length ? (params as never[]) : undefined,
        });
        touch();
        break;
      case 'all':
        result = rows(sql!, params ?? []);
        break;
      case 'first':
        result = rows(sql!, params ?? [])[0] ?? null;
        break;
      case 'begin':
        raw.exec('BEGIN');
        break;
      case 'commit':
        raw.exec('COMMIT');
        touch();
        break;
      case 'rollback':
        try {
          raw.exec('ROLLBACK');
        } catch {
          /* 이미 풀렸으면 그만 */
        }
        break;
      case 'flush':
        await flush();
        break;
      case 'photoWrite':
        await writePhoto(ev.data.name!, ev.data.bytes!);
        break;
      case 'photoDelete':
        await deletePhoto(ev.data.name!);
        break;
      case 'photoList':
        result = await listPhotos();
        break;
      case 'serialize':
        result = serialize();
        break;
      case 'restore': {
        const bytes = ev.data.bytes!;
        // 검사는 전부 여는 것보다 먼저. 연결을 닫아 놓고 '아니었다'고 말하면 앱이 벽돌이 된다.
        assertOurDb(bytes);
        if (pool) {
          raw.close();
          try {
            await pool.importDb(dbPath(), bytes);
          } finally {
            // 들여오기가 실패해도 연결은 반드시 되살린다 (옛 파일이 그대로 남아 있다)
            raw = new pool.OpfsSAHPoolDb(dbPath());
          }
        } else {
          deserializeInto(raw, bytes);
          await flush();
        }
        break;
      }
      default:
        throw new Error(`알 수 없는 연산: ${op}`);
    }
    (self as unknown as Worker).postMessage({ id, ok: true, result });
  } catch (e) {
    (self as unknown as Worker).postMessage({
      id,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
};
