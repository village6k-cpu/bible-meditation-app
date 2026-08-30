import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../../lib/theme';
import { addDays, formatISODateKo, getISODate } from '../../lib/utils';
import {
  Entry,
  DayLog,
  Todo,
  getActiveDates,
  getEntriesInRange,
  getDayLogsInRange,
  getTodosByDate,
  getHabitRange,
  HabitDay,
  photoUriToAbsolute,
} from '../../lib/journal-db';

interface DayCardData {
  date: string;
  entries: Entry[];
  dayLog: DayLog | null;
  habit: HabitDay | null;
  todoCount: number;
  todoDone: number;
}

const PAGE_SIZE = 21;

export default function DayScreen() {
  const router = useRouter();
  const [days, setDays] = useState<DayCardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [exhausted, setExhausted] = useState(false);

  const today = getISODate();

  const buildCards = useCallback(async (dates: string[]): Promise<DayCardData[]> => {
    if (dates.length === 0) return [];
    const minDate = dates[dates.length - 1];
    const maxDate = dates[0];
    const [entries, dayLogs, habits] = await Promise.all([
      getEntriesInRange(minDate, maxDate),
      getDayLogsInRange(minDate, maxDate),
      getHabitRange(minDate, maxDate),
    ]);
    const logByDate = new Map(dayLogs.map((l) => [l.date, l]));
    const cards: DayCardData[] = [];
    for (const date of dates) {
      const todos = await getTodosByDate(date);
      cards.push({
        date,
        entries: entries.filter((e) => e.date === date),
        dayLog: logByDate.get(date) ?? null,
        habit: habits[date] ?? null,
        todoCount: todos.length,
        todoDone: todos.filter((t) => t.done === 1).length,
      });
    }
    return cards;
  }, []);

  const load = useCallback(async () => {
    const dates = await getActiveDates(PAGE_SIZE);
    // Today always leads the timeline, even before its first record
    if (dates[0] !== today) dates.unshift(today);
    setDays(await buildCards(dates));
    setExhausted(dates.length < PAGE_SIZE);
  }, [buildCards, today]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function loadMore() {
    if (loading || exhausted || days.length === 0) return;
    setLoading(true);
    try {
      const last = days[days.length - 1].date;
      const dates = await getActiveDates(PAGE_SIZE, last);
      if (dates.length === 0) {
        setExhausted(true);
        return;
      }
      const more = await buildCards(dates);
      setDays((prev) => [...prev, ...more]);
      if (dates.length < PAGE_SIZE) setExhausted(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>하루</Text>
      </View>

      {days.length <= 1 && !days.some(dayHasAnything) ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>아직 기록이 없습니다{'\n'}작은 순간부터 남겨보세요</Text>
        </View>
      ) : (
        <FlatList
          data={days}
          keyExtractor={(item) => item.date}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          renderItem={({ item }) => (
            <DayCard data={item} onPress={() => router.push(`/day/${item.date}`)} />
          )}
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => router.push('/entry/new')}>
        <Ionicons name="add" size={26} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function dayHasAnything(d: DayCardData): boolean {
  return (
    d.entries.length > 0 ||
    d.todoCount > 0 ||
    !!d.dayLog?.day_title ||
    d.habit?.workout === true ||
    d.habit?.meditation === true ||
    d.habit?.diet !== null && d.habit?.diet !== undefined
  );
}

function HabitDots({ habit }: { habit: HabitDay | null }) {
  const items: { label: string; on: boolean; missed: boolean }[] = [
    { label: '운동', on: habit?.workout === true, missed: false },
    { label: '식단', on: habit?.diet === true, missed: habit?.diet === false },
    { label: '묵상', on: habit?.meditation === true, missed: false },
  ];
  return (
    <View style={styles.habitRow}>
      {items.map((i) => (
        <View key={i.label} style={styles.habitItem}>
          <View
            style={[styles.habitDot, i.on && styles.habitDotOn, i.missed && styles.habitDotMissed]}
          />
          <Text style={styles.habitLabel}>{i.label}</Text>
        </View>
      ))}
    </View>
  );
}

function DayCard({ data, onPress }: { data: DayCardData; onPress: () => void }) {
  const today = getISODate();
  const photos = data.entries
    .map((e) => photoUriToAbsolute(e.photo_uri))
    .filter((p): p is string => p !== null)
    .slice(0, 3);
  const snippetEntry =
    data.entries.find((e) => e.quote) ?? data.entries.find((e) => e.body);
  const snippet = snippetEntry?.quote ?? snippetEntry?.body ?? null;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardDate}>
          {data.date === today ? '오늘' : formatISODateKo(data.date)}
        </Text>
        <Text style={styles.cardCount}>
          {data.entries.length > 0 ? `기록 ${data.entries.length}` : ''}
        </Text>
      </View>
      {data.dayLog?.day_title ? (
        <Text style={styles.cardTitle}>{data.dayLog.day_title}</Text>
      ) : null}
      <HabitDots habit={data.habit} />
      {photos.length > 0 && (
        <View style={styles.photoRow}>
          {photos.map((p, i) => (
            <Image key={i} source={{ uri: p }} style={styles.photoThumb} />
          ))}
        </View>
      )}
      {snippet ? (
        <Text
          style={snippetEntry?.quote ? styles.snippetQuote : styles.snippetBody}
          numberOfLines={2}
        >
          {snippet}
        </Text>
      ) : null}
      {data.todoCount > 0 && (
        <Text style={styles.todoSummary}>
          할 일 {data.todoDone}/{data.todoCount}
        </Text>
      )}
      {data.entries.length === 0 && data.todoCount === 0 && data.date === today && (
        <Text style={styles.cardEmpty}>오늘의 첫 기록을 남겨보세요</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  titleRow: {
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 14,
  },
  title: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 17,
    color: colors.textPrimary,
  },
  list: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 140,
  },
  card: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  cardDate: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  cardCount: {
    fontFamily: fonts.sansRegular,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  cardTitle: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  habitRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 6,
    marginBottom: 8,
  },
  habitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  habitDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  habitDotOn: {
    backgroundColor: colors.accentGreen,
  },
  habitDotMissed: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.accentRed,
  },
  habitLabel: {
    fontFamily: fonts.sansRegular,
    fontSize: 10.5,
    color: colors.textSecondary,
  },
  photoRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  photoThumb: {
    flex: 1,
    height: 84,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  snippetQuote: {
    fontFamily: fonts.serifLight,
    fontSize: 14,
    lineHeight: 25,
    color: colors.textPrimary,
    marginTop: 2,
  },
  snippetBody: {
    fontFamily: fonts.sansRegular,
    fontSize: 13.5,
    lineHeight: 21,
    color: colors.textPrimary,
    marginTop: 2,
  },
  todoSummary: {
    fontFamily: fonts.sansRegular,
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 8,
  },
  cardEmpty: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: 2,
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
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 108,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accentGreen,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
});
