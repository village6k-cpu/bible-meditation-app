import { useState } from 'preact/hooks';
import { EMPTY_LIBRARY_FILTERS, libraryMarkdown, type LibraryItem } from '@core/library';
import { listLibrary } from '@db/libraryRepo';
import { asSqlite } from '../../db';
import type { WebDb } from '../../db/sqlite';
import { deliverFile } from '../../platform/backup';
import { useLoad } from '../store';
import { LibraryView } from '../parts/LibraryView';

export function Library({handle,today,onOpen,onAdd,toast}: {
  handle:WebDb; today:string; onOpen:(id:string)=>void; onAdd:()=>void; toast:(message:string)=>void;
}) {
  const [filters,setFilters]=useState({...EMPTY_LIBRARY_FILTERS});
  const {data,loading,error}=useLoad<LibraryItem[]>(handle,d=>listLibrary(asSqlite(d)),[],[]);
  async function exportLibrary() {
    try {
      const result=await deliverFile(libraryMarkdown(data),`ledger-서재-${today}.md`,'text/markdown;charset=utf-8');
      if(result!=='cancelled') toast('서재와 리뷰를 내보냈습니다');
    } catch { toast('내보내지 못했습니다. 다시 시도해 주세요.'); }
  }
  return <LibraryView items={data} filters={filters} onFilters={setFilters} today={today} onOpen={onOpen}
    onAdd={onAdd} onExport={()=>void exportLibrary()} loading={loading} error={error}/>;
}
