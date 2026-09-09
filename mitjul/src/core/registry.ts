import { EntryType, SourceKind } from './types';

// 유형 레지스트리 — 컴포저 폼, 카드 렌더러, 마크다운 빌더가 모두 여기서 읽는다.
// 새 유형을 추가할 때 고치는 곳은 이 파일과 마이그레이션뿐이어야 한다.

export interface TypeSpec {
  key: EntryType;
  label: string;
  icon: string; // Ionicons
  // 출처(책·링크)에 매달리는 유형 — 제목·저자는 출처에 한 번만, 밑줄은 연속으로
  sourced?: boolean;
  // 이 유형이 붙을 수 있는 출처 종류
  sourceKinds?: SourceKind[];
  // 링크를 붙여넣는 것이 시작인 유형 — 제목·채널·썸네일은 링크에서 알아서 온다
  linkFirst?: boolean;
  // 실천 유형 — 식사·운동. 콘텐츠가 아니라 습관이다.
  // 단위가 기록 하나가 아니라 하루이고, 매일 비슷한 것이 반복되며, 중요한 것은 내용이 아니라 추이다.
  // 그래서 기록 스트림·검토 큐·회상 카드에 섞이지 않고, 날짜 × 칸의 격자로만 산다.
  practice?: boolean;
  // 컴포저에 노출할 필드와 그 문구
  fields: {
    title?: { label: string; placeholder: string };
    subtitle?: { label: string; placeholder: string };
    quote?: { label: string; placeholder: string };
    body?: { label: string; placeholder: string };
    url?: boolean;
    image?: boolean;
    page?: boolean;
    slot?: boolean;
    minutes?: boolean;
    practiced?: { label: string };
    dueTime?: boolean;
  };
  // 저장 가능 조건: 이 중 하나라도 채워지면 된다
  requiresOneOf: ('title' | 'quote' | 'body' | 'image_uri' | 'url' | 'minutes')[];
  exportHeading: string; // 마크다운 H2
}

export const TYPE_ORDER: EntryType[] = [
  'moment',
  'book',
  'link',
  'verse',
  'meal',
  'workout',
  'writing',
  'task',
];

export const REGISTRY: Record<EntryType, TypeSpec> = {
  moment: {
    key: 'moment',
    label: '순간',
    icon: 'sparkles-outline',
    fields: {
      body: { label: '순간', placeholder: '간직하고 싶은 순간을 적어보세요' },
      image: true,
    },
    requiresOneOf: ['body', 'image_uri'],
    exportHeading: '순간',
  },
  book: {
    key: 'book',
    label: '책',
    icon: 'book-outline',
    sourced: true,
    sourceKinds: ['book'],
    fields: {
      // title/subtitle은 출처 등록 폼의 문구로만 쓰인다 — 밑줄마다 묻지 않는다
      title: { label: '책 제목', placeholder: '책 제목' },
      subtitle: { label: '저자', placeholder: '저자' },
      quote: { label: '밑줄', placeholder: '밑줄 그은 문장을 옮겨 적어보세요' },
      page: true,
      body: { label: '메모', placeholder: '메모 (선택)' },
      image: true,
    },
    requiresOneOf: ['quote', 'body', 'image_uri'],
    exportHeading: '책',
  },
  link: {
    key: 'link',
    label: '링크',
    icon: 'link-outline',
    sourced: true,
    linkFirst: true,
    sourceKinds: ['video', 'article'],
    fields: {
      title: { label: '제목', placeholder: '제목' },
      subtitle: { label: '채널·매체', placeholder: '채널·매체 (선택)' },
      url: true,
      body: { label: '메모', placeholder: '기억하고 싶은 내용 (선택)' },
    },
    requiresOneOf: ['url', 'body'],
    exportHeading: '링크',
  },
  verse: {
    key: 'verse',
    label: '묵상',
    icon: 'flame-outline',
    fields: {
      subtitle: { label: '본문', placeholder: '시편 23:1' },
      quote: { label: '말씀', placeholder: '말씀을 옮겨 적어보세요 (선택)' },
      body: { label: '묵상', placeholder: '오늘 이 말씀이 내게 하는 이야기' },
    },
    requiresOneOf: ['body', 'quote'],
    exportHeading: '묵상',
  },
  meal: {
    key: 'meal',
    label: '식사',
    icon: 'restaurant-outline',
    practice: true,
    fields: {
      slot: true,
      body: { label: '식사', placeholder: '무엇을 먹었나요' },
      image: true,
      practiced: { label: '잘 챙겨 먹었어요' },
    },
    requiresOneOf: ['body', 'image_uri'],
    exportHeading: '식사',
  },
  workout: {
    key: 'workout',
    label: '운동',
    icon: 'barbell-outline',
    practice: true,
    fields: {
      title: { label: '종류', placeholder: '달리기' },
      minutes: true,
      body: { label: '메모', placeholder: '오늘의 몸 상태 (선택)' },
      image: true,
    },
    requiresOneOf: ['title', 'minutes', 'body', 'image_uri'],
    exportHeading: '운동',
  },
  writing: {
    key: 'writing',
    label: '글',
    icon: 'create-outline',
    fields: {
      title: { label: '제목', placeholder: '제목 (선택)' },
      body: { label: '본문', placeholder: '쓰고 싶은 글을 적어보세요' },
    },
    requiresOneOf: ['body'],
    exportHeading: '글',
  },
  task: {
    key: 'task',
    label: '할 일',
    icon: 'checkbox-outline',
    fields: {
      title: { label: '할 일', placeholder: '할 일을 적어보세요' },
      dueTime: true,
    },
    requiresOneOf: ['title'],
    exportHeading: '할 일',
  },
};

export function specOf(type: EntryType): TypeSpec {
  return REGISTRY[type];
}

// 실천 유형 목록과 그 반대(콘텐츠) — 쿼리와 화면이 흩어진 type != 'task' 대신 이것을 쓴다.
// 하나라도 빠뜨리면 그 자리에서 식사가 밑줄 사이에 다시 새어 들어온다.
export const PRACTICE_TYPES: EntryType[] = TYPE_ORDER.filter((t) => REGISTRY[t].practice);
export const isPractice = (t: EntryType): boolean => !!REGISTRY[t].practice;
// 콘텐츠 = 할 일도 실천도 아닌 것. 기록 탭·검토·회상이 다루는 범위다.
export const CONTENT_TYPES: EntryType[] = TYPE_ORDER.filter((t) => t !== 'task' && !REGISTRY[t].practice);
