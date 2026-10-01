import { useEffect, useRef, useState } from 'preact/hooks';
import { todayKey } from '@core/dates';
import type { WebDb } from '../../db/sqlite';
import { pickPhotos, savePhoto } from '../../platform/photos';
import { EntryEditor, draftOf } from '../parts/EntryEditor';
import { blankWriting, saveWriting, type WritingSession } from '../parts/writingDraft';
import { bump } from '../store';

export function WritingSheet({handle,type,text,photo=null,onClose,setGuard}: {
  handle:WebDb; type:'writing'|'verse'; text:string; photo?:string|null;
  onClose:()=>void; setGuard:(fn:null|(()=>boolean))=>void;
}) {
  const [entry] = useState(()=>blankWriting(type,todayKey()));
  const [draft,setDraft] = useState(()=>({...draftOf(entry,[]),body:text,image_uri:photo}));
  const [saved,setSaved] = useState(()=>JSON.stringify(draftOf(entry,[])));
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const session = useRef<WritingSession>({id:null,day:entry.day});
  const operation = useRef(false);
  const dirty = JSON.stringify(draft)!==saved;
  const hasText = !!(draft.body.trim()||draft.quote.trim()||draft.title.trim()||draft.image_uri);

  useEffect(()=>{
    setGuard(()=>!operation.current && (!dirty || confirm('아직 저장하지 않은 글이 있습니다. 저장하지 않고 닫을까요?')));
    const warn = (e:BeforeUnloadEvent)=>{if(dirty||operation.current){e.preventDefault();e.returnValue='';}};
    window.addEventListener('beforeunload',warn);
    return ()=>{setGuard(null);window.removeEventListener('beforeunload',warn);};
  },[dirty,setGuard]);

  async function save() {
    if(operation.current||!hasText||!dirty) return;
    operation.current=true;setBusy(true);setError('');
    try {await saveWriting(handle,session.current,draft);setSaved(JSON.stringify(draft));bump();}
    catch(e){setError(e instanceof Error?`저장 실패 — ${e.message}`:'저장하지 못했습니다. 글은 이 화면에 남아 있습니다.');}
    finally{operation.current=false;setBusy(false);}
  }
  async function attach() {
    if(operation.current)return;
    operation.current=true;setBusy(true);setError('');
    try {
      const result=await pickPhotos(false);
      if(result.files[0]) {
        const uri=await savePhoto(handle,result.files[0]);
        setDraft(d=>({...d,image_uri:uri}));
      }
    } catch(e){setError(e instanceof Error?e.message:'사진을 붙이지 못했습니다.');}
    finally{operation.current=false;setBusy(false);}
  }
  return <div class="sheet writing-sheet" role="dialog" aria-modal="true" aria-label="몰입 글쓰기"
    onKeyDown={e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='s'&&!e.isComposing){e.preventDefault();void save();}}}>
    <div class="sheet-head">
      <button class="quiet" disabled={busy} onClick={onClose}>닫기</button>
      <span class="writing-status" role="status">{busy?'처리 중…':dirty?'저장하지 않은 변경':session.current.id?'저장됨 · 계속 쓰세요':'새 원고'}</span>
      <button class="act" disabled={busy||!hasText||!dirty} onClick={()=>void save()}>저장</button>
    </div>
    <div class="sheet-body writing-page">
      {error&&<p role="alert" class="writing-error">{error}</p>}
      <EntryEditor entry={entry} draft={draft} busy={busy} preview={null} immersive
        onChange={setDraft} onPick={()=>void attach()} onRemove={()=>setDraft(d=>({...d,image_uri:null}))}/>
    </div>
    <footer class="writing-footer"><span>{draft.body.length.toLocaleString()}자</span><span>저장 후에도 이어서 작성 · ⌘/Ctrl S</span></footer>
  </div>;
}
