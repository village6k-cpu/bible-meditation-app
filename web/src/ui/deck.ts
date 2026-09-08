import { pickDeck, type DeckSlot } from '@core/resurface';
import type { Entry } from '@core/types';
import { agoLabelKo } from '@core/dates';
import { getEntry, recordShown, resurfaceCandidates } from '@db/entryRepo';
import { asSqlite } from '../db';
import type { WebDb } from '../db/sqlite';

// 하루 동안 얼어 있는 세 장. 같은 날엔 몇 번을 열어도 같은 카드가 나온다 —
// '오늘 뭘 다시 읽을지'가 새로고침마다 달라지면 그건 순환이 아니라 소음이다.

export interface DeckItem {
  entry: Entry;
  slot: DeckSlot;
  caption: string;
}

const CAPTION: Record<DeckSlot, (e: Entry, today: string) => string> = {
  anniversary: (e, today) => agoLabelKo(e.day, today),
  pinned: () => '아껴둔 밑줄',
  forgotten: (e, today) => `${agoLabelKo(e.day, today)}에 적음`,
};

export async function loadDeck(d: WebDb, today: string): Promise<DeckItem[]> {
  const db = asSqlite(d);
  const cards = pickDeck(today, await resurfaceCandidates(db, today));
  const items: DeckItem[] = [];
  for (const c of cards) {
    const entry = await getEntry(db, c.id);
    if (entry)
      items.push({
        entry,
        slot: c.slot,
        caption: CAPTION[c.slot](entry, today),
      });
  }
  if (items.length > 0)
    await recordShown(
      db,
      items.map((i) => i.entry.id),
      today
    );
  return items;
}
