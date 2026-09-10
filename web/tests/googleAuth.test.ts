import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { h } from 'preact';
import { render } from 'preact-render-to-string';
import { googleSignInUrl, syncAuthOptions } from '../src/sync/googleAuth';
import { SyncLogin } from '../src/ui/parts/SyncLogin';

test('Google 계정 선택으로 연결하고 글·토큰·사진 권한은 로그인 URL에 싣지 않는다', async () => {
  const storage = new Map<string, string>();
  const client = createClient('https://example.supabase.co', 'public-test-key', {
    auth: {
      ...syncAuthOptions,
      autoRefreshToken: false,
      storage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => { storage.set(key, value); },
        removeItem: (key) => { storage.delete(key); },
      },
    },
  });
  for (const base of ['https://village6k-cpu.github.io/bible-meditation-app/', 'http://127.0.0.1:5174/']) {
    const url = new URL(await googleSignInUrl(client.auth, `${base}?add=private-note&code=old-code#access_token=old-token`));
    assert.equal(url.origin, 'https://example.supabase.co');
    assert.equal(url.pathname, '/auth/v1/authorize');
    assert.equal(url.searchParams.get('provider'), 'google');
    assert.equal(url.searchParams.get('prompt'), 'select_account');
    assert.equal(url.searchParams.get('redirect_to'), `${base}?sync=1`);
    assert.equal(url.searchParams.get('code_challenge_method'), 's256');
    assert.match(url.searchParams.get('code_challenge') ?? '', /^[\w-]{43}$/);
    assert.equal(url.searchParams.has('scopes'), false);
    assert.equal(url.toString().includes('private-note'), false);
    assert.equal(url.toString().includes('old-token'), false);
  }
  assert.ok([...storage.keys()].some((key) => key.endsWith('-code-verifier')));
});

test('연결 화면은 Google 버튼만 제공하고 이메일·비밀번호 입력을 받지 않는다', () => {
  const html = render(h(SyncLogin, { busy: false, error: null, onSignIn() {} }));
  assert.match(html, /<button[^>]*>Google로 연결<\/button>/);
  assert.doesNotMatch(html, /<input|<form|HeyBilly/);
  assert.match(html, /두 기기에서 같은 Google 계정/);
});

test('연결 중에는 중복 요청을 막고 취소·실패는 화면에 남긴다', () => {
  const html = render(h(SyncLogin, { busy: true, error: 'Google 로그인이 취소됐습니다.', onSignIn() {} }));
  assert.match(html, /<button[^>]*disabled/);
  assert.match(html, /Google로 이동 중/);
  assert.match(html, /role="alert"[^>]*>Google 로그인이 취소됐습니다/);
});

test('전용 서버 설정이 준비되지 않으면 Google 연결 버튼을 잠그고 로컬 보존을 안내한다', () => {
  const html = render(h(SyncLogin, { busy: false, unavailable: true, error: '동기화 서버 설정이 필요합니다.', onSignIn() {} }));
  assert.match(html, /<button[^>]*disabled/);
  assert.match(html, /이 기기의 기록은 그대로/);
  assert.match(html, /role="alert"/);
});
