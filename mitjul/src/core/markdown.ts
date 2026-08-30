import { formatDayKo } from './dates';
import { REGISTRY, TYPE_ORDER } from './registry';
import { Entry, MEAL_SLOT_LABELS } from './types';

// 옵시디언 데일리 노트 빌더 — 순수 함수. 같은 입력이면 바이트까지 같은 출력.
// 사진은 임베드 대신 파일명 한 줄로 남긴다(단일 .md 공유에서 깨진 임베드를 만들지 않기 위해).

export interface ExportEntry extends Entry {
  tags: string[];
}

function fmValue(s: string): string {
  return /[:#\[\]{}"'\n,]/.test(s) ? `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : s;
}

function quoteBlock(text: string): string {
  return text
    .split('\n')
    .map((l) => `> ${l}`)
    .join('\n');
}

function entryBlock(e: ExportEntry): string {
  const parts: string[] = [];
  switch (e.type) {
    case 'book': {
      if (e.quote) {
        const source = [e.subtitle, e.title ? `『${e.title}』` : null, e.page ? `p.${e.page}` : null]
          .filter(Boolean)
          .join(', ');
        parts.push(`${quoteBlock(e.quote)}${source ? `\n> — ${source}` : ''}`);
      } else if (e.title) {
        parts.push(`**${e.title}**${e.subtitle ? ` — ${e.subtitle}` : ''}`);
      }
      if (e.body) parts.push(e.body);
      break;
    }
    case 'video': {
      const label = e.title ?? e.url ?? '영상';
      const head = e.url ? `[${label}](${e.url})` : `**${label}**`;
      parts.push(`${head}${e.subtitle ? ` — ${e.subtitle}` : ''}`);
      if (e.body) parts.push(e.body);
      break;
    }
    case 'verse': {
      if (e.subtitle) parts.push(`**${e.subtitle}**`);
      if (e.quote) parts.push(quoteBlock(e.quote));
      if (e.body) parts.push(e.body);
      break;
    }
    case 'meal': {
      const slot = e.slot ? MEAL_SLOT_LABELS[e.slot] : '식사';
      const check = e.practiced === 1 ? ' ✓' : '';
      parts.push(`- ${slot} — ${e.body ?? ''}${check}`.trimEnd());
      break;
    }
    case 'workout': {
      const bits = [e.title, e.minutes ? `${e.minutes}분` : null].filter(Boolean).join(' ');
      parts.push(bits.length > 0 ? bits : '운동');
      if (e.body) parts.push(e.body);
      break;
    }
    case 'moment':
    case 'writing': {
      if (e.title) parts.push(`**${e.title}**`);
      if (e.body) parts.push(e.body);
      break;
    }
    case 'task': {
      parts.push(`- [${e.done === 1 ? 'x' : ' '}] ${e.title ?? ''}${e.due_time ? ` (${e.due_time})` : ''}`);
      break;
    }
  }
  if (e.image_uri) parts.push(`사진: ${e.image_uri}`);
  if (e.tags.length > 0) parts.push(e.tags.map((t) => `#${t}`).join(' '));
  return parts.join('\n\n');
}

// 하루의 본문 — 세리프 제목 + 유형별 H2 섹션 (프런트매터 없이)
function buildDayBody(day: string, live: ExportEntry[]): string {
  const types = TYPE_ORDER.filter((t) => live.some((e) => e.type === t));
  const sections: string[] = [`# ${formatDayKo(day)}`];

  for (const type of types) {
    const group = live
      .filter((e) => e.type === type)
      .sort((a, b) => a.created_at - b.created_at || (a.id < b.id ? -1 : 1));
    const blocks = group.map(entryBlock).filter((b) => b.length > 0);
    if (blocks.length === 0) continue;
    // 식사·할 일은 목록이므로 붙여 쓰고, 나머지는 문단 간격을 둔다
    const joiner = type === 'meal' || type === 'task' ? '\n' : '\n\n';
    sections.push(`## ${REGISTRY[type].exportHeading}\n\n${blocks.join(joiner)}`);
  }
  return sections.join('\n\n');
}

function frontmatter(lines: (string | null)[]): string {
  return ['---', ...lines.filter((l): l is string => l !== null), '---'].join('\n');
}

export function buildDailyNote(day: string, entries: ExportEntry[]): string {
  const live = entries.filter((e) => e.deleted_at === null);
  const types = TYPE_ORDER.filter((t) => live.some((e) => e.type === t));
  const tags = Array.from(new Set(live.flatMap((e) => e.tags))).sort();

  const fm = frontmatter([
    `date: ${day}`,
    `types: [${types.join(', ')}]`,
    tags.length > 0 ? `tags: [${tags.map(fmValue).join(', ')}]` : null,
  ]);

  return `${fm}\n\n${buildDayBody(day, live)}\n`;
}

// 기간 내보내기 — 옵시디언은 파일 맨 위의 YAML만 읽으므로,
// 프런트매터는 문서 전체에 하나만 두고 날짜들은 H1 섹션으로 잇는다.
export function buildRangeNote(days: { day: string; entries: ExportEntry[] }[]): string {
  const withContent = days
    .map((d) => ({ day: d.day, live: d.entries.filter((e) => e.deleted_at === null) }))
    .filter((d) => d.live.length > 0);
  if (withContent.length === 0) return '';
  if (withContent.length === 1) {
    return buildDailyNote(withContent[0].day, withContent[0].live);
  }

  const all = withContent.flatMap((d) => d.live);
  const types = TYPE_ORDER.filter((t) => all.some((e) => e.type === t));
  const tags = Array.from(new Set(all.flatMap((e) => e.tags))).sort();
  const fm = frontmatter([
    `date_from: ${withContent[0].day}`,
    `date_to: ${withContent[withContent.length - 1].day}`,
    `types: [${types.join(', ')}]`,
    tags.length > 0 ? `tags: [${tags.map(fmValue).join(', ')}]` : null,
  ]);

  return `${fm}\n\n${withContent.map((d) => buildDayBody(d.day, d.live)).join('\n\n---\n\n')}\n`;
}
