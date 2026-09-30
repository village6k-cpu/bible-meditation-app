import type { SQLiteDatabase } from 'expo-sqlite';
import type { Source } from '../core/types';
import { newId } from '../core/ids';
import { libraryItem, libraryInfo, sourceKindFor, validateLibraryInfo, type LibraryInfo, type LibraryItem } from '../core/library';
import { allSources, getSource, propagateUrl } from './sourceRepo';

export async function listLibrary(db: SQLiteDatabase): Promise<LibraryItem[]> {
  return (await allSources(db)).map(libraryItem);
}

export interface LibraryInput {
  id?: string;
  title: string;
  creator: string | null;
  url: string | null;
  info: LibraryInfo;
}

const normalized = (s: string | null) => (s ?? '').trim().normalize('NFC').toLocaleLowerCase();

export async function saveLibraryItem(db: SQLiteDatabase, input: LibraryInput): Promise<Source> {
  validateLibraryInfo(input.info);
  const title = input.title.trim();
  const creator = input.creator?.trim() || null;
  const url = input.url?.trim() || null;
  if (!title) throw new Error('작품 제목을 입력해 주세요.');
  if (url) {
    let parsed: URL;
    try { parsed = new URL(url); } catch { throw new Error('http 또는 https 링크를 입력해 주세요.'); }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('http 또는 https 링크를 입력해 주세요.');
  }
  let result: Source | null = null;
  await db.withTransactionAsync(async () => {
    const existing = input.id ? await getSource(db, input.id) : null;
    if (input.id && !existing) throw new Error('작품을 찾지 못했습니다. 목록을 다시 확인해 주세요.');
    const kind = sourceKindFor(input.info.kind);
    const sources = await allSources(db);
    const duplicate = sources.find(s => s.id !== input.id && (
      (url && s.url === url)
      || (normalized(s.title) === normalized(title) && normalized(s.creator) === normalized(creator)
        && (libraryInfo(s)?.kind ?? s.kind) === input.info.kind)
    ));
    if (duplicate && (input.id || duplicate.library_json)) {
      throw new Error(`『${duplicate.title}』이 이미 있습니다. 기존 작품에서 감상을 고쳐 주세요.`);
    }
    // 기존 밑줄의 출처를 처음 평가할 때는 새 작품을 만들지 않는다.
    const before = existing ?? duplicate;
    const id = before?.id ?? newId();
    const now = Date.now();
    const json = JSON.stringify(input.info);
    if (before) {
      await db.runAsync('UPDATE sources SET kind=?, title=?, creator=?, url=?, library_json=?, last_used_at=? WHERE id=?',
        [kind, title, creator, url, json, now, id]);
      if(title!==before.title || creator!==before.creator) {
        await db.runAsync('UPDATE entries SET title=?, subtitle=?, updated_at=? WHERE source_id=? AND deleted_at IS NULL',
          [title, creator, now, id]);
      }
      if(url && url!==before.url) await propagateUrl(db,id,before.url,url);
    } else {
      await db.runAsync('INSERT INTO sources (id,kind,title,creator,url,created_at,last_used_at,library_json) VALUES (?,?,?,?,?,?,?,?)',
        [id, kind, title, creator, url, now, now, json]);
    }
    result = (await getSource(db,id))!;
  });
  return result!;
}
