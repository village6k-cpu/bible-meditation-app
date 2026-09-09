import type { JSX } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { canonicalLinkUrl } from '@core/links';
import type { SourceKind } from '@core/types';
import {
  allSources,
  deleteSource,
  findMergeTarget,
  mergeSources,
  renameSource,
  type SourceWithCount,
} from '@db/sourceRepo';
import { asSqlite } from '../../db';
import type { WebDb } from '../../db/sqlite';
import { Icon } from '../icons';
import { SectionRow } from '../parts/entry';
import { bump, useLoad } from '../store';

// 출처를 손보는 자리.
//
// 출처는 한 번만 등록하는 대신 잘못 등록하면 계속 잘못된 채로 쌓인다. 그래서 고칠 자리가 있어야 한다.
// 다만 이 화면이 만지는 것은 출처 하나가 아니다 — 기록들이 출처의 제목·저자를 복사해 들고 있으므로
// 한 번 고치면 거기 매달린 밑줄 전부의 얼굴이 함께 바뀐다. 그래서 어디서든 개수를 먼저 보여준다.
//
// 합치기를 이름 고치기에서 떼어 낸 이유:
// renameSource는 고친 제목이 다른 출처와 겹치면 조용히 합쳐 버리고, 그때 사용자가 친 제목을 버린다
// (살아남는 쪽 제목이 이긴다). 되돌릴 수도 없다. 오타를 고치려다 기록이 통째로 남의 책으로 옮겨가는
// 일을 사고로 겪게 할 수는 없다. 그래서 고치기는 겹치면 멈춰 서서 묻고, 합치기는 사용자가 상대를
// 지목해 고르는 별도의 동작으로 둔다.

const KIND_LABEL: Record<SourceKind, string> = {
  book: '책',
  video: '영상',
  article: '글',
};

const KINDS: SourceKind[] = ['book', 'video', 'article'];

interface Draft {
  id: string;
  kind: SourceKind;
  title: string;
  creator: string;
  url: string;
  count: number;
}

