import { useEffect, useRef, useState } from 'preact/hooks';
import type { Source } from '@core/types';
import { MEDIA_KINDS, MEDIA_LABEL, MEDIA_STATUSES, STATUS_LABEL, libraryInfo, type LibraryInfo } from '@core/library';
import type { LibraryInput } from '@db/libraryRepo';
import { Rating } from './LibraryView';

export function LibraryEditor({source,noteCount=0,today,onSave,onClose,setGuard}: {
  source:Source|null; today:string; onSave:(input:LibraryInput)=>Promise<void>; onClose:()=>void;
  noteCount?:number;
  setGuard:(fn:null|(()=>boolean))=>void;
}) {
  const [title,setTitle]=useState(source?.title??'');
  const [creator,setCreator]=useState(source?.creator??'');
  const [url,setUrl]=useState(source?.url??'');
  const [info,setInfo]=useState<LibraryInfo>(()=>source && libraryInfo(source) || {
    version:1,kind:source?.kind??'book',status:'completed',rating:null,review:'',started_on:null,finished_on:today,
  });
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const initial=useRef(JSON.stringify({title,creator,url,info}));
  const dirty=initial.current!==JSON.stringify({title,creator,url,info});
  useEffect(()=>{
    setGuard(()=>!busy && (!dirty || confirm('저장하지 않은 감상을 닫을까요?')));
    return ()=>setGuard(null);
  },[dirty,busy,setGuard]);
  const close=()=>{if(!busy && (!dirty||confirm('저장하지 않은 감상을 닫을까요?'))) {setGuard(null);onClose();}};
  async function save() {
    if(busy) return;
    setBusy(true);setError(null);
    try {
      await onSave({id:source?.id,title,creator:creator.trim()||null,url:url.trim()||null,info});
      setGuard(null);
    } catch(e) {setError(e instanceof Error?e.message:'저장하지 못했습니다. 다시 시도해 주세요.');}
    finally {setBusy(false);}
  }
  return <div class="sheet" role="dialog" aria-label={source?'감상 고치기':'작품 추가'}>
    <div class="sheet-head"><button class="quiet" disabled={busy} onClick={close}>취소</button>
      <span class="mono dim">{source?'감상 고치기':'작품 추가'}</span>
      <button class="act" disabled={busy||!title.trim()} onClick={()=>void save()}>{busy?'저장 중…':'저장'}</button>
    </div>
    <div class="sheet-body library-editor">
      {error && <p class="library-error" role="alert">{error}</p>}
      {noteCount>0 && <p class="cap dim">연결된 밑줄·메모 {noteCount}개의 작품 제목·창작자도 함께 바뀝니다. 본문과 사진은 그대로 남습니다.</p>}
      <fieldset disabled={busy} class="library-fields">
        <div class="library-form-pair">
          <label>종류<select class="field" value={info.kind} onChange={e=>setInfo({...info,kind:e.currentTarget.value as LibraryInfo['kind']})}>
            {MEDIA_KINDS.map(kind=><option key={kind} value={kind}>{MEDIA_LABEL[kind]}</option>)}
          </select></label>
          <label>감상 상태<select class="field" value={info.status} onChange={e=>{
            const status=e.currentTarget.value as LibraryInfo['status'];
            setInfo({...info,status,finished_on:status==='completed'?(info.finished_on??today):null});
          }}>{MEDIA_STATUSES.map(status=><option key={status} value={status}>{STATUS_LABEL[status]}</option>)}</select></label>
        </div>
        <label>작품 제목<input class="field" value={title} placeholder="예: 모모, 인터스텔라" onInput={e=>setTitle(e.currentTarget.value)} required/></label>
        <label>창작자 <span class="dim">선택</span><input class="field" value={creator} placeholder="저자 · 감독 · 아티스트 · 진행자" onInput={e=>setCreator(e.currentTarget.value)}/></label>
        <div class="library-rating-edit">
          <label>내 별점<select class="field" value={info.rating??''} onChange={e=>setInfo({...info,rating:e.currentTarget.value?Number(e.currentTarget.value):null})}>
            <option value="">미평가</option>{Array.from({length:10},(_,i)=>(i+1)/2).map(n=><option key={n} value={n}>{n.toFixed(1)}점</option>)}
          </select></label>
          <div><div class="library-star-buttons" aria-label="별점 빠른 선택">
            {[1,2,3,4,5].map(n=><button type="button" key={n} aria-label={`별점 ${n}점`} aria-pressed={info.rating===n}
              onClick={()=>setInfo({...info,rating:info.rating===n?n-0.5:n})}><span aria-hidden="true">{(info.rating??0)>=n?'★':'☆'}</span></button>)}
          </div><Rating value={info.rating}/></div>
        </div>
        <div class="library-form-pair">
          <label>시작일 <span class="dim">선택</span><input class="field" type="date" value={info.started_on??''} onInput={e=>setInfo({...info,started_on:e.currentTarget.value||null})}/></label>
          {info.status==='completed' && <label>완료일 <span class="dim">선택</span><input class="field" type="date" value={info.finished_on??''} onInput={e=>setInfo({...info,finished_on:e.currentTarget.value||null})}/></label>}
        </div>
        <label>리뷰<textarea class="field library-review-input" value={info.review} placeholder="무엇이 좋았나요? 기억하고 싶은 장면이나 생각을 남겨 보세요." onInput={e=>setInfo({...info,review:e.currentTarget.value})}/></label>
        <label>관련 링크 <span class="dim">선택</span><input class="field" type="url" value={url} placeholder="https://" onInput={e=>setUrl(e.currentTarget.value)}/></label>
      </fieldset>
    </div>
  </div>;
}
