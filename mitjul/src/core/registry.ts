import { EntryType } from './types';

// 유형 레지스트리 — 컴포저 폼, 카드 렌더러, 마크다운 빌더가 모두 여기서 읽는다.
// 새 유형을 추가할 때 고치는 곳은 이 파일과 마이그레이션뿐이어야 한다.

export interface TypeSpec {
  key: EntryType;
  label: string;
  icon: string; // Ionicons
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
  'video',
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
    fields: {
      title: { label: '책 제목', placeholder: '『모모』' },
      subtitle: { label: '저자', placeholder: '미하엘 엔데' },
      quote: { label: '밑줄', placeholder: '밑줄 그은 문장을 옮겨 적어보세요' },
      page: true,
      body: { label: '메모', placeholder: '이 문장이 왜 좋았는지' },
      image: true,
    },
    requiresOneOf: ['quote', 'body'],
    exportHeading: '책',
  },
  video: {
    key: 'video',
    label: '영상',
    icon: 'play-outline',
    fields: {
      url: true,
      title: { label: '영상 제목', placeholder: '영상 제목' },
      subtitle: { label: '채널', placeholder: '채널 이름' },
      body: { label: '메모', placeholder: '기억하고 싶은 내용' },
    },
    requiresOneOf: ['url', 'title', 'body'],
    exportHeading: '영상',
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
