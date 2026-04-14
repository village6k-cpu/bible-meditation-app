import { View, Text, TouchableOpacity, ScrollView, Modal, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../lib/theme';
import { Verse } from '../lib/bible-data';
import { getAnnotation } from '../lib/cross-references';
import { HIGHLIGHT_COLORS } from './VerseText';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  visible: boolean;
  verse: Verse | null;
  bookName: string;
  currentHighlight?: string | null;
  onClose: () => void;
  onHighlight?: (verse: Verse, color: string | null) => void;
  onBookmark?: (verse: Verse) => void;
}

export function VerseBottomSheet({ visible, verse, bookName, onClose, onHighlight, onBookmark, currentHighlight }: Props) {
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

            {/* 하이라이트 색상 선택 */}
            {onHighlight && (
              <View style={styles.highlightRow}>
                {HIGHLIGHT_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c.name}
                    style={[styles.highlightBtn, { backgroundColor: c.color }, currentHighlight === c.color && styles.highlightBtnActive]}
                    onPress={() => { onHighlight(verse, c.color); onClose(); }}
                  />
                ))}
                {currentHighlight ? (
                  <TouchableOpacity
                    style={styles.highlightClearBtn}
                    onPress={() => { onHighlight(verse, null); onClose(); }}
                  >
                    <Ionicons name="close" size={14} color={colors.textSecondary} />
                  </TouchableOpacity>
                ) : null}
              </View>
            )}

            {/* 여기까지 읽었어요 */}
            {onBookmark && (
              <TouchableOpacity
                style={styles.bookmarkBtn}
                onPress={() => { onBookmark(verse); onClose(); }}
                activeOpacity={0.6}
              >
                <Ionicons name="bookmark-outline" size={16} color={colors.accent} />
                <Text style={styles.bookmarkText}>여기까지 읽었어요</Text>
              </TouchableOpacity>
            )}

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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-end' },
  sheet: {
    height: SCREEN_HEIGHT * 0.6, backgroundColor: colors.background,
    borderTopLeftRadius: spacing.bottomSheetRadius, borderTopRightRadius: spacing.bottomSheetRadius,
    paddingHorizontal: spacing.screenPadding, paddingTop: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 40,
  },
  handleBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.1)', alignSelf: 'center', marginBottom: 20 },
  verseCard: { backgroundColor: 'rgba(193,95,60,0.08)', borderRadius: 10, padding: 14, paddingHorizontal: 16, marginBottom: 16 },
  verseRef: { fontFamily: fonts.sansSemiBold, fontSize: 11, color: colors.accent, marginBottom: 8 },
  verseText: { fontFamily: fonts.serifLight, fontSize: 15, lineHeight: 28, color: colors.textPrimary },

  // 하이라이트
  highlightRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 24 },
  highlightBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
  highlightBtnActive: { borderColor: colors.accent },
  highlightClearBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },

  bookmarkBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', borderRadius: 10,
  },
  bookmarkText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.accent },

  section: { marginBottom: 24 },
  sectionTitle: { fontFamily: fonts.sansSemiBold, fontSize: 10.5, letterSpacing: 10.5 * 0.1, color: colors.accent, marginBottom: 12 },
  commentary: { fontFamily: fonts.sansRegular, fontSize: 13.5, lineHeight: 23, color: '#444444' },
  crossRefItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  chip: { backgroundColor: 'rgba(0,0,0,0.04)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.textPrimary },
  crossRefText: { flex: 1, fontFamily: fonts.sansRegular, fontSize: 12.5, lineHeight: 20, color: colors.textSecondary, paddingTop: 3 },
  wordItem: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  wordOriginal: { fontFamily: fonts.serifLight, fontSize: 22, color: colors.textPrimary },
  wordTranslit: { fontFamily: fonts.sansRegular, fontSize: 12, color: colors.textSecondary, fontStyle: 'italic' },
  wordMeaning: { fontFamily: fonts.sansRegular, fontSize: 12, color: '#666666' },
});
