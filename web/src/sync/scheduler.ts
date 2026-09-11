export interface SyncSchedulerOptions {
  window: EventTarget;
  document: EventTarget;
  canRun(): boolean;
  isVisible(): boolean;
  sync(): Promise<unknown>;
  onApplied(): void;
}

export function startSyncScheduler(options: SyncSchedulerOptions): () => void {
  let stopped = false;
  let running = false;
  let pending = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const request = (): void => {
    if (stopped) return;
    pending = true;
    if (running || timer || !options.canRun()) return;
    timer = setTimeout(() => {
      timer = null;
      if (stopped || !options.canRun()) return;
      pending = false;
      running = true;
      void options.sync().catch(() => {}).finally(() => {
        running = false;
        if (stopped) return;
        options.onApplied();
        if (pending) request();
      });
    }, 250);
  };
  const visible = (): void => { if (options.isVisible()) request(); };
  options.window.addEventListener('ledger:local-change', request);
  options.window.addEventListener('ledger:sync-request', request);
  options.window.addEventListener('online', request);
  options.document.addEventListener('visibilitychange', visible);
  const poll = setInterval(request, 30_000);
  request();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    clearInterval(poll);
    options.window.removeEventListener('ledger:local-change', request);
    options.window.removeEventListener('ledger:sync-request', request);
    options.window.removeEventListener('online', request);
    options.document.removeEventListener('visibilitychange', visible);
  };
}
