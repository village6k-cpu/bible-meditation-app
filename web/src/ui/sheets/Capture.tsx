import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { todayKey } from '@core/dates';
import { parseCapture, type Capture, type SignalKind } from '@core/parse';
import { REGISTRY, TYPE_ORDER, specOf } from '@core/registry';
import type { EntryInput, EntryType, Source, SourceKind } from '@core/types';
import { createEntry } from '@db/entryRepo';
import { createSource, findSourceByUrl, recentSources, touchSource } from '@db/sourceRepo';
import { fallbackTitle } from '@ex/linkMeta';
import { asSqlite } from '../../db';
import type { WebDb } from '../../db/sqlite';
import { previewLink, resolveLink, type LinkMeta } from '../../link/resolve';
import { domainOf } from '@ex/linkMeta';
import { readClipboard } from '../../platform/intake';
import { Icon, PlayIcon } from '../icons';
import { bump } from '../store';

// 한 칸에 적으면 구조가 붙는다.
// 유형을 고르고 칸을 채우는 일은 사용자가 아니라 파서가 한다 — 사람은 틀렸을 때만 손댄다.

function applyDropped(c: Capture, dropped: SignalKind[]): Capture {
  if (dropped.length === 0) return c;
  const off = (k: SignalKind) => dropped.includes(k);
  const restored = c.signals
    .filter((s) => off(s.kind))
    .map((s) => s.label)
    .join(' ');
  return {
    ...c,
    url: off('url') ? null : c.url,
    page: off('page') ? null : c.page,
    subtitle: off('verse') ? null : c.subtitle,
    tags: off('tag') ? [] : c.tags,
    minutes: off('minutes') ? null : c.minutes,
    slot: off('slot') ? null : c.slot,
    dueTime: off('time') ? null : c.dueTime,
    quote: off('quote') ? null : c.quote,
    body: [c.body, restored].filter(Boolean).join(' ') || null,
    rest: [c.rest, restored].filter(Boolean).join(' '),
  };
}

