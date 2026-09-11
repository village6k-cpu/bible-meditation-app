import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { todayKey } from '@core/dates';
import { db as openDb } from '../db';
import type { WebDb } from '../db/sqlite';
import { markSyncPending } from '../sync/state';

// 화면은 상태를 들고 있지 않는다. SQLite가 유일한 진실이고, 화면은 그것을 다시 읽을 뿐이다.
// 무언가 쓰고 나면 bump()로 '다시 읽어라'라고만 말한다.
// 홈 화면 웹앱은 언제든 통째로 다시 시작될 수 있으니, 메모리에 든 것은 다 잃어도 좋아야 한다.

let revision = 0;
const listeners = new Set<() => void>();

export function bump(localChange = true): void {
  revision += 1;
  for (const l of listeners) l();
  if (localChange) {
    markSyncPending();
    window.dispatchEvent(new Event('ledger:local-change'));
  }
}

function useRevision(): number {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return revision;
}

export type Loadable<T> = { data: T; loading: boolean; error: string | null };

// deps가 바뀌거나 누가 bump()를 부르면 다시 읽는다. 늦게 도착한 응답은 버린다.
export function useLoad<T>(
  handle: WebDb | null,
  run: (d: WebDb) => Promise<T>,
  deps: readonly unknown[],
  initial: T
): Loadable<T> {
  const rev = useRevision();
  const [state, setState] = useState<Loadable<T>>({
    data: initial,
    loading: true,
    error: null,
  });
  const seq = useRef(0);
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    if (!handle) return;
    const mine = ++seq.current;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    runRef
      .current(handle)
      .then((data) => {
        if (cancelled || mine !== seq.current) return;
        setState({ data, loading: false, error: null });
      })
      .catch((e: unknown) => {
        if (cancelled || mine !== seq.current) return;
        setState((s) => ({
          ...s,
          loading: false,
          error: e instanceof Error ? e.message : String(e),
        }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, rev, ...deps]);

  return state;
}

export type Boot =
  | { phase: 'opening' }
  | { phase: 'ready'; handle: WebDb }
  | { phase: 'failed'; error: string };

export function useBoot(): Boot {
  const [boot, setBoot] = useState<Boot>({ phase: 'opening' });
  useEffect(() => {
    let alive = true;
    openDb()
      .then((handle) => alive && setBoot({ phase: 'ready', handle }))
      .catch(
        (e: unknown) =>
          alive &&
          setBoot({
            phase: 'failed',
            error: e instanceof Error ? e.message : String(e),
          })
      );
    return () => {
      alive = false;
    };
  }, []);
  return boot;
}

// 하루의 경계는 새벽 4시. 앱이 며칠씩 열린 채 있을 수 있으니 돌아올 때마다 다시 센다.
export function useToday(): string {
  const [day, setDay] = useState(todayKey);
  useEffect(() => {
    const check = () => setDay((prev) => (todayKey() === prev ? prev : todayKey()));
    const timer = setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return day;
}

export function useToast(): [string | null, (msg: string) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2600);
  }, []);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );
  return [msg, show];
}
