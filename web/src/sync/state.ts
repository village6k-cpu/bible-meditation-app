export type SyncState =
  | { phase: 'signed-out'; email: null; lastSyncedAt: null; error: string | null }
  | { phase: 'idle' | 'syncing'; email: string; lastSyncedAt: number | null; error: null }
  | { phase: 'error'; email: string; lastSyncedAt: number | null; error: string; legacyAccountId?: string; accountId?: string };

let state: SyncState = { phase: 'signed-out', email: null, lastSyncedAt: null, error: null };
const listeners = new Set<(next: SyncState) => void>();

export function publishSyncState(next: SyncState): void {
  state = next;
  for (const listener of listeners) listener(next);
}

export function getSyncState(): SyncState {
  return state;
}

export function subscribeSyncState(listener: (next: SyncState) => void): () => void {
  listeners.add(listener);
  // 렌더와 effect 사이에 로그인 콜백이 끝나도 최초 결과를 놓치지 않는다.
  listener(state);
  return () => listeners.delete(listener);
}
