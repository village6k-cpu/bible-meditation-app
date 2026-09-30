import type { JSX } from 'preact';
import {
  MEDIA_KINDS, MEDIA_LABEL, MEDIA_STATUSES, STATUS_LABEL, EMPTY_LIBRARY_FILTERS,
  filterLibrary, librarySummary, type LibraryItem, type LibraryFilters,
} from '@core/library';
import { Icon, type IconName } from '../icons';

export const MEDIA_ICON: Record<LibraryItem['mediaKind'], IconName> = {
  book: 'book', film: 'film', series: 'film', music: 'music', podcast: 'music', article: 'writing', video: 'play',
};

export function Rating({ value }: { value: number | null }): JSX.Element {
  if (value === null) return <span class="cap dim">미평가</span>;
  return <span class="library-rating" aria-label={`별점 ${value}점 / 5점`}>
    <span class="stars" aria-hidden="true">{[1,2,3,4,5].map(n => <span class="star-cell" key={n}>
      <span class="star-empty">☆</span><span class="star-fill" style={{width:`${Math.min(1,Math.max(0,value-n+1))*100}%`}}>★</span>
    </span>)}</span><span class="mono">{value.toFixed(1)}</span>
  </span>;
}

export function LibraryView({items, filters, onFilters, today, onOpen, onAdd, onExport, loading, error}: {
  items: LibraryItem[]; filters: LibraryFilters; onFilters: (f:LibraryFilters)=>void;
  today:string; onOpen:(id:string)=>void; onAdd:()=>void; onExport:()=>void; loading:boolean; error:string|null;
}): JSX.Element {
  const summary=librarySummary(items,today.slice(0,4));
  const shown=filterLibrary(items,filters);
  const years=[...new Set(items.map(i=>i.info?.finished_on?.slice(0,4)).filter((y):y is string=>!!y))].sort().reverse();
  const change=(patch:Partial<LibraryFilters>)=>onFilters({...filters,...patch});
  const filtered=!!(filters.q||filters.kind||filters.status||filters.year||filters.favorites);
  return <>
    <header class="app-head library-head">
      <div><div class="micro">읽고 보고 들은 것들</div><h1 class="display">서재</h1></div>
      <button class="library-add act" onClick={onAdd}><Icon name="plus"/>작품 추가</button>
    </header>
    <div class="library-summary" aria-label="서재 요약">
      <div><span class="micro">전체 작품</span><strong class="mono-lg">{summary.total}</strong></div>
      <div><span class="micro">{today.slice(0,4)} 완료</span><strong class="mono-lg">{summary.thisYear}</strong></div>
      <div><span class="micro">감상 중</span><strong class="mono-lg">{summary.active}</strong></div>
      <div><span class="micro">평균 별점</span><strong class="mono-lg">{summary.average?.toFixed(1) ?? '—'}<small> / 5</small></strong></div>
    </div>
    <div class="library-tools">
      <input class="field" type="search" aria-label="서재 검색" placeholder="제목 · 창작자 · 리뷰 검색" value={filters.q}
        onInput={e=>change({q:e.currentTarget.value})}/>
      <div class="library-selects">
        <select class="field" aria-label="감상 완료 연도" value={filters.year} onChange={e=>change({year:e.currentTarget.value})}>
          <option value="">완료 연도 전체</option>{years.map(year=><option key={year} value={year}>{year}년 완료</option>)}
        </select>
        <select class="field" aria-label="서재 정렬" value={filters.sort} onChange={e=>change({sort:e.currentTarget.value as LibraryFilters['sort']})}>
          <option value="recent">최근 기록순</option><option value="finished">최근 완료순</option><option value="rating">별점 높은순</option><option value="title">제목순</option>
        </select>
      </div>
    </div>
    <div class="chips scroll library-kinds" aria-label="작품 종류">
      <button class={!filters.kind?'chip on':'chip'} aria-pressed={!filters.kind} onClick={()=>change({kind:''})}>전체 <span class="mono">{items.length}</span></button>
      {MEDIA_KINDS.map(kind=><button key={kind} class={filters.kind===kind?'chip on':'chip'} aria-pressed={filters.kind===kind}
        onClick={()=>change({kind:filters.kind===kind?'':kind})}>{MEDIA_LABEL[kind]} <span class="mono">{items.filter(i=>i.mediaKind===kind).length}</span></button>)}
    </div>
    <div class="chips scroll tight" aria-label="감상 상태">
      <button class={!filters.status?'chip on':'chip'} aria-pressed={!filters.status} onClick={()=>change({status:''})}>모든 상태</button>
      {[...MEDIA_STATUSES,'untracked' as const].map(status=><button key={status} class={filters.status===status?'chip on':'chip'} aria-pressed={filters.status===status}
        onClick={()=>change({status:filters.status===status?'':status})}>{STATUS_LABEL[status]}</button>)}
      <button class={filters.favorites?'chip on':'chip'} aria-pressed={filters.favorites} onClick={()=>change({favorites:!filters.favorites})}>★ 4점 이상</button>
    </div>
    <div class="library-list-head"><span class="micro">{shown.length}개 작품</span><div>
      {filtered && <button class="quiet" onClick={()=>onFilters({...EMPTY_LIBRARY_FILTERS})}>필터 초기화</button>}
      {items.length>0 && <button class="quiet" onClick={onExport}>서재 내보내기</button>}
    </div></div>
    {error && <p class="library-error" role="alert">{error}</p>}
    {loading && !items.length ? <div class="empty">서재를 여는 중…</div> : !shown.length ? <div class="library-empty">
      <Icon name="library"/><h2>{items.length?'조건에 맞는 작품이 없습니다':'좋았던 작품을 한곳에'}</h2>
      <p class="sub">{items.length?'검색어나 필터를 바꿔 보세요.':'읽은 책, 본 영화, 자주 들은 음악. 별점과 감상을 남겨 보세요.'}</p>
      {!items.length && <button class="chip on" onClick={onAdd}>첫 작품 추가</button>}
    </div> : <div class="library-grid">{shown.map(item=><button key={item.id} class="library-card" onClick={()=>onOpen(item.id)}>
      <div class={`library-art ${item.mediaKind}`} aria-hidden="true"><Icon name={MEDIA_ICON[item.mediaKind]}/><span>{MEDIA_LABEL[item.mediaKind]}</span></div>
      <div class="library-card-content">
        <div class="library-card-top"><span class="micro">{MEDIA_LABEL[item.mediaKind]}</span><span class={`library-status ${item.info?.status??'untracked'}`}>{STATUS_LABEL[item.info?.status??'untracked']}</span></div>
        <h2 class="library-title clamp2">{item.title}</h2>
        <div class="cap dim clamp2">{item.creator||'창작자 미입력'}</div>
        <Rating value={item.info?.rating??null}/>
        {item.info?.review && <p class="library-review-preview clamp2">{item.info.review}</p>}
        <div class="library-card-foot"><span>{item.info?.finished_on ? `${item.info.finished_on} 완료` : item.info?.started_on ? `${item.info.started_on} 시작` : '날짜 미지정'}</span><span>메모 {item.entry_count}</span></div>
      </div>
    </button>)}</div>}
    <div class="gap-lg"/>
  </>;
}
