import { extractFirstUrl, parseVideoLink } from './links';
import { normalizeTags } from './tags';
import { EntryType, MealSlot } from './types';

// 한 칸에 아무거나 붙여넣으면 앱이 구조를 붙인다.
// 사용자가 유형을 고르고 필드를 채우는 대신, 쓴 글에서 신호를 읽어 유형과 필드를 정한다.
// 순수 함수 — 화면은 결과를 보여주고 한 번의 탭으로 뒤집을 수만 있으면 된다.

export type SignalKind =
  | 'url'
  | 'page'
  | 'verse'
  | 'tag'
  | 'minutes'
  | 'slot'
  | 'time'
  | 'quote'
  | 'done';

export interface Signal {
  kind: SignalKind;
  label: string; // 화면에 칩으로 보여줄 문구 ('p.57', '시편 23:1', '30분')
  start: number;
  end: number;
}

export interface Capture {
  type: EntryType;
  confident: boolean; // false면 유형 칩을 눈에 띄게 — 추측이라는 뜻
  title: string | null;
  subtitle: string | null; // 본문 주소 · 채널 · 저자
  quote: string | null;
  body: string | null;
  url: string | null;
  page: number | null;
  minutes: number | null;
  slot: MealSlot | null;
  dueTime: string | null;
  done: boolean;
  tags: string[];
  signals: Signal[];
  rest: string; // 신호를 걷어내고 남은 글
}

// 개역개정 책 이름과 표준 약어 — 긴 이름이 먼저 걸리도록 정렬해서 쓴다
const BIBLE_BOOKS = [
  ['창세기', '창'], ['출애굽기', '출'], ['레위기', '레'], ['민수기', '민'], ['신명기', '신'],
  ['여호수아', '수'], ['사사기', '삿'], ['룻기', '룻'], ['사무엘상', '삼상'], ['사무엘하', '삼하'],
  ['열왕기상', '왕상'], ['열왕기하', '왕하'], ['역대상', '대상'], ['역대하', '대하'],
  ['에스라', '스'], ['느헤미야', '느'], ['에스더', '에'], ['욥기', '욥'], ['시편', '시'],
  ['잠언', '잠'], ['전도서', '전'], ['아가', '아'], ['이사야', '사'], ['예레미야애가', '애'],
  ['예레미야', '렘'], ['에스겔', '겔'], ['다니엘', '단'], ['호세아', '호'], ['요엘', '욜'],
  ['아모스', '암'], ['오바댜', '옵'], ['요나', '욘'], ['미가', '미'], ['나훔', '나'],
  ['하박국', '합'], ['스바냐', '습'], ['학개', '학'], ['스가랴', '슥'], ['말라기', '말'],
  ['마태복음', '마'], ['마가복음', '막'], ['누가복음', '눅'], ['요한복음', '요'],
  ['사도행전', '행'], ['로마서', '롬'], ['고린도전서', '고전'], ['고린도후서', '고후'],
  ['갈라디아서', '갈'], ['에베소서', '엡'], ['빌립보서', '빌'], ['골로새서', '골'],
  ['데살로니가전서', '살전'], ['데살로니가후서', '살후'], ['디모데전서', '딤전'],
  ['디모데후서', '딤후'], ['디도서', '딛'], ['빌레몬서', '몬'], ['히브리서', '히'],
  ['야고보서', '약'], ['베드로전서', '벧전'], ['베드로후서', '벧후'],
  ['요한1서', '요일'], ['요한2서', '요이'], ['요한3서', '요삼'], ['유다서', '유'],
  ['요한계시록', '계'],
] as const;

// 약어 → 정식 이름. '시 23:1'도 '시편 23:1'로 적어 둔다.
const BOOK_BY_NAME = new Map<string, string>();
for (const [full, abbr] of BIBLE_BOOKS) {
  BOOK_BY_NAME.set(full, full);
  BOOK_BY_NAME.set(abbr, full);
}
const BOOK_ALTERNATION = Array.from(BOOK_BY_NAME.keys())
  .sort((a, b) => b.length - a.length)
  .join('|');

const VERSE_RE = new RegExp(
  `(${BOOK_ALTERNATION})\\s*(\\d{1,3})\\s*(?::|장\\s*)\\s*(\\d{1,3})(?:\\s*[-~–]\\s*(\\d{1,3}))?(?:\\s*절)?|(${BOOK_ALTERNATION})\\s*(\\d{1,3})\\s*장`,
  'g'
);

