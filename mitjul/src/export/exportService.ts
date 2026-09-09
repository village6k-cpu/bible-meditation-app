import { type SQLiteDatabase } from 'expo-sqlite';
import { mondayOf, todayKey } from '../core/dates';
import { ExportEntry, buildRangeNote } from '../core/markdown';
import { entriesInRange, tagsOf } from '../db/entryRepo';
import { shareMarkdown } from './files';

export type ExportRange = 'week' | 'month' | 'all';

function rangeBounds(range: ExportRange): { from: string; to: string; name: string } {
  const today = todayKey();
  if (range === 'week') {
    return { from: mondayOf(today), to: today, name: `밑줄-${today}-주간` };
  }
  if (range === 'month') {
    return { from: `${today.slice(0, 7)}-01`, to: today, name: `밑줄-${today.slice(0, 7)}` };
  }
  return { from: '1970-01-01', to: today, name: '밑줄-전체' };
}

export async function exportRange(
  db: SQLiteDatabase,
  range: ExportRange
): Promise<'shared' | 'empty' | 'unavailable'> {
  const { from, to, name } = rangeBounds(range);
  const entries = await entriesInRange(db, from, to);
  if (entries.length === 0) return 'empty';

  const tagMap = await tagsOf(db, entries.map((e) => e.id));
  const withTags: ExportEntry[] = entries.map((e) => ({ ...e, tags: tagMap.get(e.id) ?? [] }));

  const byDay = new Map<string, ExportEntry[]>();
  for (const e of withTags) {
    const list = byDay.get(e.day) ?? [];
    list.push(e);
    byDay.set(e.day, list);
  }
  const days = Array.from(byDay.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, dayEntries]) => ({ day, entries: dayEntries }));

  const content = buildRangeNote(days);
  const ok = await shareMarkdown(content, `${name}.md`);
  return ok ? 'shared' : 'unavailable';
}
