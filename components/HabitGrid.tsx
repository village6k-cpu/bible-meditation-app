import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../lib/theme';
import { HabitDay } from '../lib/journal-db';

interface Props {
  daysInMonth: number;
  // key: day of month (1-based)
  habits: Record<number, HabitDay | undefined>;
}

const ROWS: { key: 'workout' | 'diet' | 'meditation'; label: string }[] = [
  { key: 'workout', label: '운동' },
  { key: 'diet', label: '식단' },
  { key: 'meditation', label: '묵상' },
];

function dotStyle(row: 'workout' | 'diet' | 'meditation', habit: HabitDay | undefined) {
  if (!habit) return styles.dotEmpty;
  if (row === 'diet') {
    if (habit.diet === true) return styles.dotDone;
    if (habit.diet === false) return styles.dotMissed;
    return styles.dotEmpty;
  }
  return habit[row] ? styles.dotDone : styles.dotEmpty;
}

export function HabitGrid({ daysInMonth, habits }: Props) {
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <View>
      {ROWS.map((row) => (
        <View key={row.key} style={styles.row}>
          <Text style={styles.rowLabel}>{row.label}</Text>
          <View style={styles.dots}>
            {days.map((day) => (
              <View key={day} style={[styles.dot, dotStyle(row.key, habits[day])]} />
            ))}
          </View>
        </View>
      ))}
      <View style={styles.row}>
        <Text style={styles.rowLabel} />
        <View style={styles.dots}>
          {days.map((day) => (
            <Text key={day} style={styles.dayTick}>
              {day === 1 || day % 5 === 0 ? day : ''}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  rowLabel: {
    width: 34,
    fontFamily: fonts.sansRegular,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  dots: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  dotDone: {
    backgroundColor: colors.accentGreen,
  },
  dotMissed: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.accentRed,
  },
  dotEmpty: {
    backgroundColor: 'rgba(0,0,0,0.07)',
  },
  dayTick: {
    width: 7,
    fontFamily: fonts.sansRegular,
    fontSize: 7,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
