import { useEffect, useRef, useState } from 'preact/hooks';
import type { CatalogKind, CatalogResult } from '@core/catalog';
import { searchCatalog, catalogCreator } from '../../sync/catalogApi';
import { LibraryArtwork } from './LibraryArtwork';

export function CatalogSearch({kind,title,disabled,onPick}:{kind:CatalogKind;title:string;disabled:boolean;onPick:(result:CatalogResult)=>void}) {
  const [q,setQ]=useState(title);
  const [results,setResults]=useState<CatalogResult[]|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const generation=useRef(0);
  const disabledRef=useRef(disabled); disabledRef.current=disabled;
  useEffect(()=>()=>{generation.current++;},[]);
  async function search() {
    const n=++generation.current; setBusy(true);setError('');setResults(null);
    try {const data=await searchCatalog(kind,q.trim());if(n===generation.current)setResults(data);}
    catch(e) {if(n===generation.current)setError(e instanceof Error?e.message:'검색하지 못했습니다.');}
    finally {if(n===generation.current)setBusy(false);}
  }
  async function pick(result:CatalogResult) {
    const n=++generation.current;setBusy(true);setError('');
    let creator=result.creator;
    try {creator=await catalogCreator(result);}
    catch {if(n===generation.current)setError('표지는 선택했습니다. 창작자 정보는 직접 입력해 주세요.');}
    finally {
      if(n===generation.current) {
        if(!disabledRef.current) onPick({...result,creator});
        setResults(null);setBusy(false);
      }
    }
  }
  return <section class="catalog-search" aria-label="작품 검색해서 등록">
    <label>검색해서 채우기<span class="cap dim">제목·저자 검색 후 표지 선택 · 직접 입력도 가능</span></label>
    <div class="catalog-query"><input class="field" type="search" aria-label="등록할 작품 검색" maxLength={120} value={q}
      disabled={disabled||busy} placeholder={kind==='book'?'책 제목 또는 저자':'영화·시리즈 제목'}
      onInput={e=>{setQ(e.currentTarget.value);setResults(null);setError('');}}
      onKeyDown={e=>{if(e.key==='Enter'&&!e.isComposing&&q.trim()&&!busy&&!disabled){e.preventDefault();void search();}}}/>
      <button type="button" class="chip on" disabled={disabled||busy||!q.trim()} onClick={()=>void search()}>{busy?'검색 중…':'검색'}</button></div>
    <div aria-live="polite">{error&&<p class="cap">{error}</p>}{results?.length===0&&<p class="cap dim">검색 결과가 없습니다. 다른 제목으로 검색하거나 아래에 직접 입력해 주세요.</p>}</div>
    {!!results?.length&&<div class="catalog-results">{results.map(r=><button type="button" class="catalog-result" key={r.catalog.id} disabled={disabled||busy} onClick={()=>void pick(r)}>
      <LibraryArtwork kind={r.kind} image={r.catalog.image}/><span><strong>{r.title}</strong><small>{[r.creator,r.catalog.year].filter(Boolean).join(' · ')||'창작자 정보는 선택 후 확인'}</small></span><span class="cap">선택</span>
    </button>)}</div>}
    <p class="cap dim">검색 제공: {kind==='book'?'Kakao 도서':'TMDB'} · 검색어만 제공처로 전송됩니다.</p>
  </section>;
}

export function CatalogCredits() {
  return <details class="catalog-credits"><summary>작품 검색 · 이미지 출처</summary>
    <p>도서 정보·표지: Kakao 도서 검색. 영화·시리즈 정보·포스터: TMDB.</p>
    <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer"><img alt="TMDB" loading="lazy" referrerPolicy="no-referrer" src="https://www.themoviedb.org/assets/v4/logos/v2/blue_long_2-9665a76b1ae401a510ec1e0ca40ddcb3b0cfe45f1d51b77a308fea0845885648.svg"/></a>
    <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
  </details>;
}
