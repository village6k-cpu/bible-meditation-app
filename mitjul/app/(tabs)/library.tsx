import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { Screen } from '../../src/components/Screen';
import { EntryCard } from '../../src/components/EntryCard';
import { TagChips } from '../../src/components/TagChips';
import { S } from '../../src/core/strings.ko';
import { todayKey } from '../../src/core/dates';
import { REGISTRY, TYPE_ORDER } from '../../src/core/registry';
import { Entry, EntryType, Tag } from '../../src/core/types';
import { queryLibrary, tagsOf } from '../../src/db/entryRepo';
import { topTags } from '../../src/db/tagRepo';
import { useTheme } from '../../src/theme/ThemeProvider';
import { radius, space, type } from '../../src/theme/tokens';

type Sort = 'recent' | 'dusty' | 'pinned';

const SEGMENT_TYPES = TYPE_ORDER.filter((t) => t !== 'task');

export default function LibraryScreen() {
  const { palette } = useTheme();
  const db = useSQLiteContext();
  const router = useRouter();

  const [segment, setSegment] = useState<EntryType | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [tagMap, setTagMap] = useState<Map<string, string[]>>(new Map());
  const [tags, setTags] = useState<Tag[]>([]);

  const load = useCallback(async () => {
    const rows = await queryLibrary(db, {
      type: segment,
      tag,
      q,
      sort: sort === 'dusty' ? 'dusty' : 'recent',
      pinnedOnly: sort === 'pinned',
    });
    setEntries(rows);
    setTagMap(await tagsOf(db, rows.map((e) => e.id)));
    setTags(await topTags(db));
  }, [db, segment, tag, q, sort]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const today = todayKey();

  // '먼지'를 보이게 하기 — 마지막으로 다시 읽은 지 며칠이 지났는지
  function dustLabel(e: Entry): string | undefined {
    if (sort !== 'dusty') return undefined;
    if (e.last_revisited_at === null) return S.library_never_read;
    const days = Math.max(0, Math.floor((Date.now() - e.last_revisited_at) / 86400_000));
    return days === 0 ? '오늘 읽음' : S.library_last_read(days);
  }

  const sortOptions: { key: Sort; label: string }[] = [
    { key: 'recent', label: S.library_sort_recent },
    { key: 'dusty', label: S.library_sort_dusty },
    { key: 'pinned', label: S.library_filter_pinned },
  ];

  return (
    <Screen title={S.tab_library}>
      {/* 검색 */}
      <View style={styles.searchWrap}>
        <View style={[styles.search, { backgroundColor: palette.surfaceSunken }]}>
          <Ionicons name="search-outline" size={15} color={palette.textTertiary} />
          <TextInput
            style={[type.label, styles.searchInput, { color: palette.textPrimary }]}
            placeholder={S.library_search_placeholder}
            placeholderTextColor={palette.textTertiary}
            value={q}
            onChangeText={setQ}
            returnKeyType="search"
          />
          {q.length > 0 && (
            <Pressable onPress={() => setQ('')} hitSlop={8}>
              <Ionicons name="close-circle" size={15} color={palette.textTertiary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* 형식 서가 */}
      <View style={styles.segmentWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.segmentRow}
        >
          {[null, ...SEGMENT_TYPES].map((t) => {
            const active = segment === t;
            const label = t === null ? S.library_all : REGISTRY[t].label;
            return (
              <Pressable key={label} onPress={() => setSegment(t)} style={styles.segment}>
                <Text
                  style={[
                    type.label,
                    { color: active ? palette.textPrimary : palette.textTertiary },
                  ]}
                >
                  {label}
                </Text>
                <View
                  style={[
                    styles.segmentStroke,
                    { backgroundColor: active ? palette.accent : 'transparent' },
                  ]}
                />
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 갈피(태그) — 선택된 갈피가 상위 목록에서 밀려나도 칩은 남아서 해제할 수 있게 */}
      {(tags.length > 0 || tag) && (
        <View style={styles.tagWrap}>
          <TagChips
            tags={
              tag && !tags.some((t) => t.name === tag)
                ? [tag, ...tags.map((t) => t.name)]
                : tags.map((t) => t.name)
            }
            selected={tag}
            onPress={(t) => setTag(tag === t ? null : t)}
          />
        </View>
      )}

      {/* 정렬 */}
      <View style={styles.sortRow}>
        {sortOptions.map((opt) => {
          const active = sort === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => setSort(opt.key)}
              style={[
                styles.sortChip,
                {
                  backgroundColor: active ? palette.accentSoft : 'transparent',
                  borderColor: active ? palette.accent : palette.divider,
                },
              ]}
            >
              <Text
                style={[type.caption, { color: active ? palette.accent : palette.textSecondary }]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <EntryCard
            entry={item}
            tags={tagMap.get(item.id)}
            meta={dustLabel(item)}
            onPress={() => router.push(`/entry/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[type.bodySerif, { color: palette.textSecondary, textAlign: 'center' }]}>
              {sort === 'pinned' && !q.trim() && !tag && !segment
                ? '아껴둔 기록이 아직 없어요.\n마음에 남는 밑줄에 갈피를 꽂아보세요.'
                : q.trim() || tag || segment
                  ? S.empty_search
                  : S.empty_library}
            </Text>
          </View>
        }
        ListFooterComponent={<View style={{ height: 80 }} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchWrap: { paddingHorizontal: space.gutter, marginBottom: space.m },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    paddingHorizontal: space.m,
    paddingVertical: 9,
    borderRadius: radius.button,
  },
  searchInput: { flex: 1, padding: 0 },
  segmentWrap: { marginBottom: space.m },
  segmentRow: { paddingHorizontal: space.gutter, gap: space.l },
  segment: { alignItems: 'center', gap: 4, paddingVertical: 2 },
  segmentStroke: { height: 2, alignSelf: 'stretch', borderRadius: 1 },
  tagWrap: { marginBottom: space.m },
  sortRow: {
    flexDirection: 'row',
    gap: space.s,
    paddingHorizontal: space.gutter,
    marginBottom: space.xs,
  },
  sortChip: {
    paddingHorizontal: space.m,
    paddingVertical: 5,
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
  },
  list: { paddingHorizontal: space.gutter },
  empty: { paddingVertical: 64 },
});
