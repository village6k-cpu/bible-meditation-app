import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { formatDayKo } from '@core/dates';
import { parseVideoLink } from '@core/links';
import { REGISTRY, specOf } from '@core/registry';
import type { Entry } from '@core/types';
import {
  deleteEntry,
  getEntry,
  recordRevisit,
  relatedEntries,
  tagsOf,
  togglePinned,
  updateEntry,
} from '@db/entryRepo';
import { parseTagInput } from '@core/tags';
import { domainOf } from '@ex/linkMeta';
import { asSqlite } from '../../db';
import type { WebDb } from '../../db/sqlite';
import { Icon, PlayIcon } from '../icons';
import { deletePhoto, isPhotoRef } from '../../platform/photos';
import { Photo } from '../parts/photo';
import { EntryRow, SectionRow, srcLine, thumbOf } from '../parts/entry';
import { bump, useLoad } from '../store';

// 상세는 '다시 읽는' 자리다. 여는 순간 마지막으로 읽은 시각이 갱신되고,
// 그래서 '오래 안 읽은 기록' 줄에서 내려간다.

interface Detail {
  entry: Entry | null;
  tags: string[];
  related: Entry[];
  relatedTags: Map<string, string[]>;
}

const EMPTY: Detail = {
  entry: null,
  tags: [],
  related: [],
  relatedTags: new Map(),
};

// 고치기 — 오타 하나 때문에 기록을 지우고 다시 적게 하지 않는다
interface Draft {
  title: string;
  subtitle: string;
  quote: string;
  body: string;
  page: string;
  tags: string;
}

function draftOf(e: Entry, tags: string[]): Draft {
  return {
    title: e.title ?? '',
    subtitle: e.subtitle ?? '',
    quote: e.quote ?? '',
    body: e.body ?? '',
    page: e.page === null ? '' : String(e.page),
    tags: tags.join(' '),
  };
}

