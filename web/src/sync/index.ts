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

export async function syncNow(handle: WebDb, retryPhotos = false): Promise<SyncResult> {
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
    // 사진이 실패해도 이미 받은 본문은 화면에 나타나야 한다.
    void syncNow(handle).catch(() => {}).finally(() => { if (!stopped) onApplied(); });
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