const TAG_RE = /#([\p{L}\p{N}_-]+)/gu;
const PAGE_RE = /\bp\.?\s*(\d{1,4})(?:\s*[-~]\s*\d{1,4})?|(\d{1,4})\s*(?:쪽|페이지)|(\d{1,4})\s*p\b/gi;
const HOUR_MIN_RE = /(\d{1,2})\s*시간(?:\s*(\d{1,2})\s*분)?/g;
const MIN_RE = /(\d{1,3})\s*분(?!\s*께)/g;
const AMPM_RE = /(오전|오후|아침|저녁)?\s*(\d{1,2})\s*시(?!간)(?:\s*(\d{1,2})\s*분)?(?:\s*까지)?/g;
const CLOCK_RE = /\b(\d{1,2}):(\d{2})\b(?:\s*까지)?/g;
const DONE_RE = /^\s*(?:-\s*)?\[( |x|X)\]\s*/;
const TODO_RE = /^\s*(?:todo|할\s?일)\s*[:：]\s*/i;
const QUOTE_RE = /[""]([^""]{2,})[""]|"([^"]{2,})"|^\s*>\s?(.+)$/gm;

const SLOT_RE =
  /(^|[^가-힣])(아침(?:밥|식사)?|점심(?:밥|식사)?|브런치|저녁(?:밥|식사)?|간식|야식|디저트)(?![가-힣])/;

function slotOf(word: string): MealSlot {
  if (word.startsWith('아침')) return 'breakfast';
  if (word.startsWith('점심') || word === '브런치') return 'lunch';
  if (word.startsWith('저녁')) return 'dinner';
  return 'snack';
}

const WORKOUT_WORDS =
  /운동|달리기|러닝|조깅|헬스|웨이트|요가|필라테스|수영|등산|자전거|라이딩|산책|스쿼트|데드리프트|턱걸이|푸시업|플랭크|클라이밍|축구|농구|테니스|배드민턴|줄넘기|스트레칭/;

const WRITING_WORDS = /^\s*(?:글|초고|원고|에세이)\s*[:：]/;
const WRITING_MIN_LENGTH = 280;

