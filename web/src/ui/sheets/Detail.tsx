import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { formatDayKo } from '@core/dates';
import { parseVideoLink } from '@core/links';
import { REGISTRY } from '@core/registry';
import type { Entry } from '@core/types';
import {
  deleteEntry,
  getEntry,
  recordRevisit,
  relatedEntries,
  tagsOf,
  togglePinned,
} from '@db/entryRepo';
import { domainOf } from '@ex/linkMeta';
import { asSqlite } from '../../db';
import type { WebDb } from '../../db/sqlite';
import { Icon, PlayIcon } from '../icons';
import { deletePhoto, isPhotoRef, pickPhotos, savePhoto } from '../../platform/photos';
import { Photo } from '../parts/photo';
import { EntryEditor, draftOf, saveEdit as persistEdit, type EntryDraft } from '../parts/EntryEditor';
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

export function DetailSheet({
  handle,
  id,
  onClose,
  onOpen,
  setGuard,
}: {
  handle: WebDb;
  id: string;
  onClose: () => void;
  onOpen: (id: string) => void;
  setGuard: (fn: null | (() => boolean)) => void;
}): JSX.Element {
  const [playing, setPlaying] = useState(false);
  const [draft, setDraft] = useState<EntryDraft | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const operation = useRef(false);
  const emptyPicks = useRef(0);

  useEffect(() => {
    setPlaying(false);
    setDraft(null);
    setPhotoFile(null);
    setEditError(null);
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

  useEffect(() => {
    if (!photoFile) { setPreview(null); return; }
    const url = URL.createObjectURL(photoFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  const dirty = !!draft && (!!photoFile || JSON.stringify(draft) !== JSON.stringify(e && draftOf(e, data.tags)));
  useEffect(() => {
    setGuard(busy ? () => false : dirty ? () => confirm('수정한 내용이 있습니다. 저장하지 않고 닫을까요?') : null);
    return () => setGuard(null);
  }, [busy, dirty, setGuard]);

  function cancelEdit(): void {
    if (operation.current) return;
    setDraft(null);
    setPhotoFile(null);
    setEditError(null);
  }

  async function attachPhoto(): Promise<void> {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setEditError(null);
    try {
      const picked = await pickPhotos(false);
      if (picked.files[0]) {
        emptyPicks.current = 0;
        // 저장을 누르기 전까지 원래 사진·DB는 만지지 않는다. 취소는 미리보기만 버린다.
        setPhotoFile(picked.files[0]);
      } else if (++emptyPicks.current >= 2) {
        emptyPicks.current = 0;
        setEditError('사진 선택기가 응답하지 않습니다. 앱을 완전히 닫았다 열거나 기기 저장 공간을 확인해 주세요');
      }
    } catch (error) {
      setEditError(error instanceof Error ? `사진을 붙이지 못했습니다 — ${error.message}` : '사진을 붙이지 못했습니다');
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }

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
    if (!e || !draft || operation.current) return;
    operation.current = true;
    setBusy(true);
    setEditError(null);
    try {
      let next = draft;
      if (photoFile) {
        next = {...draft, image_uri:await savePhoto(handle, photoFile)};
        setDraft(next);
        setPhotoFile(null);
      }
      await persistEdit(handle, e, next);
      setDraft(null);
      bump();
      // 저장 성공 뒤에만, 다른 기록도 쓰지 않는 옛 파일을 정리한다. Google 원본은 지우지 않는다.
      const oldPhoto = e.image_uri;
      if (isPhotoRef(oldPhoto) && oldPhoto !== next.image_uri) {
        await handle.getFirstAsync('SELECT 1 FROM entries WHERE image_uri=? AND deleted_at IS NULL LIMIT 1', [oldPhoto])
          .then(async used => { if (!used) await deletePhoto(handle, oldPhoto); })
          .catch(() => {}); // 부수적인 파일 정리 실패로 이미 저장한 기록을 실패라고 표시하지 않는다.
      }
    } catch (error) {
      setEditError(error instanceof Error ? `저장 실패 — ${error.message}` : '저장하지 못했습니다');
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }

  return (
    <div class="sheet">
      <div class="sheet-head">
        <button class="quiet" disabled={busy} onClick={() => (draft ? cancelEdit() : onClose())}>
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
            <button class="act" disabled={busy} onClick={() => void saveEdit()}>
              {busy ? '처리 중…' : '저장'}
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
        {editError && <div class="cap" role="alert" style="margin-bottom:12px">{editError}</div>}
        {!e ? (
          loading ? null : (
            <div class="empty">기록을 찾을 수 없습니다</div>
          )
        ) : draft ? (
          <EntryEditor entry={e} draft={draft} busy={busy} preview={preview}
            onChange={setDraft} onPick={() => void attachPhoto()}
            onRemove={() => { setPhotoFile(null); setDraft({...draft, image_uri:null}); }} />
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
            {e.type !== 'book' && e.type !== 'link' && e.subtitle && (
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
