export type EntryType = 'moment' | 'media' | 'writing' | 'meal' | 'workout';
export type MediaKind = 'book' | 'youtube' | 'music' | 'article' | 'movie';
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const ENTRY_TYPES: EntryType[] = ['moment', 'media', 'writing', 'meal', 'workout'];

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  moment: '순간',
  media: '감상',
  writing: '글',
  meal: '식사',
  workout: '운동',
};

export const ENTRY_TYPE_ICONS: Record<EntryType, string> = {
  moment: 'sparkles-outline',
  media: 'bookmark-outline',
  writing: 'create-outline',
  meal: 'restaurant-outline',
  workout: 'barbell-outline',
};

export const MEDIA_KINDS: MediaKind[] = ['book', 'youtube', 'music', 'article', 'movie'];

export const MEDIA_KIND_LABELS: Record<MediaKind, string> = {
  book: '책',
  youtube: '유튜브',
  music: '음악',
  article: '아티클',
  movie: '영화',
};

export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: '아침',
  lunch: '점심',
  dinner: '저녁',
  snack: '간식',
};

export function isEntryType(v: string | undefined): v is EntryType {
  return !!v && (ENTRY_TYPES as string[]).includes(v);
}

// '#독서 #신앙_생활' → ['독서', '신앙_생활'] — the user's existing Drafts habit
export function extractHashtags(text: string): string[] {
  const matches = text.matchAll(/#([\p{L}\p{N}_]+)/gu);
  return Array.from(matches, (m) => m[1]);
}

// Stored comma-wrapped so LIKE '%,tag,%' matches exactly: ',독서,신앙,' (empty → '')
export function normalizeTags(tags: string[]): string {
  const cleaned = Array.from(
    new Set(tags.map((t) => t.trim().replace(/^#/, '')).filter((t) => t.length > 0))
  );
  return cleaned.length === 0 ? '' : `,${cleaned.join(',')},`;
}

export function parseTags(stored: string): string[] {
  return stored.split(',').filter((t) => t.length > 0);
}

export function detectMediaKind(url: string): MediaKind | null {
  const u = url.trim().toLowerCase();
  if (!/^https?:\/\//.test(u)) return null;
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('music.apple.com') || u.includes('spotify.com')) return 'music';
  return 'article';
}

export function defaultMealSlot(date: Date = new Date()): MealSlot {
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes >= 4 * 60 && minutes < 10 * 60 + 30) return 'breakfast';
  if (minutes < 15 * 60) return 'lunch';
  if (minutes < 17 * 60 + 30) return 'snack';
  return 'dinner';
}

// Deterministic per-day seed: the resurfaced entry stays the same all day, changes tomorrow
export function dailySeed(dateIso: string): number {
  let hash = 0;
  for (let i = 0; i < dateIso.length; i++) {
    hash = (hash * 31 + dateIso.charCodeAt(i)) >>> 0;
  }
  return hash;
}
