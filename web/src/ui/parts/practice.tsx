import type { JSX } from 'preact';
import { addDays, mondayOf } from '@core/dates';
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

// ── 한눈에 보는 자리 ──
// 28줄짜리 격자는 아래로 끝없이 길어져서 '요즘 어떤가'를 답하지 못했다. 스크롤해야 보이는 추이는 추이가 아니다.
// 대신 주를 열로, 요일을 줄로 세운다. 12주가 폭 안에 들어오고, 빈 구간이 세로 띠로 즉시 보인다.

/** 하루를 0..3 농도로. 3=전부 지킴, 2=일부, 1=기록은 있으나 못 지킴, 0=기록 없음 */
// 농도와 '어김'은 다른 축이다. 농도만 쓰면 '아침 지키고 저녁 치팅'과 '아침만 기록'이 같은 회색이 되어
// 어긴 날이 그림에서 사라진다 — 정작 보려던 것이 그건데. 그래서 둘을 갈라 돌려주고, 화면은 농도 위에
// 빗금을 덧씌운다. 어긴 날은 얼마나 채웠든 반드시 빗금이 보인다.
export interface Mark {
  level: 0 | 1 | 2 | 3;
  broke: boolean;
}

export function mealMark(day: DayCells): Mark {
  const slots = (['breakfast', 'lunch', 'dinner'] as const).map((k) => day.cells[k].state);
  const logged = slots.filter((s) => s !== 'none').length;
  const broke = slots.some((s) => s === 'broken');
  if (logged === 0) return { level: 0, broke: false };
  const kept = slots.filter((s) => s === 'kept').length;
  if (kept === 0) return { level: 1, broke };
  return { level: kept === logged && logged >= 2 ? 3 : 2, broke };
}

export function workoutMark(day: DayCells): Mark {
  const s = day.cells.workout.state;
  if (s === 'kept') return { level: 3, broke: false };
  if (s === 'broken') return { level: 1, broke: true };
  return { level: 0, broke: false };
}

/** 12주치를 주 단위로 자른다. 각 주는 월요일부터 일곱 칸. 오늘 이후는 null. */
export function weeksOf(days: DayCells[], today: string, weeks: number): (DayCells | null)[][] {
  const byDay = new Map(days.map((d) => [d.day, d]));
  const out: (DayCells | null)[][] = [];
  // 이번 주 월요일에서 (weeks-1)주 뒤로
  const start = addDays(mondayOf(today), -(weeks - 1) * 7);
  for (let w = 0; w < weeks; w += 1) {
    const col: (DayCells | null)[] = [];
    for (let i = 0; i < 7; i += 1) {
      const day = addDays(start, w * 7 + i);
      col.push(day > today ? null : (byDay.get(day) ?? { day, cells: emptyCells(), snacks: 0 }));
    }
    out.push(col);
  }
  return out;
}

function emptyCells(): DayCells['cells'] {
  const cells = {} as DayCells['cells'];
  for (const c of COLUMNS) cells[c.key] = { state: 'none', entry: null };
  return cells;
}

/** 끼니별 준수 — 아침·점심·저녁 각각 {지킨 날, 기록한 날} */
export function slotTally(
  days: DayCells[]
): { key: SlotKey; label: string; kept: number; logged: number }[] {
  return COLUMNS.slice(0, 3).map((c) => {
    let kept = 0;
    let logged = 0;
    for (const d of days) {
      const st = d.cells[c.key].state;
      if (st !== 'none') logged += 1;
      if (st === 'kept') kept += 1;
    }
    return { key: c.key, label: c.label, kept, logged };
  });
}
