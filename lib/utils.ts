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

export function getISODate(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
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
