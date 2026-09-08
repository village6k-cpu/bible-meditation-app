/* 밑줄 — 오프라인 껍데기.
   원칙 하나: 이 워커는 기록을 절대 만지지 않는다. 기록은 OPFS의 SQLite 파일에 있고,
   여기 있는 것은 앱을 열기 위한 껍데기(HTML·JS·wasm·글꼴)뿐이다.
   그래서 캐시를 통째로 비워도 잃는 것이 없다. */

const VERSION = 'v3';
const SHELL = `mitjul-shell-${VERSION}`;
const FONTS = `mitjul-fonts-${VERSION}`;

// 껍데기의 시작점. 나머지 자산은 이름에 해시가 박혀 있으므로 처음 열릴 때 채운다.
const ENTRY = new URL('./', self.registration.scope).pathname;

self.addEventListener('install', (ev) => {
  ev.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.add(new Request(ENTRY, { cache: 'reload' })))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL && k !== FONTS).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// 새 판이 준비됐을 때 페이지가 원하면 즉시 넘긴다
self.addEventListener('message', (ev) => {
  if (ev.data === 'skip-waiting') self.skipWaiting();
});

function cacheable(res) {
  // 리다이렉트된 응답(로그인 벽 등)은 껍데기로 굳히지 않는다 — 앱이 벽돌이 된다
  return res && res.ok && res.type === 'basic' && !res.redirected;
}

async function staleWhileRevalidate(cacheName, request, fallbackRequest) {
  const cache = await caches.open(cacheName);
  const key = fallbackRequest || request;
  const hit = await cache.match(key);
  const fetching = fetch(request)
    .then((res) => {
      if (cacheable(res) || (cacheName === FONTS && res && res.ok)) cache.put(key, res.clone());
      return res;
    })
    .catch(() => null);
  if (hit) {
    void fetching; // 배경에서 갱신 — 다음에 열 때 새 판
    return hit;
  }
  const res = await fetching;
  if (res) return res;
  throw new Error('offline');
}

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 글꼴 — 구글에서 오지만 오프라인에서도 글자가 흔들리지 않게 붙잡아 둔다
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    ev.respondWith(staleWhileRevalidate(FONTS, req).catch(() => Response.error()));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // 화면 이동 — 캐시 우선. 비행기 모드에서도 즉시 열리고, 새 판은 배경에서 받아 둔다.
  if (req.mode === 'navigate') {
    ev.respondWith(
      staleWhileRevalidate(SHELL, req, new Request(ENTRY)).catch(
        () =>
          new Response('오프라인입니다.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
      )
    );
    return;
  }

  // 해시가 박힌 자산·wasm·아이콘 — 캐시 우선
  if (/\.(js|css|wasm|png|svg|webmanifest|woff2?)$/.test(url.pathname)) {
    ev.respondWith(staleWhileRevalidate(SHELL, req).catch(() => Response.error()));
  }
});