export function CaptureSheet({
  handle,
  presetType,
  presetText,
  onClose,
  toast,
}: {
  handle: WebDb;
  presetType: EntryType | null;
  presetText: string;
  onClose: () => void;
  toast: (m: string) => void;
}): JSX.Element {
  const db = asSqlite(handle);
  const [text, setText] = useState(presetText);
  const [typeOverride, setTypeOverride] = useState<EntryType | null>(presetType);
  const [dropped, setDropped] = useState<SignalKind[]>([]);
  const [showTypes, setShowTypes] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [newSource, setNewSource] = useState<{
    title: string;
    creator: string;
  } | null>(null);
  const [linkMeta, setLinkMeta] = useState<LinkMeta | null>(null);
  const [saving, setSaving] = useState(false);
  const [count, setCount] = useState(0);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const resolveSeq = useRef(0);

  const parsed = useMemo(() => parseCapture(text), [text]);
  const live = useMemo(() => applyDropped(parsed, dropped), [parsed, dropped]);
  const entryType = typeOverride ?? live.type;
  const spec = specOf(entryType);
  const sourceKinds = spec.sourceKinds ?? [];
  const sourced = sourceKinds.length > 0;
  const selectedSource = sourceId ? (sources.find((s) => s.id === sourceId) ?? null) : null;
  const canSave = !saving && (live.rest.length > 0 || !!live.url || !!live.quote);

  useEffect(() => {
    inputRef.current?.focus();
    const el = inputRef.current;
    if (el) el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  // 출처가 붙는 유형이면 최근 순으로 불러 첫 것을 미리 고른다
  const kindKey = sourceKinds.join(',');
  useEffect(() => {
    let alive = true;
    if (!sourced) {
      setSources([]);
      setSourceId(null);
      return;
    }
    void recentSources(db, kindKey.split(',') as SourceKind[]).then((rs) => {
      if (!alive) return;
      setSources(rs);
      setSourceId((prev) => (prev && rs.some((s) => s.id === prev) ? prev : (rs[0]?.id ?? null)));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, sourced, kindKey]);

  // 링크를 적으면 제목·채널·썸네일을 읽어 온다. 이미 담아둔 링크면 그 출처를 고른다.
  useEffect(() => {
    const preview = live.url ? previewLink(live.url) : null;
    if (!preview) {
      setLinkMeta(null);
      return;
    }
    setLinkMeta((prev) => (prev && prev.url === preview.url ? prev : preview));
    const seq = ++resolveSeq.current;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      const existing = await findSourceByUrl(db, preview.canonicalUrl).catch(() => null);
      if (seq !== resolveSeq.current) return;
      if (existing) {
        setSources((prev) => (prev.some((s) => s.id === existing.id) ? prev : [existing, ...prev]));
        setSourceId(existing.id);
        setLinkMeta({
          ...preview,
          title: existing.title,
          creator: existing.creator,
          thumbnailUrl: existing.thumbnail_uri ?? preview.thumbnailUrl,
        });
        return;
      }
      const meta = await resolveLink(preview.url, ctrl.signal);
      if (seq !== resolveSeq.current || !meta) return;
      setLinkMeta(meta);
    }, 450);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
      resolveSeq.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.url, handle]);

  async function paste(): Promise<void> {
    const r = await readClipboard();
    if (!r.ok) {
      toast(
        r.reason === 'empty' ? '클립보드가 비어 있습니다' : '붙여넣기를 허용해야 읽을 수 있습니다'
      );
      return;
    }
    setText((prev) => (prev.trim() ? `${prev.trim()} ${r.text}` : r.text));
    inputRef.current?.focus();
  }

  // 출처는 한 번만 등록한다. 그 '한 번'이 캡처 칸을 떠나야 할 이유가 되면 안 되므로 여기서 끝낸다.
  async function registerSource(): Promise<void> {
    const draft = newSource;
    if (!draft?.title.trim()) return;
    const kind = (sourceKinds[0] ?? 'book') as SourceKind;
    try {
      const made = await createSource(db, kind, draft.title.trim(), draft.creator.trim() || null);
      setSources((prev) => [made, ...prev.filter((s) => s.id !== made.id)]);
      setSourceId(made.id);
      setNewSource(null);
      setShowSources(false);
      bump();
      inputRef.current?.focus();
    } catch {
      toast('출처를 만들지 못했습니다');
    }
  }

  function toggleSignal(kind: SignalKind): void {
    setDropped((prev) => (prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]));
  }

  async function save(): Promise<void> {
    if (!canSave) return;
    setSaving(true);
    try {
      let source: Source | null = sourced ? selectedSource : null;

      // 링크는 출처를 스스로 만든다 — 제목·채널·얼굴까지.
      // 웹에서는 썸네일을 내려받지 않고 주소 그대로 둔다. 유튜브 주소는 영상 식별자에서 나오므로
      // 링크만 있으면 언제든 다시 만들 수 있다.
      if (entryType === 'link' && linkMeta) {
        const kind: SourceKind = linkMeta.video ? 'video' : 'article';
        const name = linkMeta.title || fallbackTitle(linkMeta);
        source = await createSource(db, kind, name, linkMeta.creator, {
          url: linkMeta.canonicalUrl,
          thumbnail_uri: linkMeta.thumbnailUrl,
        });
        const made = source;
        setSources((prev) => [made, ...prev.filter((s) => s.id !== made.id)]);
        setSourceId(made.id);
      }

      const tags = live.tags;
      if (source) await touchSource(db, source.id, tags);

      const input: EntryInput = {
        type: entryType,
        day: todayKey(),
        source_id: source?.id ?? null,
        title: source ? source.title : (live.title ?? null),
        subtitle: source ? source.creator : (live.subtitle ?? null),
        quote: spec.fields.quote ? live.quote : null,
        body: live.body ?? (spec.fields.quote ? null : live.rest || null),
        url: spec.fields.url ? (live.url ?? source?.url ?? null) : null,
        image_uri: source?.thumbnail_uri ?? null,
        page: spec.fields.page ? live.page : null,
        slot: spec.fields.slot ? live.slot : null,
        minutes: spec.fields.minutes ? live.minutes : null,
        practiced: entryType === 'meal' || entryType === 'workout' ? 1 : null,
        done: entryType === 'task' ? (live.done ? 1 : 0) : null,
        due_time: spec.fields.dueTime ? live.dueTime : null,
        tags,
      };
      await createEntry(db, input);
      await handle.flush();
      bump();

      // 이어서 적는다 — 시트는 닫지 않고 칸만 비운다
      setCount((n) => n + 1);
      setText('');
      setTypeOverride(presetType);
      setDropped([]);
      setLinkMeta(null);
      setShowTypes(false);
      inputRef.current?.focus();
    } catch (e) {
      toast(e instanceof Error ? `저장 실패 — ${e.message}` : '저장하지 못했습니다');
    } finally {
      setSaving(false);
    }
  }

  const thumb = linkMeta?.thumbnailUrl ?? null;
  const strong = typeOverride !== null || live.confident;

  return (
    <div class="sheet">
      <div class="sheet-head">
        <button class="quiet" onClick={onClose}>
          {count > 0 ? '완료' : '닫기'}
        </button>
        <span class="mono dim">{count > 0 ? `${count}건 저장됨` : '새 기록'}</span>
        <button class="act" disabled={!canSave} onClick={() => void save()}>
          저장
        </button>
      </div>

      <div class="sheet-body">
        <textarea
          ref={inputRef}
          class="cap-in"
          value={text}
          placeholder="무엇이든 붙여넣거나 적으세요"
          enterkeyhint="enter"
          autocapitalize="sentences"
          onInput={(ev) => setText((ev.target as HTMLTextAreaElement).value)}
        />
        {entryType === 'link' && linkMeta && (
          <div style="margin-top:12px">
            <div class="vid">
              {thumb ? (
                <img
                  src={thumb}
                  alt=""
                  onError={(ev) => ((ev.currentTarget as HTMLImageElement).style.display = 'none')}
                />
              ) : (
                <div class="ph">{domainOf(linkMeta.url)}</div>
              )}
              <span class="play">
                <PlayIcon />
              </span>
            </div>
            <div class="label" style="margin-top:8px">
              {linkMeta.title ?? domainOf(linkMeta.url)}
            </div>
            {linkMeta.creator && <div class="cap">{linkMeta.creator}</div>}
          </div>
        )}
      </div>

      <div class="structure sheet-foot">
        <div class="chips">
          <button class={strong ? 'chip on' : 'chip'} onClick={() => setShowTypes((v) => !v)}>
            {REGISTRY[entryType].label}
            <Icon name="chevronDown" />
          </button>
          {live.signals.map((s) => (
            <button
              key={s.kind + s.label}
              class={dropped.includes(s.kind) ? 'chip mono off' : 'chip mono'}
              onClick={() => toggleSignal(s.kind)}
            >
              {s.label}
            </button>
          ))}
          {text.trim().length === 0 && (
            <button class="chip" onClick={() => void paste()}>
              <Icon name="clipboard" />
              붙여넣기
            </button>
          )}
        </div>

        {showTypes && (
          <div class="chips tight">
            {TYPE_ORDER.map((t) => (
              <button
                key={t}
                class={t === entryType ? 'chip on' : 'chip'}
                onClick={() => {
                  setTypeOverride(t);
                  setShowTypes(false);
                  setSourceId(null);
                }}
              >
                {REGISTRY[t].label}
              </button>
            ))}
          </div>
        )}

        {sourced && (
          <>
            <button
              class="meta-row"
              onClick={() => entryType !== 'link' && setShowSources((v) => !v)}
            >
              <span class="micro">출처</span>
              <span class="grow cap" style="text-align:right; color:var(--ink)">
                {entryType === 'link'
                  ? (linkMeta?.title ?? (linkMeta ? domainOf(linkMeta.url) : '링크에서 자동'))
                  : (selectedSource?.title ?? '없음')}
              </span>
              {entryType !== 'link' && <Icon name="chevronDown" />}
            </button>
            {showSources && entryType !== 'link' && (
              <>
                <div class="chips scroll" style="padding-top:8px">
                  <button
                    class="chip"
                    onClick={() => setNewSource((v) => (v ? null : { title: '', creator: '' }))}
                  >
                    <Icon name="plus" />새 출처
                  </button>
                  {sources.map((s) => (
                    <button
                      key={s.id}
                      class={s.id === sourceId ? 'chip on' : 'chip'}
                      onClick={() => {
                        setSourceId(s.id);
                        setNewSource(null);
                        setShowSources(false);
                      }}
                    >
                      {s.title}
                    </button>
                  ))}
                  {sources.length === 0 && !newSource && (
                    <span class="cap dim" style="align-self:center">
                      등록된 출처 없음
                    </span>
                  )}
                </div>
                {newSource && (
                  <div style="display:flex; gap:8px; padding:0 16px 12px">
                    <input
                      class="field"
                      value={newSource.title}
                      placeholder="책 제목"
                      autofocus
                      onInput={(ev) =>
                        setNewSource((v) =>
                          v
                            ? {
                                ...v,
                                title: (ev.target as HTMLInputElement).value,
                              }
                            : v
                        )
                      }
                      onKeyDown={(ev) => ev.key === 'Enter' && void registerSource()}
                    />
                    <input
                      class="field"
                      style="max-width:110px"
                      value={newSource.creator}
                      placeholder="저자"
                      onInput={(ev) =>
                        setNewSource((v) =>
                          v
                            ? {
                                ...v,
                                creator: (ev.target as HTMLInputElement).value,
                              }
                            : v
                        )
                      }
                      onKeyDown={(ev) => ev.key === 'Enter' && void registerSource()}
                    />
                    <button
                      class="chip on"
                      disabled={!newSource.title.trim()}
                      onClick={() => void registerSource()}
                    >
                      등록
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        <div class="hint">링크 · p.57 · 시편 23:1 · #갈피 · 30분 · 14:00 자동 인식</div>
      </div>
    </div>
  );
}