export function SourcesSheet({
  handle,
  onClose,
  toast,
}: {
  handle: WebDb;
  onClose: () => void;
  toast: (m: string) => void;
}): JSX.Element {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<SourceKind | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [mergeFrom, setMergeFrom] = useState<SourceWithCount | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: sources } = useLoad<SourceWithCount[]>(
    handle,
    async (d) => allSources(asSqlite(d)),
    [],
    []
  );

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return sources.filter(
      (s) =>
        (!kind || s.kind === kind) &&
        (!needle ||
          s.title.toLowerCase().includes(needle) ||
          (s.creator ?? '').toLowerCase().includes(needle))
    );
  }, [sources, q, kind]);

  async function guard(run: () => Promise<void>): Promise<void> {
    setBusy(true);
    try {
      await run();
      await handle.flush();
      bump();
    } catch (e) {
      toast(e instanceof Error ? e.message : '실패했습니다');
    } finally {
      setBusy(false);
    }
  }

  // 고치기 저장. 겹치는 출처가 있으면 저장하지 않고 합치기로 넘긴다 —
  // 조용히 합쳐지는 길을 막는 것이 이 함수의 요점이다.
  async function saveDraft(): Promise<void> {
    if (!draft) return;
    const title = draft.title.trim();
    if (!title) {
      toast('제목은 비울 수 없습니다');
      return;
    }
    const raw = draft.url.trim();
    const url = raw ? (canonicalLinkUrl(raw) ?? raw) : null;
    const db = asSqlite(handle);
    const clash = await findMergeTarget(db, draft.id, draft.kind, title, url);
    if (clash) {
      const ok = confirm(
        `이미 같은 출처가 있습니다 — 『${clash.title}』.\n\n` +
          `계속하면 두 출처가 하나로 합쳐집니다. 이 출처의 밑줄 ${draft.count}개가 그쪽으로 옮겨가고, ` +
          `방금 적은 제목 대신 『${clash.title}』이 남습니다.\n\n되돌릴 수 없습니다. 합칠까요?`
      );
      if (!ok) return;
      await guard(async () => {
        await mergeSources(db, draft.id, clash.id);
        setDraft(null);
        toast(`『${clash.title}』으로 합쳤습니다`);
      });
      return;
    }
    await guard(async () => {
      await renameSource(db, draft.id, title, draft.creator.trim() || null, url);
      setDraft(null);
      toast(draft.count > 0 ? `밑줄 ${draft.count}개의 출처를 고쳤습니다` : '출처를 고쳤습니다');
    });
  }

  async function removeSource(s: SourceWithCount): Promise<void> {
    const ok = confirm(
      s.entry_count === 0
        ? `『${s.title}』을 지울까요?`
        : `『${s.title}』을 지울까요?\n\n` +
            `밑줄 ${s.entry_count}개는 지워지지 않고 남습니다. 다만 출처에서 떨어져 나와 ` +
            `검토 탭으로 돌아옵니다 — 거기서 다른 출처에 다시 붙이거나 그대로 둘 수 있습니다.`
    );
    if (!ok) return;
    await guard(async () => {
      await deleteSource(asSqlite(handle), s.id);
      setDraft(null);
      toast(
        s.entry_count === 0
          ? '출처를 지웠습니다'
          : `출처를 지웠습니다 — 밑줄 ${s.entry_count}개는 검토로 돌아갔습니다`
      );
    });
  }

  async function doMerge(to: SourceWithCount): Promise<void> {
    if (!mergeFrom) return;
    const from = mergeFrom;
    const ok = confirm(
      `『${from.title}』을 『${to.title}』에 합칩니다.\n\n` +
        `밑줄 ${from.entry_count}개가 『${to.title}』으로 옮겨가고, 제목·저자도 그쪽 것으로 바뀝니다. ` +
        `『${from.title}』은 목록에서 사라집니다.\n\n되돌릴 수 없습니다. 계속할까요?`
    );
    if (!ok) return;
    await guard(async () => {
      await mergeSources(asSqlite(handle), from.id, to.id);
      setMergeFrom(null);
      setDraft(null);
      toast(`『${to.title}』으로 합쳤습니다`);
    });
  }

  // ── 합칠 상대 고르기 ──
  if (mergeFrom) {
    const others = sources.filter((s) => s.id !== mergeFrom.id && s.kind === mergeFrom.kind);
    return (
      <div class="sheet">
        <div class="sheet-head">
          <button class="quiet" onClick={() => setMergeFrom(null)}>
            취소
          </button>
          <span class="mono dim">합칠 상대</span>
          <span style="width:44px" />
        </div>
        <div class="sheet-body" style="padding:0 0 var(--safe-b)">
          <div class="cap dim" style="padding:14px 16px">
            『{mergeFrom.title}』의 밑줄 {mergeFrom.entry_count}개를 어디로 옮길까요? 남는 쪽의
            제목·저자가 이깁니다.
          </div>
          {others.length === 0 ? (
            <div class="empty">합칠 만한 같은 종류의 출처가 없습니다</div>
          ) : (
            others.map((s) => (
              <button key={s.id} class="row" disabled={busy} onClick={() => void doMerge(s)}>
                <span class="grow label">
                  {s.title}
                  {s.creator ? <span class="dim"> · {s.creator}</span> : null}
                </span>
                <span class="mono dim">{s.entry_count}</span>
              </button>
            ))
          )}
          <div class="gap-lg" />
        </div>
      </div>
    );
  }

  // ── 하나 고치기 ──
  if (draft) {
    const src = sources.find((s) => s.id === draft.id);
    return (
      <div class="sheet">
        <div class="sheet-head">
          <button class="quiet" onClick={() => setDraft(null)}>
            취소
          </button>
          <button class="act" disabled={busy} onClick={() => void saveDraft()}>
            저장
          </button>
        </div>
        <div class="sheet-body" style="padding:0 0 var(--safe-b)">
          <div class="stack" style="padding:16px">
            <input
              class="field"
              value={draft.title}
              placeholder="제목"
              onInput={(ev) =>
                setDraft({ ...draft, title: (ev.currentTarget as HTMLInputElement).value })
              }
            />
            <input
              class="field"
              value={draft.creator}
              placeholder={draft.kind === 'video' ? '채널' : '저자'}
              onInput={(ev) =>
                setDraft({ ...draft, creator: (ev.currentTarget as HTMLInputElement).value })
              }
            />
            {draft.kind !== 'book' && (
              <input
                class="field mono"
                value={draft.url}
                placeholder="링크"
                inputMode="url"
                autocapitalize="off"
                autocorrect="off"
                onInput={(ev) =>
                  setDraft({ ...draft, url: (ev.currentTarget as HTMLInputElement).value })
                }
              />
            )}
          </div>
          <div class="cap dim" style="padding:0 16px 14px">
            {draft.count > 0
              ? `이 출처의 밑줄 ${draft.count}개에 복사돼 있는 제목·저자도 함께 바뀝니다.`
              : '아직 이 출처로 적은 밑줄이 없습니다.'}
          </div>

          <SectionRow label="정리" />
          <button
            class="row"
            disabled={busy}
            onClick={() => src && setMergeFrom({ ...src, ...{} })}
          >
            <span class="grow label">다른 출처와 합치기</span>
            <Icon name="chevronRight" />
          </button>
          <button
            class="row"
            disabled={busy}
            onClick={() => src && void removeSource(src)}
            style="color:var(--bad, var(--ink))"
          >
            <span style="width:16px;flex:none">
              <Icon name="trash" />
            </span>
            <span class="grow label">출처 지우기</span>
          </button>
          <div class="cap dim" style="padding:10px 16px 14px">
            지워도 밑줄은 남습니다. 출처에서만 떨어져 검토 탭으로 돌아옵니다.
          </div>
          <div class="gap-lg" />
        </div>
      </div>
    );
  }

  // ── 목록 ──
  return (
    <div class="sheet">
      <div class="sheet-head">
        <button class="quiet" onClick={onClose}>
          <Icon name="chevronLeft" />
          뒤로
        </button>
        <span class="mono dim">출처</span>
        <span style="width:44px" />
      </div>

      <div class="sheet-body" style="padding:0 0 var(--safe-b)">
        <div style="padding:12px 16px 8px">
          <input
            class="field"
            type="search"
            value={q}
            placeholder="제목 · 저자 검색"
            onInput={(ev) => setQ((ev.currentTarget as HTMLInputElement).value)}
          />
        </div>
        <div class="chips">
          <button class={kind === null ? 'chip on' : 'chip'} onClick={() => setKind(null)}>
            전체
          </button>
          {KINDS.map((k) => (
            <button
              key={k}
              class={kind === k ? 'chip on' : 'chip'}
              onClick={() => setKind(kind === k ? null : k)}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <div class="empty">
            {sources.length === 0 ? '아직 등록한 출처가 없습니다' : '찾는 출처가 없습니다'}
          </div>
        ) : (
          shown.map((s) => (
            <button
              key={s.id}
              class="row"
              onClick={() =>
                setDraft({
                  id: s.id,
                  kind: s.kind,
                  title: s.title,
                  creator: s.creator ?? '',
                  url: s.url ?? '',
                  count: s.entry_count,
                })
              }
            >
              <span class="grow" style="min-width:0">
                <span class="label clamp2">{s.title}</span>
                <span class="cap dim">
                  {KIND_LABEL[s.kind]}
                  {s.creator ? ` · ${s.creator}` : ''}
                </span>
              </span>
              <span class="mono dim">{s.entry_count}</span>
              <Icon name="chevronRight" />
            </button>
          ))
        )}
        <div class="gap-lg" />
      </div>
    </div>
  );
}
