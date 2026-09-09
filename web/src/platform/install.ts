// 설치 여부는 이 앱에서 취향 문제가 아니라 데이터 문제다.
//
// iOS의 홈 화면 웹앱은 Safari와 '다른 저장 통'을 쓴다(WWDC23 10120: "separate cookies and
// storage from the browser"). 그래서 Safari 탭에서 적은 기록은 설치한 앱에서 보이지 않는다.
// 게다가 Safari 탭 쪽 통은 ITP의 7일 규칙(Safari를 쓴 날 기준) 대상이라 언젠가 지워진다.
// 반대로 홈 화면 웹앱의 저장소는 그 규칙에서 면제된다.
//
// 결론: 첫 기록을 적기 전에 설치부터 해야 한다. 앱은 그것을 감춰서는 안 된다.

export function isStandalone(): boolean {
  const legacy = (navigator as unknown as { standalone?: boolean }).standalone;
  return (
    legacy === true ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches
  );
}

export function isIOS(): boolean {
  const ua = navigator.userAgent;
  // iPadOS는 데스크톱 Safari로 위장한다 — 터치 지원으로 가려낸다
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

// 브라우저가 저장소를 '지워도 되는 것'이 아니라 '지키는 것'으로 다루게 한다.
// WebKit은 홈 화면 웹앱일 때 이 요청을 더 잘 받아들인다.
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function persisted(): Promise<boolean> {
  try {
    return (await navigator.storage?.persisted?.()) ?? false;
  } catch {
    return false;
  }
}

export async function storageUsed(): Promise<number | null> {
  try {
    const est = await navigator.storage?.estimate?.();
    return est?.usage ?? null;
  } catch {
    return null;
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}
