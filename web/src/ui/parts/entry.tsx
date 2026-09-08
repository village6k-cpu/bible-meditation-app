import type { JSX } from 'preact';
import { REGISTRY } from '@core/registry';
import { MEAL_SLOT_LABELS, type Entry } from '@core/types';
import { formatDayShortKo } from '@core/dates';
import { previewLink } from '../../link/resolve';
import { PlayIcon } from '../icons';

// 한 줄로 요약되는 출처. 유형마다 무엇이 '어디서 왔는지'가 다르다.
export function srcLine(e: Entry): string {
  switch (e.type) {
    case 'book':
      return [e.subtitle, e.title ? `『${e.title}』` : null, e.page ? `p.${e.page}` : null]
        .filter(Boolean)
        .join(' · ');
    case 'link':
      return [e.title, e.subtitle].filter(Boolean).join(' · ');
    case 'workout':
      return [e.title, e.minutes ? `${e.minutes}분` : null].filter(Boolean).join(' · ');
    case 'meal':
      return e.slot ? MEAL_SLOT_LABELS[e.slot] : '식사';
    case 'verse':
      return e.subtitle ?? '';
    default:
      return e.title ?? '';
  }
}

export function firstLine(e: Entry): string {
  return e.quote || e.body || e.title || '';
}

// 유튜브는 주소만으로 썸네일이 나오지만 비메오는 oEmbed를 거쳐야 나온다 —
// 저장해 둔 값이 있으면 그것이 먼저다.
export function thumbOf(e: Entry): string | null {
  if (e.type !== 'link') return null;
  if (e.image_uri && /^https?:/.test(e.image_uri)) return e.image_uri;
  return e.url ? (previewLink(e.url)?.thumbnailUrl ?? null) : null;
}

export function Thumb({ src, style }: { src: string; style?: string }): JSX.Element {
  return (
    <div class="vid" style={style}>
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={(ev) => ((ev.currentTarget as HTMLImageElement).style.display = 'none')}
      />
      <span class="play">
        <PlayIcon />
      </span>
    </div>
  );
}

export function EntryRow({
  entry,
  tags,
  showDate,
  meta,
  onOpen,
}: {
  entry: Entry;
  tags?: string[];
  showDate?: boolean;
  meta?: string | null;
  onOpen: (id: string) => void;
}): JSX.Element {
  const line = srcLine(entry);
  const thumb = thumbOf(entry);
  return (
    <button class="entry-row" onClick={() => onOpen(entry.id)}>
      <div class="entry-head">
        <span class="mono">{REGISTRY[entry.type].label}</span>
        {showDate && <span class="mono dim">{formatDayShortKo(entry.day)}</span>}
        {entry.pinned === 1 && <span class="mono dim">표시함</span>}
        {meta && (
          <span class="mono dim" style="margin-left:auto">
            {meta}
          </span>
        )}
      </div>
      {thumb && <Thumb src={thumb} style="margin:6px 0 8px" />}
      {entry.quote && (
        <div class="quoted">
          <span class="rule" />
          <span class="quote-t clamp3">{entry.quote}</span>
        </div>
      )}
      {entry.body && (
        <div class="body-t clamp2" style={entry.quote ? 'margin-top:6px' : undefined}>
          {entry.body}
        </div>
      )}
      {line && (
        <div class="src-line">
          <span class="cap">{line}</span>
        </div>
      )}
      {tags && tags.length > 0 && (
        <div class="cap dim" style="margin-top:6px">
          {tags.map((t) => `#${t}`).join('  ')}
        </div>
      )}
    </button>
  );
}

export function SectionRow({
  label,
  right,
  first,
}: {
  label: string;
  right?: string | number;
  first?: boolean;
}): JSX.Element {
  return (
    <div class={first ? 'sec-row first' : 'sec-row'}>
      <span class="micro">{label}</span>
      {right !== undefined && <span class="mono dim">{right}</span>}
    </div>
  );
}
