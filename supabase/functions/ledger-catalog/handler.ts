import { books, movies, creators } from './catalog.ts';

interface Dependencies {
  authenticate: (token: string) => Promise<string | null>;
  kakaoKey: string;
  tmdbToken: string;
  fetcher?: typeof fetch;
}
export function createCatalogHandler(deps: Dependencies) {
  const fetcher = deps.fetcher ?? fetch;
  const cache = new Map<string, {expires:number;value:unknown}>();
  const usage = new Map<string, {expires:number;count:number}>();
  return async (req: Request): Promise<Response> => {
    const origin = req.headers.get('origin') ?? '';
    const allowed = origin === 'https://village6k-cpu.github.io' || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    const headers = {'Content-Type':'application/json','Access-Control-Allow-Origin':allowed?origin:'https://village6k-cpu.github.io',
      'Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type',
      'Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store'};
    const json = (value:unknown,status=200) => new Response(JSON.stringify(value),{status,headers});
    if (req.method === 'OPTIONS') return new Response(null,{status:204,headers});
    if (req.method !== 'POST') return json({error:'POST 요청만 지원합니다.'},405);
    if (origin && !allowed) return json({error:'허용되지 않은 요청입니다.'},403);
    const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return json({error:'서재 검색은 렛저 로그인 후 사용할 수 있습니다.'},401);
    try {
      const user = await deps.authenticate(token);
      if (!user) return json({error:'로그인이 만료되었습니다. 보관에서 다시 연결해 주세요.'},401);
      const raw = await req.text();
      if (raw.length > 2048) return json({error:'검색어가 너무 깁니다.'},400);
      let input: {kind?:string;action?:string;q?:string;id?:string};
      try { input = JSON.parse(raw); } catch { return json({error:'검색 요청을 확인해 주세요.'},400); }
      if (!input || !['book','film','series'].includes(input.kind??'')) return json({error:'책·영화·시리즈를 선택해 주세요.'},400);
      const kind = input.kind as 'book'|'film'|'series';
      const detail = input.action === 'detail';
      const q = typeof input.q === 'string' ? input.q.trim().normalize('NFC') : '';
      if (detail ? kind === 'book' || typeof input.id !== 'string' || !/^\d{1,12}$/.test(input.id)
        : input.action !== 'search' || !q || q.length > 120) return json({error:'검색어를 120자 이내로 입력해 주세요.'},400);
      const now = Date.now();
      for (const [key,value] of usage) if (value.expires < now) usage.delete(key);
      const limit = usage.get(user) ?? {expires:now+60_000,count:0};
      if (++limit.count > 30 || usage.size > 1000) return json({error:'검색이 많습니다. 잠시 후 다시 시도해 주세요.'},429);
      usage.set(user,limit);
      const cacheKey = JSON.stringify([kind,detail,input.id,q]);
      if ((cache.get(cacheKey)?.expires??0) > now) return json(cache.get(cacheKey)!.value);
      const key = kind === 'book' ? deps.kakaoKey : deps.tmdbToken;
      if (!key) return json({error:'작품 검색 연결을 준비 중입니다. 직접 입력해 저장할 수 있습니다.'},503);
      const url = kind === 'book' ? new URL('https://dapi.kakao.com/v3/search/book')
        : new URL(`https://api.themoviedb.org/3/${detail?'':'search/'}${kind==='film'?'movie':'tv'}${detail?`/${input.id}`:''}`);
      if (kind === 'book') {url.searchParams.set('query',q);url.searchParams.set('size','12');}
      else {url.searchParams.set('language','ko-KR');if(detail) url.searchParams.set('append_to_response','credits');else {url.searchParams.set('query',q);url.searchParams.set('include_adult','false');}}
      const res = await fetcher(url,{headers:{Authorization:kind==='book'?`KakaoAK ${key}`:`Bearer ${key}`},signal:AbortSignal.timeout(9000)});
      if (!res.ok) return json({error:res.status===429?'검색 제공처의 한도에 도달했습니다. 나중에 다시 시도해 주세요.':'검색 제공처에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'},502);
      const data = await res.json();
      const value = detail ? {creator:creators(data,kind as 'film'|'series')} : {results:kind==='book'?books(data):movies(data,kind)};
      if (cache.size >= 100) cache.delete(cache.keys().next().value!);
      cache.set(cacheKey,{expires:now+5*60_000,value});
      return json(value);
    } catch { return json({error:'작품 검색에 연결하지 못했습니다. 직접 입력하거나 다시 시도해 주세요.'},502); }
  };
}
