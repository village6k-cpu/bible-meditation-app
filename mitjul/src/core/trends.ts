import { DayKey, addDays } from './dates';
import { TrendRow } from './types';

// 흐름 탭의 먹점 농도와 이어온 날 수 — 순수 함수만.

export type PracticeKey = 'workout' | 'meal' | 'verse' | 'record';
export type DotLevel = 0 | 1 | 2 | 3;

export function dotLevel(key: PracticeKey, row: TrendRow | undefined): DotLevel {
  if (!row) return 0;
  switch (key) {
    case 'workout':
      return row.workoutDone ? 3 : 0;
    case 'meal':
      if (row.mealCount === 0) return 0;
      if (row.mealPracticed === 0) return 1; // 기록은 했지만 실천 체크 없음
      return row.mealPracticed >= row.mealCount ? 3 : 2;
    case 'verse':
      return row.verseCount > 0 ? 3 : 0;
    case 'record':
      if (row.entryCount === 0) return 0;
      return row.entryCount >= 3 ? 3 : 2;
  }
}

export function practicedOn(key: PracticeKey, row: TrendRow | undefined): boolean {
  return dotLevel(key, row) >= 2;
}

// 오늘 또는 어제부터 거꾸로 이어지는 연속 실천 일수.
// 오늘 아직 안 했다고 어제까지의 흐름이 끊긴 것은 아니다.
export function streakOf(
  key: PracticeKey,
  rowsByDay: Map<DayKey, TrendRow>,
  today: DayKey
): number {
  let day = today;
  if (!practicedOn(key, rowsByDay.get(day))) day = addDays(day, -1);
  let streak = 0;
  while (practicedOn(key, rowsByDay.get(day))) {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}

// 이번 주(월요일 시작)에 실천한 날 수 — 끊긴 흐름의 죄책감 없는 리프레임
export function weekCount(
  key: PracticeKey,
  rowsByDay: Map<DayKey, TrendRow>,
  weekDays: DayKey[]
): number {
  return weekDays.filter((d) => practicedOn(key, rowsByDay.get(d))).length;
}
