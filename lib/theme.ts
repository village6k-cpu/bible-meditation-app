import { TextStyle } from 'react-native';

export const colors = {
  background: '#FAFAF8',
  textPrimary: '#1A1A1A',
  textSecondary: '#999999',
  textTertiary: '#CCCCCC',
  accentGreen: '#7D8B75',
  accentRed: '#B8564F',
  surface: '#F0EDE7',
  divider: 'rgba(0,0,0,0.05)',
  tabBarBg: 'rgba(250,250,248,0.88)',
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
    color: colors.accentRed,
  },
  sectionLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10.5,
    letterSpacing: 10.5 * 0.1,
    color: colors.accentGreen,
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
    color: '#AAAAAA',
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
