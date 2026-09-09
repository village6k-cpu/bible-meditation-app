import type { JSX } from 'preact';
import type { MealSlot } from '@core/types';
import type { PracticeCell } from '@db/entryRepo';
import { Photo } from './photo';

// 식사·운동은 줄이 아니라 격자다.
//
// 콘텐츠(밑줄·영상 메모)는 하나하나가 다르고 그래서 목록으로 읽는다. 실천은 반대다 — 매일 같은 칸이
// 있고, 그 칸이 채워졌는지가 전부이며, 내용은 사진 한 장이면 된다. 단위는 기록이 아니라 하루다.
// 그래서 여기서는 하루를 한 줄로, 칸을 열로 그린다. 오늘은 수집함 맨 위에 한 줄, 추이는 지표에 여러 줄.

export type Column = { key: 'breakfast' | 'lunch' | 'dinner' | 'workout'; label: string };

export const COLUMNS: Column[] = [
  { key: 'breakfast', label: '아침' },
  { key: 'lunch', label: '점심' },
  { key: 'dinner', label: '저녁' },
  { key: 'workout', label: '운동' },
];

export type CellState = 'none' | 'kept' | 'broken';

export interface DayCells {
  day: string;
  cells: Record<Column['key'], { state: CellState; entry: PracticeCell | null }>;
  snacks: number;
}

// 한 날의 기록들을 칸에 배치한다. 같은 칸에 여럿이면 마지막 것이 얼굴이 되고, 하나라도 어겼으면 어긴 날이다.
export function layoutDay(day: string, rows: PracticeCell[]): DayCells {
  const cells = {} as DayCells['cells'];
  for (const c of COLUMNS) cells[c.key] = { state: 'none', entry: null };
  let snacks = 0;
  for (const r of rows) {
    if (r.day !== day) continue;
    const key: Column['key'] | null =
      r.type === 'workout'
        ? 'workout'
        : r.slot === 'breakfast' || r.slot === 'lunch' || r.slot === 'dinner'
          ? r.slot
          : null;
    if (!key) {
      if (r.slot === 'snack') snacks += 1;
      continue;
    }
    const cell = cells[key];
    const broken = r.practiced === 0 || cell.state === 'broken';
    cells[key] = { state: broken ? 'broken' : 'kept', entry: r.image_uri ? r : (cell.entry ?? r) };
  }
  return { day, cells, snacks };
}

export function layoutDays(days: string[], rows: PracticeCell[]): DayCells[] {
  const byDay = new Map<string, PracticeCell[]>();
  for (const r of rows) {
    const list = byDay.get(r.day);
    if (list) list.push(r);
    else byDay.set(r.day, [r]);
  }
  return days.map((d) => layoutDay(d, byDay.get(d) ?? []));
}

// 칸 하나. 사진이 있으면 사진, 없으면 점 — 지킴은 먹, 어김은 빗금, 비움은 테두리만.
export function Cell({
  cell,
  size,
  onClick,
  label,
}: {
  cell: { state: CellState; entry: PracticeCell | null };
  size: 'strip' | 'grid';
  onClick?: () => void;
  label?: string;
}): JSX.Element {
  const cls = `pcell ${size} ${cell.state}`;
  const photo = cell.entry?.image_uri ?? null;
  return (
    <button class={cls} onClick={onClick} aria-label={label}>
      {photo ? <Photo photo={photo} class="photo pcell-photo" /> : <span class="pcell-dot" />}
      {cell.state === 'broken' && <span class="pcell-x" />}
    </button>
  );
}

export const SLOT_WORD: Record<Column['key'], string> = {
  breakfast: '아침',
  lunch: '점심',
  dinner: '저녁',
  workout: '운동',
};

export type SlotKey = Column['key'];
export type { MealSlot };
