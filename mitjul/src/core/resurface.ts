import { DayKey, annKeyOf, daysBetween, hashDay, mulberry32 } from './dates';
import { EntryType } from './types';

// '다시 만나는 밑줄' 3장 선정 — 순수 함수. 같은 날, 같은 후보면 항상 같은 덱.
// 오늘의 노출 기록은 덱을 바꾸지 않는다: lastShownDay는 반드시 '이전 날'의 노출만 담아 넘길 것.

export const FORGOTTEN_COOLDOWN_DAYS = 30;
const TEXTUAL_TYPES: EntryType[] = ['book', 'verse', 'writing', 'moment', 'video'];

export interface ResurfaceCandidate {
  id: string;
  type: EntryType;
  day: DayKey;
  pinned: number;
  hasText: boolean; // quote 또는 body가 비어 있지 않음
  lastShownDay: DayKey | null; // 오늘 이전의 마지막 노출일
  skipped: boolean; // '다음에요'를 받은 적 있음
  retired: boolean; // '보내주기' — 순환에서 영구 제외
}

export type DeckSlot = 'anniversary' | 'pinned' | 'forgotten';

export interface DeckCard {
  id: string;
  slot: DeckSlot;
}

export function pickDeck(today: DayKey, candidates: ResurfaceCandidate[]): DeckCard[] {
  const alive = candidates.filter((c) => !c.retired && c.day < today);
  const used = new Set<string>();
  const deck: DeckCard[] = [];

  // 슬롯 A — 그날의 기록: 같은 월·일의 과거 기록, 가장 오래된 해 우선
  const ann = alive
    .filter((c) => annKeyOf(c.day) === annKeyOf(today))
    .sort((a, b) => (a.day < b.day ? -1 : 1))[0];
  if (ann) {
    deck.push({ id: ann.id, slot: 'anniversary' });
    used.add(ann.id);
  }

  // 슬롯 B — 아껴둔 밑줄: pinned 중 가장 오래 안 보여준 것
  const pinnedPick = alive
    .filter((c) => c.pinned === 1 && !used.has(c.id))
    .sort((a, b) => {
      const la = a.lastShownDay ?? '';
      const lb = b.lastShownDay ?? '';
      if (la !== lb) return la < lb ? -1 : 1; // 노출 이력 없음('') 최우선
      return a.day < b.day ? -1 : 1;
    })[0];
  if (pinnedPick) {
    deck.push({ id: pinnedPick.id, slot: 'pinned' });
    used.add(pinnedPick.id);
  }

  // 슬롯 C — 잊힌 문장: 글이 있는 기록 중 최근 30일 미노출, 날짜 시드 가중 랜덤
  const forgotten = alive.filter(
    (c) =>
      !used.has(c.id) &&
      c.hasText &&
      TEXTUAL_TYPES.includes(c.type) &&
      (c.lastShownDay === null || daysBetween(c.lastShownDay, today) > FORGOTTEN_COOLDOWN_DAYS)
  );
  if (forgotten.length > 0) {
    const rand = mulberry32(hashDay(today));
    const weighted: string[] = [];
    // 후보 순서가 흔들려도 같은 덱이 나오도록 id로 고정 정렬 후 가중치 전개
    for (const c of [...forgotten].sort((a, b) => (a.id < b.id ? -1 : 1))) {
      const weight = c.skipped ? 1 : c.pinned === 1 ? 4 : 2;
      for (let i = 0; i < weight; i++) weighted.push(c.id);
    }
    const pick = weighted[Math.floor(rand() * weighted.length)];
    deck.push({ id: pick, slot: 'forgotten' });
  }

  return deck;
}
