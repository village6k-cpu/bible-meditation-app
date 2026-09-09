import { render } from 'preact';
import { App } from './ui/App';
import { trackViewport } from './platform/viewport';
import './ui/styles.css';

trackViewport();

const root = document.getElementById('root');
if (root) render(<App />, root);

// 껍데기만 캐시한다 — 기록은 OPFS에 있고 워커는 그걸 만지지 않는다.
//
// 갱신은 세 가지가 모두 있어야 실제로 사용자에게 닿는다. 하나라도 빠지면 고친 것이 기기에 안 온다.
// 1) updateViaCache: 'none' — GitHub Pages는 sw.js를 max-age=600으로 준다. 기본값이면 브라우저가
//    HTTP 캐시의 옛 sw.js를 그대로 써서 새 판을 보지도 못한다.
// 2) update() — 홈 화면 웹앱은 좀처럼 완전히 죽지 않는다. 열 때마다, 그리고 다시 앞으로 나올 때마다
//    직접 물어본다.
// 3) controllerchange에서 새로고침 — 새 워커가 넘겨받아도 이미 그려진 화면은 옛 HTML 그대로다.
//    한 번 다시 그려야 새 이름·새 화면이 보인다.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register(new URL('sw.js', document.baseURI), { scope: './', updateViaCache: 'none' })
      .then((reg) => {
        void reg.update();
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') void reg.update();
        });
      })
      .catch(() => {});
  });

  // 첫 설치(controller가 없던 상태)에서는 새로고침하지 않는다 — 그때는 이미 새 판을 보고 있다.
  let reloading = false;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });
}
