import { oembedUrl } from '@core/links';
import { previewLink, type LinkMeta } from '@ex/linkMeta';

// 네이티브의 resolveLink는 영상이 아니면 페이지를 직접 받아 og 태그를 읽는다.
// 브라우저에서는 그 요청이 CORS에 막힌다 — 막히는 걸 알면서 던지지 않는다.
// 영상(oEmbed)만 실제로 물어보고, 나머지는 링크가 아는 만큼으로 남긴다.

export { previewLink };
export type { LinkMeta };

export async function resolveLink(input: string, signal?: AbortSignal): Promise<LinkMeta | null> {
  const meta = previewLink(input);
  if (!meta?.video) return meta;
  try {
    const res = await withTimeout(oembedUrl(meta.video), 6000, signal);
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
      // 비공개·삭제·임베드 금지 — 틀 안에서 재생되지 않는다
      meta.embeddable = false;
    }
  } catch {
    // 오프라인이어도 링크만으로 기록은 남는다
  }
  return meta;
}

async function withTimeout(url: string, ms: number, signal?: AbortSignal): Promise<Response> {
  if (signal?.aborted) throw new Error('aborted');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
