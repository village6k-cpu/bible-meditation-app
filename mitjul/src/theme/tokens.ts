// 밑줄의 색은 셋뿐 — 종이, 먹, 인주.
// 순수한 흰색도 순수한 검정도 쓰지 않는다. 종이는 늘 종이색이다.

export interface Palette {
  bg: string; // 지면
  surface: string; // 카드·낱장
  surfaceSunken: string; // 입력창·검색창 바닥
  textPrimary: string; // 먹
  textSecondary: string;
  textTertiary: string;
  accent: string; // 인주 — 모든 밑줄과 활성 상태
  accentSoft: string; // 선택·하이라이트 워시
  accentInk: string; // pressed
  secondary: string; // 쪽빛 — 링크·성경 장절·URL 전용
  divider: string;
  dotInk: string; // 흐름 탭 먹점
  overlay: string;
}

// 낮의 서재 — 한지와 먹, 그리고 인주
export const light: Palette = {
  bg: '#F6F1E6',
  surface: '#FDFAF2',
  surfaceSunken: '#EEE7D7',
  textPrimary: '#2C2620',
  textSecondary: '#6E6355',
  textTertiary: '#A09582',
  accent: '#C24A2F',
  accentSoft: '#F6E0D5',
  accentInk: '#8E3421',
  secondary: '#3D5A78',
  divider: '#E5DCC8',
  dotInk: '#2C2620',
  overlay: 'rgba(44,38,32,0.45)',
};

// 밤의 서재 — 등불에 데워진 갈색 어둠
export const dark: Palette = {
  bg: '#17130F',
  surface: '#201B15',
  surfaceSunken: '#282219',
  textPrimary: '#EDE4D3',
  textSecondary: '#A99C88',
  textTertiary: '#7A6F5F',
  accent: '#E2694A',
  accentSoft: '#3A241C',
  accentInk: '#F0876B',
  secondary: '#92B0CE',
  divider: '#322B22',
  dotInk: '#EDE4D3',
  overlay: 'rgba(0,0,0,0.55)',
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
