import type { SupabaseClient } from '@supabase/supabase-js';
import type { PhotoRemote } from '@db/photoSync';

function bytesToBase64Url(bytes: Uint8Array<ArrayBuffer>): string {
  let raw = '';
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    raw += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return btoa(raw).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function bytesFromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

export async function invokeLedgerPhotos<T>(
  client: SupabaseClient,
  body: Record<string, unknown>
): Promise<T> {
  const { data, error } = await client.functions.invoke('ledger-photos', { body });
  if (error) {
    // functions-js의 기본 문구는 "non-2xx"뿐이라 설정 오류나 재로그인 안내가 사라진다.
    // Edge Function이 돌려준 안전한 사용자용 문구가 있으면 그것을 먼저 보여준다.
    const context = (error as { context?: Response }).context;
    let detail: string | null = null;
    if (context) {
      try {
        const payload = await context.clone().json() as { error?: unknown };
        if (typeof payload.error === 'string') detail = payload.error;
      } catch {
        // JSON이 아닌 프록시 오류라면 SDK의 원래 메시지가 가장 유용하다.
      }
    }
    throw new Error(detail ?? error.message);
  }
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export function createGooglePhotosRemote(client: SupabaseClient): PhotoRemote {
  return {
    async upload(input) {
      return invokeLedgerPhotos(client, {
        action: 'upload',
        photoRef: input.photoRef,
        month: input.month,
        bytes: bytesToBase64Url(input.bytes),
      });
    },
    async download(mediaItemId) {
      const result = await invokeLedgerPhotos<{ bytes: string }>(client, { action: 'download', mediaItemId });
      return bytesFromBase64Url(result.bytes);
    },
  };
}
