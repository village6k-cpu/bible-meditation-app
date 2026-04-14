import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../lib/theme';
import { DailyReading } from '../lib/bible-data';

interface Props {
  readings: DailyReading[];
  onToggle: (id: number) => void;
  onAdd: () => void;
}

export function ReadingChecklist({ readings, onToggle, onAdd }: Props) {
  const allDone = readings.length > 0 && readings.every((r) => r.completed);

  return (
    <View>
      <Text style={styles.title}>오늘 읽을 말씀</Text>

      {readings.map((reading) => {
        const label = reading.start_chapter === reading.end_chapter
          ? `${reading.book_name} ${reading.start_chapter}장`
          : `${reading.book_name} ${reading.start_chapter}-${reading.end_chapter}장`;

        return (
          <View key={reading.id} style={styles.row}>
            <TouchableOpacity
              style={[styles.checkbox, !!reading.completed && styles.checkboxDone]}
              onPress={() => onToggle(reading.id)}
            >
              {reading.completed ? (
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              ) : null}
            </TouchableOpacity>
            <Text
              style={[
                styles.readingText,
                !!reading.completed && styles.readingTextDone,
              ]}
            >
              {label}
            </Text>
          </View>
        );
      })}

      {allDone && readings.length > 0 && (
        <Text style={styles.doneText}>오늘의 읽기를 완료했어요</Text>
      )}

      <TouchableOpacity style={styles.addButton} onPress={onAdd}>
        <Ionicons name="add" size={18} color={colors.accentGreen} />
        <Text style={styles.addText}>읽을 말씀 추가</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.serifLight,
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: spacing.buttonRadius,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxDone: {
    backgroundColor: colors.accentGreen,
    borderColor: colors.accentGreen,
  },
  readingText: {
    flex: 1,
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: colors.textPrimary,
  },
  readingTextDone: {
    textDecorationLine: 'line-through',
    opacity: 0.4,
  },
  doneText: {
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    color: colors.accentGreen,
    textAlign: 'center',
    marginTop: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
    gap: 6,
  },
  addText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.accentGreen,
  },
});
