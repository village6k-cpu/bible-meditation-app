import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../lib/theme';
import { useAppStore } from '../lib/store';

interface Props {
  visible: boolean;
  onClose: () => void;
}

function Slider({ label, value, onDecrease, onIncrease, display }: {
  label: string; value: number; onDecrease: () => void; onIncrease: () => void; display: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.controls}>
        <TouchableOpacity onPress={onDecrease} style={styles.btn}>
          <Text style={styles.btnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.value}>{display}</Text>
        <TouchableOpacity onPress={onIncrease} style={styles.btn}>
          <Text style={styles.btnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function FontSettings({ visible, onClose }: Props) {
  const { fontScale, lineHeightScale, setFontScale, setLineHeightScale } = useAppStore();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet}>
          <Text style={styles.title}>읽기 설정</Text>

          <Slider
            label="글자 크기"
            value={fontScale}
            display={`${Math.round(fontScale * 100)}%`}
            onDecrease={() => setFontScale(Math.max(0.8, fontScale - 0.05))}
            onIncrease={() => setFontScale(Math.min(1.4, fontScale + 0.05))}
          />

          <Slider
            label="줄 간격"
            value={lineHeightScale}
            display={`${Math.round(lineHeightScale * 100)}%`}
            onDecrease={() => setLineHeightScale(Math.max(0.8, lineHeightScale - 0.05))}
            onIncrease={() => setLineHeightScale(Math.min(1.4, lineHeightScale + 0.05))}
          />

          <Text style={styles.preview}>
            태초에 말씀이 계시니라 이 말씀이 하나님과 함께 계셨으니 이 말씀은 곧 하나님이시니라
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  sheet: {
    backgroundColor: colors.background,
    borderRadius: spacing.cardRadius,
    padding: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
  },
  title: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 24,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  label: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: colors.textPrimary,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  btn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontFamily: fonts.sansMedium,
    fontSize: 18,
    color: colors.textPrimary,
  },
  value: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.accent,
    width: 42,
    textAlign: 'center',
  },
  preview: {
    fontFamily: fonts.serifLight,
    fontSize: 15,
    lineHeight: 30,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
});
