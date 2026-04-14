import { View, Text, TouchableOpacity, ScrollView, Modal, StyleSheet, Dimensions } from 'react-native';
import { colors, fonts, spacing } from '../lib/theme';
import { Verse } from '../lib/bible-data';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  visible: boolean;
  verse: Verse | null;
  bookName: string;
  onClose: () => void;
}

export function VerseBottomSheet({ visible, verse, bookName, onClose }: Props) {
  if (!verse) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Selected verse */}
            <View style={styles.verseCard}>
              <Text style={styles.verseRef}>
                {bookName} {verse.chapter}:{verse.verse}
              </Text>
              <Text style={styles.verseText}>{verse.text}</Text>
            </View>

            {/* 주석 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>주석</Text>
              <Text style={styles.sectionContent}>
                주석 데이터가 곧 추가됩니다. Phase 2에서 RAG 시스템과 연결하여 해설을 제공합니다.
              </Text>
            </View>

            {/* 관련 구절 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>관련 구절</Text>
              <View style={styles.chipRow}>
                {['창 1:1', '골 1:17', '히 1:2'].map((ref) => (
                  <View key={ref} style={styles.chip}>
                    <Text style={styles.chipText}>{ref}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 원어 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>원어</Text>
              <Text style={styles.sectionContent}>
                원어 데이터가 곧 추가됩니다.
              </Text>
            </View>
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
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  verseCard: {
    backgroundColor: 'rgba(125,139,117,0.12)',
    borderRadius: spacing.cardRadius,
    padding: 16,
    marginBottom: 24,
  },
  verseRef: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    color: colors.accentGreen,
    marginBottom: 8,
  },
  verseText: {
    fontFamily: fonts.serifLight,
    fontSize: 15,
    lineHeight: 30,
    color: colors.textPrimary,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.accentGreen,
    letterSpacing: 1,
    marginBottom: 10,
  },
  sectionContent: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    lineHeight: 22,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.textPrimary,
  },
});
