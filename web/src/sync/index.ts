import type { Session } from '@supabase/supabase-js';
import { asSqlite } from '../db';
import type { WebDb } from '../db/sqlite';
import { bindSyncAccount, syncOnce, type SyncResult } from '@db/syncEngine';
import { supabase } from './client';
import { createSupabaseSyncApi } from './supabaseApi';
import { processPendingPhotos } from './photos';
import { googleSignInUrl } from './googleAuth';
import { getSyncState, publishSyncState as publish } from './state';
export { getSyncState, subscribeSyncState, type SyncState } from './state';

let active: Promise<SyncResult> | null = null;

function emailOf(session: Session): string {
  return session.user.email ?? '연결된 계정';
}

export async function signInForSync(): Promise<void> {
  window.location.assign(await googleSignInUrl(supabase.auth, window.location.href));
}

export async function signOutFromSync(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function syncNow(handle: WebDb, retryPhotos = false): Promise<SyncResult> {
  if (active) return active;
  active = (async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error(error.message);
    const session = data.session;
    if (!session) throw new Error('먼저 동기화 계정에 로그인하세요.');
    const email = emailOf(session);
    publish({ phase: 'syncing', email, lastSyncedAt: getSyncState().lastSyncedAt, error: null });
    try {
      const sqlite = asSqlite(handle);
      await bindSyncAccount(sqlite, session.user.id);
      if (retryPhotos) await sqlite.runAsync("UPDATE photo_jobs SET state='pending', attempts=0 WHERE state='failed'");
      const result = await syncOnce(sqlite, createSupabaseSyncApi(supabase, session.user.id));
      await handle.flush();
      // 본문을 먼저 맞춘 뒤 사진을 처리한다. 사진 오류도 화면에 보여줘야 연결 실패를 알 수 있다.
      const photos = await processPendingPhotos(handle);
      if (photos?.completed) {
        const afterPhotos = await syncOnce(sqlite, createSupabaseSyncApi(supabase, session.user.id));
        result.pushed += afterPhotos.pushed;
        result.pulled += afterPhotos.pulled;
      }
      await handle.flush();
      publish({ phase: 'idle', email, lastSyncedAt: Date.now(), error: null });
      return result;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      publish({ phase: 'error', email, lastSyncedAt: getSyncState().lastSyncedAt, error: message });
      throw reason;
    }
  })().finally(() => { active = null; });
  return active;
}

export function startAutoSync(handle: WebDb, onApplied: () => void): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let subscription: { unsubscribe: () => void } | null = null;
  let loginError: string | null = null;

  const run = (): void => {
    if (stopped || !navigator.onLine) return;
    // 사진이 실패해도 이미 받은 본문은 화면에 나타나야 한다.
    void syncNow(handle).catch(() => {}).finally(() => { if (!stopped) onApplied(); });
  };
  const setSession = (session: Session | null): void => {
    if (stopped) return;
    if (!session) {
      publish({ phase: 'signed-out', email: null, lastSyncedAt: null, error: loginError });
      return;
    }
    loginError = null;
    publish({ phase: 'idle', email: emailOf(session), lastSyncedAt: getSyncState().lastSyncedAt, error: null });
    queueMicrotask(run);
  };
  const onVisible = (): void => {
    if (document.visibilityState === 'visible') run();
  };

  // SDK가 PKCE 코드를 한 번 교환한 뒤 구독한다. getSession만 읽으면 콜백 오류가 사라진다.
  void supabase.auth.initialize().then(({ error }) => {
    if (stopped) return;
    if (error) loginError = 'Google 로그인을 마치지 못했습니다. 취소했거나 연결이 만료됐다면 다시 연결하세요.';
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    subscription = data.subscription;
  }).catch(() => {
    loginError = '로그인 상태를 확인하지 못했습니다. 다시 연결하세요.';
    setSession(null);
  });
  window.addEventListener('online', run);
  document.addEventListener('visibilitychange', onVisible);
  timer = setInterval(run, 30_000);

  return () => {
    stopped = true;
    if (timer) clearInterval(timer);
    subscription?.unsubscribe();
    window.removeEventListener('online', run);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
