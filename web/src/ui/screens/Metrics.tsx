import type { JSX } from 'preact';
import { addDays, formatDayGridKo, mondayOf, rangeOfDays } from '@core/dates';
import { dotLevel, streakOf, weekCount, type PracticeKey } from '@core/trends';
import type { EntryType, SourceKind, TrendRow } from '@core/types';
import { practiceEntries, trendRows, type PracticeCell } from '@db/entryRepo';
import { asSqlite } from '../../db';
import type { WebDb } from '../../db/sqlite';
import { Icon } from '../icons';
import { SectionRow } from '../parts/entry';
import { COLUMNS, Cell, SLOT_WORD, layoutDays, type DayCells } from '../parts/practice';
import { useLoad } from '../store';

// 격려하지 않는다. 일어난 일만 적는다.
//
// 식사·운동은 여기서 격자로 산다 — 날짜가 줄, 칸이 열. 콘텐츠처럼 목록으로 읽는 것이 아니라
// 한눈에 훑어 '요즘 어떤가'를 보는 자리다. 칸은 사진이거나 점이고, 어긴 날은 빗금이다.
// 지킴/어김/비움의 판정은 core/trends와 parts/practice의 순수 함수가 정한다 — 네이티브와 같은 규칙.

const GRID_DAYS = 28;

const FORMAT_LABEL: Record<SourceKind | 'none', string> = {
  book: '책',
  video: '영상',
  article: '글',
  none: '출처 없음',
};

const OPACITY: Record<number, string> = { 0: '0.08', 1: '0.35', 2: '0.65', 3: '1' };

interface Data {
  rows: Map<string, TrendRow>;
  grid: DayCells[];
  formats: { kind: SourceKind | 'none'; count: number }[];
  recent: number;
}

const EMPTY: Data = { rows: new Map(), grid: [], formats: [], recent: 0 };

export function Metrics({
  handle,
  today,
  onOpen,
  onCompose,
  onSettings,
  onSources,
}: {
  handle: WebDb;
  today: string;
  onOpen: (id: string) => void;
  onCompose: (type: EntryType | null, text?: string) => void;
  onSettings: () => void;
  onSources: () => void;
}): JSX.Element {
  const days14 = rangeOfDays(addDays(today, -13), today);
  // 격자는 오늘이 맨 위 — 최근을 먼저 본다
  const gridDays = rangeOfDays(addDays(today, -(GRID_DAYS - 1)), today).reverse();
  // 월요일부터 일요일까지 일곱 칸을 늘 세운다 — 주 초에 막대가 하나만 서면 고장처럼 보인다
  const monday = mondayOf(today);
  const week = rangeOfDays(monday, addDays(monday, 6));

  const { data, loading } = useLoad<Data>(
    handle,
    async (d) => {
      const db = asSqlite(d);
      const rows = await trendRows(db, addDays(today, -365), today);
      const byDay = new Map(rows.map((r) => [r.day, r]));
      const cells: PracticeCell[] = await practiceEntries(db, gridDays[gridDays.length - 1], today);
      const formats = await db.getAllAsync<{ kind: SourceKind | null; count: number }>(
        `SELECT s.kind AS kind, COUNT(*) AS count
         FROM entries e LEFT JOIN sources s ON s.id = e.source_id AND s.deleted_at IS NULL
         WHERE e.deleted_at IS NULL AND e.type NOT IN ('task', 'meal', 'workout')
         GROUP BY s.kind ORDER BY count DESC`
      );
      const recent = days14.reduce((n, day) => n + (byDay.get(day)?.entryCount ?? 0), 0);
      return {
        rows: byDay,
        grid: layoutDays(gridDays, cells),
        formats: formats.map((f) => ({ kind: f.kind ?? 'none', count: f.count })),
        recent,
      };
    },
    [today],
    EMPTY
  );

  const weekMinutes = week.reduce((n, d) => n + (data.rows.get(d)?.workoutMinutes ?? 0), 0);
  const streak = (k: PracticeKey) => streakOf(k, data.rows, today);
  const thisWeek = (k: PracticeKey) => weekCount(k, data.rows, week);

  return (
    <>
      <header class="app-head">
        <div>
          <div class="micro">최근 {GRID_DAYS}일</div>
          <div class="display" style="margin-top:3px">
            지표
          </div>
        </div>
        <div class="mono-lg sub">{data.recent}</div>
      </header>

      <SectionRow label="실천" right={`${GRID_DAYS}d`} first />
      {/* 숫자 넷. 연속은 어제까지의 흐름을 오늘이 아직 안 끊은 것으로 세고, 이번 주는 월요일부터다. */}
      <div class="psum">
        <div class="k">
          <span class="micro">식사 연속</span>
          <span class="v">
            {streak('meal')}
            <small>일</small>
          </span>
        </div>
        <div class="k">
          <span class="micro">이번 주</span>
          <span class="v">
            {thisWeek('meal')}
            <small>/7</small>
          </span>
        </div>
        <div class="k">
          <span class="micro">운동 연속</span>
          <span class="v">
            {streak('workout')}
            <small>일</small>
          </span>
        </div>
        <div class="k">
          <span class="micro">이번 주</span>
          <span class="v">
            {thisWeek('workout')}
            <small>/7 · {weekMinutes}분</small>
          </span>
        </div>
      </div>

      <div class="pgrid">
        <div class="pgrid-head">
          <span />
          {COLUMNS.slice(0, 3).map((c) => (
            <span key={c.key} class="micro">
              {c.label}
            </span>
          ))}
          <span />
          <span class="micro">운동</span>
          <span />
        </div>
        {data.grid.map((row) => {
          const isToday = row.day === today;
          const minutes = data.rows.get(row.day)?.workoutMinutes ?? 0;
          const tap = (key: (typeof COLUMNS)[number]['key']) => {
            const cell = row.cells[key];
            if (cell.entry) onOpen(cell.entry.id);
            // 지난 날의 빈 칸은 그대로 둔다 — 지나간 끼니를 뒤늦게 채우는 것은 기록이 아니라 꾸밈이다
            else if (isToday)
              onCompose(key === 'workout' ? 'workout' : 'meal', `${SLOT_WORD[key]} `);
          };
          return (
            <div key={row.day} class={isToday ? 'pgrid-row today' : 'pgrid-row'}>
              <span class="dt">{isToday ? '오늘' : formatDayGridKo(row.day)}</span>
              {COLUMNS.slice(0, 3).map((c) => (
                <Cell key={c.key} cell={row.cells[c.key]} size="grid" onClick={() => tap(c.key)} />
              ))}
              <span />
              <Cell cell={row.cells.workout} size="grid" onClick={() => tap('workout')} />
              <span class="min">{minutes ? `${minutes}분` : ''}</span>
            </div>
          );
        })}
      </div>

      {/* 묵상과 기록은 실천이 아니라 콘텐츠지만 꾸준함은 여기서 본다 — 먹점 열넷. */}
      <SectionRow label="꾸준함" right="14d" />
      <div class="grid-rows">
        {(
          [
            ['verse', '묵상'],
            ['record', '기록'],
          ] as [PracticeKey, string][]
        ).map(([key, name]) => (
          <div class="grid-row" key={key}>
            <span class="micro nm">{name}</span>
            <span class="cells">
              {days14.map((d) => (
                <span
                  key={d}
                  class="cell"
                  style={`opacity:${OPACITY[dotLevel(key, data.rows.get(d))]}`}
                />
              ))}
            </span>
            <span class="mono dim" style="width:34px; text-align:right">
              {streak(key)}d
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
