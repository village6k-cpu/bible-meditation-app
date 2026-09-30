import { validCatalog, type CatalogKind, type CatalogResult } from '@core/catalog';

async function invoke(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { requireSyncClient } = await import('./client');
  const client = requireSyncClient();
  const {data:{session}} = await client.auth.getSession();
  if (!session) throw new Error('서재 검색은 보관에서 렛저에 로그인한 뒤 사용할 수 있습니다. 직접 입력은 로그인 없이도 가능합니다.');
  const {data,error} = await client.functions.invoke('ledger-catalog',{body,timeout:12_000});
  if (error) {
    let message = '검색에 연결하지 못했습니다. 잠시 후 다시 시도하거나 직접 입력해 주세요.';
    try {
      const response = (error as {context?:Response}).context;
      const payload = await response?.clone().json();
      if (typeof payload?.error === 'string') message = payload.error;
      else if(response?.status === 401) message = '검색 인증을 확인하지 못했습니다. 보관의 로그인 상태를 확인해 주세요.';
    } catch { /* Keep a safe, actionable error. */ }
    throw new Error(message);
  }
  return data;
}
export async function searchCatalog(kind:CatalogKind,q:string):Promise<CatalogResult[]> {
  const data = await invoke({action:'search',kind,q});
  if (!Array.isArray(data.results)) throw new Error('검색 결과를 읽지 못했습니다. 다시 시도해 주세요.');
  return data.results.filter((v):v is CatalogResult => !!v && v.kind===kind && typeof v.title==='string'
    && typeof v.creator==='string' && validCatalog(v.catalog));
}
export async function catalogCreator(result:CatalogResult):Promise<string> {
  if(result.kind==='book') return result.creator;
  const data=await invoke({action:'detail',kind:result.kind,id:result.catalog.id});
  return typeof data.creator==='string'?data.creator:'';
}
