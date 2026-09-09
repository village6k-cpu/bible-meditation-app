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

// 링크 뒤에 한글·CJK 문장부호·스마트 따옴표가 붙어 와도 링크만 집는다 ('…XcQ입니다', '「…」', '…。')
const URL_RE = /https?:\/\/[^\s<>"')\]　-〿＀-￯가-힣‘’“”]+/i;
// 'youtu.be/…'·'www.youtube.com/…'처럼 스킴 없이 적은 링크
const BARE_RE =
  /(?:^|[\s(「『"'‘“])((?:www\.|m\.)?(?:youtube\.com|youtu\.be|vimeo\.com)\/[^\s<>"')\]　-〿＀-￯가-힣‘’“”]+)/i;

// 공유 시트는 "제목 https://..." 처럼 글과 링크를 함께 붙여넣는다 — 첫 링크만 집는다
export function extractFirstUrl(text: string): string | null {
  const m = URL_RE.exec(text);
  if (m) return trimTail(m[0]);
  const b = BARE_RE.exec(text);
  return b ? `https://${trimTail(b[1])}` : null;
}

function trimTail(s: string): string {
  return s.replace(/[.,;:!?]+$/, '');
}

export function isHttpUrl(text: string): boolean {
  return /^https?:\/\/\S+$/i.test(text.trim());
}

// 손으로 치는 중인 주소('https://y', 'https://tv.naver.c')는 아직 링크가 아니다
export function looksCompleteUrl(url: string): boolean {
  try {
    return /\.[a-z]{2,}$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

// utm_* 같은 추적 꼬리를 뗀다 — 같은 페이지는 같은 정체
export function stripTracking(url: string): string {
  try {
    const u = new URL(url);
    for (const k of Array.from(u.searchParams.keys())) {
      if (/^utm_/i.test(k) || k === 'fbclid' || k === 'gclid') u.searchParams.delete(k);
    }
    return u.toString();
  } catch {
    return url;
  }
}

// 출처의 정체로 쓰는 정규형 — 영상은 식별자로, 그 밖은 추적 꼬리를 뗀 주소
export function canonicalLinkUrl(url: string): string {
  return parseVideoLink(url)?.canonicalUrl ?? stripTracking(url);
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
    // 채널·쇼케이스·그룹 페이지 안의 영상도 같은 영상이다
    const m =
      /^\/(?:(?:channels\/[^/]+|groups\/[^/]+\/videos|showcase\/\d+\/video|album\/\d+\/video|manage\/videos|video)\/)?(\d{6,12})(?:\/([0-9a-f]{6,}))?(?:[/?#]|$)/.exec(
        u.pathname
      );
    if (!m) return null;
    const id = m[1];
    // 비공개(unlisted) 영상의 해시 — 없으면 임베드도 oEmbed도 막힌다
    const qh = u.searchParams.get('h');
    const hash = m[2] ?? (qh && /^[0-9a-f]{6,}$/.test(qh) ? qh : null);
    const start = parseTimestamp(u.hash.replace(/^#t=/, '') || null);
    const embed = new URL(`https://player.vimeo.com/video/${id}`);
    if (hash) embed.searchParams.set('h', hash);
    embed.searchParams.set('playsinline', '1');
    if (start) embed.hash = `t=${start}s`;
    return {
      provider: 'vimeo',
      id,
      canonicalUrl: hash ? `https://vimeo.com/${id}/${hash}` : `https://vimeo.com/${id}`,
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
    : `https://vimeo.com/api/oembed.json?url=${target}&width=1280`;
}

export interface PageMeta {
  title: string | null;
  siteName: string | null;
  imageUrl: string | null;
}

// 일반 링크 — og:title / <title>, og:site_name, og:image 만 가볍게 긁는다
export function parsePageMeta(html: string): PageMeta {
  const head = html.slice(0, 200_000);
  // 여는 따옴표와 닫는 따옴표를 짝지운다 — 값 안의 다른 따옴표(Can't, "hi")에서 잘리지 않게
  const meta = (prop: string): string | null => {
    const attr = `(?:property|name)=(?:"${prop}"|'${prop}')`;
    const content = `content=(?:"([^"]*)"|'([^']*)')`;
    const re = new RegExp(`<meta[^>]+${attr}[^>]*${content}|<meta[^>]+${content}[^>]*${attr}`, 'i');
    const m = re.exec(head);
    const v = m ? (m[1] ?? m[2] ?? m[3] ?? m[4]) : null;
    return v ? decodeEntities(v).trim() || null : null;
  };
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head);
  return {
    title:
      meta('og:title') ??
      meta('twitter:title') ??
      (titleTag ? decodeEntities(titleTag[1]).trim() || null : null),
    siteName: meta('og:site_name'),
    imageUrl: meta('og:image') ?? meta('twitter:image'),
  };
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

// 한 번에 푼다 — '&amp;#39;'가 두 번 풀리지 않게
function decodeEntities(s: string): string {
  return s.replace(/&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));/gi, (m, hex, dec, name) => {
    if (hex || dec) {
      const cp = hex ? parseInt(hex, 16) : Number(dec);
      return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
    }
    return NAMED_ENTITIES[String(name).toLowerCase()] ?? m;
  });
}
