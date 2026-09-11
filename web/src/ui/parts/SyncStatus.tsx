import type { SyncState } from '../../sync/state';
export function SyncStatus({ state, online, onOpen }: { state: SyncState; online: boolean; onOpen(): void }) {
  const label = !online ? '오프라인 · 연결되면 자동 동기화'
    : state.phase === 'signed-out' ? '이 기기에 보관 중 · Google로 동기화 연결'
    : state.phase === 'error' ? '동기화 확인 필요'
    : state.phase === 'pending' ? '전송 대기…'
    : state.phase === 'syncing' ? '동기화 중…'
    : state.lastSyncedAt ? '동기화 완료' : '자동 동기화 준비 중…';
  return <div role="status" aria-label="자동 저장 및 동기화 상태" style="padding:0 16px 12px;font-size:12px;color:var(--ink2)">
    <button class="quiet" onClick={onOpen} style="min-height:32px">{label}</button>
    {state.error && <div style="color:var(--danger);overflow-wrap:anywhere">{state.error}</div>}
  </div>;
}
