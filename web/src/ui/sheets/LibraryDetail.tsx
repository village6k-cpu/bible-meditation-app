import { useEffect, useState } from 'preact/hooks';
import type { Entry, Source } from '@core/types';
import { libraryInfo, MEDIA_LABEL, STATUS_LABEL } from '@core/library';
import { saveLibraryItem, type LibraryInput } from '@db/libraryRepo';
import { getSource, deleteSource } from '@db/sourceRepo';
import { createEntry } from '@db/entryRepo';
import { asSqlite } from '../../db';
import type { WebDb } from '../../db/sqlite';
import { bump, useLoad } from '../store';
import { LibraryEditor } from '../parts/LibraryEditor';
import { Rating, MEDIA_ICON } from '../parts/LibraryView';
import { Icon } from '../icons';
import { firstLine } from '../parts/entry';

export function LibraryDetail({handle,id,today,onClose,onOpen,onSaved,setGuard,toast}: {
  handle:WebDb; id:string|null; today:string; onClose:()=>void; onOpen:(id:string)=>void;
  onSaved:(id:string)=>void;
  setGuard:(fn:null|(()=>boolean))=>void; toast:(message:string)=>void;
}) {
  const [editing,setEditing]=useState(!id);
  const [currentId,setCurrentId]=useState(id);
  const [note,setNote]=useState('');
  const [busy,setBusy]=useState(false);
  const [actionError,setActionError]=useState<string|null>(null);
  useEffect(()=>{
    if(editing) return;
    setGuard(()=>!busy && (!note.trim() || confirm('저장하지 않은 메모를 닫을까요?')));
    return ()=>setGuard(null);
  },[editing,busy,note,setGuard]);
  const {data,loading,error}=useLoad<{source:Source|null;notes:Entry[]}>(handle,async d=>{
    if(!currentId) return {source:null,notes:[]};
    const db=asSqlite(d);
    return {source:await getSource(db,currentId),notes:await db.getAllAsync<Entry>('SELECT * FROM entries WHERE source_id=? AND deleted_at IS NULL ORDER BY day DESC, created_at DESC',[currentId])};
  },[currentId],{source:null,notes:[]});
  const source=data.source;
  async function save(input:LibraryInput) {
    const saved=await saveLibraryItem(asSqlite(handle),input);
    await handle.flush();
    setGuard(null);setCurrentId(saved.id);setEditing(false);onSaved(saved.id);bump();toast('서재에 저장했습니다');
  }
  async function addNote() {
    if(!source||!note.trim()||busy) return;
    setBusy(true);setActionError(null);
    try {
      const db=asSqlite(handle);
      await db.withTransactionAsync(async()=>{
        if(!await getSource(db,source.id)) throw new Error('작품이 삭제됐습니다. 서재를 다시 확인해 주세요.');
        await createEntry(db,{type:'writing',day:today,source_id:source.id,title:source.title,subtitle:source.creator,url:source.url,body:note.trim()});
      });
      await handle.flush();setNote('');bump();
    } catch(e) {setActionError(e instanceof Error?e.message:'메모를 저장하지 못했습니다.');}
    finally {setBusy(false);}
  }
  async function remove() {
    if(!source||busy||!confirm(`『${source.title}』을 서재에서 삭제할까요? 별점·리뷰도 목록에서 사라집니다. 연결된 메모 ${data.notes.length}개는 기록 탭에 남습니다.`)) return;
    setBusy(true);setActionError(null);
    try {await deleteSource(asSqlite(handle),source.id);await handle.flush();setGuard(null);bump();onClose();}
    catch(e) {setActionError(e instanceof Error?e.message:'삭제하지 못했습니다.');}
    finally {setBusy(false);}
  }
  if(editing && (!currentId||source)) return <LibraryEditor source={source} noteCount={data.notes.length} today={today} onSave={save}
    onClose={()=>currentId?setEditing(false):onClose()} setGuard={setGuard}/>;
  const info=source?libraryInfo(source):null;
  const kind=info?.kind??source?.kind??'book';
  return <div class="sheet" role="dialog" aria-label="작품 상세">
    <div class="sheet-head"><button class="quiet" disabled={busy} onClick={onClose}><Icon name="chevronLeft"/>서재</button>
      <span class="mono dim">{MEDIA_LABEL[kind]}</span><button class="act" disabled={busy||!source} onClick={()=>setEditing(true)}>고치기</button></div>
    <div class="sheet-body library-detail">
      {(error||actionError) && <p class="library-error" role="alert">{error||actionError}</p>}
      {!source?<div class="empty">{loading?'작품을 여는 중…':'작품을 찾지 못했습니다.'}</div>:<>
        <div class="library-detail-heading"><div class={`library-art ${kind}`}><Icon name={MEDIA_ICON[kind]}/></div><div>
          <span class={`library-status ${info?.status??'untracked'}`}>{STATUS_LABEL[info?.status??'untracked']}</span>
          <h2>{source.title}</h2>{source.creator&&<p class="sub">{source.creator}</p>}<Rating value={info?.rating??null}/>
        </div></div>
        <div class="library-dates cap dim">{info?.started_on && <span>시작 {info.started_on}</span>}{info?.finished_on && <span>완료 {info.finished_on}</span>}</div>
        {source.url && /^https?:\/\//i.test(source.url) && <a class="library-link" href={source.url} target="_blank" rel="noopener noreferrer">관련 링크 열기 <Icon name="external"/></a>}
        <section class="library-review"><h3 class="micro">나의 리뷰</h3>{info?.review?<p class="body-t pre">{info.review}</p>:<button class="quiet" onClick={()=>setEditing(true)}>별점과 첫 감상 남기기 <Icon name="writing"/></button>}</section>
        <section class="library-notes"><h3 class="micro">이 작품의 밑줄 · 메모 {data.notes.length}</h3>
          {data.notes.map(entry=><button key={entry.id} class="library-note" disabled={busy} onClick={()=>{
            if(note.trim()&&!confirm('저장하지 않은 메모를 닫고 기록을 열까요?')) return;
            setGuard(null);onOpen(entry.id);
          }}><span class="cap dim">{entry.day}{entry.page?` · p.${entry.page}`:''}</span><span class="body-t clamp3">{firstLine(entry)}</span><Icon name="chevronRight"/></button>)}
          <label class="sr-only" for="library-note">이 작품에 메모 남기기</label>
          <textarea id="library-note" class="field" placeholder="기억할 문장이나 장면을 남겨 보세요. #갈피도 쓸 수 있어요." value={note} disabled={busy} onInput={e=>setNote(e.currentTarget.value)}/>
          <button class="chip on" disabled={busy||!note.trim()} onClick={()=>void addNote()}>{busy?'저장 중…':'메모 저장'}</button>
        </section>
        <button class="quiet library-delete" disabled={busy} onClick={()=>void remove()}><Icon name="trash"/>서재에서 삭제</button>
      </>}
    </div>
  </div>;
}
