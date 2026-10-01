import { Icon, type IconName } from '../icons';

export type Tab = 'inbox'|'records'|'library'|'review'|'metrics';
const TABS: [Tab,string,IconName][] = [
  ['inbox','수집함','inbox'],['records','기록','records'],['library','서재','library'],
  ['review','검토','review'],['metrics','지표','metrics'],
];
export function Navigation({tab,onTab,onCompose,toast}: {
  tab:Tab;onTab:(tab:Tab)=>void;onCompose:()=>void;toast:string|null;
}) {
  return <nav class="tabbar" aria-label="주 메뉴">
    {TABS.map(([key,label,icon])=><button key={key} class={tab===key?'on':undefined}
      aria-current={tab===key?'page':undefined} onClick={()=>onTab(key)}>
      <Icon name={icon}/><span>{label}</span><span class="stroke"/>
    </button>)}
    <button class="fab" aria-label="적기" onClick={onCompose}><Icon name="plus" width={2}/><span>적기</span></button>
    {toast&&<div class="toast">{toast}</div>}
  </nav>;
}
