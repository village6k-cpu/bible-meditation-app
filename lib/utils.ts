export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return '고요한 새벽입니다';
  if (hour < 12) return '좋은 아침이에요';
  if (hour < 17) return '평안한 오후예요';
  if (hour < 21) return '편안한 저녁이에요';
  return '고요한 밤이에요';
}

export function formatDateKo(date: Date = new Date()): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const dayName = dayNames[date.getDay()];
  return `${month}월 ${day}일 ${dayName}`;
}

// Local calendar date (never UTC): a diary entry written at 11pm belongs to that day.
export function getISODate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// SQLite datetime('now') stores UTC as 'YYYY-MM-DD HH:MM:SS' with no zone marker;
// parse it as UTC so local getters show the user's wall-clock time
export function parseSqliteUtc(dt: string): Date {
  return new Date(dt.includes('T') ? dt : `${dt.replace(' ', 'T')}Z`);
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatISODateKo(iso: string): string {
  return formatDateKo(parseISODate(iso));
}

export function addDays(iso: string, n: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return getISODate(d);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const ms = parseISODate(toIso).getTime() - parseISODate(fromIso).getTime();
  return Math.round(ms / 86400000);
}

export function getWeekDates(): Date[] {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((day + 6) % 7));

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}
