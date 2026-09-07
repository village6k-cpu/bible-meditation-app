// 밑줄의 색은 둘뿐 — 흰 종이와 검은 먹. 모노톤.
// 밑줄(강조)은 먹 그 자체다. 색으로 말하지 않고 획으로 말한다.

export interface Palette {
  bg: string; // 지면
  surface: string; // 카드·시트 (지면과 같은 흰색 — 구획은 헤어라인으로)
  surfaceSunken: string; // 입력창·검색창 바닥
  textPrimary: string; // 먹
  textSecondary: string;
  textTertiary: string;
  accent: string; // 먹 — 모든 밑줄과 활성 상태
  accentSoft: string; // 선택 워시
  accentInk: string; // 남기기 버튼 그림자 (눌림은 색이 아니라 투명도로)
  secondary: string; // 링크·본문 주소 (회색 톤, 밑줄로 구분)
  divider: string;
  dotInk: string; // 흐름 탭 먹점
  overlay: string;
  onAccent: string; // 먹 위의 글자색
}

// 낮 — 흰 종이
export const light: Palette = {
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceSunken: '#F3F3F3',
  textPrimary: '#111111',
  textSecondary: '#6E6E6E',
  textTertiary: '#A6A6A6',
  accent: '#111111',
  accentSoft: '#EDEDED',
  accentInk: '#000000',
  secondary: '#4A4A4A',
  divider: '#E7E7E7',
  dotInk: '#111111',
  overlay: 'rgba(0,0,0,0.4)',
  onAccent: '#FFFFFF',
};

// 밤 — 검은 지면
export const dark: Palette = {
  bg: '#0C0C0C',
  surface: '#0C0C0C',
  surfaceSunken: '#1C1C1C',
  textPrimary: '#F2F2F2',
  textSecondary: '#9A9A9A',
  textTertiary: '#5E5E5E',
  accent: '#F2F2F2',
  accentSoft: '#262626',
  accentInk: '#FFFFFF',
  secondary: '#BDBDBD',
  divider: '#242424',
  dotInk: '#F2F2F2',
  overlay: 'rgba(0,0,0,0.6)',
  onAccent: '#0C0C0C',
};

// 사용자가 쓴 것은 바탕체, 앱이 말하는 것은 산스체.
export const fonts = {
  serif: 'GowunBatang_400Regular',
  serifBold: 'GowunBatang_700Bold',
  sans: 'IBMPlexSansKR_400Regular',
  sansMedium: 'IBMPlexSansKR_500Medium',
  sansSemiBold: 'IBMPlexSansKR_600SemiBold',
} as const;

export const type = {
  display: { fontFamily: fonts.serifBold, fontSize: 26, lineHeight: 34 },
  quote: { fontFamily: fonts.serif, fontSize: 18, lineHeight: 30 },
  titleSerif: { fontFamily: fonts.serifBold, fontSize: 20, lineHeight: 28 },
  bodySerif: { fontFamily: fonts.serif, fontSize: 16, lineHeight: 27, letterSpacing: -0.2 },
  label: { fontFamily: fonts.sansMedium, fontSize: 15, lineHeight: 20 },
  caption: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18 },
  micro: { fontFamily: fonts.sansMedium, fontSize: 11, lineHeight: 14, letterSpacing: 0.4 },
  numeral: { fontFamily: fonts.sansSemiBold, fontSize: 22, lineHeight: 26 },
} as const;

export const space = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  gutter: 20,
} as const;

export const radius = {
  card: 10,
  button: 12,
  chip: 999,
  sheet: 20,
} as const;

// 밑줄 장식 — 이 앱의 시그니처
export const underline = {
  thickness: 2,
  offset: 3,
} as const;
