// 이 모듈이 앱 전체에서 day 키('YYYY-MM-DD')를 만드는 유일한 곳이다.
// 새벽 4시 이전의 기록은 전날에 속한다 — 자정 넘어 쓴 일기는 어제의 일기니까.
export const DAY_ROLLOVER_HOUR = 4;

export type DayKey = string; // 'YYYY-MM-DD', device-local

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function dayKeyOf(date: Date): DayKey {
  const shifted = new Date(date.getTime() - DAY_ROLLOVER_HOUR * 3600_000);
  return `${shifted.getFullYear()}-${pad2(shifted.getMonth() + 1)}-${pad2(shifted.getDate())}`;
}

export function todayKey(now: Date = new Date()): DayKey {
  return dayKeyOf(now);
}

export function parseDayKey(day: DayKey): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(day: DayKey, n: number): DayKey {
  const d = parseDayKey(day);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function daysBetween(from: DayKey, to: DayKey): number {
  return Math.round((parseDayKey(to).getTime() - parseDayKey(from).getTime()) / 86400_000);
}

// 'MM-DD' — 'n년 전 오늘' 조회 키 (DB의 substr(day, 6)과 동일해야 한다)
export function annKeyOf(day: DayKey): string {
  return day.slice(5);
}

const DOW_KO = ['일', '월', '화', '수', '목', '금', '토'];

export function formatDayKo(day: DayKey): string {
  const d = parseDayKey(day);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${DOW_KO[d.getDay()]}요일`;
}

export function formatDayShortKo(day: DayKey): string {
  const d = parseDayKey(day);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// '오늘' / '어제' / 'n일 전' / 'n년 전 오늘'과 같은 상대 표현의 재료
export function agoLabelKo(day: DayKey, today: DayKey): string {
  const diff = daysBetween(day, today);
  if (diff <= 0) return '오늘';
  if (diff === 1) return '어제';
  if (annKeyOf(day) === annKeyOf(today) && diff >= 365) {
    const years = Math.round(diff / 365.25);
    return `${years}년 전 오늘`;
  }
  if (diff >= 365) {
    const years = Math.floor(diff / 365.25);
    return `${years}년 전`;
  }
  return `${diff}일 전`;
}

// 월요일 시작 주 — 흐름 탭의 주간 집계 단위
export function mondayOf(day: DayKey): DayKey {
  const d = parseDayKey(day);
  const shift = (d.getDay() + 6) % 7;
  return addDays(day, -shift);
}

export function rangeOfDays(from: DayKey, to: DayKey): DayKey[] {
  const out: DayKey[] = [];
  let d = from;
  while (d <= to) {
    out.push(d);
    d = addDays(d, 1);
  }
  return out;
}

// FNV-1a — day 문자열을 32비트 시드로. 플랫폼 무관 결정적.
export function hashDay(day: DayKey): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < day.length; i++) {
    h ^= day.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// mulberry32 — 시드 고정 시 동일한 난수열. '같은 날엔 같은 카드'라는 약속의 기반.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
