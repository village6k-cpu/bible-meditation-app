import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { Screen } from '../../src/components/Screen';
import { HeatDots, HeatRow } from '../../src/components/HeatDots';
import { S } from '../../src/core/strings.ko';
import { DayKey, addDays, mondayOf, rangeOfDays, todayKey } from '../../src/core/dates';
import { REGISTRY } from '../../src/core/registry';
import { PracticeKey, dotLevel, streakOf, weekCount } from '../../src/core/trends';
import { EntryType, TrendRow } from '../../src/core/types';
import { MonthShelfRow, monthShelf, trendRows } from '../../src/db/entryRepo';
import { useTheme } from '../../src/theme/ThemeProvider';
import { radius, space, type } from '../../src/theme/tokens';

const DOW_KO = ['월', '화', '수', '목', '금', '토', '일'];
const MATRIX_DAYS = 28;

export default function TrendsScreen() {
  const { palette } = useTheme();
  const db = useSQLiteContext();
  const router = useRouter();

  const [today, setToday] = useState(todayKey());
  const [rowsByDay, setRowsByDay] = useState<Map<DayKey, TrendRow>>(new Map());
  const [shelf, setShelf] = useState<MonthShelfRow[]>([]);

  const load = useCallback(async () => {
    const day = todayKey();
    setToday(day);
    // 스트릭 계산까지 커버할 만큼 넉넉히 — 최근 400일
    const rows = await trendRows(db, addDays(day, -400), day);
    setRowsByDay(new Map(rows.map((r) => [r.day, r])));
    setShelf(await monthShelf(db, `${day.slice(0, 7)}-01`, day));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const matrixDays = rangeOfDays(addDays(today, -(MATRIX_DAYS - 1)), today);
  const weekDays = rangeOfDays(mondayOf(today), today);
  const hasAnything = rowsByDay.size > 0;

  const practiceKeys: PracticeKey[] = ['workout', 'meal', 'verse', 'record'];
  const heatRows: HeatRow[] = practiceKeys.map((key) => {
    const streak = streakOf(key, rowsByDay, today);
    const label =
      streak > 0 ? `${streak}일째` : `주 ${weekCount(key, rowsByDay, weekDays)}일`;
    return {
      label: S.trends_rows[key],
      streakLabel: label,
      levels: new Map(matrixDays.map((d) => [d, dotLevel(key, rowsByDay.get(d))])),
    };
  });

  // 이번 주 운동 막대
  const fullWeek = rangeOfDays(mondayOf(today), addDays(mondayOf(today), 6));
  const weekMinutes = fullWeek.map((d) => rowsByDay.get(d)?.workoutMinutes ?? 0);
  const maxMinutes = Math.max(30, ...weekMinutes);

  const shelfMax = Math.max(1, ...shelf.map((s) => s.count));

  return (
    <Screen title={S.tab_trends}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {!hasAnything ? (
          <View style={styles.empty}>
            <Text style={[type.bodySerif, { color: palette.textSecondary, textAlign: 'center' }]}>
              {S.empty_trends}
            </Text>
          </View>
        ) : (
          <>
            {/* 실천의 무늬 */}
            <Text style={[type.micro, styles.sectionLabel, { color: palette.textTertiary }]}>
              {S.trends_practice_header}
            </Text>
            <HeatDots days={matrixDays} today={today} rows={heatRows} columns={MATRIX_DAYS} />

            <View style={[styles.divider, { backgroundColor: palette.divider }]} />

            {/* 이번 주 운동 */}
            <Text style={[type.micro, styles.sectionLabel, { color: palette.textTertiary }]}>
              {S.trends_week_workout}
            </Text>
            <View style={styles.chart}>
              {fullWeek.map((d, i) => {
                const minutes = weekMinutes[i];
                const isToday = d === today;
                return (
                  <View key={d} style={styles.chartCol}>
                    <Text style={[type.caption, { color: palette.textSecondary, fontSize: 11 }]}>
                      {minutes > 0 ? minutes : ''}
                    </Text>
                    <View style={styles.chartTrack}>
                      <View
                        style={{
                          width: 14,
                          borderRadius: 4,
                          height: Math.max(3, Math.round((minutes / maxMinutes) * 72)),
                          backgroundColor: isToday ? palette.accent : palette.dotInk,
                          opacity: isToday ? 1 : minutes > 0 ? 0.7 : 0.15,
                        }}
                      />
                    </View>
                    <Text style={[type.caption, { color: isToday ? palette.accent : palette.textTertiary }]}>
                      {DOW_KO[i]}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View style={[styles.divider, { backgroundColor: palette.divider }]} />

            {/* 이달의 서재 — 통계가 곧 책장이 되는 마무리 */}
            <Text style={[type.micro, styles.sectionLabel, { color: palette.textTertiary }]}>
              {S.trends_month_shelf}
            </Text>
            {shelf.map((row) => (
              <View key={row.type} style={styles.shelfRow}>
                <Text style={[type.caption, { color: palette.textSecondary, width: 34 }]}>
                  {REGISTRY[row.type as EntryType].label}
                </Text>
                <View style={styles.shelfTrack}>
                  <View
                    style={[
                      styles.spine,
                      {
                        backgroundColor: palette.dotInk,
                        opacity: 0.15 + 0.55 * (row.count / shelfMax),
                        width: `${Math.max(8, Math.round((row.count / shelfMax) * 100))}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={[type.caption, { color: palette.textTertiary, width: 30, textAlign: 'right' }]}>
                  {row.count}
                </Text>
              </View>
            ))}
          </>
        )}

        <View style={[styles.divider, { backgroundColor: palette.divider }]} />

        {/* 내보내기 */}
        <Pressable
          onPress={() => router.push('/settings')}
          style={({ pressed }) => [
            styles.exportButton,
            { backgroundColor: palette.surfaceSunken, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="download-outline" size={16} color={palette.textPrimary} />
          <Text style={[type.label, { color: palette.textPrimary }]}>{S.export_action}</Text>
        </Pressable>

        <View style={{ height: 80 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: space.gutter },
  sectionLabel: {
    textTransform: 'uppercase',
    marginBottom: space.m,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: space.xxl,
  },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chartCol: {
    alignItems: 'center',
    gap: space.xs,
  },
  chartTrack: {
    height: 72,
    justifyContent: 'flex-end',
  },
  shelfRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    marginBottom: space.m,
  },
  shelfTrack: { flex: 1 },
  spine: {
    height: 16,
    borderRadius: 3,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s,
    paddingVertical: space.l,
    borderRadius: radius.button,
  },
  empty: { paddingVertical: 64 },
});
