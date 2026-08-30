import { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../../lib/theme';
import { SectionLabel } from '../../components/SectionLabel';
import { HabitGrid } from '../../components/HabitGrid';
import { addDays, getISODate, parseISODate } from '../../lib/utils';
import {
  Entry,
  HabitDay,
  MonthlyStats,
  computeStreak,
  getHabitRange,
  getMonthlyStats,
  getQuotesInRange,
  getWorkoutMinutesByDate,
} from '../../lib/journal-db';

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

function monthRange(year: number, month: number): { start: string; end: string; days: number } {
  const days = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, '0');
  return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${String(days).padStart(2, '0')}`, days };
}

export default function RhythmScreen() {
  const router = useRouter();
  const today = getISODate();
  const now = parseISODate(today);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [habits, setHabits] = useState<Record<string, HabitDay>>({});
  const [streaks, setStreaks] = useState({ workout: 0, meditation: 0 });
  const [weekMinutes, setWeekMinutes] = useState<{ label: string; minutes: number }[]>([]);
  const [stats, setStats] = useState<MonthlyStats>({ entryCount: 0, quoteCount: 0, photoCount: 0 });
  const [weekQuotes, setWeekQuotes] = useState<Entry[]>([]);

  const load = useCallback(async () => {
    const { start, end } = monthRange(year, month);
    setHabits(await getHabitRange(start, end));
    setStats(await getMonthlyStats(start, end));

    // Streaks always run from today, regardless of the browsed month
    const streakHabits = await getHabitRange(addDays(today, -366), today);
    setStreaks({
      workout: computeStreak(streakHabits, 'workout', today),
      meditation: computeStreak(streakHabits, 'meditation', today),
    });

    // Current week (Mon-Sun) — the same 이번 주 for both the chart and the quotes
    const dow = (parseISODate(today).getDay() + 6) % 7;
    const monday = addDays(today, -dow);
    const weekDates = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
    const minutes = await getWorkoutMinutesByDate(monday, addDays(monday, 6));
    setWeekMinutes(
      weekDates.map((d, i) => ({ label: DAY_LABELS[i], minutes: minutes[d] ?? 0 }))
    );

    setWeekQuotes(await getQuotesInRange(monday, today));
  }, [year, month, today]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setYear(y);
    setMonth(m);
  }

  const { days } = monthRange(year, month);
  const habitsByDay: Record<number, HabitDay | undefined> = {};
  for (let d = 1; d <= days; d++) {
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    habitsByDay[d] = habits[iso];
  }
  const hasAnyHabit = Object.values(habits).length > 0;
  const maxMinutes = Math.max(30, ...weekMinutes.map((w) => w.minutes));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>리듬</Text>

        {/* Month pager */}
        <View style={styles.monthRow}>
          <TouchableOpacity onPress={() => shiftMonth(-1)} hitSlop={10}>
            <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.monthText}>
            {year}년 {month}월
          </Text>
          <TouchableOpacity onPress={() => shiftMonth(1)} hitSlop={10}>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {!hasAnyHabit && stats.entryCount === 0 ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyText}>
              일주일만 기록하면{'\n'}흐름이 보이기 시작합니다
            </Text>
          </View>
        ) : (
          <HabitGrid daysInMonth={days} habits={habitsByDay} />
        )}

        <View style={styles.divider} />

        {/* Streaks */}
        <View style={styles.streakRow}>
          <View style={styles.streakCard}>
            <Text style={styles.streakNumber}>{streaks.workout}</Text>
            <Text style={styles.streakLabel}>운동 연속일</Text>
          </View>
          <View style={styles.streakCard}>
            <Text style={styles.streakNumber}>{streaks.meditation}</Text>
            <Text style={styles.streakLabel}>묵상 연속일</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Weekly workout minutes */}
        <SectionLabel label="이번 주 운동" />
        <View style={styles.chart}>
          {weekMinutes.map((w, i) => (
            <View key={i} style={styles.chartCol}>
              <Text style={styles.chartValue}>{w.minutes > 0 ? w.minutes : ''}</Text>
              <View style={styles.chartBarTrack}>
                <View
                  style={[
                    styles.chartBar,
                    { height: Math.max(2, Math.round((w.minutes / maxMinutes) * 80)) },
                  ]}
                />
              </View>
              <Text style={styles.chartLabel}>{w.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.divider} />

        {/* Monthly counters */}
        <View style={styles.statsRow}>
          <Text style={styles.statsText}>
            기록 {stats.entryCount} · 밑줄 {stats.quoteCount} · 사진 {stats.photoCount}
          </Text>
        </View>

        {/* Week quotes */}
        {weekQuotes.length > 0 && (
          <>
            <View style={styles.divider} />
            <SectionLabel label="이번 주의 밑줄" />
            {weekQuotes.map((e) => (
              <TouchableOpacity
                key={e.id}
                style={styles.quoteCard}
                onPress={() => router.push(`/entry/${e.id}`)}
              >
                <Text style={styles.quoteText} numberOfLines={3}>
                  {e.quote}
                </Text>
                {e.title ? <Text style={styles.quoteSource}>— {e.title}</Text> : null}
              </TouchableOpacity>
            ))}
          </>
        )}

        <View style={styles.divider} />

        {/* Export */}
        <TouchableOpacity style={styles.exportButton} onPress={() => router.push('/export')}>
          <Ionicons name="download-outline" size={16} color={colors.textPrimary} />
          <Text style={styles.exportText}>마크다운으로 내보내기</Text>
        </TouchableOpacity>
        <Text style={styles.exportHint}>Obsidian에 차곡차곡 쌓아보세요</Text>

        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: {
    paddingHorizontal: spacing.screenPadding,
  },
  title: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 17,
    color: colors.textPrimary,
    paddingVertical: 14,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 20,
  },
  monthText: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: 24,
  },
  streakRow: {
    flexDirection: 'row',
    gap: 12,
  },
  streakCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 18,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  streakNumber: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 26,
    color: colors.textPrimary,
  },
  streakLabel: {
    fontFamily: fonts.sansRegular,
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 4,
  },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 130,
    marginTop: 4,
  },
  chartCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  chartValue: {
    fontFamily: fonts.sansRegular,
    fontSize: 10,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  chartBarTrack: {
    width: 16,
    height: 80,
    justifyContent: 'flex-end',
  },
  chartBar: {
    width: 16,
    borderRadius: 5,
    backgroundColor: colors.accentGreen,
    minHeight: 2,
  },
  chartLabel: {
    fontFamily: fonts.sansRegular,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 6,
  },
  statsRow: {
    alignItems: 'center',
  },
  statsText: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  quoteCard: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  quoteText: {
    fontFamily: fonts.serifLight,
    fontSize: 14.5,
    lineHeight: 26,
    color: colors.textPrimary,
  },
  quoteSource: {
    fontFamily: fonts.sansRegular,
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 6,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  exportText: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  exportHint: {
    fontFamily: fonts.sansRegular,
    fontSize: 11.5,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 10,
  },
  emptyBlock: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
