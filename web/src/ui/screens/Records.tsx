import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { daysBetween, dayKeyOf } from '@core/dates';
import { REGISTRY, TYPE_ORDER } from '@core/registry';
import type { Entry, EntryType, SourceKind } from '@core/types';
import { queryLibrary, tagsOf } from '@db/entryRepo';
import { topTags } from '@db/tagRepo';
import { asSqlite } from '../../db';
import type { WebDb } from '../../db/sqlite';
import { EntryRow } from '../parts/entry';
import { useLoad } from '../store';

// 표. 여기서는 '무엇이 있었나'가 아니라 '무엇을 찾고 있나'가 먼저다.
// 유형(무엇을 적었나)과 형식(어디서 왔나)은 다른 축이라 서로를 지운다.

const FORMATS: [SourceKind, string][] = [
  ['book', '책'],
  ['video', '영상'],
  ['article', '글'],
];

interface Filters {
  q: string;
  type: EntryType | null;
  format: SourceKind | null;
  tag: string | null;
  sort: 'recent' | 'dusty';
}

interface Data {
  rows: Entry[];
  tags: Map<string, string[]>;
  allTags: string[];
  total: number;
}

const EMPTY: Data = { rows: [], tags: new Map(), allTags: [], total: 0 };

export function Records({
  handle,
  today,
  onOpen,
}: {
  handle: WebDb;
  today: string;
  onOpen: (id: string) => void;
}): JSX.Element {
  const [f, setF] = useState<Filters>({
    q: '',
    type: null,
    format: null,
    tag: null,
    sort: 'recent',
  });
  const [q, setQ] = useState('');

  // 한 글자마다 질의를 던지지 않는다
  useEffect(() => {
    const t = setTimeout(() => setF((prev) => (prev.q === q ? prev : { ...prev, q })), 200);
    return () => clearTimeout(t);
  }, [q]);

  const { data } = useLoad<Data>(
    handle,
    async (d) => {
      const db = asSqlite(d);
      const rows = await queryLibrary(db, {
        type: f.type,
        sourceKind: f.format,
        tag: f.tag,
        q: f.q,
        sort: f.sort,
      });
      const tags = await tagsOf(
        db,
        rows.map((e) => e.id)
      );
      const allTags = (await topTags(db, 20)).map((t) => t.name);
      const total = await db.getFirstAsync<{ n: number }>(
        "SELECT COUNT(*) AS n FROM entries WHERE deleted_at IS NULL AND type != 'task'"
      );
      return { rows, tags, allTags, total: total?.n ?? 0 };
    },
    [f.q, f.type, f.format, f.tag, f.sort],
    EMPTY
  );

  const dustLabel = (e: Entry): string =>
    e.last_revisited_at === null
      ? '읽은 적 없음'
      : `${daysBetween(dayKeyOf(new Date(e.last_revisited_at)), today)}일 전 읽음`;

  return (
    <>
      <header class="app-head">
        <div>
          <div class="micro">전체 {data.total}건</div>
          <div class="display" style="margin-top:3px">
            기록
          </div>
        </div>
        <div class="mono-lg sub">{data.rows.length}</div>
      </header>

      <div style="padding:10px 16px 0">
        <input
          class="field"
          type="search"
          value={q}
          placeholder="문장 · 제목 · 갈피 검색"
          enterkeyhint="search"
          onInput={(ev) => setQ((ev.target as HTMLInputElement).value)}
        />
      </div>

      <div class="chips scroll">
        <button
          class={!f.type && !f.format ? 'chip on' : 'chip'}
          onClick={() => setF((p) => ({ ...p, type: null, format: null, tag: null }))}
        >
          전체
        </button>
        {TYPE_ORDER.filter((t) => t !== 'task').map((t) => (
          <button
            key={t}
            class={f.type === t ? 'chip on' : 'chip'}
            onClick={() =>
              setF((p) => ({
                ...p,
                type: p.type === t ? null : t,
                format: null,
              }))
            }
          >
            {REGISTRY[t].label}
          </button>
        ))}
        {FORMATS.map(([k, label]) => (
          <button
            key={k}
            class={f.format === k ? 'chip on' : 'chip'}
            onClick={() =>
              setF((p) => ({
                ...p,
                format: p.format === k ? null : k,
                type: null,
              }))
            }
          >
            {label}
          </button>
        ))}
      </div>

      {data.allTags.length > 0 && (
        <div class="chips scroll tight">
          {data.allTags.map((t) => (
            <button
              key={t}
              class={f.tag === t ? 'chip mono on' : 'chip mono'}
              onClick={() => setF((p) => ({ ...p, tag: p.tag === t ? null : t }))}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      <div class="chips scroll tight">
        {(['recent', 'dusty'] as const).map((s) => (
          <button
            key={s}
            class={f.sort === s ? 'chip on' : 'chip'}
            onClick={() => setF((p) => ({ ...p, sort: s }))}
          >
            {s === 'recent' ? '최신순' : '오래 안 읽은 순'}
          </button>
        ))}
      </div>

      {data.rows.length > 0 ? (
        data.rows.map((e) => (
          <EntryRow
            key={e.id}
            entry={e}
            tags={data.tags.get(e.id)}
            showDate
            meta={f.sort === 'dusty' ? dustLabel(e) : null}
            onOpen={onOpen}
          />
        ))
      ) : (
        <div class="empty">결과 없음</div>
      )}
      <div class="gap" />
    </>
  );
}
