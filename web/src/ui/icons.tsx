import type { JSX } from 'preact';
import type { EntryType } from '@core/types';

// 한 벌의 선 아이콘. 굵기 1.6, 24 격자, 채우기 없음 — 활자와 같은 무게로 읽히도록.
const PATHS = {
  moment:
    'M12 4l1.8 4.2L18 10l-4.2 1.8L12 16l-1.8-4.2L6 10l4.2-1.8z M18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z',
  book: 'M4 5a2 2 0 012-2h12v18H6a2 2 0 01-2-2z M8 3v18',
  link: 'M10 13a5 5 0 007.5.5l2-2A5 5 0 0012.5 4.5l-1 1 M14 11a5 5 0 00-7.5-.5l-2 2A5 5 0 0011.5 19.5l1-1',
  verse: 'M12 3c3 4 5 6 5 9a5 5 0 01-10 0c0-3 2-5 5-9z',
  meal: 'M6 3v8a2 2 0 004 0V3 M8 11v10 M17 3c-1.5 2-2 3.5-2 6h4c0-2.5-.5-4-2-6z M17 9v12',
  workout: 'M4 9v6 M20 9v6 M7 6v12 M17 6v12 M7 12h10',
  writing: 'M4 20h4L19 9a2.1 2.1 0 00-3-3L5 17z M14 7l3 3',
  task: 'M4 5h16v14H4z M8 12l3 3 5-6',
  inbox: 'M3 12h5l2 3h4l2-3h5 M5 5h14l2 7v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5z',
  records: 'M4 6h16 M4 12h16 M4 18h10',
  review: 'M4 5h16v5H4z M4 14h16v5H4z',
  metrics: 'M4 20V10 M10 20V4 M16 20v-8 M22 20H2',
  plus: 'M12 5v14 M5 12h14',
  chevronRight: 'M9 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  chevronLeft: 'M15 6l-6 6 6 6',
  close: 'M6 6l12 12 M18 6L6 18',
  pin: 'M6 3h12v18l-6-4-6 4z',
  trash: 'M4 7h16 M10 11v6 M14 11v6 M6 7l1 13h10l1-13 M9 7V4h6v3',
  play: 'M8 5v14l11-7z',
  check: 'M4 12l5 5L20 6',
  square: 'M5 5h14v14H5z',
  camera:
    'M4 8a2 2 0 012-2h1.5l1.2-2h6.6l1.2 2H20a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2z M12 10.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z',
  clipboard: 'M9 4h6v3H9z M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-2',
  download: 'M12 4v11 M8 11l4 4 4-4 M5 20h14',
  upload: 'M12 20V9 M8 13l4-4 4 4 M5 4h14',
  gear: 'M12 9a3 3 0 100 6 3 3 0 000-6z M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.9 1.2v.1a2 2 0 11-4 0v-.2a1.7 1.7 0 00-2.9-1.1l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.7 1.7 0 003.5 14H3a2 2 0 110-4h.2a1.7 1.7 0 001.1-2.9l-.1-.1a2 2 0 112.8-2.8l.1.1A1.7 1.7 0 0010 3.5V3a2 2 0 114 0v.2a1.7 1.7 0 002.9 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 001.2 2.9H21a2 2 0 110 4h-.2a1.7 1.7 0 00-1.4 1z',
  alert: 'M12 4l9 16H3z M12 10v4 M12 17v.5',
  home: 'M4 11l8-7 8 7 M6 10v10h12V10',
  external: 'M14 4h6v6 M20 4l-9 9 M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  width,
  ...rest
}: {
  name: IconName;
  width?: number;
} & JSX.SVGAttributes<SVGSVGElement>): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={width ?? 1.6}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

// 채워진 재생 삼각형만 예외 — 선으로 그리면 작을 때 뭉갠다
export function PlayIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

// 레지스트리의 유형 키가 곧 아이콘 이름이다
export const typeIcon = (t: EntryType): IconName => t as IconName;
