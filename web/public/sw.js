/* Ledger — 오프라인 껍데기.
   원칙 하나: 이 워커는 기록을 절대 만지지 않는다. 기록은 OPFS의 SQLite 파일에 있고,
   여기 있는 것은 앱을 열기 위한 껍데기(HTML·JS·wasm·글꼴)뿐이다.
   그래서 캐시를 통째로 비워도 잃는 것이 없다.

   두 번째 원칙: HTML과 그 HTML이 가리키는 자산은 함께 움직인다.
   새 index.html만 캐시에 들여놓고 그것이 부르는 해시 붙은 자산을 받아 두지 않으면
   다음에 비행기 모드로 열었을 때 앱은 빈 화면이 된다. 그래서 빌드가 자산 목록을 여기 박아 준다. */

// 빌드가 갈아 끼운다 (vite.config.ts의 precache 플러그인)
const BUILD = '__BUILD_ID__';
const ASSETS = __PRECACHE__;

const SHELL = `mitjul-shell-${BUILD}`;
const FONTS = 'mitjul-fonts-v1'; // 글꼴은 빌드마다 바뀌지 않는다 — 판을 넘겨 가며 재사용한다

// 껍데기의 시작점. 프로젝트 페이지처럼 하위 경로에 놓여도 스코프에서 뽑아 쓴다.
const ENTRY = new URL('./', self.registration.scope).pathname;

const shellUrls = () => [ENTRY, ...ASSETS.map((a) => new URL(a, self.registration.scope).pathname)];

self.addEventListener('install', (ev) => {
  ev.waitUntil(
    caches
      .open(SHELL)
      // 하나라도 실패하면 통째로 실패한다 — 반쪽짜리 껍데기가 굳는 것보다 낫다
      .then((c) => c.addAll(shellUrls().map((u) => new Request(u, { cache: 'reload' }))))
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

// 껍데기는 install에서 통째로 받아 두었으므로 여기서는 캐시가 먼저다.
// 새 판은 activate 때 새 SHELL 이름으로 통째로 들어온다 — 낱개로 갈아 끼우지 않는다.
async function fromShell(request) {
  const cache = await caches.open(SHELL);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (cacheable(res)) cache.put(request, res.clone());
  return res;
}

async function fonts(request) {
  const cache = await caches.open(FONTS);
  const hit = await cache.match(request);
  const fetching = fetch(request)
    .then((res) => {
      // 글꼴 CSS는 crossorigin으로 부르므로 ok가 온다. 혹시 불투명하게 와도 받아 둔다.
      if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  if (hit) {
    void fetching; // 배경에서 갱신
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
    ev.respondWith(fonts(req).catch(() => Response.error()));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // 화면 이동. 앱의 시작점만 ENTRY로 갈음하고, selftest.html 같은 다른 문서는
  // 자기 주소 그대로 다룬다 — 그러지 않으면 점검 페이지가 앱 껍데기를 덮어쓴다.
  if (req.mode === 'navigate') {
    const isShell = url.pathname === ENTRY || url.pathname === ENTRY + 'index.html';
    ev.respondWith(
      fromShell(isShell ? new Request(ENTRY) : req).catch(
        () =>
          new Response('오프라인입니다.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
      )
    );
    return;
  }

  // 워커 자신은 절대 캐시에 굳히지 않는다 — 굳으면 갱신의 입구가 막힌다
  if (url.pathname === ENTRY + 'sw.js') return;

  // 해시가 박힌 자산·wasm·아이콘
  if (/\.(js|css|wasm|png|svg|webmanifest|woff2?)$/.test(url.pathname)) {
    ev.respondWith(fromShell(req).catch(() => Response.error()));
  }
});
