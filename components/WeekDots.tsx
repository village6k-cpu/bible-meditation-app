import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../lib/theme';
import { getWeekDates, getISODate } from '../lib/utils';

interface Props {
  completedDates: Record<string, boolean>;
}

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

export function WeekDots({ completedDates }: Props) {
  const weekDates = getWeekDates();
  const todayStr = getISODate();

  return (
    <View style={styles.container}>
      {weekDates.map((date, i) => {
        const dateStr = getISODate(date);
        const isToday = dateStr === todayStr;
        const isCompleted = completedDates[dateStr] === true;
        const isFuture = date > new Date();

        return (
          <View key={dateStr} style={styles.dayColumn}>
            <Text style={styles.dayLabel}>{DAY_LABELS[i]}</Text>
            <View
              style={[
                styles.dot,
                isCompleted && styles.dotCompleted,
                isToday && !isCompleted && styles.dotToday,
                isFuture && !isToday && styles.dotFuture,
              ]}
            >
              {isCompleted && (
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              )}
              {isToday && !isCompleted && <View style={styles.todayInner} />}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 24,
  },
  dayColumn: {
    alignItems: 'center',
    gap: 6,
  },
  dayLabel: {
    fontFamily: fonts.sansRegular,
    fontSize: 11,
    color: colors.textSecondary,
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCompleted: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  dotToday: {
    borderColor: colors.accent,
  },
  todayInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  dotFuture: {
    borderColor: 'rgba(0,0,0,0.1)',
  },
});
