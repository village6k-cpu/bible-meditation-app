// iOS의 키보드는 레이아웃을 밀지 않고 덮는다. `interactive-widget=resizes-content`는
// WebKit에 없다 — 시각 뷰포트를 직접 읽어 CSS 변수로 넘기는 수밖에 없다.
//
// --vv-h   : 지금 실제로 보이는 높이 (키보드가 덮은 만큼 줄어든 값)
// --vv-top : 시각 뷰포트가 레이아웃 뷰포트에서 밀려난 양
//
// iOS 26에는 키보드가 닫혀도 offsetTop이 0으로 돌아오지 않는 경우가 있어,
// focusout 뒤에 한 번 더 읽어 바로잡는다.

let installed = false;

function apply(): void {
  const vv = window.visualViewport;
  const root = document.documentElement;
  if (!vv) {
    root.style.setProperty('--vv-h', `${window.innerHeight}px`);
    root.style.setProperty('--vv-top', '0px');
    return;
  }
  root.style.setProperty('--vv-h', `${Math.round(vv.height)}px`);
  root.style.setProperty('--vv-top', `${Math.round(vv.offsetTop)}px`);
  // 키보드가 덮은 높이 — 고정 바의 아래 여백에 쓴다
  const covered = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
  root.style.setProperty('--kb', `${covered}px`);
}

export function trackViewport(): void {
  if (installed) return;
  installed = true;
  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      apply();
    });
  };
  apply();
  const vv = window.visualViewport;
  vv?.addEventListener('resize', schedule);
  vv?.addEventListener('scroll', schedule);
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  // 키보드가 닫힌 뒤 남는 잔여 오프셋 바로잡기
  document.addEventListener('focusout', () => {
    schedule();
    setTimeout(schedule, 120);
    setTimeout(schedule, 400);
  });
}
