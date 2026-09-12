import type { JSX } from 'preact';
import { CONTENT_TYPES, REGISTRY, specOf } from '@core/registry';
import { parseTagInput } from '@core/tags';
import type { Entry, EntryInput, EntryType } from '@core/types';
import { updateEntry } from '@db/entryRepo';
import { asSqlite } from '../../db';
import type { WebDb } from '../../db/sqlite';
import { isPhotoRef } from '../../platform/photos';
import { Icon } from '../icons';
import { Photo } from './photo';

export interface EntryDraft {
  type: EntryType;
  title: string;
  subtitle: string;
  quote: string;
  body: string;
  page: string;
  tags: string;
  image_uri: string | null;
}

export function draftOf(e: Entry, tags: string[]): EntryDraft {
  return { type:e.type, title:e.title ?? '', subtitle:e.subtitle ?? '', quote:e.quote ?? '',
    body:e.body ?? '', page:e.page === null ? '' : String(e.page), tags:tags.join(' '), image_uri:e.image_uri };
}

export function inputOf(e: Entry, draft: EntryDraft): EntryInput {
  const page = draft.page.trim() ? Number(draft.page) : null;
  // 분류를 바로잡는 일이지 새 기록을 만드는 일이 아니다. 다른 유형의 칸도 버리지 않는다.
  return { ...e, type:draft.type, title:draft.title.trim() || null, subtitle:draft.subtitle.trim() || null,
    quote:draft.quote.trim() || null, body:draft.body.trim() || null,
    image_uri:draft.image_uri, page:page !== null && Number.isFinite(page) ? page : null,
    tags:parseTagInput(draft.tags) };
}

export async function saveEdit(handle: WebDb, e: Entry, draft: EntryDraft): Promise<void> {
  // 사진 연결과 갈피가 따로 저장되면 일부만 바뀐 기록이 전송될 수 있다.
  await handle.withTransactionAsync(() => updateEntry(asSqlite(handle), e.id, inputOf(e, draft)));
  await handle.flush();
}

export function EntryEditor({entry, draft, busy, preview, onChange, onPick, onRemove}: {
  entry: Entry;
  draft: EntryDraft;
  busy: boolean;
  preview: string | null;
  onChange: (draft: EntryDraft) => void;
  onPick: () => void;
  onRemove: () => void;
}): JSX.Element {
  const spec = specOf(draft.type);
  const original = specOf(entry.type);
  const photo = !!preview || !!draft.image_uri;
  const change = (key: keyof EntryDraft, value: string) => onChange({...draft, [key]:value});

  function textField(key: 'title' | 'subtitle' | 'quote' | 'body'): JSX.Element | null {
    if ((key === 'title' || key === 'subtitle') && entry.source_id) return null;
    const field = spec.fields[key] ?? (draft[key] ? {
      label:`기존 ${original.fields[key]?.label ?? {title:'제목', subtitle:'부제', quote:'인용문', body:'본문'}[key]}`,
      placeholder:'',
    } : null);
    if (!field) return null;
    const multiline = key === 'quote' || key === 'body';
    return <label>
      <span class="micro edit-label">{field.label}</span>
      {multiline ? <textarea class="field" rows={5} value={draft[key]} placeholder={field.placeholder}
        onInput={ev=>change(key, ev.currentTarget.value)} />
        : <input class="field" value={draft[key]} placeholder={field.placeholder}
          onInput={ev=>change(key, ev.currentTarget.value)} />}
    </label>;
  }

  return <fieldset class="stack entry-editor" disabled={busy}>
    {CONTENT_TYPES.includes(entry.type) && <div>
      <span class="micro edit-label">기록 유형</span>
      <div class="chips tight" role="group" aria-label="기록 유형">
        {CONTENT_TYPES.map(type=><button key={type} type="button" class={draft.type === type ? 'chip on' : 'chip'}
          aria-pressed={draft.type === type} onClick={()=>onChange({...draft, type})}>{REGISTRY[type].label}</button>)}
      </div>
    </div>}
    <div>
      <span class="micro edit-label">사진</span>
      <div class="edit-photo-row">
        {photo && <div class="edit-photo-preview">
          {preview ? <img src={preview} alt="선택한 사진" /> : isPhotoRef(draft.image_uri)
            ? <Photo photo={draft.image_uri} alt="붙인 사진" />
            : <img src={draft.image_uri!} alt="기존 이미지" />}
        </div>}
        <div class="chips tight">
          <button type="button" class="chip" onClick={onPick}><Icon name="camera" />{photo ? '사진 바꾸기' : '사진 추가'}</button>
          {photo && <button type="button" class="chip" onClick={onRemove}>사진 떼기</button>}
        </div>
      </div>
    </div>
    {entry.source_id && <div class="cap">출처: {[entry.title, entry.subtitle].filter(Boolean).join(' · ')}</div>}
    {textField('title')}{textField('subtitle')}{textField('quote')}{textField('body')}
    {(spec.fields.page || draft.page) && <label><span class="micro edit-label">쪽</span>
      <input class="field" inputMode="numeric" value={draft.page} placeholder="쪽" onInput={ev=>change('page', ev.currentTarget.value)} /></label>}
    <label><span class="micro edit-label">갈피</span>
      <input class="field" value={draft.tags} placeholder="띄어쓰기로 구분" onInput={ev=>change('tags', ev.currentTarget.value)} /></label>
  </fieldset>;
}
