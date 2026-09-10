import type { SupabaseClient } from '@supabase/supabase-js';

export const syncAuthOptions = {
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: true,
  flowType: 'pkce',
} as const;

export async function googleSignInUrl(auth: SupabaseClient['auth'], appUrl: string): Promise<string> {
  // 공유로 받은 글이나 이전 인증 정보를 Google에 보내거나 돌아와서 다시 처리하지 않는다.
  const redirect = new URL(appUrl);
  redirect.search = '?sync=1';
  redirect.hash = '';
  const { data, error } = await auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirect.toString(),
      queryParams: { prompt: 'select_account' },
      skipBrowserRedirect: true,
    },
  });
  if (error || !data.url) throw new Error('Google 로그인 화면을 열지 못했습니다. 다시 시도하세요.');
  return data.url;
}
