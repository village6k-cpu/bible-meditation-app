import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { dayKeyOf, daysBetween, formatDayShortKo } from '@core/dates';
import { REGISTRY } from '@core/registry';
import { parseTagInput } from '@core/tags';
import type { Entry } from '@core/types';
import { markFiled, queryLibrary, setReaction, unfiledEntries } from '@db/entryRepo';
import { setEntryTags } from '@db/tagRepo';
import { asSqlite } from '../../db';
import type { WebDb } from '../../db/sqlite';
import { Icon } from '../icons';
import { firstLine, srcLine, SectionRow } from '../parts/entry';
import { bump, useLoad } from '../store';
import { loadDeck, type DeckItem } from '../deck';

// 정리는 사용자가 기억해야 할 일이 아니라 앱이 내미는 줄이다.
// 이 화면이 하는 일은 세 개의 줄을 세우는 것뿐 — 다시 읽을 것, 구조가 없는 것, 오래 안 읽은 것.

interface Data {
  deck: DeckItem[];
  unfiled: Entry[];
  dusty: Entry[];
}

const EMPTY: Data = { deck: [], unfiled: [], dusty: [] };

export function Review({
  handle,
  today,
  onOpen,
}: {
  handle: WebDb;
  today: string;
  onOpen: (id: string) => void;
}): JSX.Element {
  const [tagging, setTagging] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const { data } = useLoad<Data>(
    handle,
    async (d) => {
      const db = asSqlite(d);
      return {
        deck: await loadDeck(d, today),
        unfiled: await unfiledEntries(db, 20),
        dusty: await queryLibrary(db, { sort: 'dusty', limit: 6 }),
      };
    },
    [today],
    EMPTY
  );

  async function leaveAsIs(id: string): Promise<void> {
    await markFiled(asSqlite(handle), id);
    await handle.flush();
    bump();
  }

  async function applyTags(id: string): Promise<void> {
    const names = parseTagInput(draft);
    if (names.length === 0) {
      setTagging(null);
      return;
    }
    const db = asSqlite(handle);
    await setEntryTags(db, id, names);
    await markFiled(db, id);
    await handle.flush();
    setTagging(null);
    setDraft('');
    bump();
  }

  async function react(id: string, reaction: 'kept' | 'retired'): Promise<void> {
    const db = asSqlite(handle);
    await setReaction(db, id, today, reaction);
    if (reaction === 'kept') await markFiled(db, id);
    await handle.flush();
    bump();
  }

  return (
    <>
      <header class="app-head">
        <div>
          <div class="micro">정리</div>
          <div class="display" style="margin-top:3px">
            검토
          </div>
        </div>
        <div class="mono-lg sub">{data.deck.length + data.unfiled.length}</div>
      </header>

      {data.deck.length > 0 && (
        <>
          <SectionRow label="다시 읽기" right={data.deck.length} first />
          {data.deck.map(({ entry, caption }) => (
            <div class="card" key={entry.id}>
              <div class="mono dim">
                {caption} · {REGISTRY[entry.type].label}
              </div>
              <button
                class="quoted"
                style="margin-top:6px; width:100%; text-align:left"
                onClick={() => onOpen(entry.id)}
              >
                <span class="rule" />
                <span class="quote-t clamp3">{firstLine(entry)}</span>
              </button>
              {srcLine(entry) && (
                <div class="cap" style="margin-top:6px">
                  {srcLine(entry)}
                </div>
              )}
              <div style="display:flex; gap:16px; align-items:center; margin-top:10px">
                <button
                  class={entry.pinned === 1 ? 'chip on' : 'chip'}
                  onClick={() => void react(entry.id, 'kept')}
                >
                  {entry.pinned === 1 ? '표시함' : '유지'}
                </button>
                <button class="cap dim" onClick={() => void react(entry.id, 'retired')}>
                  순환에서 제외
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      <SectionRow
        label="구조 없는 기록"
        right={data.unfiled.length}
        first={data.deck.length === 0}
      />
      {data.unfiled.length === 0 ? (
        <div class="empty">검토할 기록 없음</div>
      ) : (
        <>
          <div class="cap dim" style="padding:8px 16px 0">
            갈피나 출처를 붙이면 나중에 찾을 수 있습니다
          </div>
          {data.unfiled.map((e) => (
            <div class="card" key={e.id}>
              <div class="mono dim">
                {REGISTRY[e.type].label} · {formatDayShortKo(e.day)}
              </div>
              <button
                class="body-t clamp2"
                style="margin:3px 0 8px; width:100%; text-align:left"
                onClick={() => onOpen(e.id)}
              >
                {firstLine(e)}
              </button>
              {tagging === e.id ? (
                <div style="display:flex; gap:8px; align-items:center">
                  <input
                    class="field"
                    value={draft}
                    placeholder="갈피 (띄어쓰기로 구분)"
                    enterkeyhint="done"
                    autofocus
                    onInput={(ev) => setDraft((ev.target as HTMLInputElement).value)}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter') {
                        ev.preventDefault();
                        void applyTags(e.id);
                      }
                    }}
                  />
                  <button class="chip on" onClick={() => void applyTags(e.id)}>
                    붙이기
                  </button>
                </div>
              ) : (
                <div style="display:flex; gap:12px; align-items:center">
                  <button
                    class="chip"
                    onClick={() => {
                      setTagging(e.id);
                      setDraft('');
                    }}
                  >
                    갈피 붙이기
                  </button>
                  <button class="cap dim" onClick={() => void leaveAsIs(e.id)}>
                    이대로 두기
                  </button>
                </div>
              )}
            </div>
          ))}
        </>
      )}

      <SectionRow label="오래 안 읽은 기록" right={data.dusty.length} />
      {data.dusty.map((e) => {
        const d =
          e.last_revisited_at === null
            ? null
            : daysBetween(dayKeyOf(new Date(e.last_revisited_at)), today);
        return (
          <button key={e.id} class="row" onClick={() => onOpen(e.id)}>
            <span class="badge">{REGISTRY[e.type].label}</span>
            <span class="grow label">{firstLine(e)}</span>
            <span class="mono dim">{d === null ? '—' : `${d}d`}</span>
            <Icon name="chevronRight" />
          </button>
        );
      })}
      <div class="gap" />
    </>
  );
}
