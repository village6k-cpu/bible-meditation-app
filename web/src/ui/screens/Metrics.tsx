import type { JSX } from 'preact';
import { addDays, formatDayShortKo, mondayOf, rangeOfDays } from '@core/dates';
import { dotLevel, streakOf, type PracticeKey } from '@core/trends';
import type { SourceKind, TrendRow } from '@core/types';
import { trendRows } from '@db/entryRepo';
import { asSqlite } from '../../db';
import type { WebDb } from '../../db/sqlite';
import { Icon } from '../icons';
import { SectionRow } from '../parts/entry';
import { useLoad } from '../store';

// 격려하지 않는다. 일어난 일만 적는다.
// 먹점 농도는 core/trends의 순수 함수가 정한다 — 네이티브와 같은 규칙.

const PRACTICES: [PracticeKey, string][] = [
  ['workout', '운동'],
  ['meal', '식사'],
  ['verse', '묵상'],
  ['record', '기록'],
];

const FORMAT_LABEL: Record<SourceKind | 'none', string> = {
  book: '책',
  video: '영상',
  article: '글',
  none: '출처 없음',
};

const OPACITY: Record<number, string> = {
  0: '0.08',
  1: '0.35',
  2: '0.65',
  3: '1',
};

interface Data {
  rows: Map<string, TrendRow>;
  formats: { kind: SourceKind | 'none'; count: number }[];
  recent: number;
}

const EMPTY: Data = { rows: new Map(), formats: [], recent: 0 };

export function Metrics({
  handle,
  today,
  onSettings,
  onSources,
}: {
  handle: WebDb;
  today: string;
  onSettings: () => void;
  onSources: () => void;
}): JSX.Element {
  const days = rangeOfDays(addDays(today, -13), today);
  // 월요일부터 일요일까지 일곱 칸을 늘 세운다 — 주 초에 막대가 하나만 서면 고장처럼 보인다
  const monday = mondayOf(today);
  const week = rangeOfDays(monday, addDays(monday, 6));

  const { data, loading } = useLoad<Data>(
    handle,
    async (d) => {
      const db = asSqlite(d);
      const rows = await trendRows(db, addDays(today, -365), today);
      const byDay = new Map(rows.map((r) => [r.day, r]));
      const formats = await db.getAllAsync<{
        kind: SourceKind | null;
        count: number;
      }>(
        `SELECT s.kind AS kind, COUNT(*) AS count
         FROM entries e LEFT JOIN sources s ON s.id = e.source_id AND s.deleted_at IS NULL
         WHERE e.deleted_at IS NULL AND e.type != 'task'
         GROUP BY s.kind ORDER BY count DESC`
      );
      const recent = days.reduce((n, day) => n + (byDay.get(day)?.entryCount ?? 0), 0);
      return {
        rows: byDay,
        formats: formats.map((f) => ({
          kind: f.kind ?? 'none',
          count: f.count,
        })),
        recent,
      };
    },
    [today],
    EMPTY
  );

  const minutes = week.map((d) => data.rows.get(d)?.workoutMinutes ?? 0);
  const maxMinutes = Math.max(60, ...minutes);
  const totalMinutes = minutes.reduce((a, b) => a + b, 0);

  return (
    <>
      <header class="app-head">
        <div>
          <div class="micro">최근 14일</div>
          <div class="display" style="margin-top:3px">
            지표
          </div>
        </div>
        <div class="mono-lg sub">{data.recent}</div>
      </header>

      <SectionRow label="실천" right="14d" first />
      <div class="grid-rows">
        {PRACTICES.map(([key, name]) => (
          <div class="grid-row" key={key}>
            <span class="micro nm">{name}</span>
            <span class="cells">
              {days.map((d) => (
                <span
                  key={d}
                  class="cell"
                  style={`opacity:${OPACITY[dotLevel(key, data.rows.get(d))]}`}
                />
              ))}
            </span>
            <span class="mono dim" style="width:34px; text-align:right">
              {streakOf(key, data.rows, today)}d
            </span>
          </div>
        ))}
      </div>

      <SectionRow label="이번 주 운동" right={`${totalMinutes}분`} />
      <div style="padding:10px 0">
        {week.map((d, i) => (
          <div class="bar-row" key={d}>
            <span class="mono dim" style="width:32px">
              {formatDayShortKo(d).replace('월 ', '.').replace('일', '')}
            </span>
            <span class="track">
              <span class="fill" style={`width:${Math.round((minutes[i] / maxMinutes) * 100)}%`} />
            </span>
            <span class="mono" style="width:34px; text-align:right">
              {minutes[i] || ''}
            </span>
          </div>
        ))}
      </div>

      <SectionRow label="형식" right="전체" />
      {data.formats.length > 0 ? (
        data.formats.map((f) => (
          <div class="row" key={f.kind}>
            <span class="grow label">{FORMAT_LABEL[f.kind]}</span>
            <span class="mono">{f.count}</span>
          </div>
        ))
      ) : loading ? null : (
        <div class="empty">아직 기록이 없습니다</div>
      )}

      <SectionRow label="보관" />
      {/* 형식 줄이 바로 위에 있다 — 그 형식을 정하는 것이 출처이므로 손보는 길도 여기 둔다 */}
      <button class="row" onClick={onSources}>
        <span style="width:16px;flex:none">
          <Icon name="book" />
        </span>
        <span class="grow label">출처 고치기 · 합치기 · 지우기</span>
        <Icon name="chevronRight" />
      </button>
      <button class="row" onClick={onSettings}>
        <span style="width:16px;flex:none">
          <Icon name="gear" />
        </span>
        <span class="grow label">백업 · 내보내기 · 저장소</span>
        <Icon name="chevronRight" />
      </button>
      <div class="gap" />
    </>
  );
}