// 소비한 구간을 지워 가며 읽는다 — 앞서 잡은 신호를 뒤 규칙이 다시 집지 않도록
class Reader {
  private mask: boolean[];
  constructor(readonly text: string) {
    this.mask = new Array(text.length).fill(false);
  }
  free(start: number, end: number): boolean {
    for (let i = start; i < end; i += 1) if (this.mask[i]) return false;
    return true;
  }
  take(start: number, end: number): void {
    for (let i = start; i < end; i += 1) this.mask[i] = true;
  }
  rest(): string {
    let out = '';
    for (let i = 0; i < this.text.length; i += 1) if (!this.mask[i]) out += this.text[i];
    return out.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function parseCapture(input: string): Capture {
  const text = input ?? '';
  const reader = new Reader(text);
  const signals: Signal[] = [];
  const add = (kind: SignalKind, label: string, start: number, end: number): boolean => {
    if (!reader.free(start, end)) return false;
    reader.take(start, end);
    signals.push({ kind, label, start, end });
    return true;
  };

  // 1. 링크 — 가장 강한 신호
  let url: string | null = null;
  const found = extractFirstUrl(text);
  if (found) {
    const at = text.indexOf(found);
    const start = at >= 0 ? at : 0;
    const end = at >= 0 ? at + found.length : 0;
    if (at < 0 || add('url', found.replace(/^https?:\/\/(www\.)?/, ''), start, end)) url = found;
  }

  // 2. 해시태그
  const tagWords: string[] = [];
  for (const m of text.matchAll(TAG_RE)) {
    const start = m.index ?? 0;
    if (add('tag', `#${m[1]}`, start, start + m[0].length)) tagWords.push(m[1]);
  }

  // 3. 본문 주소 (시각보다 먼저 — '시편 23:1'의 콜론을 시각으로 읽지 않도록)
  let verse: string | null = null;
  for (const m of text.matchAll(VERSE_RE)) {
    const start = m.index ?? 0;
    const label = m[5]
      ? `${BOOK_BY_NAME.get(m[5])} ${m[6]}장`
      : `${BOOK_BY_NAME.get(m[1])} ${m[2]}:${m[3]}${m[4] ? `-${m[4]}` : ''}`;
    if (add('verse', label, start, start + m[0].length)) {
      verse = label;
      break;
    }
  }

  // 4. 쪽수
  let page: number | null = null;
  for (const m of text.matchAll(PAGE_RE)) {
    const start = m.index ?? 0;
    const n = Number(m[1] ?? m[2] ?? m[3]);
    if (!Number.isFinite(n)) continue;
    if (add('page', `p.${n}`, start, start + m[0].length)) {
      page = n;
      break;
    }
  }

  // 5. 시각 — '14:00', '오후 3시'
  let dueTime: string | null = null;
  for (const m of text.matchAll(CLOCK_RE)) {
    const start = m.index ?? 0;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) continue;
    const label = `${pad(h)}:${pad(min)}`;
    if (add('time', label, start, start + m[0].length)) {
      dueTime = label;
      break;
    }
  }
  if (!dueTime) {
    for (const m of text.matchAll(AMPM_RE)) {
      const start = m.index ?? 0;
      let h = Number(m[2]);
      const min = Number(m[3] ?? 0);
      if (h > 24 || min > 59) continue;
      const pm = m[1] === '오후' || m[1] === '저녁';
      if (pm && h < 12) h += 12;
      if (m[1] === '오전' && h === 12) h = 0;
      const label = `${pad(h % 24)}:${pad(min)}`;
      if (add('time', label, start, start + m[0].length)) {
        dueTime = label;
        break;
      }
    }
  }

  // 6. 시간(분) — 운동 길이
  let minutes: number | null = null;
  for (const m of text.matchAll(HOUR_MIN_RE)) {
    const start = m.index ?? 0;
    const total = Number(m[1]) * 60 + Number(m[2] ?? 0);
    if (add('minutes', `${total}분`, start, start + m[0].length)) {
      minutes = total;
      break;
    }
  }
  if (minutes === null) {
    for (const m of text.matchAll(MIN_RE)) {
      const start = m.index ?? 0;
      const n = Number(m[1]);
      if (n > 600) continue;
      if (add('minutes', `${n}분`, start, start + m[0].length)) {
        minutes = n;
        break;
      }
    }
  }

  // 7. 식사 때
  let slot: MealSlot | null = null;
  const slotMatch = SLOT_RE.exec(text);
  if (slotMatch) {
    const word = slotMatch[2];
    const start = (slotMatch.index ?? 0) + slotMatch[1].length;
    if (add('slot', word, start, start + word.length)) slot = slotOf(word);
  }

  // 8. 할 일 표시
  const doneMatch = DONE_RE.exec(text);
  const todoMatch = TODO_RE.exec(text);
  let done = false;
  let isTask = false;
  if (doneMatch) {
    done = doneMatch[1].toLowerCase() === 'x';
    isTask = add('done', done ? '완료' : '할 일', 0, doneMatch[0].length) || true;
  } else if (todoMatch) {
    isTask = add('done', '할 일', 0, todoMatch[0].length) || true;
  }

  // 9. 인용 — 따옴표로 감싸거나 '>'로 시작한 줄
  let quote: string | null = null;
  for (const m of text.matchAll(QUOTE_RE)) {
    const start = m.index ?? 0;
    const inner = (m[1] ?? m[2] ?? m[3] ?? '').trim();
    if (!inner) continue;
    if (add('quote', '인용', start, start + m[0].length)) {
      quote = inner;
      break;
    }
  }

  const rest = reader.rest();
  const tags = normalizeTags(tagWords);
  const video = url ? parseVideoLink(url) : null;

  // ─── 유형 결정 ───
  let typeGuess: EntryType;
  let confident = true;
  if (isTask) {
    typeGuess = 'task';
  } else if (url) {
    typeGuess = 'link';
  } else if (verse) {
    typeGuess = 'verse';
  } else if (page !== null) {
    typeGuess = 'book';
  } else if (slot !== null) {
    typeGuess = 'meal';
  } else if (WORKOUT_WORDS.test(rest) || (minutes !== null && !quote)) {
    typeGuess = 'workout';
    confident = WORKOUT_WORDS.test(rest);
  } else if (quote) {
    // 따옴표만 있으면 책일 확률이 높지만 확신하지는 않는다
    typeGuess = 'book';
    confident = false;
  } else if (dueTime) {
    typeGuess = 'task';
    confident = false;
  } else if (WRITING_WORDS.test(text) || rest.length >= WRITING_MIN_LENGTH) {
    typeGuess = 'writing';
    confident = WRITING_WORDS.test(text);
  } else {
    typeGuess = 'moment';
    confident = rest.length > 0;
  }

  const bodyText = rest.replace(WRITING_WORDS, '').trim();

  return {
    type: typeGuess,
    confident,
    title: typeGuess === 'task' || typeGuess === 'workout' ? bodyText || null : null,
    subtitle: verse ?? (video ? null : null),
    quote,
    body:
      typeGuess === 'task' || typeGuess === 'workout' ? null : bodyText || null,
    url,
    page,
    minutes,
    slot,
    dueTime,
    done,
    tags,
    signals: signals.sort((a, b) => a.start - b.start),
    rest,
  };
}
