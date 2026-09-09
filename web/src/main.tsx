import { render } from 'preact';
import { App } from './ui/App';
import { trackViewport } from './platform/viewport';
import './ui/styles.css';

trackViewport();

const root = document.getElementById('root');
if (root) render(<App />, root);

// 껍데기만 캐시한다 — 기록은 OPFS에 있고 워커는 그걸 만지지 않는다
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(new URL('sw.js', document.baseURI), {
      scope: './',
    });
  });
}
