import { getISODate, getWeekDates } from './utils';

// 주간 목표
export const WEEKLY_GOALS = {
  readingChapters: 10,  // 최소 목표
  prayerCount: 4,       // 최소 목표
};

export const DAILY_IDEAL = {
  readingChapters: 2,   // 바람직한 일일 목표
  prayerCount: 1,       // 바람직한 일일 목표
};

export interface WeeklyProgress {
  chaptersRead: number;
  prayersDone: number;
  goalChapters: number;
  goalPrayers: number;
  dailyDetail: { date: string; chapters: number; prayed: boolean }[];
}
