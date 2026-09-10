import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { syncAuthOptions } from './googleAuth';

// 환경 변수 오설정도 운영 앱에 닿지 않도록 승인된 Ledger 전용 서버만 허용한다.
export const syncProjectId = 'mbypanaxjuliucxsujea';
const url = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/$/, '') ?? '';
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';
export const syncConfigError = url !== `https://${syncProjectId}.supabase.co` || !/^sb_publishable_[\w-]+$/.test(key)
  ? '렛저 전용 동기화 서버 설정이 필요합니다. 이 기기의 기록은 그대로 보관됩니다.'
  : null;

// 설정 누락으로 앱 전체가 죽거나 다른 프로젝트의 세션을 읽는 일을 막는다.
export const supabase = syncConfigError ? null : createClient(url, key, {
  auth: { ...syncAuthOptions, storageKey: `ledger-${syncProjectId}-auth` },
});

export function requireSyncClient(): SupabaseClient {
  if (!supabase) throw new Error(syncConfigError!);
  return supabase;
}
