export type CatalogKind = 'book' | 'film' | 'series';
export interface CatalogArtwork {
  provider: 'kakao' | 'tmdb';
  id: string;
  image: string | null;
  url: string;
  year: string;
}
export interface CatalogResult {
  kind: CatalogKind;
  title: string;
  creator: string;
  catalog: CatalogArtwork;
}

export function safeArtworkUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port
      && ['image.tmdb.org', 'search1.kakaocdn.net', 'search2.kakaocdn.net', 't1.daumcdn.net'].includes(u.hostname)
      ? u.href : null;
  } catch { return null; }
}

export function validCatalog(value: unknown): value is CatalogArtwork {
  if (!value || typeof value !== 'object') return false;
  const c = value as CatalogArtwork;
  if (!['kakao', 'tmdb'].includes(c.provider) || typeof c.id !== 'string' || !c.id || c.id.length > 512
    || typeof c.year !== 'string' || !/^(\d{4})?$/.test(c.year)
    || (c.image !== null && !safeArtworkUrl(c.image))) return false;
  try {
    const u = new URL(c.url);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port
      && (c.provider === 'tmdb' ? u.hostname === 'www.themoviedb.org' && /^\/(movie|tv)\/\d+$/.test(u.pathname)
        : ['search.daum.net', 'book.daum.net'].includes(u.hostname));
  } catch { return false; }
}

export function isCatalogKind(kind: string): kind is CatalogKind {
  return ['book', 'film', 'series'].includes(kind);
}
