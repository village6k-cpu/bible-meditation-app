import { Platform } from 'react-native';
import { formatISODateKo } from './utils';
import {
  DayMeditation,
  Entry,
  DayLog,
  Todo,
  getEntriesByDate,
  getMeditationsByDate,
  getDayLog,
  getTodosByDate,
  getActiveDates,
} from './journal-db';
import {
  MEAL_SLOT_LABELS,
  MEDIA_KIND_LABELS,
  parseTags,
} from './journal-utils';

interface DayData {
  date: string;
  entries: Entry[];
  meditations: DayMeditation[];
  dayLog: DayLog | null;
  todos: Todo[];
}

async function loadDay(date: string): Promise<DayData> {
  const [entries, meditations, dayLog, todos] = await Promise.all([
    getEntriesByDate(date),
    getMeditationsByDate(date),
    getDayLog(date),
    getTodosByDate(date),
  ]);
  return { date, entries, meditations, dayLog, todos };
}

function dayHasContent(d: DayData): boolean {
  return (
    d.entries.length > 0 ||
    d.meditations.length > 0 ||
    d.todos.length > 0 ||
    !!d.dayLog?.day_title ||
    d.dayLog?.workout_done === 1 ||
    d.dayLog?.diet_kept !== null && d.dayLog?.diet_kept !== undefined
  );
}

function entryBlock(e: Entry): string {
  const lines: string[] = [];
  if (e.type === 'media') {
    const kind = e.media_kind ? MEDIA_KIND_LABELS[e.media_kind] : '기타';
    lines.push(`### [${kind}] ${e.title ?? '무제'}`);
  } else if (e.title) {
    lines.push(`### ${e.title}`);
  }
  if (e.quote) {
    lines.push(...e.quote.split('\n').map((l) => `> ${l}`));
  }
  if (e.body) lines.push(e.body);
  if (e.link) lines.push(`[링크](${e.link})`);
  if (e.photo_uri) lines.push(`사진: ${e.photo_uri}`);
  const tags = parseTags(e.tags);
  if (tags.length > 0) lines.push(tags.map((t) => `#${t}`).join(' '));
  return lines.join('\n');
}

// One markdown document per day — the Obsidian-native unit, Dataview-queryable frontmatter
export function buildDayMarkdown(d: DayData): string {
  const workoutEntries = d.entries.filter((e) => e.type === 'workout');
  const workoutMinutes = workoutEntries.reduce((sum, e) => sum + (e.minutes ?? 0), 0);
  const workoutDone = workoutEntries.length > 0 || d.dayLog?.workout_done === 1;
  const allTags = Array.from(new Set(d.entries.flatMap((e) => parseTags(e.tags))));

  const fm: string[] = ['---', `date: ${d.date}`];
  if (d.dayLog?.day_title) fm.push(`title: ${d.dayLog.day_title}`);
  fm.push(`workout: ${workoutDone}`);
  if (workoutMinutes > 0) fm.push(`workout_minutes: ${workoutMinutes}`);
  if (d.dayLog?.diet_kept !== null && d.dayLog?.diet_kept !== undefined) {
    fm.push(`diet: ${d.dayLog.diet_kept === 1}`);
  }
  if (allTags.length > 0) fm.push(`tags: [${allTags.join(', ')}]`);
  fm.push('---');

  const sections: string[] = [fm.join('\n')];
  sections.push(`# ${formatISODateKo(d.date)}`);
  if (d.dayLog?.day_title) sections.push(`_${d.dayLog.day_title}_`);

  if (d.meditations.length > 0) {
    const parts = ['## 말씀 묵상'];
    for (const m of d.meditations) {
      if (m.book_name && m.chapter) {
        parts.push(`> ${m.book_name} ${m.chapter}${m.verse ? `:${m.verse}` : ''}`);
      }
      parts.push(m.content);
    }
    sections.push(parts.join('\n\n'));
  }

  const byType = (type: Entry['type']) => d.entries.filter((e) => e.type === type);

  const moments = byType('moment');
  if (moments.length > 0) {
    sections.push(['## 순간', ...moments.map(entryBlock)].join('\n\n'));
  }
  const media = byType('media');
  if (media.length > 0) {
    sections.push(['## 감상', ...media.map(entryBlock)].join('\n\n'));
  }
  const writings = byType('writing');
  if (writings.length > 0) {
    sections.push(['## 글', ...writings.map(entryBlock)].join('\n\n'));
  }
  const meals = byType('meal');
  if (meals.length > 0) {
    const parts = ['## 식사'];
    for (const e of meals) {
      const slot = e.meal_slot ? MEAL_SLOT_LABELS[e.meal_slot] : '식사';
      const lines = [`### ${slot}`];
      if (e.body) lines.push(e.body);
      if (e.photo_uri) lines.push(`사진: ${e.photo_uri}`);
      parts.push(lines.join('\n'));
    }
    sections.push(parts.join('\n\n'));
  }
  if (workoutEntries.length > 0 || d.dayLog?.workout_done === 1) {
    const parts = [`## 운동${workoutMinutes > 0 ? ` (${workoutMinutes}분)` : ''}`];
    for (const e of workoutEntries) {
      const lines: string[] = [];
      if (e.body) lines.push(e.body);
      if (e.minutes) lines.push(`${e.minutes}분`);
      if (e.photo_uri) lines.push(`사진: ${e.photo_uri}`);
      if (lines.length > 0) parts.push(lines.join(' · '));
    }
    sections.push(parts.join('\n\n'));
  }
  if (d.todos.length > 0) {
    sections.push(
      ['## 할 일', d.todos.map((t) => `- [${t.done ? 'x' : ' '}] ${t.content}`).join('\n')].join(
        '\n\n'
      )
    );
  }

  return sections.join('\n\n');
}

export async function buildSingleDayMarkdown(date: string): Promise<string> {
  return buildDayMarkdown(await loadDay(date));
}

export async function buildRangeMarkdown(
  startDate: string,
  endDate: string
): Promise<{ content: string; dayCount: number }> {
  const dates = (await getActiveDates(1000)).filter((d) => d >= startDate && d <= endDate);
  dates.sort();
  const docs: string[] = [];
  for (const date of dates) {
    const day = await loadDay(date);
    if (dayHasContent(day)) docs.push(buildDayMarkdown(day));
  }
  return { content: docs.join('\n\n---\n\n'), dayCount: docs.length };
}

export async function shareMarkdown(content: string, filename: string): Promise<void> {
  if (Platform.OS === 'web') {
    console.warn('Markdown export is not supported on web');
    return;
  }
  const FileSystem = require('expo-file-system/legacy');
  const Sharing = require('expo-sharing');
  const fileUri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(fileUri, content);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/markdown',
      dialogTitle: filename,
    });
  }
}
