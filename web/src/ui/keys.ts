// 한글 입력기에서 Enter는 두 번 온다 — 조합을 끝내는 keydown(isComposing)과 진짜 Enter.
// 이걸 안 거르면 '등록'이 두 번 눌린 것과 같아져 출처와 할 일이 둘씩 생긴다. 실제로 그랬다.
// keyCode 229는 isComposing을 안 주는 옛 WebKit이 조합 중임을 알리는 값이다.
export function isEnter(ev: KeyboardEvent): boolean {
  return ev.key === 'Enter' && !ev.isComposing && ev.keyCode !== 229;
}
