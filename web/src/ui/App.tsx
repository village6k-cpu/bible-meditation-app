import type { JSX } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';
import type { EntryType } from '@core/types';
import { Icon, type IconName } from './icons';
import { Inbox } from './screens/Inbox';
import { Records } from './screens/Records';
import { Review } from './screens/Review';
import { Metrics } from './screens/Metrics';
import { CaptureSheet } from './sheets/Capture';
import { DetailSheet } from './sheets/Detail';
import { SettingsSheet } from './sheets/Settings';
import { useBoot, useToast, useToday } from './store';
import { canIntakeSafely, takeFromUrl } from '../platform/intake';
import { requestPersistence } from '../platform/install';

type Tab = 'inbox' | 'records' | 'review' | 'metrics';

type View =
  | null
  | { kind: 'capture'; type: EntryType | null; text: string }
  | { kind: 'detail'; id: string }
  | { kind: 'settings' };

const TABS: [Tab, string, IconName][] = [
  ['inbox', '수집함', 'inbox'],
  ['records', '기록', 'records'],
  ['review', '검토', 'review'],
  ['metrics', '지표', 'metrics'],
];

export function App(): JSX.Element {
  const boot = useBoot();
  const today = useToday();
  const [tab, setTab] = useState<Tab>('inbox');
  const [view, setView] = useState<View>(null);
  const [toast, showToast] = useToast();

  const openDetail = useCallback((id: string) => setView({ kind: 'detail', id }), []);
  const compose = useCallback(
    (type: EntryType | null, text = '') => setView({ kind: 'capture', type, text }),
    []
  );
  const close = useCallback(() => setView(null), []);

  // 뒤로가기(스와이프 포함)로 시트가 닫히게 — 열 때 한 칸을 쌓고 닫을 때 되돌린다
  useEffect(() => {
    if (!view) return;
    history.pushState({ sheet: true }, '');
    const onPop = () => setView(null);
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (history.state?.sheet) history.back();
    };
  }, [view !== null]);

  // 저장소를 '지워도 되는 것'이 아니라 '지키는 것'으로 — 열자마자 한 번 요청한다
  useEffect(() => {
    void requestPersistence();
  }, []);

  // 주소에 실려 온 글 — 설치한 앱 안에서만 받는다.
  // Safari 탭의 저장소는 설치한 앱과 다른 통이라, 여기서 저장하면 앱에서는 보이지 않는다.
  useEffect(() => {
    if (boot.phase !== 'ready') return;
    const incoming = takeFromUrl();
    if (!incoming) return;
    if (canIntakeSafely()) compose(null, incoming.text);
    else
      showToast(
        '홈 화면에 추가한 앱에서 열어야 같은 기록함에 담깁니다 — 이 창의 기록은 앱에서 보이지 않습니다'
      );
  }, [boot.phase, compose, showToast]);

  // 앱이 뒤로 갈 때가 마지막으로 저장할 수 있는 순간이다.
  // iOS는 앱을 쓸어 닫을 때 beforeunload/pagehide를 부르지 않는다.
  useEffect(() => {
    if (boot.phase !== 'ready') return;
    const handle = boot.handle;
    const flush = () => {
      if (document.visibilityState === 'hidden') void handle.flush();
    };
    document.addEventListener('visibilitychange', flush);
    return () => document.removeEventListener('visibilitychange', flush);
  }, [boot]);

  if (boot.phase === 'opening') {
    return <div class="boot">기록함을 여는 중…</div>;
  }
  if (boot.phase === 'failed') {
    return (
      <div class="boot">
        <div>기록함을 열지 못했습니다</div>
        <div style="max-width:34ch">{boot.error}</div>
      </div>
    );
  }

  const handle = boot.handle;

  return (
    <div class="app">
      <main class="screen" key={tab}>
        {tab === 'inbox' && (
          <Inbox
            handle={handle}
            today={today}
            onOpen={openDetail}
            onCompose={(t) => compose(t)}
            onReview={() => setTab('review')}
            toast={showToast}
          />
        )}
        {tab === 'records' && <Records handle={handle} today={today} onOpen={openDetail} />}
        {tab === 'review' && <Review handle={handle} today={today} onOpen={openDetail} />}
        {tab === 'metrics' && (
          <Metrics handle={handle} today={today} onSettings={() => setView({ kind: 'settings' })} />
        )}
      </main>

      <nav class="tabbar">
        {TABS.slice(0, 2).map(([key, label, icon]) => (
          <TabButton
            key={key}
            on={tab === key}
            label={label}
            icon={icon}
            onClick={() => setTab(key)}
          />
        ))}
        <button class="fab" aria-label="적기" onClick={() => compose(null)}>
          <Icon name="plus" width={2} />
        </button>
        {TABS.slice(2).map(([key, label, icon]) => (
          <TabButton
            key={key}
            on={tab === key}
            label={label}
            icon={icon}
            onClick={() => setTab(key)}
          />
        ))}
      </nav>

      <div class="modal-root">
        {view?.kind === 'capture' && (
          <CaptureSheet
            handle={handle}
            presetType={view.type}
            presetText={view.text}
            onClose={close}
            toast={showToast}
          />
        )}
        {view?.kind === 'detail' && (
          <DetailSheet handle={handle} id={view.id} onClose={close} onOpen={openDetail} />
        )}
        {view?.kind === 'settings' && (
          <SettingsSheet handle={handle} onClose={close} toast={showToast} />
        )}
      </div>

      {toast && <div class="toast">{toast}</div>}
    </div>
  );
}

function TabButton({
  on,
  label,
  icon,
  onClick,
}: {
  on: boolean;
  label: string;
  icon: IconName;
  onClick: () => void;
}): JSX.Element {
  return (
    <button class={on ? 'on' : undefined} aria-current={on ? 'page' : undefined} onClick={onClick}>
      <Icon name={icon} />
      <span>{label}</span>
      <span class="stroke" />
    </button>
  );
}
