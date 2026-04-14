import { create } from 'zustand';

interface AppState {
  // User
  userName: string;
  setUserName: (name: string) => void;

  // Bible viewer
  currentBookId: number;
  currentChapter: number;
  setCurrentPosition: (bookId: number, chapter: number) => void;

  // Bible font settings
  fontScale: number;
  lineHeightScale: number;
  setFontScale: (scale: number) => void;
  setLineHeightScale: (scale: number) => void;

  // Music player
  isPlaying: boolean;
  currentTrackIndex: number;
  playbackPosition: number;
  playbackDuration: number;
  volume: number;
  showMiniPlayer: boolean;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTrackIndex: (index: number) => void;
  setPlaybackPosition: (position: number) => void;
  setPlaybackDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  setShowMiniPlayer: (show: boolean) => void;

  // Reading plan
  readingPlanStartDate: string;
  setReadingPlanStartDate: (date: string) => void;

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

  fontScale: 1.0,
  lineHeightScale: 1.0,
  setFontScale: (scale) => set({ fontScale: scale }),
  setLineHeightScale: (scale) => set({ lineHeightScale: scale }),

  isPlaying: false,
  currentTrackIndex: -1,
  playbackPosition: 0,
  playbackDuration: 0,
  volume: 0.7,
  showMiniPlayer: true,
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTrackIndex: (index) => set({ currentTrackIndex: index }),
  setPlaybackPosition: (position) => set({ playbackPosition: position }),
  setPlaybackDuration: (duration) => set({ playbackDuration: duration }),
  setVolume: (volume) => set({ volume }),
  setShowMiniPlayer: (show) => set({ showMiniPlayer: show }),

  readingPlanStartDate: '',
  setReadingPlanStartDate: (date) => set({ readingPlanStartDate: date }),

  dbReady: false,
  setDbReady: (ready) => set({ dbReady: ready }),
}));
