// 워커에 사는 SQLite에게 말을 거는 얇은 창구.
// 바깥으로는 네이티브 앱의 db 레이어가 쓰던 다섯 개의 메서드를 그대로 내민다 —
// 그래야 마이그레이션과 리포지토리 950줄이 한 줄도 안 고치고 돌아간다.

export type Engine = 'opfs' | 'memory' | 'blocked';

export interface WebDb {
  execAsync(sql: string): Promise<void>;
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
  runAsync(sql: string, params?: unknown[]): Promise<void>;
  withTransactionAsync(fn: () => Promise<void>): Promise<void>;
  /** 지금 상태를 SQLite 파일 바이트로 — 백업 */
  serialize(): Promise<Uint8Array<ArrayBuffer>>;
  /** 백업 파일로 통째로 되돌린다 */
  restore(bytes: Uint8Array<ArrayBuffer>): Promise<void>;
  flush(): Promise<void>;
  /** 사진 한 장을 OPFS에 쓴다 (DB 바깥의 별도 파일) */
  writePhoto(name: string, bytes: Uint8Array<ArrayBuffer>): Promise<void>;
  deletePhoto(name: string): Promise<void>;
  listPhotos(): Promise<{ name: string; size: number }[]>;
  engine: Engine;
  opfsError: string | null;
}

let seq = 0;

export async function openDb(name?: string): Promise<WebDb> {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), {
    type: 'module',
  });
  const waiting = new Map<number, { ok: (v: unknown) => void; fail: (e: Error) => void }>();

  worker.onmessage = (
    ev: MessageEvent<{
      id: number;
      ok: boolean;
      result?: unknown;
      error?: string;
    }>
  ) => {
    const w = waiting.get(ev.data.id);
    if (!w) return;
    waiting.delete(ev.data.id);
    if (ev.data.ok) w.ok(ev.data.result);
    else w.fail(new Error(ev.data.error ?? '알 수 없는 오류'));
  };

  const send = (
    op: string,
    sql?: string,
    params?: unknown[],
    bytes?: Uint8Array<ArrayBuffer>,
    opts?: { name?: string },
    name?: string
  ): Promise<unknown> =>
    new Promise((ok, fail) => {
      const id = ++seq;
      waiting.set(id, { ok, fail });
      worker.postMessage({ id, op, sql, params, bytes, opts, name });
    });

  // 모든 호출을 한 줄로 세운다 — 트랜잭션 사이에 다른 질의가 끼어들지 않도록
  let chain: Promise<unknown> = Promise.resolve();
  const call = (
    op: string,
    sql?: string,
    params?: unknown[],
    bytes?: Uint8Array<ArrayBuffer>,
    name?: string
  ): Promise<unknown> => {
    const next = chain.then(
      () => send(op, sql, params, bytes, undefined, name),
      () => send(op, sql, params, bytes, undefined, name)
    );
    chain = next.catch(() => {});
    return next;
  };

  const opened = (await send('open', undefined, undefined, undefined, name ? { name } : undefined)) as {
    engine: Engine;
    opfsError: string | null;
  };

  // 잠긴 OPFS는 DB가 열린 상태가 아니다. 마이그레이션이 null DB에 접근하기 전에 멈춘다.
  if (opened.engine === 'blocked') {
    worker.terminate();
    throw new Error('기존 기록함을 열 수 없습니다. 다른 Ledger 탭이나 창이 열려 있다면 닫고 다시 시도하세요. 저장소를 삭제하지 마세요.');
  }

  return {
    engine: opened.engine,
    opfsError: opened.opfsError,

    async execAsync(sql) {
      await call('exec', sql);
    },
    async getFirstAsync<T>(sql: string, params: unknown[] = []) {
      return (await call('first', sql, params)) as T | null;
    },
    async getAllAsync<T>(sql: string, params: unknown[] = []) {
      return (await call('all', sql, params)) as T[];
    },
    async runAsync(sql, params: unknown[] = []) {
      await call('run', sql, params);
    },
    async withTransactionAsync(fn) {
      await call('begin');
      try {
        await fn();
      } catch (e) {
        await call('rollback');
        throw e;
      }
      await call('commit');
    },
    async serialize() {
      return (await call('serialize')) as Uint8Array<ArrayBuffer>;
    },
    async restore(bytes) {
      await call('restore', undefined, undefined, bytes);
    },
    async flush() {
      await call('flush');
    },
    async writePhoto(name, bytes) {
      await call('photoWrite', undefined, undefined, bytes, name);
    },
    async deletePhoto(name) {
      await call('photoDelete', undefined, undefined, undefined, name);
    },
    async listPhotos() {
      return (await call('photoList')) as { name: string; size: number }[];
    },
  };
}
