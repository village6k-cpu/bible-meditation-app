import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DayKey } from '../core/dates';
import { useTheme } from '../theme/ThemeProvider';
import { space, type } from '../theme/tokens';

// 먹점 매트릭스 — 그래프가 아니라 먹의 농담으로 그린 잔결.
// 행마다 0 / 0.4 / 0.7 / 1.0 네 단계의 농도, 오늘만 인주색 링.

export type DotLevel = 0 | 1 | 2 | 3;

export interface HeatRow {
  label: string;
  streakLabel: string; // 행 끝의 짧은 문구 ('6일째')
  levels: Map<DayKey, DotLevel>;
}

interface Props {
  days: DayKey[]; // 표시할 날짜들 (예: 최근 8주, 월요일 시작)
  today: DayKey;
  rows: HeatRow[];
  columns?: number; // 한 줄에 놓을 점 수 (기본 28 = 4주)
}

const OPACITY: Record<DotLevel, number> = { 0: 0.12, 1: 0.4, 2: 0.7, 3: 1.0 };

export function HeatDots({ days, today, rows, columns = 28 }: Props) {
  const { palette } = useTheme();
  // 최근 columns일만 — 좁은 화면에서 줄바꿈 없이
  const visible = days.slice(-columns);

  return (
    <View style={{ gap: space.m }}>
      {rows.map((row) => (
        <View key={row.label} style={styles.row}>
          <Text style={[type.caption, { color: palette.textSecondary, width: 34 }]}>
            {row.label}
          </Text>
          <View style={styles.dots}>
            {visible.map((day) => {
              const level = row.levels.get(day) ?? 0;
              const isToday = day === today;
              return (
                <View
                  key={day}
                  style={[
                    styles.dotWrap,
                    isToday && { borderColor: palette.accent, borderWidth: 1.5 },
                  ]}
                >
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: palette.dotInk, opacity: OPACITY[level] },
                    ]}
                  />
                </View>
              );
            })}
          </View>
          <Text
            style={[type.caption, { color: palette.textTertiary, width: 52, textAlign: 'right' }]}
            numberOfLines={1}
          >
            {row.streakLabel}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
  },
  dots: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dotWrap: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
