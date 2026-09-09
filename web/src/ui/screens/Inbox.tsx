import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { formatDayKo, todayKey } from '@core/dates';
import { REGISTRY, TYPE_ORDER } from '@core/registry';
import type { Entry, EntryType } from '@core/types';
import { createEntry, entriesOfDay, setTaskDone, tagsOf, unfiledCount } from '@db/entryRepo';
import { asSqlite } from '../../db';
import type { WebDb } from '../../db/sqlite';
import { Icon, typeIcon } from '../icons';
import { EntryRow, SectionRow } from '../parts/entry';
import { bump, useLoad } from '../store';
import { loadDeck } from '../deck';
import { Notices } from '../parts/Notices';

interface InboxData {
  entries: Entry[];
  tasks: Entry[];
  tags: Map<string, string[]>;
  unfiled: number;
  deck: number;
}

const EMPTY: InboxData = {
  entries: [],
  tasks: [],
  tags: new Map(),
  unfiled: 0,
  deck: 0,
};

export function Inbox({
  handle,
  today,
  onOpen,
  onCompose,
  onReview,
  toast,
}: {
  handle: WebDb;
  today: string;
  onOpen: (id: string) => void;
  onCompose: (type: EntryType | null) => void;
  onReview: () => void;
  toast: (m: string) => void;
}): JSX.Element {
  const [draft, setDraft] = useState('');

  const { data, loading } = useLoad<InboxData>(
    handle,
    async (d) => {
      const db = asSqlite(d);
      const all = await entriesOfDay(db, today);
      const entries = all.filter((e) => e.type !== 'task');
      const tasks = all.filter((e) => e.type === 'task');
      const tags = await tagsOf(
        db,
        entries.map((e) => e.id)
      );
      return {
        entries,
        tasks,
        tags,
        unfiled: await unfiledCount(db),
        deck: (await loadDeck(d, today)).length,
      };
    },
    [today],
    EMPTY
  );

  async function addTask(): Promise<void> {
    const title = draft.trim();
    if (!title) return;
    setDraft('');
    try {
      await createEntry(asSqlite(handle), {
        type: 'task',
        day: todayKey(),
        title,
        done: 0,
      });
      await handle.flush();
      bump();
    } catch {
      toast('할 일을 저장하지 못했습니다');
    }
  }

  async function toggle(t: Entry): Promise<void> {
    await setTaskDone(asSqlite(handle), t.id, t.done !== 1);
    await handle.flush();
    bump();
  }

  const open = data.tasks.filter((t) => t.done !== 1).length;

  return (
    <>
      <header class="app-head">
        <div>
          <div class="micro">{formatDayKo(today)}</div>
          <div class="display" style="margin-top:3px">
            수집함
          </div>
        </div>
        <div class="mono-lg sub">{data.entries.length}</div>
      </header>

      <Notices handle={handle} toast={toast} />

      <div class="chips scroll">
        {TYPE_ORDER.map((t) => (
          <button key={t} class="chip" onClick={() => onCompose(t)}>
            <Icon name={typeIcon(t)} />
            {REGISTRY[t].label}
          </button>
        ))}
      </div>

      {(data.unfiled > 0 || data.deck > 0) && (
        <button class="row" onClick={onReview}>
          <span class="micro">검토</span>
          <span class="grow cap" style="text-align:right">
            {[
              data.deck > 0 ? `다시 읽기 ${data.deck}` : null,
              data.unfiled > 0 ? `미분류 ${data.unfiled}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
          <Icon name="chevronRight" />
        </button>
      )}

      {data.tasks.length > 0 && <SectionRow label="할 일" right={open} />}
      {data.tasks.map((t) => (
        <button key={t.id} class="row" onClick={() => void toggle(t)}>
          <span style={`width:16px;flex:none;color:${t.done === 1 ? 'var(--ink)' : 'var(--ink3)'}`}>
            <Icon name={t.done === 1 ? 'check' : 'square'} />
          </span>
          <span
            class="grow label"
            style={t.done === 1 ? 'color:var(--ink3);text-decoration:line-through' : undefined}
          >
            {t.title ?? ''}
          </span>
          {t.due_time && <span class="mono dim">{t.due_time}</span>}
        </button>
      ))}
      <div class="row" style="color:var(--ink3)">
        <span style="width:16px;flex:none">
          <Icon name="plus" />
        </span>
        <input
          class="grow"
          value={draft}
          placeholder="할 일 추가"
          enterkeyhint="done"
          style="border:0;background:none;outline:0;font-size:14px;color:var(--ink)"
          onInput={(ev) => setDraft((ev.target as HTMLInputElement).value)}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter') {
              ev.preventDefault();
              void addTask();
            }
          }}
        />
      </div>

      <SectionRow label="오늘" right={data.entries.length} />
      {data.entries.length > 0 ? (
        data.entries.map((e) => (
          <EntryRow key={e.id} entry={e} tags={data.tags.get(e.id)} onOpen={onOpen} />
        ))
      ) : loading ? null : (
        <div class="empty">오늘 기록 없음</div>
      )}
      <div class="gap" />
    </>
  );
}
