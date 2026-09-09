import { pickDeck, type DeckSlot } from '@core/resurface';
import type { Entry } from '@core/types';
import { agoLabelKo } from '@core/dates';
import { getEntry, recordShown, resurfaceCandidates } from '@db/entryRepo';
import { getSetting, setSetting } from '@db/settingsRepo';
import { asSqlite } from '../db';
import type { WebDb } from '../db/sqlite';

// 하루 동안 얼어 있는 세 장. 같은 날엔 몇 번을 열어도 같은 카드가 나온다 —
// '오늘 뭘 다시 읽을지'가 화면을 다시 그릴 때마다 달라지면 그건 순환이 아니라 소음이다.
//
// 얼리는 방법: 처음 뽑은 카드를 settings에 적어 두고, 같은 날에는 그것만 다시 불러온다.
// 이게 없으면 '유지'를 누르는 순간 pinned가 바뀌고, 카드가 손 밑에서 다시 뽑히고,
// 보지도 않은 기록에 '오늘 보여줬음' 도장이 찍혀 30일 동안 순환에서 빠진다.

const KEY = 'deck';

export interface DeckItem {
  entry: Entry;
  slot: DeckSlot;
  caption: string;
}

interface StoredDeck {
  day: string;
  cards: { id: string; slot: DeckSlot }[];
}

const CAPTION: Record<DeckSlot, (e: Entry, today: string) => string> = {
  anniversary: (e, today) => agoLabelKo(e.day, today),
  pinned: () => '아껴둔 밑줄',
  forgotten: (e, today) => `${agoLabelKo(e.day, today)}에 적음`,
};

async function storedFor(d: WebDb, today: string): Promise<StoredDeck['cards'] | null> {
  try {
    const raw = await getSetting(asSqlite(d), KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDeck;
    return parsed.day === today && Array.isArray(parsed.cards) ? parsed.cards : null;
  } catch {
    return null; // 손상된 값은 새로 뽑는다
  }
}

export async function loadDeck(d: WebDb, today: string): Promise<DeckItem[]> {
  const db = asSqlite(d);
  let cards = await storedFor(d, today);
  if (cards === null) {
    cards = pickDeck(today, await resurfaceCandidates(db, today));
    await setSetting(db, KEY, JSON.stringify({ day: today, cards }));
    // '보여줬음'은 덱을 처음 뽑을 때 한 번만 적는다
    await recordShown(
      db,
      cards.map((c) => c.id),
      today
    );
  }
  const items: DeckItem[] = [];
  for (const c of cards) {
    const entry = await getEntry(db, c.id);
    if (entry) items.push({ entry, slot: c.slot, caption: CAPTION[c.slot](entry, today) });
  }
  return items;
}

// '순환에서 제외'는 얼려 둔 덱에서도 빼야 한다 — 다시 뽑지 않고 그 자리만 비운다
export async function dropFromDeck(d: WebDb, today: string, id: string): Promise<void> {
  const cards = await storedFor(d, today);
  if (!cards) return;
  await setSetting(
    asSqlite(d),
    KEY,
    JSON.stringify({ day: today, cards: cards.filter((c) => c.id !== id) })
  );
}
