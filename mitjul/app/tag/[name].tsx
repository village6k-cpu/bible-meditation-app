import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { EntryCard } from '../../src/components/EntryCard';
import { Underline } from '../../src/components/Underline';
import { S } from '../../src/core/strings.ko';
import { formatDayShortKo } from '../../src/core/dates';
import { Entry } from '../../src/core/types';
import { entriesByTag, tagsOf } from '../../src/db/entryRepo';
import { tagBookends } from '../../src/db/tagRepo';
import { useTheme } from '../../src/theme/ThemeProvider';
import { space, type } from '../../src/theme/tokens';

// 갈피 — 한 주제로 걷는 책장. 책 밑줄과 영상 메모와 묵상이 나란히 놓인다.
export default function TagScreen() {
  const { palette } = useTheme();
  const db = useSQLiteContext();
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name: string }>();
  const tag = name ? decodeURIComponent(name) : '';

  const [entries, setEntries] = useState<Entry[]>([]);
  const [tagMap, setTagMap] = useState<Map<string, string[]>>(new Map());
  const [bookends, setBookends] = useState<{ first: string; latest: string; count: number } | null>(
    null
  );

  const load = useCallback(async () => {
    if (!tag) return;
    const rows = await entriesByTag(db, tag);
    setEntries(rows);
    setTagMap(await tagsOf(db, rows.map((e) => e.id)));
    setBookends(await tagBookends(db, tag));
  }, [db, tag]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={palette.textPrimary} />
        </Pressable>
      </View>

      <View style={styles.titleWrap}>
        <Text style={[type.display, { color: palette.textPrimary }]}>#{tag}</Text>
        <Underline width={40} />
        {bookends ? (
          <Text style={[type.caption, { color: palette.textTertiary, marginTop: space.s }]}>
            {`기록 ${bookends.count} · ${S.tag_bookend_first} ${formatDayShortKo(bookends.first)} · ${S.tag_bookend_latest} ${formatDayShortKo(bookends.latest)}`}
          </Text>
        ) : null}
      </View>

      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <EntryCard
            entry={item}
            tags={tagMap.get(item.id)}
            onPress={() => router.push(`/entry/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[type.bodySerif, { color: palette.textSecondary, textAlign: 'center' }]}>
              {S.empty_tag}
            </Text>
          </View>
        }
        ListFooterComponent={<View style={{ height: 60 }} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: space.gutter,
    paddingVertical: space.m,
  },
  titleWrap: {
    paddingHorizontal: space.gutter,
    paddingBottom: space.l,
  },
  list: { paddingHorizontal: space.gutter },
  empty: { paddingVertical: 64 },
});
