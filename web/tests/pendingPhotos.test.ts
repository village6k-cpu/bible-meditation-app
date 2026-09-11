import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';
import { migrate } from '../../mitjul/src/db/migrations';
import { processPhotoJobs } from '../../mitjul/src/db/photoSync';
import { FakeDb } from '../../mitjul/tests/sqliteShim';
import * as googlePhotosApi from '../src/sync/googlePhotosApi';

// 실제 큐·SDK를 쓰고 외부 HTTP와 브라우저 파일 저장소만 격리한다.
function loadPhotos(mode: 'offline' | 'connected' | 'disconnected' = 'offline') {
  const requests: string[] = [];
  const client = createClient('https://example.supabase.co', 'public-test-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init) => {
      requests.push(String(input));
      if (mode !== 'offline') {
        const body = JSON.parse(String(init?.body));
        return Response.json(body.action === 'status'
          ? { connected: mode === 'connected' }
          : { mediaItemId: `media-${body.photoRef}`, albumId: 'album' });
      }
      return new Response(JSON.stringify({ error: '사진 서버를 사용할 수 없습니다.' }), {
        status: 503, headers: { 'Content-Type': 'application/json' },
      });
    } },
  });
  const compiled = ts.transpileModule(
    readFileSync(new URL('../src/sync/photos.ts', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const exports = {} as { processPendingPhotos: (db: FakeDb) => Promise<unknown> };
  runInNewContext(compiled, {
    exports, Error, Date, Uint8Array,
    require(name: string) {
      if (name === '@db/photoSync') return { processPhotoJobs };
      if (name === '../db') return { asSqlite: (db: FakeDb) => db };
      if (name === './client') return { requireSyncClient: () => client };
      if (name === './googlePhotosApi') return googlePhotosApi;
      if (name === '../platform/photos') return {
        isPhotoRef: (ref: string) => ref.startsWith('photos/'),
        photoBlob: () => {
          if (mode !== 'connected') throw new Error('사진 서버 장애 중 파일을 읽으면 안 된다');
          return new Blob([new Uint8Array([1, 2, 3])]);
        },
      };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return { ...exports, requests };
}

test('사진 큐가 비어 있으면 사진 서버 장애가 글 동기화를 실패시키지 않는다', async () => {
  const db = new FakeDb();
  try {
    await migrate(db as never);
    await db.execAsync("INSERT INTO entries (id,type,day,created_at,updated_at,body) VALUES ('text','moment','2026-09-10',1,1,'글만 있는 기록')");
    const photos = loadPhotos();
    assert.equal(await photos.processPendingPhotos(db), null);
    assert.deepEqual(photos.requests, []);
    assert.equal((await db.getFirstAsync<{ body: string }>('SELECT body FROM entries'))?.body, '글만 있는 기록');
  } finally { db.raw().close(); }
});

test('사진이 한 묶음보다 많아도 전부 전송한 뒤에만 완료로 돌아온다', async () => {
  const db = new FakeDb();
  try {
    await migrate(db as never);
    for (let i = 0; i < 7; i++) await db.runAsync(
      "INSERT INTO entries (id,type,day,created_at,updated_at,image_uri) VALUES (?,'moment','2026-09-11',1,1,?)", [`e${i}`, `photos/${i}.jpg`]);
    const photos = loadPhotos('connected');
    const result = await photos.processPendingPhotos(db);
    assert.equal((result as any).completed, 7);
    assert.equal((await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM photo_jobs'))?.n, 0);
    assert.equal((await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM photo_links'))?.n, 7);
  } finally { db.raw().close(); }
});

test('사진 계정이 끊겼는데 대기 사진이 있으면 완료로 위장하지 않는다', async () => {
  const db = new FakeDb();
  try {
    await migrate(db as never);
    await db.execAsync("INSERT INTO entries (id,type,day,created_at,updated_at,image_uri) VALUES ('photo','meal','2026-09-11',1,1,'photos/a.jpg')");
    await assert.rejects(loadPhotos('disconnected').processPendingPhotos(db), /Google Photos.*연결/);
  } finally { db.raw().close(); }
});

test('일시 장애로 재시도 한도에 걸린 사진도 대기 시간 후 자동 재시도한다', async () => {
  const db = new FakeDb();
  try {
    await migrate(db as never);
    await db.execAsync("INSERT INTO entries (id,type,day,created_at,updated_at,image_uri) VALUES ('photo','meal','2026-09-11',1,1,'photos/a.jpg')");
    await db.runAsync("UPDATE photo_jobs SET state='failed', attempts=5, updated_at=?, last_error='일시 장애'", [Date.now()]);
    await assert.rejects(loadPhotos('connected').processPendingPhotos(db), /일시 장애/);
    await db.runAsync('UPDATE photo_jobs SET updated_at=?', [Date.now() - 301_000]);
    await loadPhotos('connected').processPendingPhotos(db);
    assert.equal((await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM photo_jobs'))?.n, 0);
  } finally { db.raw().close(); }
});

test('사진 작업이 있으면 서버 장애를 숨기지 않고 미전송 큐를 보존한다', async () => {
  for (const state of ['pending', 'running', 'failed']) {
    const db = new FakeDb();
    try {
      await migrate(db as never);
      await db.execAsync("INSERT INTO entries (id,type,day,created_at,updated_at,image_uri) VALUES ('photo','meal','2026-09-10',1,1,'photos/a.jpg')");
      await db.runAsync('UPDATE photo_jobs SET state=?, attempts=5', [state]);
      const photos = loadPhotos();
      await assert.rejects(photos.processPendingPhotos(db), /사진 서버를 사용할 수 없습니다/);
      assert.equal(photos.requests.length, 1);
      assert.deepEqual(await db.getFirstAsync('SELECT state, attempts FROM photo_jobs'), { state, attempts: 5 });
      assert.equal((await db.getFirstAsync<{ image_uri: string }>('SELECT image_uri FROM entries'))?.image_uri, 'photos/a.jpg');
    } finally { db.raw().close(); }
  }
});
