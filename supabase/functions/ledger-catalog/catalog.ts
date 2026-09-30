type Row = Record<string, unknown>;
const row = (v: unknown): Row => v && typeof v === 'object' && !Array.isArray(v) ? v as Row : {};
const str = (v: unknown, max = 400) => typeof v === 'string' ? v.slice(0, max).trim() : '';
const names = (v: unknown) => Array.isArray(v) ? v.map(x => str(x, 100)).filter(Boolean).slice(0, 8).join(', ') : '';
function image(v: unknown): string | null {
  try {
    const u = new URL(str(v, 2048));
    if (u.protocol === 'http:') u.protocol = 'https:';
    return u.protocol === 'https:' && !u.username && !u.password && !u.port
      && ['search1.kakaocdn.net', 'search2.kakaocdn.net', 't1.daumcdn.net'].includes(u.hostname) ? u.href : null;
  } catch { return null; }
}
export function books(payload: unknown) {
  const docs = row(payload).documents;
  if (!Array.isArray(docs)) throw new Error('Invalid catalog response');
  return docs.slice(0, 12).flatMap(v => {
    const d = row(v); const title = str(d.title); const url = str(d.url, 2048);
    let valid = false;
    try { const u = new URL(url); valid = u.protocol === 'https:' && !u.username && !u.password && !u.port && ['search.daum.net', 'book.daum.net'].includes(u.hostname); } catch { /* skip */ }
    if (!title || !valid) return [];
    return [{kind:'book', title, creator:names(d.authors), catalog:{provider:'kakao',id:str(d.isbn)||url,image:image(d.thumbnail),url,year:str(d.datetime).match(/^\d{4}/)?.[0]??''}}];
  });
}
export function movies(payload: unknown, kind: 'film' | 'series') {
  const docs = row(payload).results;
  if (!Array.isArray(docs)) throw new Error('Invalid catalog response');
  return docs.filter(v => row(v).adult !== true).slice(0, 12).flatMap(v => {
    const d = row(v); const title = str(kind === 'film' ? d.title : d.name);
    if (!title || !Number.isSafeInteger(d.id) || Number(d.id) < 1) return [];
    const path = str(d.poster_path);
    return [{kind,title,creator:'',catalog:{provider:'tmdb',id:String(d.id),
      image:/^\/[\w-]+\.(jpg|png)$/.test(path)?`https://image.tmdb.org/t/p/w342${path}`:null,
      url:`https://www.themoviedb.org/${kind==='film'?'movie':'tv'}/${d.id}`,
      year:str(kind==='film'?d.release_date:d.first_air_date).match(/^\d{4}/)?.[0]??''}}];
  });
}
export function creators(payload: unknown, kind: 'film'|'series'): string {
  const d = row(payload);
  const list = kind === 'film' ? row(d.credits).crew : d.created_by;
  return Array.isArray(list) ? names(list.filter(v=>kind==='series'||row(v).job==='Director').map(v=>row(v).name)) : '';
}
