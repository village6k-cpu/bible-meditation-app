import {
  VideoLink,
  canonicalLinkUrl,
  extractFirstUrl,
  isHttpUrl,
  looksCompleteUrl,
  oembedUrl,
  parsePageMeta,
  parseVideoLink,
} from '../core/links';

// 붙여넣은 링크에서 제목·채널·썸네일을 가져온다.
// 유튜브·비메오는 oEmbed(키 없음), 그 밖의 링크는 페이지의 og 태그.
// 실패해도 링크만으로 기록은 남는다 — 이 함수는 절대 던지지 않는다.

export interface LinkMeta {
  url: string; // 붙여넣은 그대로 (시점 포함) — 기록에 남는 링크
  canonicalUrl: string; // 출처의 정체 — 같은 영상이면 어떤 형태로 붙여넣어도 같다
  video: VideoLink | null;
  title: string | null;
  creator: string | null;
  thumbnailUrl: string | null;
  embeddable: boolean; // 비공개·임베드 금지·삭제된 영상은 틀 안에서 재생되지 않는다 — 바깥으로 연다
}

// 붙여넣은 문자열에서 링크를 찾아 네트워크 없이 즉시 알 수 있는 것까지 채운다
export function previewLink(input: string): LinkMeta | null {
  const url = extractFirstUrl(input) ?? (isHttpUrl(input) ? input.trim() : null);
  if (!url || !looksCompleteUrl(url)) return null;
  const video = parseVideoLink(url);
  return {
    url,
    canonicalUrl: canonicalLinkUrl(url),
    video,
    title: null,
    creator: null,
    thumbnailUrl: video?.thumbnailUrl ?? null,
    embeddable: true,
  };
}

export async function resolveLink(input: string, signal?: AbortSignal): Promise<LinkMeta | null> {
  const meta = previewLink(input);
  if (!meta) return null;
  try {
    if (meta.video) {
      const res = await fetchWithTimeout(oembedUrl(meta.video), 6000, signal);
      if (res.ok) {
        const j = (await res.json()) as {
          title?: string;
          author_name?: string;
          thumbnail_url?: string;
        };
        meta.title = j.title?.trim() || null;
        meta.creator = j.author_name?.trim() || null;
        if (!meta.thumbnailUrl && j.thumbnail_url) meta.thumbnailUrl = j.thumbnail_url;
      } else if (res.status === 401 || res.status === 403 || res.status === 404) {
        meta.embeddable = false;
      }
    } else {
      const res = await fetchWithTimeout(meta.url, 6000, signal);
      if (res.ok) {
        const page = parsePageMeta(await res.text());
        meta.title = page.title;
        meta.creator = page.siteName;
        meta.thumbnailUrl = absolutize(page.imageUrl, res.url || meta.url);
      }
    }
  } catch {
    // 오프라인이거나 느린 링크 — 링크만으로도 기록은 남는다
  }
  return meta;
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// 제목을 못 얻었을 때의 이름 — 영상은 식별자를 붙여 서로 다른 영상이 같은 이름이 되지 않게
export function fallbackTitle(meta: LinkMeta): string {
  if (meta.video) {
    const label = meta.video.provider === 'youtube' ? 'YouTube' : 'Vimeo';
    return `${label} · ${meta.video.id}`;
  }
  return domainOf(meta.url);
}

// og:image는 절대 주소여야 하지만 '/images/og.jpg'·'//cdn…'로 적힌 블로그가 많다 — 페이지 주소 기준으로 푼다
function absolutize(src: string | null, base: string): string | null {
  if (!src) return null;
  try {
    const u = new URL(src, base);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url: string, ms: number, signal?: AbortSignal): Promise<Response> {
  if (signal?.aborted) throw new Error('aborted');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json, text/html;q=0.9, */*;q=0.5' },
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
