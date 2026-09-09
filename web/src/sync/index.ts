import type { Session } from '@supabase/supabase-js';
import { asSqlite } from '../db';
import type { WebDb } from '../db/sqlite';
import { bindSyncAccount, syncOnce, type SyncResult } from '@db/syncEngine';
import { supabase } from './client';
import { createSupabaseSyncApi } from './supabaseApi';
import { processPendingPhotos } from './photos';

export type SyncState =
  | { phase: 'signed-out'; email: null; lastSyncedAt: null; error: null }
  | { phase: 'idle' | 'syncing'; email: string; lastSyncedAt: number | null; error: null }
  | { phase: 'error'; email: string; lastSyncedAt: number | null; error: string };

let state: SyncState = { phase: 'signed-out', email: null, lastSyncedAt: null, error: null };
let active: Promise<SyncResult> | null = null;
const listeners = new Set<(next: SyncState) => void>();

function publish(next: SyncState): void {
  state = next;
  for (const listener of listeners) listener(next);
}

function emailOf(session: Session): string {
  return session.user.email ?? '연결된 계정';
}

export function getSyncState(): SyncState {
  return state;
}

export function subscribeSyncState(listener: (next: SyncState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function signInForSync(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error('로그인하지 못했습니다. 이메일과 비밀번호를 확인하세요.');
}

export async function signOutFromSync(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function syncNow(handle: WebDb): Promise<SyncResult> {
  if (active) return active;
  active = (async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error(error.message);
    const session = data.session;
    if (!session) throw new Error('먼저 동기화 계정에 로그인하세요.');
    const email = emailOf(session);
    publish({ phase: 'syncing', email, lastSyncedAt: state.lastSyncedAt, error: null });
    try {
      const sqlite = asSqlite(handle);
      await bindSyncAccount(sqlite, session.user.id);
      // 사진 실패는 photo_jobs에 남고 본문 동기화는 계속 간다.
      await processPendingPhotos(handle).catch(() => null);
      const result = await syncOnce(sqlite, createSupabaseSyncApi(supabase, session.user.id));
      await processPendingPhotos(handle).catch(() => null);
      await handle.flush();
      publish({ phase: 'idle', email, lastSyncedAt: Date.now(), error: null });
      return result;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      publish({ phase: 'error', email, lastSyncedAt: state.lastSyncedAt, error: message });
      throw reason;
    }
  })().finally(() => { active = null; });
  return active;
}

export function startAutoSync(handle: WebDb, onApplied: () => void): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  const run = (): void => {
    if (stopped || !navigator.onLine) return;
    void syncNow(handle).then(onApplied).catch(() => {});
  };
  const setSession = (session: Session | null): void => {
    if (!session) {
      publish({ phase: 'signed-out', email: null, lastSyncedAt: null, error: null });
      return;
    }
    publish({ phase: 'idle', email: emailOf(session), lastSyncedAt: state.lastSyncedAt, error: null });
    queueMicrotask(run);
  };
  const onVisible = (): void => {
    if (document.visibilityState === 'visible') run();
  };

  void supabase.auth.getSession().then(({ data }) => setSession(data.session));
  const { data: auth } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
  window.addEventListener('online', run);
  document.addEventListener('visibilitychange', onVisible);
  timer = setInterval(run, 30_000);

  return () => {
    stopped = true;
    if (timer) clearInterval(timer);
    auth.subscription.unsubscribe();
    window.removeEventListener('online', run);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
