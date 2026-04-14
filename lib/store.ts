import { create } from 'zustand';
import { DailyReading } from './bible-data';

interface AppState {
  // User
  userName: string;
  setUserName: (name: string) => void;

  // Bible viewer
  currentBookId: number;
  currentChapter: number;
  setCurrentPosition: (bookId: number, chapter: number) => void;

  // Today's readings
  todayReadings: DailyReading[];
  setTodayReadings: (readings: DailyReading[]) => void;

  // Music player (UI state only for MVP)
  isPlaying: boolean;
  currentTrack: string;
  togglePlaying: () => void;

  // DB initialized flag
  dbReady: boolean;
  setDbReady: (ready: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  userName: '',
  setUserName: (name) => set({ userName: name }),

  currentBookId: 43, // 요한복음
  currentChapter: 1,
  setCurrentPosition: (bookId, chapter) => set({ currentBookId: bookId, currentChapter: chapter }),

  todayReadings: [],
  setTodayReadings: (readings) => set({ todayReadings: readings }),

  isPlaying: false,
  currentTrack: 'Peaceful Dwelling',
  togglePlaying: () => set((s) => ({ isPlaying: !s.isPlaying })),

  dbReady: false,
  setDbReady: (ready) => set({ dbReady: ready }),
}));
