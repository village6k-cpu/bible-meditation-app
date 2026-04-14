import { Text, TouchableOpacity, View, StyleSheet, Modal } from 'react-native';
import { useState } from 'react';
import { colors, fonts } from '../lib/theme';
import { Verse } from '../lib/bible-data';

export const HIGHLIGHT_COLORS = [
  { name: '노랑', color: 'rgba(245,215,110,0.35)', border: 'rgba(245,215,110,0.6)' },
  { name: '초록', color: 'rgba(140,190,120,0.3)', border: 'rgba(140,190,120,0.55)' },
  { name: '보라', color: 'rgba(180,160,210,0.3)', border: 'rgba(180,160,210,0.55)' },
];

interface Props {
  verse: Verse;
  highlighted?: boolean;
  highlightColor?: string | null;
  onLongPress?: (verse: Verse) => void;
  onHighlight?: (verse: Verse, color: string | null) => void;
}

export function VerseText({ verse, highlighted, highlightColor, onLongPress, onHighlight }: Props) {
  const [showColorPicker, setShowColorPicker] = useState(false);

  function handleLongPress() {
    if (onHighlight) {
      setShowColorPicker(true);
    }
    onLongPress?.(verse);
  }

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.8}
        delayLongPress={500}
        onLongPress={handleLongPress}
        style={[
          styles.container,
          highlighted && styles.highlighted,
          highlightColor ? { backgroundColor: highlightColor, borderRadius: 4, marginHorizontal: -4, paddingHorizontal: 4 } : null,
        ]}
      >
        <Text style={styles.text}>
          <Text style={styles.verseNumber}>{verse.verse} </Text>
          {verse.text}
        </Text>
      </TouchableOpacity>

      {/* 하이라이트 색상 선택 */}
      <Modal visible={showColorPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowColorPicker(false)}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>하이라이트</Text>
            <View style={styles.pickerRow}>
              {HIGHLIGHT_COLORS.map((c) => (
                <TouchableOpacity
                  key={c.name}
                  style={[styles.colorBtn, { backgroundColor: c.color, borderColor: c.border }]}
                  onPress={() => {
                    onHighlight?.(verse, c.color);
                    setShowColorPicker(false);
                  }}
                >
                  <Text style={styles.colorLabel}>{c.name}</Text>
                </TouchableOpacity>
              ))}
              {/* 지우기 */}
              {highlightColor && (
                <TouchableOpacity
                  style={[styles.colorBtn, styles.clearBtn]}
                  onPress={() => {
                    onHighlight?.(verse, null);
                    setShowColorPicker(false);
                  }}
                >
                  <Text style={styles.clearLabel}>지우기</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 1 },
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

  // 색상 선택
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  pickerSheet: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
  },
  pickerTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
  },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  colorBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  colorLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.textPrimary,
  },
  clearBtn: {
    backgroundColor: colors.surface,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  clearLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
});
