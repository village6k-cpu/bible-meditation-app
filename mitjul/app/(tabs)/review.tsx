import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';
import { S } from '../../src/core/strings.ko';
import { daysBetween, todayKey } from '../../src/core/dates';
import { specOf } from '../../src/core/registry';
import { Entry } from '../../src/core/types';
import { markFiled, queryLibrary, unfiledEntries } from '../../src/db/entryRepo';
import { useTheme } from '../../src/theme/ThemeProvider';
import { grid, radius, space, type } from '../../src/theme/tokens';

// 정리는 사용자가 기억해야 할 일이 아니라, 앱이 내미는 줄이다.
// 구조가 붙지 않은 기록과 오래 안 읽은 기록을 여기 모아 한 번에 처리한다.

export default function ReviewScreen() {
  const { palette } = useTheme();
  const db = useSQLiteContext();
  const router = useRouter();

  const [unfiled, setUnfiled] = useState<Entry[]>([]);
  const [dusty, setDusty] = useState<Entry[]>([]);

  const load = useCallback(async () => {
    setUnfiled(await unfiledEntries(db, 20));
    setDusty(await queryLibrary(db, { sort: 'dusty', limit: 6 }));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function leaveAsIs(id: string) {
    Haptics.selectionAsync();
    await markFiled(db, id);
    setUnfiled((prev) => prev.filter((e) => e.id !== id));
  }

  const today = todayKey();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Text style={[type.display, { color: palette.textPrimary }]}>{S.review_title}</Text>
        <Text style={[type.mono, { color: palette.textTertiary }]}>
          {S.records_count(unfiled.length)}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* 구조 없는 기록 — 한 번의 탭으로 붙이거나 그대로 둔다 */}
        <SectionLabel text={S.review_unfiled} count={unfiled.length} />
        {unfiled.length === 0 ? (
          <Text style={[type.caption, styles.empty, { color: palette.textTertiary }]}>
            {S.review_empty}
          </Text>
        ) : (
          <>
            <Text style={[type.caption, styles.sectionHint, { color: palette.textTertiary }]}>
              {S.review_unfiled_hint}
            </Text>
            {unfiled.map((e) => (
              <View key={e.id} style={[styles.row, { borderBottomColor: palette.divider }]}>
                <Pressable style={styles.rowMain} onPress={() => router.push(`/entry/${e.id}`)}>
                  <Text style={[type.micro, { color: palette.textTertiary }]}>
                    {specOf(e.type).label.toUpperCase()}
                  </Text>
                  <Text style={[type.body, { color: palette.textPrimary }]} numberOfLines={2}>
                    {e.quote ?? e.body ?? e.title ?? ''}
                  </Text>
                </Pressable>
                <View style={styles.rowActions}>
                  <Pressable
                    onPress={() => router.push(`/compose?id=${e.id}`)}
                    style={[styles.action, { borderColor: palette.divider }]}
                    hitSlop={6}
                  >
                    <Text style={[type.caption, { color: palette.textPrimary }]}>
                      {S.records_filter_tag}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => leaveAsIs(e.id)} style={styles.actionQuiet} hitSlop={6}>
                    <Text style={[type.caption, { color: palette.textTertiary }]}>
                      {S.review_leave}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        )}

        {/* 오래 안 읽은 기록 — 서가의 먼지 */}
        <SectionLabel text={S.review_dusty} count={dusty.length} />
        {dusty.map((e) => {
          const days = daysBetween(e.day, today);
          return (
            <Pressable
              key={e.id}
              onPress={() => router.push(`/entry/${e.id}`)}
              style={({ pressed }) => [
                styles.dustyRow,
                { borderBottomColor: palette.divider, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text style={[type.micro, styles.dustyType, { color: palette.textTertiary }]}>
                {specOf(e.type).label.toUpperCase()}
              </Text>
              <Text style={[type.label, { color: palette.textPrimary, flex: 1 }]} numberOfLines={1}>
                {e.quote ?? e.title ?? e.body ?? ''}
              </Text>
              <Text style={[type.mono, { color: palette.textTertiary }]}>
                {e.last_revisited_at === null ? '—' : `${days}d`}
              </Text>
              <Ionicons name="chevron-forward" size={13} color={palette.textTertiary} />
            </Pressable>
          );
        })}

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionLabel({ text, count }: { text: string; count: number }) {
  const { palette } = useTheme();
  return (
    <View style={[styles.sectionRow, { borderBottomColor: palette.divider }]}>
      <Text style={[type.micro, { color: palette.textSecondary }]}>{text.toUpperCase()}</Text>
      <Text style={[type.mono, { color: palette.textTertiary }]}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.gutter,
    height: grid.row + 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scroll: { paddingBottom: space.xxl },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.gutter,
    height: grid.rowDense,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: space.xxl,
  },
  sectionHint: {
    paddingHorizontal: space.gutter,
    paddingTop: space.s,
  },
  empty: {
    paddingHorizontal: space.gutter,
    paddingVertical: space.l,
  },
  row: {
    paddingHorizontal: space.gutter,
    paddingVertical: space.m,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: space.s,
  },
  rowMain: { gap: 3 },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
  },
  action: {
    paddingHorizontal: space.m,
    height: 28,
    justifyContent: 'center',
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionQuiet: {
    height: 28,
    justifyContent: 'center',
  },
  dustyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingHorizontal: space.gutter,
    height: grid.row,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dustyType: { width: 34 },
});
