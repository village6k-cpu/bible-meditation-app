import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.108.0';
import { createCatalogHandler } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL');
if (url !== 'https://mbypanaxjuliucxsujea.supabase.co') throw new Error('Ledger project required');
const client = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(createCatalogHandler({
  async authenticate(token) {
    const {data,error} = await client.auth.getUser(token);
    return !error && data.user && !data.user.is_anonymous ? data.user.id : null;
  },
  kakaoKey:Deno.env.get('LEDGER_KAKAO_KEY')??'',
  tmdbToken:Deno.env.get('LEDGER_TMDB_TOKEN')??'',
}));
