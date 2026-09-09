// 시간순으로 정렬되는 순수 JS id: epoch ms의 base36 + 난수 꼬리.
// 단일 사용자 기기에서 충돌 확률은 무시 가능하고, 네이티브 의존성이 없다.
let lastMs = 0;
let seq = 0;

export function newId(now: number = Date.now()): string {
  if (now === lastMs) {
    seq += 1;
  } else {
    lastMs = now;
    seq = 0;
  }
  const time = now.toString(36).padStart(9, '0');
  const tail = Math.floor(Math.random() * 36 ** 4)
    .toString(36)
    .padStart(4, '0');
  return `${time}${seq.toString(36).padStart(2, '0')}${tail}`;
}
