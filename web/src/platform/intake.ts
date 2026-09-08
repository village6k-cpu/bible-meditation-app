// 바깥에서 들어오는 글을 받는 두 개의 문.
//
// 1) 주소로 (`#add=…` 또는 `?add=…`) — 데스크톱과 앱 안에서는 이게 가장 빠르다.
// 2) 클립보드로 — iOS에서는 이쪽이 유일하게 '옳은' 문이다.
//
// iOS에서 단축어의 'URL 열기'는 설치한 홈 화면 웹앱이 아니라 Safari를 연다(웹앱을 주소로
// 부르는 표준 수단인 Launch Handler API가 WebKit에 없다). 그런데 Safari 탭의 저장소는
// 홈 화면 웹앱의 저장소와 다른 통이다. 그러니 주소로 들어온 글을 Safari 탭에서 저장하면
// 설치한 앱에서는 영영 보이지 않는다.
// 그래서 단축어는 '주소를 열지' 않고 '클립보드에 담고', 사용자는 홈 화면의 밑줄을 열어
// 붙여넣기 한 번을 누른다. 아래 canIntakeSafely가 그 경계를 지킨다.

import { isStandalone } from './install';

export interface Intake {
  text: string;
  fromUrl: boolean;
}

const KEYS = ['add', 'text', 'u', 'url'];

function pick(params: URLSearchParams): string | null {
  for (const k of KEYS) {
    const v = params.get(k);
    if (v && v.trim()) return v.trim();
  }
  return null;
}

// 주소에 실려 온 글을 읽는다. 여기서는 절대 지우지 않는다 —
// 받을 수 없는 창이라고 판단해 놓고 주소부터 비우면 사용자가 공유한 글이 그대로 없어진다.
export function peekFromUrl(): Intake | null {
  const url = new URL(window.location.href);
  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  const text = pick(new URLSearchParams(hash)) ?? pick(url.searchParams);
  return text ? { text, fromUrl: true } : null;
}

// 실제로 받아 넣은 뒤에만 주소를 비운다 — 새로고침해도 두 번 들어오지 않게
export function consumeFromUrl(): void {
  const url = new URL(window.location.href);
  for (const k of KEYS) url.searchParams.delete(k);
  url.hash = '';
  window.history.replaceState(null, '', url.pathname + url.search);
}

// 주소로 들어온 글을 이 창에서 저장해도 되는가.
// 설치한 앱 안이면 그렇다. Safari 탭이면 — 저장은 되지만 설치한 앱에서는 보이지 않는다.
export function canIntakeSafely(): boolean {
  return isStandalone();
}

// 클립보드에 '쓰는' 것은 읽기와 달리 사용자 제스처 안이면 조용히 된다
export async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export type ClipboardResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'empty' | 'denied' | 'unsupported' };

export async function readClipboard(): Promise<ClipboardResult> {
  if (!navigator.clipboard?.readText) return { ok: false, reason: 'unsupported' };
  try {
    const text = (await navigator.clipboard.readText()).trim();
    return text ? { ok: true, text } : { ok: false, reason: 'empty' };
  } catch {
    // iOS는 붙여넣기 확인을 사용자가 무시하면 여기로 온다
    return { ok: false, reason: 'denied' };
  }
}
