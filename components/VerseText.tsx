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
}

export function VerseText({ verse, highlighted, highlightColor, onLongPress }: Props) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      delayLongPress={500}
      onLongPress={() => onLongPress?.(verse)}
      style={styles.container}
    >
      {/* 물감 하이라이트 배경 레이어 */}
      {highlightColor && (
        <View
          style={[
            styles.paintBlob,
            { backgroundColor: highlightColor },
          ]}
        />
      )}
      {/* 롱프레스 선택 하이라이트 */}
      {highlighted && !highlightColor && (
        <View style={styles.selectBlob} />
      )}
      <Text style={styles.text}>
        <Text style={styles.verseNumber}>{verse.verse} </Text>
        {verse.text}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 2,
    position: 'relative',
  },
  // 물감이 번진 듯한 유기적 블롭
  paintBlob: {
    position: 'absolute',
    top: -2,
    bottom: -2,
    left: -10,
    right: -6,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 18,
    opacity: 1,
  },
  // 롱프레스 시 선택 표시
  selectBlob: {
    position: 'absolute',
    top: -1,
    bottom: -1,
    left: -8,
    right: -5,
    backgroundColor: 'rgba(193,95,60,0.1)',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 16,
  },
  text: {
    fontFamily: fonts.serifLight,
    fontSize: 16.5,
    lineHeight: 16.5 * 2.05,
    color: colors.textPrimary,
  },
  verseNumber: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: colors.accent,
  },
});
