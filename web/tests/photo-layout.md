# 상세 사진 잘림 회귀 검사

실제 렌더링이 필요한 검사다. `npm test`의 DOM 없는 테스트 수에는 포함하지 않는다.

1. 사진이 있는 테스트 기록을 열고 이미지가 표시될 때까지 기다린다.
2. 390×844와 1280×900에서 각각 아래 읽기 전용 검사를 실행한다.
3. 상세 화면을 스크롤해 사진 전체와 그 아래 본문이 보이는지 스크린샷으로 확인한다.
4. 새로고침하고 같은 기록을 다시 열어 반복한다.

```js
const image = document.querySelector('img[alt="기록에 붙인 사진"]');
if (!image?.complete || !image.naturalWidth) {
  throw new Error('검사할 사진이 아직 표시되지 않았습니다.');
}
const imageHeight = image.getBoundingClientRect().height;
const containerHeight = image.parentElement.getBoundingClientRect().height;
if (containerHeight + 1 < imageHeight) {
  throw new Error(`상세 사진이 잘립니다: 이미지 ${imageHeight}px, 영역 ${containerHeight}px`);
}
```

이 검사는 `.photo.full`이 세로 flex 레이아웃에서 줄어들어 `overflow: hidden`으로
원본을 자르는 회귀를 잡는다. 최초 재현은 이미지 646px/영역 81.59375px였다.
상세 사진의 축소 방지를 제거하면 다시 실패해야 한다. 화면보다 긴 사진은 비율대로
유지하고 시트 본문을 스크롤한다. 화면 안에 모두 넣으려고 사진 자체를 자르지 않는다.