export function DetailSheet({
  handle,
  id,
  onClose,
  onOpen,
}: {
  handle: WebDb;
  id: string;
  onClose: () => void;
  onOpen: (id: string) => void;
}): JSX.Element {
  const [playing, setPlaying] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    setPlaying(false);
    setDraft(null);
    void recordRevisit(asSqlite(handle), id);
  }, [handle, id]);

  const { data, loading } = useLoad<Detail>(
    handle,
    async (d) => {
      const db = asSqlite(d);
      const entry = await getEntry(db, id);
      if (!entry) return EMPTY;
      const tagMap = await tagsOf(db, [entry.id]);
      const related = await relatedEntries(db, entry, 3);
      const relatedTags = await tagsOf(
        db,
        related.map((r) => r.id)
      );
      return { entry, tags: tagMap.get(entry.id) ?? [], related, relatedTags };
    },
    [id],
    EMPTY
  );

  const e = data.entry;
  const video = e?.url ? parseVideoLink(e.url) : null;
  const thumb = e ? thumbOf(e) : null;
  const line = e ? srcLine(e) : '';

  async function remove(): Promise<void> {
    if (!e) return;
    if (!confirm('이 기록을 삭제할까요?')) return;
    await deleteEntry(asSqlite(handle), e.id);
    // 기록이 물고 있던 사진도 함께 — 파일만 남으면 아무도 찾지 않는 용량이 된다
    if (isPhotoRef(e.image_uri)) await deletePhoto(handle, e.image_uri);
    await handle.flush();
    bump();
    onClose();
  }

  async function pin(): Promise<void> {
    if (!e) return;
    await togglePinned(asSqlite(handle), e.id);
    await handle.flush();
    bump();
  }

  async function saveEdit(): Promise<void> {
    if (!e || !draft) return;
    const page = draft.page.trim() ? Number(draft.page.trim()) : null;
    await updateEntry(asSqlite(handle), e.id, {
      type: e.type,
      day: e.day,
      source_id: e.source_id,
      title: draft.title.trim() || null,
      subtitle: draft.subtitle.trim() || null,
      quote: draft.quote.trim() || null,
      body: draft.body.trim() || null,
      url: e.url,
      image_uri: e.image_uri,
      page: page !== null && Number.isFinite(page) ? page : null,
      slot: e.slot,
      minutes: e.minutes,
      practiced: e.practiced,
      done: e.done,
      due_time: e.due_time,
      tags: parseTagInput(draft.tags),
    });
    await handle.flush();
    setDraft(null);
    bump();
  }

  const spec = e ? specOf(e.type) : null;

  return (
    <div class="sheet">
      <div class="sheet-head">
        <button class="quiet" onClick={() => (draft ? setDraft(null) : onClose())}>
          {draft ? (
            '취소'
          ) : (
            <>
              <Icon name="chevronLeft" />
              뒤로
            </>
          )}
        </button>
        {e &&
          (draft ? (
            <button class="act" onClick={() => void saveEdit()}>
              저장
            </button>
          ) : (
            <span style="display:flex; gap:18px">
              <button
                class="quiet"
                aria-label="고치기"
                onClick={() => setDraft(draftOf(e, data.tags))}
              >
                <Icon name="writing" />
              </button>
              <button
                class="quiet"
                style={e.pinned === 1 ? 'color:var(--ink)' : undefined}
                aria-label="표시함"
                onClick={() => void pin()}
              >
                <Icon name="pin" />
              </button>
              <button class="quiet" aria-label="삭제" onClick={() => void remove()}>
                <Icon name="trash" />
              </button>
            </span>
          ))}
      </div>

      <div class="sheet-body">
        {!e ? (
          loading ? null : (
            <div class="empty">기록을 찾을 수 없습니다</div>
          )
        ) : draft && spec ? (
          <div class="stack">
            {spec.fields.title && !e.source_id && (
              <Labelled text={spec.fields.title.label}>
                <input
                  class="field"
                  value={draft.title}
                  placeholder={spec.fields.title.placeholder}
                  onInput={(ev) =>
                    setDraft((d) =>
                      d ? { ...d, title: (ev.target as HTMLInputElement).value } : d
                    )
                  }
                />
              </Labelled>
            )}
            {spec.fields.subtitle && !e.source_id && (
              <Labelled text={spec.fields.subtitle.label}>
                <input
                  class="field"
                  value={draft.subtitle}
                  placeholder={spec.fields.subtitle.placeholder}
                  onInput={(ev) =>
                    setDraft((d) =>
                      d
                        ? {
                            ...d,
                            subtitle: (ev.target as HTMLInputElement).value,
                          }
                        : d
                    )
                  }
                />
              </Labelled>
            )}
            {spec.fields.quote && (
              <Labelled text={spec.fields.quote.label}>
                <textarea
                  class="field"
                  rows={5}
                  value={draft.quote}
                  placeholder={spec.fields.quote.placeholder}
                  onInput={(ev) =>
                    setDraft((d) =>
                      d
                        ? {
                            ...d,
                            quote: (ev.target as HTMLTextAreaElement).value,
                          }
                        : d
                    )
                  }
                />
              </Labelled>
            )}
            {spec.fields.body && (
              <Labelled text={spec.fields.body.label}>
                <textarea
                  class="field"
                  rows={5}
                  value={draft.body}
                  placeholder={spec.fields.body.placeholder}
                  onInput={(ev) =>
                    setDraft((d) =>
                      d
                        ? {
                            ...d,
                            body: (ev.target as HTMLTextAreaElement).value,
                          }
                        : d
                    )
                  }
                />
              </Labelled>
            )}
            {spec.fields.page && (
              <Labelled text="쪽">
                <input
                  class="field"
                  inputMode="numeric"
                  value={draft.page}
                  placeholder="쪽"
                  onInput={(ev) =>
                    setDraft((d) => (d ? { ...d, page: (ev.target as HTMLInputElement).value } : d))
                  }
                />
              </Labelled>
            )}
            <Labelled text="갈피">
              <input
                class="field"
                value={draft.tags}
                placeholder="띄어쓰기로 구분"
                onInput={(ev) =>
                  setDraft((d) => (d ? { ...d, tags: (ev.target as HTMLInputElement).value } : d))
                }
              />
            </Labelled>
          </div>
        ) : (
          <>
            <div class="micro">
              {REGISTRY[e.type].label}
              {e.pinned === 1 ? ' · 표시함' : ''}
            </div>
            <div class="mono dim" style="margin-top:4px">
              {formatDayKo(e.day)}
            </div>

            {isPhotoRef(e.image_uri) && (
              <Photo
                photo={e.image_uri}
                class="photo full"
                style="margin-top:14px"
                alt="기록에 붙인 사진"
              />
            )}
            {e.type === 'link' && (thumb || video) && (
              <div class="vid" style="margin-top:14px">
                {playing && video ? (
                  <iframe
                    src={`${video.embedUrl}&autoplay=1`}
                    title={e.title ?? '영상'}
                    allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <>
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        onError={(ev) =>
                          ((ev.currentTarget as HTMLImageElement).style.display = 'none')
                        }
                      />
                    ) : (
                      <div class="ph">{e.url ? domainOf(e.url) : ''}</div>
                    )}
                    {video && (
                      <button class="play" aria-label="재생" onClick={() => setPlaying(true)}>
                        <PlayIcon />
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {e.title && e.type !== 'book' && (
              <div class="title" style="margin-top:14px">
                {e.title}
              </div>
            )}
            {e.type === 'verse' && e.subtitle && (
              <div class="title sec" style="margin-top:14px">
                {e.subtitle}
              </div>
            )}
            {e.quote && (
              <div class="quoted" style="margin-top:16px">
                <span class="rule" />
                <span class="quote-t pre">{e.quote}</span>
              </div>
            )}
            {e.type === 'book' && line && (
              <div class="cap" style="margin-top:10px">
                {line}
              </div>
            )}
            {e.body && (
              <div class="body-t pre" style="margin-top:16px">
                {e.body}
              </div>
            )}
            {(e.type === 'meal' || e.type === 'workout') && line && (
              <div class="cap" style="margin-top:14px">
                {line}
              </div>
            )}
            {e.type === 'task' && e.due_time && (
              <div class="cap" style="margin-top:14px">
                {e.due_time}
              </div>
            )}
            {e.url && (
              <div class="cap" style="margin-top:14px">
                <a href={e.url} target="_blank" rel="noreferrer" style="color:var(--ink2)">
                  {domainOf(e.url)} ↗
                </a>
              </div>
            )}
            {data.tags.length > 0 && (
              <div class="chips" style="padding:16px 0 0">
                {data.tags.map((t) => (
                  <span key={t} class="chip mono">
                    #{t}
                  </span>
                ))}
              </div>
            )}
            {data.related.length > 0 && (
              <>
                <div style="margin:24px -16px 0">
                  <SectionRow label="같은 갈피" right={data.related.length} first />
                </div>
                <div style="margin:0 -16px">
                  {data.related.map((r) => (
                    <EntryRow
                      key={r.id}
                      entry={r}
                      tags={data.relatedTags.get(r.id)}
                      showDate
                      onOpen={onOpen}
                    />
                  ))}
                </div>
              </>
            )}
            <div class="gap-lg" />
          </>
        )}
      </div>
    </div>
  );
}

function Labelled({ text, children }: { text: string; children: JSX.Element }): JSX.Element {
  return (
    <label style="display:block">
      <span class="micro" style="display:block; margin-bottom:5px">
        {text}
      </span>
      {children}
    </label>
  );
}
