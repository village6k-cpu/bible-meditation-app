// 영상 링크 — 붙여넣은 문자열에서 링크를 찾고, 유튜브·비메오면 식별자·썸네일·임베드 주소를 뽑는다.
// 순수 함수만: 네트워크는 export/linkMeta.ts가 맡는다.

export type VideoProvider = 'youtube' | 'vimeo';

export interface VideoLink {
  provider: VideoProvider;
  id: string;
  canonicalUrl: string; // 출처의 정체 — 같은 영상이면 어떤 형태로 붙여넣어도 같다
  embedUrl: string; // 그 자리에서 재생할 때 WebView에 넣는 주소
  thumbnailUrl: string | null; // 유튜브는 식별자만으로 즉시, 비메오는 oEmbed 뒤에
  startSeconds: number | null; // 붙여넣은 링크가 가리키던 시점 (?t=1m30s)
}

const URL_RE = /https?:\/\/[^\s<>"'）)\]]+/i;

// 공유 시트는 "제목 https://..." 처럼 글과 링크를 함께 붙여넣는다 — 첫 링크만 집는다
export function extractFirstUrl(text: string): string | null {
  const m = URL_RE.exec(text);
  if (!m) return null;
  return m[0].replace(/[.,;:!?]+$/, '');
}

export function isHttpUrl(text: string): boolean {
  return /^https?:\/\/\S+$/i.test(text.trim());
}

// '1m30s' · '90' · '1h2m3s' → 초
export function parseTimestamp(raw: string | null): number | null {
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Number(raw);
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(raw);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

export function parseVideoLink(input: string): VideoLink | null {
  const raw = extractFirstUrl(input) ?? input.trim();
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\.|^music\./, '').toLowerCase();

  if (host === 'youtube.com' || host === 'youtu.be' || host === 'youtube-nocookie.com') {
    let id: string | null = null;
    if (host === 'youtu.be') {
      id = u.pathname.split('/')[1] ?? null;
    } else if (u.pathname === '/watch') {
      id = u.searchParams.get('v');
    } else {
      const m = /^\/(?:shorts|embed|live|v)\/([^/?#]+)/.exec(u.pathname);
      id = m ? m[1] : null;
    }
    if (!id || !YT_ID.test(id)) return null;
    const start = parseTimestamp(u.searchParams.get('t') ?? u.searchParams.get('start'));
    const embed = new URL(`https://www.youtube-nocookie.com/embed/${id}`);
    embed.searchParams.set('playsinline', '1');
    embed.searchParams.set('rel', '0');
    if (start) embed.searchParams.set('start', String(start));
    return {
      provider: 'youtube',
      id,
      canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
      embedUrl: embed.toString(),
      thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      startSeconds: start,
    };
  }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = /^\/(?:video\/)?(\d{6,12})(?:[/?#]|$)/.exec(u.pathname);
    if (!m) return null;
    const id = m[1];
    const start = parseTimestamp(u.hash.replace(/^#t=/, '') || null);
    const embed = new URL(`https://player.vimeo.com/video/${id}`);
    embed.searchParams.set('playsinline', '1');
    if (start) embed.hash = `t=${start}s`;
    return {
      provider: 'vimeo',
      id,
      canonicalUrl: `https://vimeo.com/${id}`,
      embedUrl: embed.toString(),
      thumbnailUrl: null,
      startSeconds: start,
    };
  }

  return null;
}

// oEmbed — 제목·채널(·비메오 썸네일)을 키 없이 돌려주는 공개 끝점
export function oembedUrl(link: VideoLink): string {
  const target = encodeURIComponent(link.canonicalUrl);
  return link.provider === 'youtube'
    ? `https://www.youtube.com/oembed?url=${target}&format=json`
    : `https://vimeo.com/api/oembed.json?url=${target}`;
}

export interface PageMeta {
  title: string | null;
  siteName: string | null;
  imageUrl: string | null;
}

// 일반 링크 — og:title / <title>, og:site_name, og:image 만 가볍게 긁는다
export function parsePageMeta(html: string): PageMeta {
  const head = html.slice(0, 200_000);
  const meta = (prop: string): string | null => {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`,
      'i'
    );
    const m = re.exec(head);
    const v = m ? (m[1] ?? m[2]) : null;
    return v ? decodeEntities(v).trim() || null : null;
  };
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head);
  return {
    title: meta('og:title') ?? meta('twitter:title') ?? (titleTag ? decodeEntities(titleTag[1]).trim() || null : null),
    siteName: meta('og:site_name'),
    imageUrl: meta('og:image') ?? meta('twitter:image'),
  };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}
