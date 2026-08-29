import { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../../lib/theme';
import { EntryCard } from '../../components/EntryCard';
import {
  Entry,
  DayMeditation,
  LibrarySegment,
  getLibraryEntries,
  getAllMeditations,
  getAllTags,
  getPinned,
} from '../../lib/journal-db';

const SEGMENTS: { key: LibrarySegment; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'quotes', label: '밑줄' },
  { key: 'book', label: '책' },
  { key: 'youtube', label: '유튜브' },
  { key: 'music', label: '음악' },
  { key: 'writing', label: '글' },
  { key: 'moment', label: '순간' },
  { key: 'meditation', label: '묵상' },
];

export default function LibraryScreen() {
  const router = useRouter();
  const [segment, setSegment] = useState<LibrarySegment>('all');
  const [tag, setTag] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [meditations, setMeditations] = useState<DayMeditation[]>([]);
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  const [pinned, setPinned] = useState<Entry[]>([]);

  const load = useCallback(async () => {
    if (segment === 'meditation') {
      const meds = await getAllMeditations();
      setMeditations(
        query.trim()
          ? meds.filter((m) => m.content.includes(query.trim()))
          : meds
      );
      setEntries([]);
    } else {
      setEntries(await getLibraryEntries({ segment, tag, query }));
      setMeditations([]);
    }
    setTags(await getAllTags(12));
    setPinned(await getPinned(10));
  }, [segment, tag, query]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const showPinned = pinned.length > 0 && segment === 'all' && !tag && !query.trim();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>서재</Text>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color={colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="기록 속에서 찾기"
          placeholderTextColor={colors.textTertiary}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Format segments */}
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.segmentRow}
        >
          {SEGMENTS.map((s) => (
            <TouchableOpacity
              key={s.key}
              style={[styles.segmentChip, segment === s.key && styles.segmentChipActive]}
              onPress={() => setSegment(s.key)}
            >
              <Text
                style={[styles.segmentText, segment === s.key && styles.segmentTextActive]}
              >
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Topic tags */}
      {tags.length > 0 && segment !== 'meditation' && (
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagRow}
          >
            {tags.map((t) => (
              <TouchableOpacity
                key={t.tag}
                style={[styles.tagChip, tag === t.tag && styles.tagChipActive]}
                onPress={() => setTag(tag === t.tag ? null : t.tag)}
              >
                <Text style={[styles.tagText, tag === t.tag && styles.tagTextActive]}>
                  #{t.tag}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {segment === 'meditation' ? (
        meditations.length === 0 ? (
          <EmptyLibrary />
        ) : (
          <FlatList
            data={meditations}
            keyExtractor={(m) => String(m.id)}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.meditationCard}
                onPress={() => router.push(`/note/${item.id}`)}
              >
                <Text style={styles.meditationDate}>{item.date}</Text>
                {item.book_name && item.chapter ? (
                  <Text style={styles.meditationRef}>
                    {item.book_name} {item.chapter}
                    {item.verse ? `:${item.verse}` : ''}
                  </Text>
                ) : null}
                <Text style={styles.meditationText} numberOfLines={3}>
                  {item.content}
                </Text>
              </TouchableOpacity>
            )}
          />
        )
      ) : entries.length === 0 && !showPinned ? (
        <EmptyLibrary />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => String(e.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            showPinned ? (
              <View style={styles.pinnedBlock}>
                <Text style={styles.pinnedLabel}>아껴둔 기록</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {pinned.map((e) => (
                    <TouchableOpacity
                      key={e.id}
                      style={styles.pinnedCard}
                      onPress={() => router.push(`/entry/${e.id}`)}
                    >
                      <Ionicons name="star" size={11} color={colors.accentGreen} />
                      <Text style={styles.pinnedText} numberOfLines={3}>
                        {e.quote ?? e.body ?? e.title ?? ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null
          }
          ListFooterComponent={
            entries.length > 0 ? (
              <Text style={styles.countCaption}>기록 {entries.length}</Text>
            ) : null
          }
          renderItem={({ item }) => (
            <EntryCard
              entry={item}
              showDate
              onPress={() => router.push(`/entry/${item.id}`)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function EmptyLibrary() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>기록이 쌓이면{'\n'}이곳이 당신의 서재가 됩니다</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 17,
    color: colors.textPrimary,
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 14,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacing.screenPadding,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.sansRegular,
    fontSize: 13.5,
    color: colors.textPrimary,
    padding: 0,
  },
  segmentRow: {
    paddingHorizontal: spacing.screenPadding,
    gap: 8,
    paddingBottom: 10,
  },
  segmentChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  segmentChipActive: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  segmentText: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  tagRow: {
    paddingHorizontal: spacing.screenPadding,
    gap: 6,
    paddingBottom: 6,
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  tagChipActive: {
    backgroundColor: colors.accentGreen,
  },
  tagText: {
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  tagTextActive: {
    color: '#FFFFFF',
  },
  list: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 120,
  },
  pinnedBlock: {
    paddingTop: 10,
    paddingBottom: 4,
  },
  pinnedLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10.5,
    letterSpacing: 1,
    color: colors.accentGreen,
    marginBottom: 10,
  },
  pinnedCard: {
    width: 150,
    marginRight: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
    gap: 6,
  },
  pinnedText: {
    fontFamily: fonts.serifLight,
    fontSize: 12.5,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  countCaption: {
    fontFamily: fonts.sansRegular,
    fontSize: 11.5,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingVertical: 18,
  },
  meditationCard: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  meditationDate: {
    fontFamily: fonts.sansRegular,
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  meditationRef: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.accentGreen,
    marginBottom: 6,
  },
  meditationText: {
    fontFamily: fonts.serifLight,
    fontSize: 14.5,
    lineHeight: 26,
    color: colors.textPrimary,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
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
