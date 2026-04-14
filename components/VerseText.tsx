import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts } from '../lib/theme';
import { Verse } from '../lib/bible-data';

interface Props {
  verse: Verse;
  highlighted?: boolean;
  onLongPress?: (verse: Verse) => void;
}

export function VerseText({ verse, highlighted, onLongPress }: Props) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      delayLongPress={500}
      onLongPress={() => onLongPress?.(verse)}
      style={[styles.container, highlighted && styles.highlighted]}
    >
      <Text style={styles.text}>
        <Text style={styles.verseNumber}>{verse.verse} </Text>
        {verse.text}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 1,
  },
  highlighted: {
    backgroundColor: 'rgba(193,95,60,0.12)',
    borderRadius: 4,
    marginHorizontal: -4,
    paddingHorizontal: 4,
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
