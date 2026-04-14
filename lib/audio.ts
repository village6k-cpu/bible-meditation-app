import { Audio, AVPlaybackStatus } from 'expo-av';
import { useAppStore } from './store';

export interface Track {
  id: string;
  title: string;
  artist: string;
  duration: number; // seconds
}

export const TRACKS: Track[] = [
  { id: '1', title: 'Peaceful Dwelling', artist: 'Ambient Worship', duration: 900 },
  { id: '2', title: 'Still Waters', artist: 'Ambient Worship', duration: 720 },
  { id: '3', title: 'Morning Light', artist: 'Ambient Worship', duration: 840 },
  { id: '4', title: 'Sacred Rest', artist: 'Ambient Worship', duration: 660 },
  { id: '5', title: 'Gentle Presence', artist: 'Ambient Worship', duration: 780 },
];

let sound: Audio.Sound | null = null;
let statusUpdateInterval: ReturnType<typeof setInterval> | null = null;

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export async function setupAudio(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
    });
  } catch (e) {
    console.warn('Audio setup failed:', e);
  }
}

export async function playTrack(trackIndex: number): Promise<void> {
  const store = useAppStore.getState();

  // Stop current track
  if (sound) {
    await sound.unloadAsync();
    sound = null;
  }

  if (statusUpdateInterval) {
    clearInterval(statusUpdateInterval);
    statusUpdateInterval = null;
  }

  const track = TRACKS[trackIndex];
  if (!track) return;

  store.setCurrentTrackIndex(trackIndex);
  store.setIsPlaying(true);
  store.setPlaybackPosition(0);
  store.setPlaybackDuration(track.duration);

  // In a real app, we'd load from assets/music/*.mp3
  // For now, simulate playback with a timer
  let position = 0;
  statusUpdateInterval = setInterval(() => {
    const currentStore = useAppStore.getState();
    if (!currentStore.isPlaying) return;

    position += 1;
    currentStore.setPlaybackPosition(position);

    if (position >= track.duration) {
      // Auto-advance to next track
      const nextIndex = (trackIndex + 1) % TRACKS.length;
      playTrack(nextIndex);
    }
  }, 1000);
}

export async function togglePlayback(): Promise<void> {
  const store = useAppStore.getState();

  if (!store.isPlaying && store.currentTrackIndex === -1) {
    // Start playing first track
    await playTrack(0);
    return;
  }

  store.setIsPlaying(!store.isPlaying);
}

export async function nextTrack(): Promise<void> {
  const store = useAppStore.getState();
  const nextIndex = (store.currentTrackIndex + 1) % TRACKS.length;
  await playTrack(nextIndex);
}

export async function prevTrack(): Promise<void> {
  const store = useAppStore.getState();
  const pos = store.playbackPosition;

  // If more than 3 seconds in, restart current track
  if (pos > 3) {
    store.setPlaybackPosition(0);
    return;
  }

  const prevIndex = store.currentTrackIndex <= 0 ? TRACKS.length - 1 : store.currentTrackIndex - 1;
  await playTrack(prevIndex);
}

export async function seekTo(position: number): Promise<void> {
  const store = useAppStore.getState();
  store.setPlaybackPosition(position);
}

export async function stopPlayback(): Promise<void> {
  const store = useAppStore.getState();
  store.setIsPlaying(false);

  if (statusUpdateInterval) {
    clearInterval(statusUpdateInterval);
    statusUpdateInterval = null;
  }

  if (sound) {
    await sound.unloadAsync();
    sound = null;
  }
}
