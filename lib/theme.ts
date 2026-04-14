import { TextStyle } from 'react-native';

export const colors = {
  // Background
  background: '#F4F3EE',
  surface: '#EDE8E0',
  surfaceDim: '#E6E1D8',

  // Text
  textPrimary: '#1A1A1A',
  textSecondary: '#B1ADA1',
  textTertiary: '#CDC8BE',

  // Accent (Claude terra cotta)
  accent: '#C15F3C',
  accentLight: 'rgba(193, 95, 60, 0.10)',
  accentHover: '#A8512F',

  // Structure
  divider: 'rgba(0,0,0,0.05)',
  tabBarBg: 'rgba(244,243,238,0.88)',
  tabActive: '#1A1A1A',
  tabInactive: '#CDC8BE',
} as const;

export const fonts = {
  serifLight: 'NotoSerifKR-Light',
  serifSemiBold: 'NotoSerifKR-SemiBold',
  sansRegular: 'Pretendard-Regular',
  sansMedium: 'Pretendard-Medium',
  sansSemiBold: 'Pretendard-SemiBold',
  sansBold: 'Pretendard-Bold',
} as const;

export const typography: Record<string, TextStyle> = {
  bibleText: {
    fontFamily: fonts.serifLight,
    fontSize: 16.5,
    lineHeight: 16.5 * 2.05,
    color: colors.textPrimary,
  },
  sectionTitle: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 19,
    lineHeight: 19 * 1.5,
    color: colors.textPrimary,
  },
  verseNumber: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: colors.accent,
  },
  sectionLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10.5,
    letterSpacing: 10.5 * 0.1,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  greeting: {
    fontFamily: fonts.serifLight,
    fontSize: 21,
    color: colors.textPrimary,
  },
  greetingBold: {
    fontFamily: fonts.sansMedium,
    fontSize: 21,
    color: colors.textPrimary,
  },
  dateText: {
    fontFamily: fonts.sansRegular,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  bodyUI: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: colors.textPrimary,
  },
} as const;

export const spacing = {
  screenPadding: 28,
  sectionGap: 28,
  cardRadius: 14,
  buttonRadius: 9,
  bottomSheetRadius: 20,
} as const;
