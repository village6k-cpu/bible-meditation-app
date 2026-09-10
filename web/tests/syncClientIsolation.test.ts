import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { syncAuthOptions } from '../src/sync/googleAuth';

// Vite의 환경 주입만 대신하고 실제 진입점과 SDK를 실행한다. 운영 서버에는 요청하지 않는다.
function loadClient(env: Record<string, string> = {}) {
  const requests: string[] = [];
  const compiled = ts.transpileModule(
    readFileSync(new URL('../src/sync/client.ts', import.meta.url), 'utf8'),
    {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      transformers: { before: [(context) => (source) => {
        const visit: ts.Visitor = (node) => ts.isMetaProperty(node)
          ? ts.factory.createIdentifier('importMeta') : ts.visitEachChild(node, visit, context);
        return ts.visitNode(source, visit) as ts.SourceFile;
      }] },
    },
  ).outputText;
  const exports: { supabase: SupabaseClient | null; syncConfigError?: string | null } = { supabase: null };
  runInNewContext(compiled, {
    exports, importMeta: { env }, URL,
    require(name: string) {
      if (name === './googleAuth') return { syncAuthOptions };
      if (name === '@supabase/supabase-js') return {
        createClient: (url: string, key: string, options: Parameters<typeof createClient>[2]) =>
          createClient(url, key, { ...options, global: { fetch: async (input) => {
            requests.push(String(input));
            return new Response(JSON.stringify({ message: 'test-only transport' }), { status: 400 });
          } } }),
      };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return { ...exports, requests };
}

const dedicated = 'https://mbypanaxjuliucxsujea.supabase.co';
const publicKey = 'sb_publishable_test_only';

test('설정이 없으면 앱 로딩은 유지하되 인증 클라이언트와 서버 요청을 만들지 않는다', () => {
  const loaded = loadClient();
  assert.equal(loaded.supabase, null);
  assert.ok(loaded.syncConfigError);
  assert.deepEqual(loaded.requests, []);
});

test('환경 설정에 옛 운영 서버를 넣어도 연결하지 않는다', () => {
  const loaded = loadClient({ VITE_SUPABASE_URL: 'https://tedffwpijiylklfuzkua.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: publicKey });
  assert.equal(loaded.supabase, null);
  assert.deepEqual(loaded.requests, []);
});

test('미승인 서버·불완전한 설정·서버 전용 비밀키는 인증 초기화 전에 거부한다', () => {
  for (const env of [
    { VITE_SUPABASE_URL: dedicated },
    { VITE_SUPABASE_PUBLISHABLE_KEY: publicKey },
    { VITE_SUPABASE_URL: 'https://unapproved.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: publicKey },
    { VITE_SUPABASE_URL: dedicated, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_do_not_expose' },
    { VITE_SUPABASE_URL: 'not a url', VITE_SUPABASE_PUBLISHABLE_KEY: publicKey },
  ]) {
    const loaded = loadClient(env);
    assert.equal(loaded.supabase, null);
    assert.deepEqual(loaded.requests, []);
  }
});

test('승인된 전용 서버만 사용하고 인증 저장소도 Ledger 전용으로 구분한다', async () => {
  const { supabase, requests, syncConfigError } = loadClient({ VITE_SUPABASE_URL: dedicated, VITE_SUPABASE_PUBLISHABLE_KEY: publicKey });
  assert.ok(supabase);
  assert.equal(syncConfigError, null);
  const { data } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { skipBrowserRedirect: true } });
  assert.equal(new URL(data.url!).origin, dedicated);
  assert.equal(supabase.auth.storageKey, 'ledger-mbypanaxjuliucxsujea-auth');
  assert.deepEqual(requests, []);
});
