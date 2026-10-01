import type { Entry } from '@core/types';
import { createEntry, getEntry, updateEntry } from '@db/entryRepo';
import { asSqlite } from '../../db';
import type { WebDb } from '../../db/sqlite';
import { inputOf, type EntryDraft } from './EntryEditor';

export function blankWriting(type: 'writing'|'verse', day: string): Entry {
  return {id:'',type,day,created_at:0,updated_at:0,deleted_at:null,pinned:0,revisit_count:0,
    last_revisited_at:null,filed_at:null,source_id:null,title:null,subtitle:null,quote:null,
    body:null,url:null,image_uri:null,page:null,slot:null,minutes:null,practiced:null,done:null,due_time:null};
}

export interface WritingSession {id: string|null; day: string}
export async function saveWriting(handle: WebDb, session: WritingSession, draft: EntryDraft): Promise<void> {
  const db = asSqlite(handle);
  const entry = session.id ? await getEntry(db,session.id) : blankWriting('writing',session.day);
  if (!entry || entry.deleted_at !== null) throw new Error('이 기록을 찾을 수 없습니다. 본문을 복사해 보관해 주세요.');
  const input = inputOf(entry,draft);
  // 긴 글의 본문은 자동 추출하거나 공백·문단을 재작성하지 않는다.
  input.body = draft.body || null;
  input.quote = draft.quote || null;
  let id = session.id;
  await handle.withTransactionAsync(async () => {
    if (id) await updateEntry(db,id,input);
    else id = await createEntry(db,input);
  });
  // flush 실패 뒤 재시도해도 이미 만든 기록에 이어 쓴다. 중복 원고를 만들지 않는다.
  session.id = id;
  await handle.flush();
}
