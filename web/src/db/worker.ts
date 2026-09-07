/// <reference lib="webworker" />
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

// SQLite는 워커에서 산다. OPFS의 동기 접근 핸들이 워커에만 노출되기 때문이고,
// 덕분에 큰 질의가 화면을 붙잡지도 않는다.
// 바깥과는 다섯 개의 연산만 주고받는다 — 네이티브 앱의 db 레이어가 쓰던 그 다섯.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const DB_NAME = 'mitjul.db';
const IDB_NAME = 'mitjul-store';
const IDB_STORE = 'db';
const IDB_KEY = 'snapshot';

let s3: Any = null;
let raw: Any = null;
let pool: Any = null;
let engine: 'opfs' | 'memory' = 'memory';
let saveTimer: ReturnType<typeof setTimeout> | null = null;

/* ── 메모리로 물러났을 때 쓰는 스냅숏 상자 ── */
function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
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

async function open(): Promise<{ engine: string; opfsError: string | null }> {
  s3 = await (sqlite3InitModule as (o?: unknown) => Promise<Any>)({ print: () => {}, printErr: () => {} });
  try {
    pool = await s3.installOpfsSAHPoolVfs({ name: 'mitjul-vfs', initialCapacity: 4 });
    raw = new pool.OpfsSAHPoolDb(`/${DB_NAME}`);
    engine = 'opfs';
  } catch (e) {
    opfsError = e instanceof Error ? e.message : String(e);
    pool = null;
    engine = 'memory';
    raw = new s3.oo1.DB(':memory:', 'c');
    const saved = await idbGet().catch(() => null);
    if (saved && saved.byteLength > 0) deserializeInto(raw, saved);
  }
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

type Req = { id: number; op: string; sql?: string; params?: unknown[]; bytes?: Uint8Array };

self.onmessage = async (ev: MessageEvent<Req>) => {
  const { id, op, sql, params } = ev.data;
  try {
    let result: unknown = null;
    switch (op) {
      case 'open':
        result = await open();
        break;
      case 'exec':
        raw.exec(sql!);
        touch();
        break;
      case 'run':
        raw.exec({ sql: sql!, bind: params && params.length ? (params as never[]) : undefined });
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
        assertOurDb(bytes);
        if (pool) {
          raw.close();
          await pool.importDb(`/${DB_NAME}`, bytes);
          raw = new pool.OpfsSAHPoolDb(`/${DB_NAME}`);
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
