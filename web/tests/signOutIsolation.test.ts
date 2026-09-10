import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';

// 브라우저 DB/WASM을 시작하지 않고 실제 로그아웃 진입점과 SDK의 요청을 함께 검증한다.
const source = ts.createSourceFile('index.ts', readFileSync(new URL('../src/sync/index.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
const entry = source.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'signOutFromSync');
assert.ok(entry, '동기화 로그아웃 진입점이 있어야 한다');
const compiled = ts.transpileModule(entry.getText(source), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

test('렛저 연결 해제 요청은 다른 앱·기기의 세션을 취소하지 않는다', async () => {
  const key = 'sb-example-auth-token';
  const session = {
    access_token: 'test-access-token', refresh_token: 'test-refresh-token', token_type: 'bearer',
    expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: 'test-user', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
  };
  const storage = new Map([[key, JSON.stringify(session)]]);
  const requests: URL[] = [];
  const client = createClient('https://example.supabase.co', 'public-test-key', {
    auth: {
      storageKey: key, autoRefreshToken: false, detectSessionInUrl: false,
      storage: {
        getItem: (name) => storage.get(name) ?? null,
        setItem: (name, value) => { storage.set(name, value); },
        removeItem: (name) => { storage.delete(name); },
      },
    },
    global: { fetch: async (input) => {
      requests.push(new URL(String(input)));
      return new Response(null, { status: 204 });
    } },
  });
  await client.auth.initialize();
  const exports: { signOutFromSync?: () => Promise<void> } = {};
  runInNewContext(compiled, { exports, requireSyncClient: () => client });
  await exports.signOutFromSync!();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].pathname, '/auth/v1/logout');
  assert.equal(requests[0].searchParams.get('scope'), 'local');
  assert.equal(storage.has(key), false);
});
