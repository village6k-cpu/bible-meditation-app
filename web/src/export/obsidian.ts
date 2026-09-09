import { mondayOf, todayKey } from '@core/dates';
import { buildRangeNote, type ExportEntry } from '@core/markdown';
import { entriesInRange, tagsOf } from '@db/entryRepo';
import { asSqlite } from '../db';
import type { WebDb } from '../db/sqlite';
import { deliverFile, type Delivered } from '../platform/backup';

// 옵시디언으로 나가는 문. 문서를 만드는 일은 core/markdown이 하고,
// 여기서는 기간을 잘라 파일 하나로 건네주기만 한다.

export type ExportRange = 'week' | 'month' | 'all';

export const RANGE_LABEL: Record<ExportRange, string> = {
  week: '이번 주',
  month: '이번 달',
  all: '전체',
};

function bounds(range: ExportRange): {
  from: string;
  to: string;
  name: string;
} {
  const today = todayKey();
  if (range === 'week') return { from: mondayOf(today), to: today, name: `밑줄-${today}-주간` };
  if (range === 'month')
    return {
      from: `${today.slice(0, 7)}-01`,
      to: today,
      name: `밑줄-${today.slice(0, 7)}`,
    };
  return { from: '1970-01-01', to: today, name: '밑줄-전체' };
}

export async function exportRange(
  d: WebDb,
  range: ExportRange
): Promise<{ result: 'empty' } | { result: 'ok'; how: Delivered; days: number }> {
  const db = asSqlite(d);
  const { from, to, name } = bounds(range);
  const entries = await entriesInRange(db, from, to);
  if (entries.length === 0) return { result: 'empty' };

  const tagMap = await tagsOf(
    db,
    entries.map((e) => e.id)
  );
  const withTags: ExportEntry[] = entries.map((e) => ({
    ...e,
    tags: tagMap.get(e.id) ?? [],
  }));

  const byDay = new Map<string, ExportEntry[]>();
  for (const e of withTags) {
    const list = byDay.get(e.day) ?? [];
    list.push(e);
    byDay.set(e.day, list);
  }
  const days = Array.from(byDay.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, dayEntries]) => ({ day, entries: dayEntries }));

  const how = await deliverFile(buildRangeNote(days), `${name}.md`, 'text/markdown;charset=utf-8');
  return { result: 'ok', how, days: days.length };
}
