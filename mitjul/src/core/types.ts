export type EntryType =
  | 'book'
  | 'link'
  | 'verse'
  | 'meal'
  | 'workout'
  | 'moment'
  | 'writing'
  | 'task';

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type Reaction = 'kept' | 'skipped' | 'retired';

// 출처 — 책·영상은 한 번만 등록하고, 밑줄은 출처에 매달린다.
// 하루에 수십 개의 밑줄을 긋는 사람이 제목을 수십 번 치지 않도록.
export type SourceKind = 'book' | 'video' | 'article';

export interface Source {
  id: string;
  kind: SourceKind;
  title: string;
  creator: string | null; // 저자 / 채널
  url: string | null; // 영상 링크(정규형) — 같은 영상의 메모마다 링크를 다시 붙이지 않도록 출처가 지닌다
  thumbnail_uri: string | null; // 'images/thumb-…' 상대 경로 — 붙여넣는 순간 내려받아 둔 썸네일
  created_at: number;
  last_used_at: number; // 최근 사용 순 — 컴포저는 이 순서로 칩을 늘어놓고 첫 것을 미리 고른다
  last_tags: string; // 이 출처에 마지막으로 붙인 태그 (공백 구분) — 다음 밑줄의 기본값
  deleted_at: number | null;
}

// 단일 테이블 + 유형별 nullable 컬럼. 레포지토리가 이 형태 그대로 돌려준다.
export interface Entry {
  id: string;
  type: EntryType;
  day: string; // 'YYYY-MM-DD' — core/dates.ts만 생성한다
  created_at: number; // epoch ms
  updated_at: number;
  deleted_at: number | null;
  pinned: number; // 0/1 — 아껴둔 밑줄
  revisit_count: number; // 상세를 연 횟수
  last_revisited_at: number | null; // 마지막으로 '다시 읽은' 시각
  filed_at: number | null; // 구조가 붙었다고 확인된 시각 — 검토 큐에서 빠진다
  source_id: string | null; // book/video — 출처. title/subtitle은 출처에서 복사되어 온다
  title: string | null; // book:책제목 / video:영상제목 / workout:종류 / writing:글제목 / task:내용
  subtitle: string | null; // book:저자 / video:채널 / verse:본문 주소('시편 23:1')
  quote: string | null; // book:밑줄 문장 / verse:옮겨 적은 말씀
  body: string | null;
  url: string | null; // link
  image_uri: string | null; // 'images/…' 상대 경로
  page: number | null; // book
  slot: MealSlot | null; // meal
  minutes: number | null; // workout (분)
  practiced: number | null; // meal/workout 실천(1/0)
  done: number | null; // task
  due_time: string | null; // task 'HH:MM'
}

export interface EntryInput {
  type: EntryType;
  day: string;
  source_id?: string | null;
  title?: string | null;
  subtitle?: string | null;
  quote?: string | null;
  body?: string | null;
  url?: string | null;
  image_uri?: string | null;
  page?: number | null;
  slot?: MealSlot | null;
  minutes?: number | null;
  practiced?: number | null;
  done?: number | null;
  due_time?: string | null;
  tags?: string[];
}

export interface Tag {
  id: string;
  name: string;
  count?: number;
}

// 흐름 탭의 하루치 집계
export interface TrendRow {
  day: string;
  workoutDone: boolean;
  workoutMinutes: number;
  mealCount: number;
  mealPracticed: number;
  verseCount: number;
  entryCount: number; // task 제외한 기록 수
}

export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: '아침',
  lunch: '점심',
  dinner: '저녁',
  snack: '간식',
};
