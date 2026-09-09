import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.108.0';

const APP_URL = Deno.env.get('LEDGER_APP_URL') ?? 'https://village6k-cpu.github.io/bible-meditation-app/';
const scopes = [
  'https://www.googleapis.com/auth/photoslibrary.appendonly',
  'https://www.googleapis.com/auth/photoslibrary.readonly.appcreateddata',
  'https://www.googleapis.com/auth/photoslibrary.edit.appcreateddata',
].join(' ');

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} 설정이 없습니다.`);
  return value;
}

function base64Url(bytes: Uint8Array): string {
  let raw = '';
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function cors(req: Request): HeadersInit {
  const origin = req.headers.get('origin') ?? '';
  const appOrigin = new URL(APP_URL).origin;
  const allowed = origin === appOrigin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    'Access-Control-Allow-Origin': allowed ? origin : appOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function json(req: Request, value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...cors(req), 'Content-Type': 'application/json; charset=utf-8' },
  });
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw', encoder.encode(required('GOOGLE_STATE_SECRET')),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
  );
}

async function makeState(ownerId: string): Promise<string> {
  const payload = base64Url(encoder.encode(JSON.stringify({ ownerId, expiresAt: Date.now() + 10 * 60_000 })));
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(), encoder.encode(payload)));
  return `${payload}.${base64Url(signature)}`;
}

async function readState(state: string): Promise<{ ownerId: string }> {
  const [payload, signature] = state.split('.');
  if (!payload || !signature) throw new Error('잘못된 연결 상태입니다.');
  const valid = await crypto.subtle.verify(
    'HMAC', await hmacKey(), fromBase64Url(signature), encoder.encode(payload)
  );
  if (!valid) throw new Error('연결 상태 서명이 맞지 않습니다.');
  const parsed = JSON.parse(decoder.decode(fromBase64Url(payload))) as { ownerId?: string; expiresAt?: number };
  if (!parsed.ownerId || !parsed.expiresAt || parsed.expiresAt < Date.now()) {
    throw new Error('연결 시간이 지났습니다. Ledger에서 다시 시작하세요.');
  }
  return { ownerId: parsed.ownerId };
}

async function encryptionKey(): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(required('GOOGLE_TOKEN_ENCRYPTION_KEY')));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function encryptToken(token: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, await encryptionKey(), encoder.encode(token)
  ));
  const joined = new Uint8Array(iv.length + encrypted.length);
  joined.set(iv);
  joined.set(encrypted, iv.length);
  return base64Url(joined);
}

async function decryptToken(value: string): Promise<string> {
  const joined = fromBase64Url(value);
  const clear = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: joined.slice(0, 12) }, await encryptionKey(), joined.slice(12)
  );
  return decoder.decode(clear);
}

function serviceClient() {
  return createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function ownerFrom(req: Request): Promise<string> {
  const bearer = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!bearer) throw new Error('Ledger 로그인이 필요합니다.');
  const { data, error } = await serviceClient().auth.getUser(bearer);
  if (error || !data.user) throw new Error('Ledger 로그인이 만료되었습니다.');
  return data.user.id;
}

async function exchangeCode(code: string): Promise<{ refresh_token?: string }> {
  const body = new URLSearchParams({
    code,
    client_id: required('GOOGLE_CLIENT_ID'),
    client_secret: required('GOOGLE_CLIENT_SECRET'),
    redirect_uri: `${required('SUPABASE_URL')}/functions/v1/ledger-photos?callback=1`,
    grant_type: 'authorization_code',
  });
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description ?? 'Google 연결 코드를 바꾸지 못했습니다.');
  return data;
}

async function accessToken(ownerId: string): Promise<{ token: string; refreshToken: string }> {
  const db = serviceClient();
  const { data, error } = await db
    .from('ledger_google_accounts')
    .select('refresh_token_ciphertext')
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Google Photos를 먼저 연결하세요.');
  const refreshToken = await decryptToken(data.refresh_token_ciphertext);
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: required('GOOGLE_CLIENT_ID'),
    client_secret: required('GOOGLE_CLIENT_SECRET'),
    grant_type: 'refresh_token',
  });
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body });
  const token = await response.json();
  if (!response.ok || !token.access_token) throw new Error('Google Photos 로그인을 갱신하지 못했습니다.');
  return { token: token.access_token, refreshToken };
}

async function googleJson(url: string, token: string, init: RequestInit = {}): Promise<any> {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message ?? 'Google Photos 요청이 실패했습니다.');
  return data;
}

async function albumFor(ownerId: string, month: string, token: string): Promise<string> {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('사진 앨범 월이 올바르지 않습니다.');
  const db = serviceClient();
  const { data, error } = await db
    .from('ledger_google_albums').select('album_id').eq('owner_id', ownerId).eq('month', month).maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data.album_id;
  const album = await googleJson('https://photoslibrary.googleapis.com/v1/albums', token, {
    method: 'POST', body: JSON.stringify({ album: { title: `Ledger ${month}` } }),
  });
  const { error: saveError } = await db.from('ledger_google_albums').upsert({
    owner_id: ownerId, month, album_id: album.id,
  }, { onConflict: 'owner_id,month' });
  if (saveError) throw new Error(saveError.message);
  return album.id;
}

async function uploadPhoto(ownerId: string, input: any) {
  const { token } = await accessToken(ownerId);
  const albumId = await albumFor(ownerId, String(input.month ?? ''), token);
  const bytes = fromBase64Url(String(input.bytes ?? ''));
  if (bytes.length === 0 || bytes.length > 10 * 1024 * 1024) throw new Error('사진 크기가 올바르지 않습니다.');
  const filename = String(input.photoRef ?? '').split('/').pop()?.replace(/[^a-zA-Z0-9._-]/g, '') || 'ledger.jpg';
  const upload = await fetch('https://photoslibrary.googleapis.com/v1/uploads', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'X-Goog-Upload-Content-Type': 'image/jpeg',
      'X-Goog-Upload-Protocol': 'raw',
      'X-Goog-Upload-File-Name': filename,
    },
    body: bytes,
  });
  const uploadToken = await upload.text();
  if (!upload.ok) throw new Error('Google Photos에 사진 바이트를 올리지 못했습니다.');
  const created = await googleJson('https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate', token, {
    method: 'POST',
    body: JSON.stringify({
      albumId,
      newMediaItems: [{ description: `Ledger ${input.month}`, simpleMediaItem: { uploadToken, fileName: filename } }],
    }),
  });
  const result = created.newMediaItemResults?.[0];
  if (!result?.mediaItem?.id) throw new Error(result?.status?.message ?? 'Google Photos가 사진 ID를 돌려주지 않았습니다.');
  return { mediaItemId: result.mediaItem.id, albumId };
}

async function downloadPhoto(ownerId: string, mediaItemId: string): Promise<string> {
  const { token } = await accessToken(ownerId);
  const item = await googleJson(
    `https://photoslibrary.googleapis.com/v1/mediaItems/${encodeURIComponent(mediaItemId)}`,
    token
  );
  const response = await fetch(`${item.baseUrl}=w1600-h1600`);
  if (!response.ok) throw new Error('Google Photos 사진을 내려받지 못했습니다.');
  return base64Url(new Uint8Array(await response.arrayBuffer()));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  try {
    const url = new URL(req.url);
    if (req.method === 'GET' && url.searchParams.get('callback') === '1') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (!code || !state) throw new Error('Google이 연결 코드를 돌려주지 않았습니다.');
      const { ownerId } = await readState(state);
      const tokens = await exchangeCode(code);
      if (!tokens.refresh_token) throw new Error('Google 장기 연결 토큰을 받지 못했습니다. 다시 연결하세요.');
      const db = serviceClient();
      const now = new Date().toISOString();
      const { error } = await db.from('ledger_google_accounts').upsert({
        owner_id: ownerId,
        refresh_token_ciphertext: await encryptToken(tokens.refresh_token),
        updated_at: now,
      }, { onConflict: 'owner_id' });
      if (error) throw new Error(error.message);
      return Response.redirect(`${APP_URL}?photos=connected`, 302);
    }

    if (req.method !== 'POST') return json(req, { error: '지원하지 않는 요청입니다.' }, 405);
    const ownerId = await ownerFrom(req);
    const input = await req.json();
    if (input.action === 'status') {
      const { data, error } = await serviceClient()
        .from('ledger_google_accounts').select('owner_id').eq('owner_id', ownerId).maybeSingle();
      if (error) throw new Error(error.message);
      return json(req, { connected: !!data });
    }
    if (input.action === 'connect') {
      const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      auth.search = new URLSearchParams({
        client_id: required('GOOGLE_CLIENT_ID'),
        redirect_uri: `${required('SUPABASE_URL')}/functions/v1/ledger-photos?callback=1`,
        response_type: 'code',
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true',
        scope: scopes,
        state: await makeState(ownerId),
      }).toString();
      return json(req, { url: auth.toString() });
    }
    if (input.action === 'disconnect') {
      const db = serviceClient();
      const { token, refreshToken } = await accessToken(ownerId);
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken || token)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }).catch(() => {});
      await db.from('ledger_google_albums').delete().eq('owner_id', ownerId);
      await db.from('ledger_google_accounts').delete().eq('owner_id', ownerId);
      return json(req, { connected: false });
    }
    if (input.action === 'upload') return json(req, await uploadPhoto(ownerId, input));
    if (input.action === 'download') {
      return json(req, { bytes: await downloadPhoto(ownerId, String(input.mediaItemId ?? '')) });
    }
    return json(req, { error: '알 수 없는 사진 작업입니다.' }, 400);
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : String(reason);
    return json(req, { error: message }, message.includes('로그인') ? 401 : 500);
  }
});
