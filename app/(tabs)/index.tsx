import { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, typography } from '../../lib/theme';
import { formatDateKo, getGreeting, getISODate, getWeekDates } from '../../lib/utils';
import { useAppStore } from '../../lib/store';
import {
  Entry,
  HabitDay,
  getDailyPick,
  getHabitRange,
  getOnThisDay,
  getTodayEntryCount,
  relativeDaysLabel,
} from '../../lib/journal-db';
import { MEDIA_KIND_LABELS } from '../../lib/journal-utils';
import {
  getRandomVerse,
  getDailyReadings,
  addDailyReading,
  toggleDailyReading,
  getReadingHistory,
  markDayCompleted,
  saveNote,
  DailyReading,
  Verse,
} from '../../lib/bible-data';
import { SectionLabel } from '../../components/SectionLabel';
import { CircleProgress } from '../../components/CircleProgress';
import { WeekDots } from '../../components/WeekDots';
import { ReadingChecklist } from '../../components/ReadingChecklist';
import { AddReadingModal } from '../../components/AddReadingModal';
import { MiniPlayer } from '../../components/MiniPlayer';

export default function HomeScreen() {
  const router = useRouter();
  const userName = useAppStore((s) => s.userName);
  const [dailyVerse, setDailyVerse] = useState<(Verse & { book_name: string }) | null>(null);
  const [showVerseDetails, setShowVerseDetails] = useState(false);
  const [readings, setReadings] = useState<DailyReading[]>([]);
  const [weekHistory, setWeekHistory] = useState<Record<string, boolean>>({});
  const [noteText, setNoteText] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [todayCount, setTodayCount] = useState(0);
  const [todayHabit, setTodayHabit] = useState<HabitDay | null>(null);
  const [resurfaced, setResurfaced] = useState<Entry | null>(null);
  const [isOnThisDay, setIsOnThisDay] = useState(false);

  const today = getISODate();

  async function loadData() {
    const verse = await getRandomVerse();
    setDailyVerse(verse);

    await loadReadings();
    await loadWeekHistory();
    await loadJournal();
  }

  async function loadJournal() {
    setTodayCount(await getTodayEntryCount(today));
    const habits = await getHabitRange(today, today);
    setTodayHabit(habits[today] ?? null);

    const onThisDay = await getOnThisDay(today);
    if (onThisDay) {
      setResurfaced(onThisDay);
      setIsOnThisDay(true);
    } else {
      setResurfaced(await getDailyPick(today));
      setIsOnThisDay(false);
    }
  }

  async function loadReadings() {
    const r = await getDailyReadings(today);
    setReadings(r);
  }

  async function loadWeekHistory() {
    const dates = getWeekDates().map(getISODate);
    const history = await getReadingHistory(dates);
    setWeekHistory(history);
  }

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function handleToggle(id: number) {
    await toggleDailyReading(id);
    await loadReadings();

    // Check if all done → mark day completed
    const updated = await getDailyReadings(today);
    if (updated.length > 0 && updated.every((r) => r.completed)) {
      await markDayCompleted(today);
      await loadWeekHistory();
    }
  }

  async function handleAddReading(bookId: number, startChapter: number, endChapter: number) {
    await addDailyReading(today, bookId, startChapter, endChapter);
    await loadReadings();
  }

  const completedCount = readings.filter((r) => r.completed).length;
  const progressPercent = readings.length > 0 ? (completedCount / readings.length) * 100 : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={typography.dateText}>{formatDateKo()}</Text>
            <Text style={styles.greeting}>
              <Text style={{ fontFamily: fonts.sansMedium }}>{userName}</Text>
              {'님, '}
              {getGreeting()}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.captureButton}
            onPress={() => router.push('/entry/new')}
            hitSlop={8}
          >
            <Ionicons name="add" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* 오늘 요약 */}
        <TouchableOpacity
          style={styles.todayStrip}
          onPress={() => router.push(`/day/${today}`)}
          activeOpacity={0.7}
        >
          <Text style={styles.todayStripText}>오늘의 기록 {todayCount}</Text>
          <View style={styles.todayStripDots}>
            {(
              [
                ['운동', todayHabit?.workout === true],
                ['식단', todayHabit?.diet === true],
                ['묵상', todayHabit?.meditation === true],
              ] as [string, boolean][]
            ).map(([label, on]) => (
              <View key={label} style={styles.todayStripItem}>
                <View style={[styles.todayStripDot, on && styles.todayStripDotOn]} />
                <Text style={styles.todayStripLabel}>{label}</Text>
              </View>
            ))}
          </View>
          <Ionicons name="chevron-forward" size={13} color={colors.textTertiary} />
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider} />

        {/* 오늘의 말씀 */}
        <SectionLabel label="오늘의 말씀" />
        {dailyVerse && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setShowVerseDetails(!showVerseDetails)}
          >
            <Text style={styles.verseText}>{dailyVerse.text}</Text>
            <Text style={styles.verseSource}>
              — {dailyVerse.book_name} {dailyVerse.chapter}:{dailyVerse.verse}
            </Text>
            {showVerseDetails && (
              <View style={styles.verseDetails}>
                <Text style={styles.verseDetailText}>
                  관련 자료가 곧 추가됩니다.
                </Text>
              </View>
            )}
            <Text style={styles.tapHint}>탭하여 관련 자료 보기</Text>
          </TouchableOpacity>
        )}

        {/* Divider */}
        <View style={styles.divider} />

        {/* 다시 꺼내 읽기 */}
        <SectionLabel label={isOnThisDay ? '그날의 기록' : '다시 꺼내 읽기'} />
        {resurfaced ? (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push(`/entry/${resurfaced.id}`)}
          >
            <Text style={styles.resurfaceText} numberOfLines={4}>
              {resurfaced.quote ?? resurfaced.body ?? resurfaced.title ?? ''}
            </Text>
            <Text style={styles.resurfaceCaption}>
              {relativeDaysLabel(resurfaced.date, today)}
              {resurfaced.title && resurfaced.quote
                ? ` · ${
                    resurfaced.media_kind ? MEDIA_KIND_LABELS[resurfaced.media_kind] : ''
                  } 「${resurfaced.title}」`
                : ''}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/entry/new')}>
            <Text style={styles.resurfaceEmpty}>
              기록이 쌓이면 이곳에서 다시 만나요{'\n'}오늘의 첫 기록을 남겨보세요
            </Text>
          </TouchableOpacity>
        )}

        {/* Divider */}
        <View style={styles.divider} />

        {/* 묵상 읽기표 */}
        <SectionLabel label="묵상 읽기표" />
        <CircleProgress percent={progressPercent} />
        <WeekDots completedDates={weekHistory} />
        <ReadingChecklist
          readings={readings}
          onToggle={handleToggle}
          onAdd={() => setShowAddModal(true)}
        />

        {/* Divider */}
        <View style={styles.divider} />

        {/* 묵상 노트 */}
        <SectionLabel
          label="묵상 노트"
          right={<Text style={typography.dateText}>{formatDateKo()}</Text>}
        />
        <TextInput
          style={styles.noteInput}
          placeholder="오늘의 묵상을 기록해 보세요..."
          placeholderTextColor={colors.textTertiary}
          multiline
          value={noteText}
          onChangeText={setNoteText}
          onBlur={async () => {
            if (noteText.trim()) {
              await saveNote(noteText.trim());
              setNoteText('');
            }
          }}
        />

        {/* Divider */}
        <View style={styles.divider} />

        {/* 미니 플레이어 */}
        <SectionLabel label="앰비언트" />
        <MiniPlayer />

        <View style={{ height: 100 }} />
      </ScrollView>

      <AddReadingModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddReading}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  captureButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  todayStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  todayStripText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12.5,
    color: colors.textPrimary,
  },
  todayStripDots: {
    flexDirection: 'row',
    gap: 12,
  },
  todayStripItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  todayStripDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  todayStripDotOn: {
    backgroundColor: colors.accentGreen,
  },
  todayStripLabel: {
    fontFamily: fonts.sansRegular,
    fontSize: 10.5,
    color: colors.textSecondary,
  },
  resurfaceText: {
    fontFamily: fonts.serifLight,
    fontSize: 15,
    lineHeight: 30,
    color: colors.textPrimary,
  },
  resurfaceCaption: {
    fontFamily: fonts.sansRegular,
    fontSize: 11.5,
    color: '#AAAAAA',
    marginTop: 10,
  },
  resurfaceEmpty: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    lineHeight: 22,
    color: colors.textTertiary,
  },
  greeting: {
    fontFamily: fonts.serifLight,
    fontSize: 21,
    color: colors.textPrimary,
    marginTop: 6,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.sectionGap,
  },
  verseText: {
    fontFamily: fonts.serifLight,
    fontSize: 15,
    lineHeight: 30,
    color: colors.textPrimary,
  },
  verseSource: {
    fontFamily: fonts.sansRegular,
    fontSize: 11.5,
    color: '#AAAAAA',
    marginTop: 10,
  },
  verseDetails: {
    backgroundColor: colors.surface,
    borderRadius: spacing.cardRadius,
    padding: 16,
    marginTop: 14,
  },
  verseDetailText: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  tapHint: {
    fontFamily: fonts.sansRegular,
    fontSize: 10.5,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 10,
  },
  noteInput: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: 'rgba(0,0,0,0.015)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    borderRadius: 12,
    padding: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
});
