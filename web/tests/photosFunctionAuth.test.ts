import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';

// 배포할 함수 전체를 실제 암호 연산·SDK로 실행한다. 외부 HTTP만 대체해 운영 데이터에 닿지 않는다.
const source = readFileSync(new URL('../../supabase/functions/ledger-photos/index.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function fixture(validSession = false) {
  const requests: string[] = [];
  const env: Record<string,string> = {
    SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-only-service-key',
    GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-only-secret',
    GOOGLE_STATE_SECRET: 'test-state-signing-key', GOOGLE_TOKEN_ENCRYPTION_KEY: 'test-token-key',
  };
  let handler!: (req: Request) => Promise<Response>;
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    requests.push(url);
    if (new URL(url).pathname === '/auth/v1/user') {
      return new Response(JSON.stringify(validSession
        ? { id:'owner-a', aud:'authenticated', app_metadata:{}, user_metadata:{}, created_at:'2026-09-10T00:00:00Z' }
        : { message:'Invalid token', code:'bad_jwt' }), { status: validSession ? 200 : 401, headers:{'Content-Type':'application/json'} });
    }
    throw new Error('허용하지 않은 외부 요청');
  };
  runInNewContext(compiled, {
    exports: {}, Deno: { env:{ get:(key:string) => env[key] }, serve:(fn: typeof handler) => { handler = fn; } },
    crypto:webcrypto, TextEncoder, TextDecoder, URL, URLSearchParams, Request, Response, btoa, atob,
    fetch:fetcher,
    require(name: string) {
      if (name.startsWith('jsr:')) return {};
      if (name === 'npm:@supabase/supabase-js@2.108.0') return {
        createClient: (url:string,key:string,options:Parameters<typeof createClient>[2]) =>
          createClient(url,key,{...options,global:{fetch:fetcher}}),
      };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return { handler, requests };
}

test('사진 함수의 모든 작업은 bearer 없는 호출을 외부 접근 전에 거부한다', async () => {
  const { handler, requests } = fixture();
  for (const action of ['status','connect','disconnect','upload','download']) {
    const response = await handler(new Request('https://example.supabase.co/functions/v1/ledger-photos', { method:'POST', body:JSON.stringify({action, ownerId:'victim'}) }));
    assert.equal(response.status,401);
  }
  assert.deepEqual(requests,[]);
});

test('위조된 bearer는 Supabase 사용자 검증에서 멈추며 Google과 DB를 호출하지 않는다', async () => {
  const { handler, requests } = fixture();
  const response = await handler(new Request('https://example.supabase.co/functions/v1/ledger-photos', { method:'POST', headers:{Authorization:'Bearer forged'}, body:JSON.stringify({action:'upload'}) }));
  assert.equal(response.status,401);
  assert.deepEqual(requests,['https://example.supabase.co/auth/v1/user']);
});

test('OAuth 반환 주소는 서명 없는 state와 위조 state를 토큰 교환 전에 거부한다', async () => {
  const { handler, requests } = fixture();
  const payload = Buffer.from(JSON.stringify({ownerId:'victim',expiresAt:Date.now()+600000})).toString('base64url');
  for (const state of ['',payload,`${payload}.AAAA`]) {
    const url = new URL('https://example.supabase.co/functions/v1/ledger-photos?callback=1&code=fake');
    url.searchParams.set('state',state);
    const response = await handler(new Request(url));
    assert.ok(response.status >= 400);
  }
  assert.deepEqual(requests,[]);
});

test('로그인 사용자만 자기 계정의 10분짜리 서명 state를 발급받으며 요청의 타인 ID는 무시한다', async () => {
  const { handler, requests } = fixture(true);
  const response = await handler(new Request('https://example.supabase.co/functions/v1/ledger-photos', { method:'POST', headers:{Authorization:'Bearer valid-test-token'}, body:JSON.stringify({action:'connect',ownerId:'victim'}) }));
  assert.equal(response.status,200);
  const url = new URL((await response.json()).url);
  assert.equal(url.origin,'https://accounts.google.com');
  const [payload,signature] = url.searchParams.get('state')!.split('.');
  const state = JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
  assert.equal(state.ownerId,'owner-a');
  assert.ok(state.expiresAt > Date.now() && state.expiresAt <= Date.now()+600000);
  const key = await webcrypto.subtle.importKey('raw',new TextEncoder().encode('test-state-signing-key'),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  assert.equal(await webcrypto.subtle.verify('HMAC',key,Buffer.from(signature,'base64url'),new TextEncoder().encode(payload)),true);
  assert.deepEqual(requests,['https://example.supabase.co/auth/v1/user']);
});

test('올바른 서명이 있어도 만료된 OAuth state는 토큰 교환 전에 거부한다', async () => {
  const { handler, requests } = fixture();
  const payload = Buffer.from(JSON.stringify({ownerId:'owner-a',expiresAt:Date.now()-1})).toString('base64url');
  const key = await webcrypto.subtle.importKey('raw',new TextEncoder().encode('test-state-signing-key'),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature = Buffer.from(await webcrypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload))).toString('base64url');
  const url = new URL('https://example.supabase.co/functions/v1/ledger-photos?callback=1&code=fake');
  url.searchParams.set('state',`${payload}.${signature}`);
  const response = await handler(new Request(url));
  assert.ok(response.status >= 400);
  assert.deepEqual(requests,[]);
});
