// 차가운 무채색 한 벌. 색으로 말하지 않고 위계·밀도·정렬로 말한다.
// 선택은 색조가 아니라 반전(먹 바탕에 흰 글자)으로, 구획은 헤어라인으로.

export interface Palette {
  bg: string; // 지면
  surface: string; // 카드·시트
  surfaceSunken: string; // 입력창·검색창·표 머리
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  accent: string; // 먹 — 활성·선택
  accentSoft: string; // 선택 워시
  accentInk: string; // 그림자
  secondary: string; // 링크·본문 주소
  divider: string; // 헤어라인
  dotInk: string; // 지표 격자
  overlay: string;
  onAccent: string; // 먹 위의 글자색
}

// 낮 — 흰 종이, 차가운 회색
export const light: Palette = {
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceSunken: '#F4F5F7',
  textPrimary: '#0E1116',
  textSecondary: '#5B6472',
  textTertiary: '#98A1AF',
  accent: '#0E1116',
  accentSoft: '#ECEFF3',
  accentInk: '#000000',
  secondary: '#5B6472',
  divider: '#E3E6EB',
  dotInk: '#0E1116',
  overlay: 'rgba(14,17,22,0.45)',
  onAccent: '#FFFFFF',
};

// 밤 — 검은 지면
export const dark: Palette = {
  bg: '#0B0D10',
  surface: '#0B0D10',
  surfaceSunken: '#15181D',
  textPrimary: '#E8EBF0',
  textSecondary: '#98A1AF',
  textTertiary: '#5B6472',
  accent: '#E8EBF0',
  accentSoft: '#1E2229',
  accentInk: '#FFFFFF',
  secondary: '#98A1AF',
  divider: '#22262D',
  dotInk: '#E8EBF0',
  overlay: 'rgba(0,0,0,0.65)',
  onAccent: '#0B0D10',
};

// 글자는 한 벌 — IBM Plex. 수치·시각·식별자는 모노로 줄을 맞춘다.
export const fonts = {
  sans: 'IBMPlexSansKR_400Regular',
  sansMedium: 'IBMPlexSansKR_500Medium',
  sansSemiBold: 'IBMPlexSansKR_600SemiBold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
} as const;

export const type = {
  // 화면 제목
  display: { fontFamily: fonts.sansSemiBold, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  // 항목 제목
  title: { fontFamily: fonts.sansSemiBold, fontSize: 16, lineHeight: 22, letterSpacing: -0.2 },
  // 본문
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 23, letterSpacing: -0.1 },
  // 옮겨 적은 문장 — 세로 획으로 구분하고 글자는 같은 벌을 쓴다
  quote: { fontFamily: fonts.sans, fontSize: 15.5, lineHeight: 25, letterSpacing: -0.1 },
  // 조작부·행
  label: { fontFamily: fonts.sansMedium, fontSize: 14, lineHeight: 20, letterSpacing: -0.1 },
  caption: { fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 18 },
  // 분류 라벨 — 대문자, 자간을 벌려 구조를 드러낸다
  micro: { fontFamily: fonts.sansMedium, fontSize: 10.5, lineHeight: 14, letterSpacing: 0.9 },
  // 수치·시각·개수 — 자릿수가 흔들리지 않게
  mono: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 16, letterSpacing: -0.2 },
  monoLg: { fontFamily: fonts.monoMedium, fontSize: 22, lineHeight: 26, letterSpacing: -0.6 },
} as const;

export const space = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  gutter: 16,
} as const;

// 모서리는 거의 세우고, 시트만 부드럽게
export const radius = {
  card: 6,
  button: 6,
  chip: 4,
  sheet: 14,
  pill: 999,
} as const;

// 행 높이·격자 — 표처럼 읽히도록 고정값을 쓴다
export const grid = {
  row: 44,
  rowDense: 36,
  hairline: 1,
  indent: 28,
} as const;

// 인용 앞의 세로 획 — 이 앱의 시그니처(밑줄에서 옆줄로)
export const underline = {
  thickness: 2,
  offset: 3,
} as const;
