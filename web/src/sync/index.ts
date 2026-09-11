import type { Session } from '@supabase/supabase-js';
import { asSqlite } from '../db';
import type { WebDb } from '../db/sqlite';
import { bindSyncAccount, LegacySyncAccountError, migrateLegacySyncAccount, syncOnce, type SyncResult } from '@db/syncEngine';
import { supabase, requireSyncClient, syncConfigError, syncProjectId } from './client';
import { createSupabaseSyncApi } from './supabaseApi';
import { processPendingPhotos } from './photos';
import { googleSignInUrl } from './googleAuth';
import { getSyncState, publishSyncState as publish } from './state';
import { backupNow } from '../platform/backup';
import { migrateWithBackup } from './migrateWithBackup';
import { startSyncScheduler } from './scheduler';
export { getSyncState, subscribeSyncState, type SyncState } from './state';

let active: Promise<SyncResult> | null = null;

function emailOf(session: Session): string {
  return session.user.email ?? '연결된 계정';
}

export async function signInForSync(): Promise<void> {
  const supabase = requireSyncClient();
  window.location.assign(await googleSignInUrl(supabase.auth, window.location.href));
}

export async function signOutFromSync(): Promise<void> {
  const supabase = requireSyncClient();
  // 기본 global은 공유 프로젝트의 HeyBilly와 다른 기기 세션까지 취소한다.
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw new Error(error.message);
}

export async function syncNow(handle: WebDb, retryPhotos = false): Promise<SyncResult> {
  if (active) return active;
  active = (async () => {
    const supabase = requireSyncClient();
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error(error.message);
    const session = data.session;
    if (!session) throw new Error('먼저 동기화 계정에 로그인하세요.');
    const email = emailOf(session);
    publish({ phase: 'syncing', email, lastSyncedAt: getSyncState().lastSyncedAt, error: null });
    try {
      const sqlite = asSqlite(handle);
      await bindSyncAccount(sqlite, session.user.id, syncProjectId);
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
      publish({ phase: 'error', email, lastSyncedAt: getSyncState().lastSyncedAt, error: message,
        ...(reason instanceof LegacySyncAccountError ? { legacyAccountId: reason.legacyAccountId, accountId: session.user.id } : {}) });
      throw reason;
    }
  })().finally(() => { active = null; });
  return active;
}

export async function moveLegacySyncWithBackup(handle: WebDb, legacyAccountId: string, expectedAccountId: string): Promise<boolean> {
  if (active) await active.catch(() => {});
  let moved = false;
  // 백업 공유 시트를 열어 둔 동안 자동 동기화가 끼어들지 않는다.
  active = (async () => {
    moved = await migrateWithBackup(
      async () => (await backupNow(handle)).how,
      async () => {
        const { data, error } = await requireSyncClient().auth.getSession();
        if (error || data.session?.user.id !== expectedAccountId) throw new Error('로그인 계정이 달라져 전환을 중단했습니다. 다시 확인하세요.');
        await migrateLegacySyncAccount(asSqlite(handle), legacyAccountId, expectedAccountId, syncProjectId);
        await handle.flush();
      }
    );
    return { pushed: 0, pulled: 0 };
  })().finally(() => { active = null; });
  await active;
  return moved;
}

export function startAutoSync(handle: WebDb, onApplied: () => void): () => void {
  const client = supabase;
  if (!client) {
    publish({ phase: 'signed-out', email: null, lastSyncedAt: null, error: syncConfigError });
    return () => {};
  }
  let stopped = false;
  let signedIn = false;
  let subscription: { unsubscribe: () => void } | null = null;
  let loginError: string | null = null;

  const stopScheduler = startSyncScheduler({
    window, document,
    canRun: () => !stopped && signedIn && navigator.onLine,
    isVisible: () => document.visibilityState === 'visible',
    sync: () => syncNow(handle), onApplied,
  });
  const setSession = (session: Session | null): void => {
    if (stopped) return;
    signedIn = !!session;
    if (!session) {
      publish({ phase: 'signed-out', email: null, lastSyncedAt: null, error: loginError });
      return;
    }
    loginError = null;
    publish({ phase: 'idle', email: emailOf(session), lastSyncedAt: getSyncState().lastSyncedAt, error: null });
    queueMicrotask(() => window.dispatchEvent(new Event('ledger:sync-request')));
  };

  // SDK가 PKCE 코드를 한 번 교환한 뒤 구독한다. getSession만 읽으면 콜백 오류가 사라진다.
  void client.auth.initialize().then(({ error }) => {
    if (stopped) return;
    if (error) loginError = 'Google 로그인을 마치지 못했습니다. 취소했거나 연결이 만료됐다면 다시 연결하세요.';
    const { data } = client.auth.onAuthStateChange((_event, session) => setSession(session));
    subscription = data.subscription;
  }).catch(() => {
    loginError = '로그인 상태를 확인하지 못했습니다. 다시 연결하세요.';
    setSession(null);
  });
  return () => {
    stopped = true;
    stopScheduler();
    subscription?.unsubscribe();
  };
}
