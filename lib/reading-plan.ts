export interface DayReading {
  bookId: number;
  startChapter: number;
  endChapter: number;
}

// 전체 성경 66권 장수
const BOOKS: { id: number; name: string; chapters: number }[] = [
  { id: 1, name: '창세기', chapters: 50 }, { id: 2, name: '출애굽기', chapters: 40 },
  { id: 3, name: '레위기', chapters: 27 }, { id: 4, name: '민수기', chapters: 36 },
  { id: 5, name: '신명기', chapters: 34 }, { id: 6, name: '여호수아', chapters: 24 },
  { id: 7, name: '사사기', chapters: 21 }, { id: 8, name: '룻기', chapters: 4 },
  { id: 9, name: '사무엘상', chapters: 31 }, { id: 10, name: '사무엘하', chapters: 24 },
  { id: 11, name: '열왕기상', chapters: 22 }, { id: 12, name: '열왕기하', chapters: 25 },
  { id: 13, name: '역대상', chapters: 29 }, { id: 14, name: '역대하', chapters: 36 },
  { id: 15, name: '에스라', chapters: 10 }, { id: 16, name: '느헤미야', chapters: 13 },
  { id: 17, name: '에스더', chapters: 10 }, { id: 18, name: '욥기', chapters: 42 },
  { id: 19, name: '시편', chapters: 150 }, { id: 20, name: '잠언', chapters: 31 },
  { id: 21, name: '전도서', chapters: 12 }, { id: 22, name: '아가', chapters: 8 },
  { id: 23, name: '이사야', chapters: 66 }, { id: 24, name: '예레미야', chapters: 52 },
  { id: 25, name: '예레미야애가', chapters: 5 }, { id: 26, name: '에스겔', chapters: 48 },
  { id: 27, name: '다니엘', chapters: 12 }, { id: 28, name: '호세아', chapters: 14 },
  { id: 29, name: '요엘', chapters: 3 }, { id: 30, name: '아모스', chapters: 9 },
  { id: 31, name: '오바댜', chapters: 1 }, { id: 32, name: '요나', chapters: 4 },
  { id: 33, name: '미가', chapters: 7 }, { id: 34, name: '나훔', chapters: 3 },
  { id: 35, name: '하박국', chapters: 3 }, { id: 36, name: '스바냐', chapters: 3 },
  { id: 37, name: '학개', chapters: 2 }, { id: 38, name: '스가랴', chapters: 14 },
  { id: 39, name: '말라기', chapters: 4 }, { id: 40, name: '마태복음', chapters: 28 },
  { id: 41, name: '마가복음', chapters: 16 }, { id: 42, name: '누가복음', chapters: 24 },
  { id: 43, name: '요한복음', chapters: 21 }, { id: 44, name: '사도행전', chapters: 28 },
  { id: 45, name: '로마서', chapters: 16 }, { id: 46, name: '고린도전서', chapters: 16 },
  { id: 47, name: '고린도후서', chapters: 13 }, { id: 48, name: '갈라디아서', chapters: 6 },
  { id: 49, name: '에베소서', chapters: 6 }, { id: 50, name: '빌립보서', chapters: 4 },
  { id: 51, name: '골로새서', chapters: 4 }, { id: 52, name: '데살로니가전서', chapters: 5 },
  { id: 53, name: '데살로니가후서', chapters: 3 }, { id: 54, name: '디모데전서', chapters: 6 },
  { id: 55, name: '디모데후서', chapters: 4 }, { id: 56, name: '디도서', chapters: 3 },
  { id: 57, name: '빌레몬서', chapters: 1 }, { id: 58, name: '히브리서', chapters: 13 },
  { id: 59, name: '야고보서', chapters: 5 }, { id: 60, name: '베드로전서', chapters: 5 },
  { id: 61, name: '베드로후서', chapters: 3 }, { id: 62, name: '요한일서', chapters: 5 },
  { id: 63, name: '요한이서', chapters: 1 }, { id: 64, name: '요한삼서', chapters: 1 },
  { id: 65, name: '유다서', chapters: 1 }, { id: 66, name: '요한계시록', chapters: 22 },
];

// 1189 chapters / 365 days ≈ 3.26 chapters/day
function generateYearlyPlan(): DayReading[][] {
  const plan: DayReading[][] = [];
  let bookIdx = 0;
  let chapterIdx = 1;

  for (let day = 0; day < 365; day++) {
    const readings: DayReading[] = [];
    let chaptersLeft = day < 364 ? 3 : 100; // 마지막 날 나머지 전부

    // 시편은 하루 5편씩 (150편이라 많으니까)
    if (BOOKS[bookIdx]?.id === 19) chaptersLeft = 5;

    while (chaptersLeft > 0 && bookIdx < BOOKS.length) {
      const book = BOOKS[bookIdx];
      const remaining = book.chapters - chapterIdx + 1;
      const take = Math.min(chaptersLeft, remaining);

      readings.push({
        bookId: book.id,
        startChapter: chapterIdx,
        endChapter: chapterIdx + take - 1,
      });

      chapterIdx += take;
      chaptersLeft -= take;

      if (chapterIdx > book.chapters) {
        bookIdx++;
        chapterIdx = 1;
      }
    }

    if (readings.length > 0) plan.push(readings);
  }

  return plan;
}

let _plan: DayReading[][] | null = null;

function getPlan(): DayReading[][] {
  if (!_plan) _plan = generateYearlyPlan();
  return _plan;
}

export function getDayNumber(startDate: string): number {
  const start = new Date(startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return (diff % 365) + 1;
}

export function getTodaysPlan(startDate: string): { day: number; readings: DayReading[] } {
  const day = getDayNumber(startDate);
  const plan = getPlan();
  const index = Math.min(day - 1, plan.length - 1);
  return { day, readings: plan[index] || [] };
}

export function getBookName(bookId: number): string {
  return BOOKS.find((b) => b.id === bookId)?.name ?? '';
}

export function getTotalDays(): number {
  return getPlan().length;
}
