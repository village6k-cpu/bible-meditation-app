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
function loadPhotos() {
  const requests: string[] = [];
  const client = createClient('https://example.supabase.co', 'public-test-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input) => {
      requests.push(String(input));
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
    exports, Error,
    require(name: string) {
      if (name === '@db/photoSync') return { processPhotoJobs };
      if (name === '../db') return { asSqlite: (db: FakeDb) => db };
      if (name === './client') return { requireSyncClient: () => client };
      if (name === './googlePhotosApi') return googlePhotosApi;
      if (name === '../platform/photos') return {
        isPhotoRef: () => { throw new Error('사진 서버 장애 중 파일 작업이 시작되면 안 된다'); },
        photoBlob: () => { throw new Error('사진 서버 장애 중 파일을 읽으면 안 된다'); },
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
