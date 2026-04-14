import { View, Text, TouchableOpacity, ScrollView, Modal, StyleSheet, Dimensions } from 'react-native';
import { colors, fonts, spacing } from '../lib/theme';
import { Verse } from '../lib/bible-data';
import { getAnnotation } from '../lib/cross-references';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  visible: boolean;
  verse: Verse | null;
  bookName: string;
  onClose: () => void;
}

export function VerseBottomSheet({ visible, verse, bookName, onClose }: Props) {
  if (!verse) return null;

  const annotation = getAnnotation(verse.book_id, verse.chapter, verse.verse);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet}>
          <View style={styles.handleBar} />

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* 선택된 구절 */}
            <View style={styles.verseCard}>
              <Text style={styles.verseRef}>
                {bookName} {verse.chapter}:{verse.verse}
              </Text>
              <Text style={styles.verseText}>{verse.text}</Text>
            </View>

            {/* 주석 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>주석</Text>
              <Text style={styles.commentary}>{annotation.commentary}</Text>
            </View>

            {/* 관련 구절 */}
            {annotation.crossRefs.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>관련 구절</Text>
                {annotation.crossRefs.map((ref, i) => (
                  <View key={i} style={styles.crossRefItem}>
                    <View style={styles.chip}>
                      <Text style={styles.chipText}>{ref.ref}</Text>
                    </View>
                    <Text style={styles.crossRefText} numberOfLines={2}>{ref.text}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* 원어 */}
            {annotation.originalWords.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>원어</Text>
                {annotation.originalWords.map((word, i) => (
                  <View key={i} style={styles.wordItem}>
                    <Text style={styles.wordOriginal}>{word.original}</Text>
                    <Text style={styles.wordTranslit}>{word.transliteration}</Text>
                    <Text style={styles.wordMeaning}>{word.meaning}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'flex-end',
  },
  sheet: {
    height: SCREEN_HEIGHT * 0.6,
    backgroundColor: colors.background,
    borderTopLeftRadius: spacing.bottomSheetRadius,
    borderTopRightRadius: spacing.bottomSheetRadius,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 40,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.1)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  verseCard: {
    backgroundColor: 'rgba(193,95,60,0.08)',
    borderRadius: 10,
    padding: 14,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  verseRef: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    color: colors.accent,
    marginBottom: 8,
  },
  verseText: {
    fontFamily: fonts.serifLight,
    fontSize: 15,
    lineHeight: 28,
    color: colors.textPrimary,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10.5,
    letterSpacing: 10.5 * 0.1,
    color: colors.accent,
    marginBottom: 12,
  },
  commentary: {
    fontFamily: fonts.sansRegular,
    fontSize: 13.5,
    lineHeight: 23,
    color: '#444444',
  },
  crossRefItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  chip: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  chipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.textPrimary,
  },
  crossRefText: {
    flex: 1,
    fontFamily: fonts.sansRegular,
    fontSize: 12.5,
    lineHeight: 20,
    color: colors.textSecondary,
    paddingTop: 3,
  },
  wordItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  wordOriginal: {
    fontFamily: fonts.serifLight,
    fontSize: 22,
    color: colors.textPrimary,
  },
  wordTranslit: {
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  wordMeaning: {
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    color: '#666666',
  },
});
