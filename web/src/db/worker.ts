/// <reference lib="webworker" />
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

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
async function idbGet(): Promise<Uint8Array | null> {
  const d = await idb();
  return new Promise((resolve, reject) => {
    const r = d.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(IDB_KEY);
    r.onsuccess = () => resolve((r.result as Uint8Array) ?? null);
    r.onerror = () => reject(r.error);
  });
}
async function idbPut(bytes: Uint8Array): Promise<void> {
  const d = await idb();
  await new Promise<void>((resolve, reject) => {
    const tx = d.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(bytes, IDB_KEY);
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
  await idbPut(serialize());
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
async function poolDirExists(): Promise<boolean> {
  try {
    const root = await navigator.storage.getDirectory();
    await root.getDirectoryHandle('.' + VFS_NAME, { create: false });
    return true;
  } catch {
    return false;
  }
}

async function open(opts: { name?: string } = {}): Promise<{
  engine: string;
  opfsError: string | null;
}> {
  if (opts.name) {
    dbName = opts.name;
    idbName = `mitjul-store-${opts.name}`;
  }
  s3 = await (sqlite3InitModule as (o?: unknown) => Promise<Any>)({
    print: () => {},
    printErr: () => {},
  });
  // 동기 접근 핸들의 첫 획득은 이따금 어긋난다 — 한 번은 다시 해 본다
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      pool = await s3.installOpfsSAHPoolVfs({ name: VFS_NAME, initialCapacity: 4 });
      raw = new pool.OpfsSAHPoolDb(dbPath());
      engine = 'opfs';
      opfsError = null;
      return { engine, opfsError };
    } catch (e) {
      opfsError = e instanceof Error ? e.message : String(e);
      pool = null;
    }
  }
  if (await poolDirExists()) {
    // 기록함이 저기 있는데 열지 못했다. 빈 기록함을 새로 열어 주지 않는다.
    engine = 'blocked';
    return { engine, opfsError };
  }
  engine = 'memory';
  raw = new s3.oo1.DB(':memory:', 'c');
  const saved = await idbGet().catch(() => null);
  if (saved && saved.byteLength > 0) deserializeInto(raw, saved);
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
    if (!n[0]) throw new Error('밑줄의 백업 파일이 아닙니다 (entries 표 없음).');
  } finally {
    probe.close();
  }
}

type Req = {
  id: number;
  op: string;
  sql?: string;
  params?: unknown[];
  bytes?: Uint8Array;
  opts?: { name?: string };
};

self.onmessage = async (ev: MessageEvent<Req>) => {
  const { id, op, sql, params } = ev.data;
  try {
    let result: unknown = null;
    switch (op) {
      case 'open':
        result = await open(ev.data.opts ?? {});
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
