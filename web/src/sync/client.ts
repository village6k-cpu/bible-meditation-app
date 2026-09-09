import { createClient } from '@supabase/supabase-js';
import { syncAuthOptions } from './googleAuth';

// publishable 키는 브라우저에 공개되는 프로젝트 식별자다. 실제 보호선은 서버의 사용자별 RLS다.
const url = import.meta.env.VITE_SUPABASE_URL ?? 'https://tedffwpijiylklfuzkua.supabase.co';
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_bSfUmM7z0scyXEPEQvIfWQ_Cx7fyuHg';

export const supabase = createClient(url, key, {
  auth: syncAuthOptions,
});
