import type { Source, SourceKind } from './types';
import { validCatalog, type CatalogArtwork } from './catalog';

export const MEDIA_KINDS = ['book', 'film', 'series', 'music', 'podcast', 'article', 'video'] as const;
export type MediaKind = typeof MEDIA_KINDS[number];
export const MEDIA_LABEL: Record<MediaKind, string> = {
  book: '책', film: '영화', series: '시리즈', music: '음악', podcast: '팟캐스트', article: '글', video: '영상',
};
export const MEDIA_STATUSES = ['planned', 'active', 'completed', 'paused'] as const;
export type MediaStatus = typeof MEDIA_STATUSES[number];
export const STATUS_LABEL: Record<MediaStatus | 'untracked', string> = {
  planned: '감상 예정', active: '감상 중', completed: '완료', paused: '중단', untracked: '상태 미지정',
};

export interface LibraryInfo {
  version: 1;
  kind: MediaKind;
  status: MediaStatus;
  rating: number | null;
  review: string;
  started_on: string | null;
  finished_on: string | null;
  catalog?: CatalogArtwork;
}

export function sourceKindFor(kind: MediaKind): SourceKind {
  return kind === 'book' ? 'book' : kind === 'article' ? 'article' : 'video';
}

function validDay(value: unknown): boolean {
  if (value === null) return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateLibraryInfo(info: LibraryInfo): void {
  if (info.catalog !== undefined && !validCatalog(info.catalog)) throw new Error('표지 정보를 확인해 주세요. 다시 검색해 선택할 수 있습니다.');
  if (info.version !== 1 || !MEDIA_KINDS.includes(info.kind) || !MEDIA_STATUSES.includes(info.status)) {
    throw new Error('작품 종류와 감상 상태를 확인해 주세요.');
  }
  if (info.rating !== null && (typeof info.rating !== 'number' || !Number.isFinite(info.rating)
    || info.rating < 0.5 || info.rating > 5 || !Number.isInteger(info.rating * 2))) {
    throw new Error('별점은 0.5점부터 5점까지 선택해 주세요.');
  }
  if (typeof info.review !== 'string') throw new Error('리뷰 내용을 확인해 주세요.');
  if (!validDay(info.started_on) || !validDay(info.finished_on)) throw new Error('올바른 날짜를 입력해 주세요.');
  if (info.finished_on && info.status !== 'completed') throw new Error('완료일은 감상 완료 상태에서만 기록합니다.');
  if (info.started_on && info.finished_on && info.started_on > info.finished_on) {
    throw new Error('완료일은 시작일보다 빠를 수 없습니다.');
  }
}

export function libraryInfo(source: Source): LibraryInfo | null {
  if (!source.library_json) return null;
  try {
    const info = JSON.parse(source.library_json) as LibraryInfo;
    // A bad external image must never hide a user's review, rating or dates.
    if (info && info.catalog !== undefined && !validCatalog(info.catalog)) delete info.catalog;
    validateLibraryInfo(info);
    return info;
  } catch { return null; }
}

export interface LibraryItem extends Source {
  entry_count: number;
  info: LibraryInfo | null;
  mediaKind: MediaKind;
}

export function libraryItem(source: Source & { entry_count: number }): LibraryItem {
  const info = libraryInfo(source);
  return { ...source, info, mediaKind: info?.kind ?? source.kind };
}

export interface LibraryFilters {
  q: string;
  kind: MediaKind | '';
  status: MediaStatus | 'untracked' | '';
  year: string;
  favorites: boolean;
  sort: 'recent' | 'rating' | 'title' | 'finished';
}
export const EMPTY_LIBRARY_FILTERS: LibraryFilters = {
  q: '', kind: '', status: '', year: '', favorites: false, sort: 'recent',
};

export function filterLibrary(items: LibraryItem[], f: LibraryFilters): LibraryItem[] {
  const query = f.q.trim().normalize('NFC').toLocaleLowerCase();
  return items.filter(item => {
    const info = item.info;
    return (!query || [item.title, item.creator, info?.review].join(' ').normalize('NFC').toLocaleLowerCase().includes(query))
      && (!f.kind || item.mediaKind === f.kind)
      && (!f.status || (info?.status ?? 'untracked') === f.status)
      && (!f.year || info?.finished_on?.startsWith(f.year + '-'))
      && (!f.favorites || (info?.rating ?? 0) >= 4);
  }).sort((a, b) => {
    if (f.sort === 'title') return a.title.localeCompare(b.title, 'ko') || a.id.localeCompare(b.id);
    if (f.sort === 'rating') return (b.info?.rating ?? -1) - (a.info?.rating ?? -1) || b.last_used_at - a.last_used_at;
    if (f.sort === 'finished') return (b.info?.finished_on ?? '').localeCompare(a.info?.finished_on ?? '') || b.last_used_at - a.last_used_at;
    return b.last_used_at - a.last_used_at || a.id.localeCompare(b.id);
  });
}

export function librarySummary(items: LibraryItem[], year: string) {
  const rated = items.filter(i => i.info?.rating != null);
  return {
    total: items.length,
    completed: items.filter(i => i.info?.status === 'completed').length,
    thisYear: items.filter(i => i.info?.status === 'completed' && i.info.finished_on?.startsWith(year + '-')).length,
    active: items.filter(i => i.info?.status === 'active').length,
    planned: items.filter(i => i.info?.status === 'planned').length,
    average: rated.length ? rated.reduce((sum, i) => sum + i.info!.rating!, 0) / rated.length : null,
  };
}

export function libraryMarkdown(items: LibraryItem[]): string {
  return '# 나의 서재\n\n' + items.map(item => {
    const info = item.info;
    return `## ${item.title.replace(/\n/g, ' ')}\n\n${MEDIA_LABEL[item.mediaKind]} · ${STATUS_LABEL[info?.status ?? 'untracked']}`
      + (item.creator ? ` · ${item.creator}` : '')
      + `\n\n별점: ${info?.rating == null ? '미평가' : `${info.rating} / 5`}`
      + (info?.started_on ? `\n시작: ${info.started_on}` : '')
      + (info?.finished_on ? `\n완료: ${info.finished_on}` : '')
      + (item.url ? `\n링크: ${item.url}` : '')
      + (info?.review ? `\n\n${info.review}` : '') + '\n';
  }).join('\n---\n\n');
}
