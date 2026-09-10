import type { JSX } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { EntryType } from '@core/types';
import { Icon, type IconName } from './icons';
import { Inbox } from './screens/Inbox';
import { Records } from './screens/Records';
import { Review } from './screens/Review';
import { Metrics } from './screens/Metrics';
import { CaptureSheet } from './sheets/Capture';
import { DetailSheet } from './sheets/Detail';
import { SettingsSheet } from './sheets/Settings';
import { SourcesSheet } from './sheets/Sources';
import { bump, useBoot, useToast, useToday } from './store';
import { canIntakeSafely, consumeFromUrl, peekFromUrl, writeClipboard } from '../platform/intake';
import { requestPersistence } from '../platform/install';
import { startAutoSync } from '../sync';

type Tab = 'inbox' | 'records' | 'review' | 'metrics';

type View =
  | { kind: 'capture'; type: EntryType | null; text: string }
  | { kind: 'detail'; id: string }
  | { kind: 'settings' }
  | { kind: 'sources' };

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
  // 시트는 쌓인다 — 상세에서 상세를 열 수 있으므로 하나만 들고 있으면 뒤로가기가 전부를 걷어낸다
  const [stack, setStack] = useState<View[]>([]);
  const [toast, showToast] = useToast();
  const [stranded, setStranded] = useState<string | null>(null);
  // 지금 맨 위 시트가 '닫아도 되는지' 대답하는 자리 (쓰던 글이 있으면 아니라고 한다)
  const guard = useRef<null | (() => boolean)>(null);

  const view = stack.length > 0 ? stack[stack.length - 1] : null;

  // 여는 쪽만 히스토리를 쌓고, 닫는 쪽은 언제나 history.back() 하나로 간다.
  // 그래야 뒤로가기 스와이프와 버튼이 같은 길을 지나고 두 번 닫히는 일이 없다.
  const push = useCallback((v: View) => {
    setStack((s) => [...s, v]);
    history.pushState({ sheet: true }, '');
  }, []);
  const close = useCallback(() => history.back(), []);
  const setGuard = useCallback((fn: null | (() => boolean)) => {
    guard.current = fn;
  }, []);

  const openDetail = useCallback((id: string) => push({ kind: 'detail', id }), [push]);
  const compose = useCallback(
    (type: EntryType | null, text = '') => push({ kind: 'capture', type, text }),
    [push]
  );

  useEffect(() => {
    const onPop = () => {
      const ok = guard.current ? guard.current() : true;
      if (!ok) {
        // 되돌아온 칸을 다시 쌓아 둔다 — 시트는 그대로 남는다
        history.pushState({ sheet: true }, '');
        return;
      }
      guard.current = null;
      setStack((s) => s.slice(0, -1));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // 저장소를 '지워도 되는 것'이 아니라 '지키는 것'으로 — 열자마자 한 번 요청한다
  useEffect(() => {
    void requestPersistence();
  }, []);

  // 주소에 실려 온 글. 설치한 앱 안이면 캡처 칸으로 넣고, 아니면 주소를 건드리지 않고
  // 화면에 남겨 둔다 — Safari 탭의 저장소는 설치한 앱과 다른 통이라 여기 저장하면 앱에서 안 보인다.
  useEffect(() => {
    if (boot.phase !== 'ready') return;
    const incoming = peekFromUrl();
    if (!incoming) return;
    if (canIntakeSafely()) {
      consumeFromUrl();
      compose(null, incoming.text);
    } else {
      setStranded(incoming.text);
    }
  }, [boot.phase, compose]);

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

  // 계정이 연결돼 있으면 열 때·온라인 복귀 때·30초마다 조용히 맞춘다.
  // 원격 변경을 받은 뒤에는 SQLite를 다시 읽어 화면도 같은 상태로 만든다.
  useEffect(() => {
    if (boot.phase !== 'ready') return;
    return startAutoSync(boot.handle, bump);
  }, [boot]);

  // Google에서 돌아오면 연결 결과가 있는 보관 화면으로 안내한다.
  // 인증 코드 정리는 SDK에 맡기고, 화면 표시용 표지만 한 번 소비한다.
  useEffect(() => {
    if (boot.phase !== 'ready') return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('sync') !== '1') return;
    url.searchParams.delete('sync');
    history.replaceState(history.state, '', url);
    push({ kind: 'settings' });
  }, [boot.phase, push]);

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
        {stranded !== null && (
          <div class="notice">
            <span style="color:var(--ink)">
              <Icon name="alert" />
            </span>
            <div style="min-width:0">
              <div class="body-t">이 창에 저장하면 설치한 앱에서 보이지 않습니다</div>
              <div class="cap" style="margin-top:2px; overflow-wrap:anywhere">
                {stranded}
              </div>
              <div class="notice-actions">
                <button
                  class="chip on"
                  onClick={() => {
                    void writeClipboard(stranded).then((ok) =>
                      showToast(
                        ok
                          ? '복사했습니다 — 홈 화면의 Ledger에서 붙여넣으세요'
                          : '복사하지 못했습니다'
                      )
                    );
                  }}
                >
                  복사하기
                </button>
                <button
                  class="chip"
                  onClick={() => {
                    consumeFromUrl();
                    compose(null, stranded);
                    setStranded(null);
                  }}
                >
                  그래도 여기 적기
                </button>
                <button class="chip" onClick={() => setStranded(null)}>
                  버리기
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'inbox' && (
          <Inbox
            handle={handle}
            today={today}
            onOpen={openDetail}
            onCompose={(t, text) => compose(t, text)}
            onReview={() => setTab('review')}
            toast={showToast}
          />
        )}
        {tab === 'records' && <Records handle={handle} today={today} onOpen={openDetail} />}
        {tab === 'review' && <Review handle={handle} today={today} onOpen={openDetail} />}
        {tab === 'metrics' && (
          <Metrics
            handle={handle}
            today={today}
            onOpen={openDetail}
            onCompose={(t, text) => compose(t, text)}
            onSettings={() => push({ kind: 'settings' })}
            onSources={() => push({ kind: 'sources' })}
          />
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
        {/* 토스트는 탭바 위에 뜬다 — 탭을 가리고 탭을 삼키지 않도록 */}
        {toast && <div class="toast">{toast}</div>}
      </nav>

      <div class="modal-root">
        {view?.kind === 'capture' && (
          <CaptureSheet
            handle={handle}
            presetType={view.type}
            presetText={view.text}
            onClose={close}
            setGuard={setGuard}
            toast={showToast}
          />
        )}
        {view?.kind === 'detail' && (
          <DetailSheet handle={handle} id={view.id} onClose={close} onOpen={openDetail} />
        )}
        {view?.kind === 'settings' && (
          <SettingsSheet handle={handle} onClose={close} toast={showToast} />
        )}
        {view?.kind === 'sources' && (
          <SourcesSheet handle={handle} onClose={close} toast={showToast} />
        )}
      </div>
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
