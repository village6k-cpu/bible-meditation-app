import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts } from '../lib/theme';
import { Verse } from '../lib/bible-data';

export const HIGHLIGHT_COLORS = [
  { name: '노랑', color: 'rgba(242,210,100,0.28)' },
  { name: '초록', color: 'rgba(130,180,110,0.24)' },
  { name: '보라', color: 'rgba(170,150,200,0.24)' },
];

interface Props {
  verse: Verse;
  highlighted?: boolean;
  highlightColor?: string | null;
  onLongPress?: (verse: Verse) => void;
  fontScale?: number;
  lineHeightScale?: number;
}

const BASE_FONT = 16.5;
const BASE_LINE_HEIGHT = 2.05;
const VERSE_NUM_WIDTH = 28;

export function VerseText({ verse, highlighted, highlightColor, onLongPress, fontScale = 1, lineHeightScale = 1 }: Props) {
  const fontSize = BASE_FONT * fontScale;
  const lineHeight = fontSize * BASE_LINE_HEIGHT * lineHeightScale;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      delayLongPress={500}
      onLongPress={() => onLongPress?.(verse)}
      style={styles.container}
    >
      {/* 하이라이트 배경 */}
      {highlightColor && (
        <View style={[styles.paintBlob, { backgroundColor: highlightColor }]} />
      )}
      {highlighted && !highlightColor && (
        <View style={styles.selectBlob} />
      )}

      {/* 절 번호 + 본문: 행잉 인덴트 */}
      <View style={styles.row}>
        <Text style={[styles.verseNumber, { lineHeight }]}>{verse.verse}</Text>
        <Text style={[styles.text, { fontSize, lineHeight }]}>{verse.text}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 2,
    position: 'relative',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  verseNumber: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: colors.accent,
    width: VERSE_NUM_WIDTH,
    textAlign: 'right',
    paddingRight: 8,
    paddingTop: 2,
  },
  text: {
    flex: 1,
    fontFamily: fonts.serifLight,
    fontSize: BASE_FONT,
    lineHeight: BASE_FONT * BASE_LINE_HEIGHT,
    color: colors.textPrimary,
    textAlign: 'justify',
  },
  paintBlob: {
    position: 'absolute',
    top: -2,
    bottom: -2,
    left: VERSE_NUM_WIDTH - 4,
    right: -6,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 18,
  },
  selectBlob: {
    position: 'absolute',
    top: -1,
    bottom: -1,
    left: VERSE_NUM_WIDTH - 4,
    right: -5,
    backgroundColor: 'rgba(193,95,60,0.1)',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 16,
  },
});
