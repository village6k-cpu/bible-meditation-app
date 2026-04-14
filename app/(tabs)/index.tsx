import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, typography } from '../../lib/theme';
import { formatDateKo, getGreeting, getISODate, getWeekDates } from '../../lib/utils';
import { useAppStore } from '../../lib/store';
import {
  getRandomVerse,
  getDailyReadings,
  addDailyReading,
  getReadingHistory,
  getAllNotes,
  DailyReading,
  Verse,
  Note,
} from '../../lib/bible-data';
import { getTodaysPlan, getBookName, getDayNumber, getTotalDays } from '../../lib/reading-plan';
import { getAnnotation } from '../../lib/cross-references';
import { SectionLabel } from '../../components/SectionLabel';
import { CircleProgress } from '../../components/CircleProgress';
import { WeekDots } from '../../components/WeekDots';
import { MiniPlayer } from '../../components/MiniPlayer';

export default function HomeScreen() {
  const userName = useAppStore((s) => s.userName);
  const readingPlanStartDate = useAppStore((s) => s.readingPlanStartDate);
  const setReadingPlanStartDate = useAppStore((s) => s.setReadingPlanStartDate);
  const setCurrentPosition = useAppStore((s) => s.setCurrentPosition);
  const router = useRouter();

  const [dailyVerse, setDailyVerse] = useState<(Verse & { book_name: string }) | null>(null);
  const [showVerseDetails, setShowVerseDetails] = useState(false);
  const [readings, setReadings] = useState<DailyReading[]>([]);
  const [weekHistory, setWeekHistory] = useState<Record<string, boolean>>({});
  const [recentNotes, setRecentNotes] = useState<Note[]>([]);

  const today = getISODate();

  async function loadData() {
    const verse = await getRandomVerse();
    setDailyVerse(verse);

    if (!readingPlanStartDate) {
      setReadingPlanStartDate(today);
    }

    await seedTodaysReadings();
    await loadReadings();
    await loadWeekHistory();

    const notes = await getAllNotes();
    setRecentNotes(notes.slice(0, 2));
  }

  async function seedTodaysReadings() {
    const existing = await getDailyReadings(today);
    if (existing.length > 0) return;

    const startDate = readingPlanStartDate || today;
    const plan = getTodaysPlan(startDate);
    for (const r of plan.readings) {
      await addDailyReading(today, r.bookId, r.startChapter, r.endChapter);
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

  const completedCount = readings.filter((r) => r.completed).length;
  const progressPercent = readings.length > 0 ? (completedCount / readings.length) * 100 : 0;
  const dayNumber = readingPlanStartDate ? getDayNumber(readingPlanStartDate) : 1;
  const totalDays = getTotalDays();

  const verseAnnotation = dailyVerse
    ? getAnnotation(dailyVerse.book_id, dailyVerse.chapter, dailyVerse.verse)
    : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={typography.dateText}>{formatDateKo()}</Text>
        <Text style={styles.greeting}>
          <Text style={{ fontFamily: fonts.sansMedium }}>{userName}</Text>
          {'님, '}
          {getGreeting()}
        </Text>

        <View style={styles.divider} />

        {/* 오늘의 말씀 */}
        <SectionLabel label="오늘의 말씀" />
        {dailyVerse ? (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setShowVerseDetails(!showVerseDetails)}
          >
            <Text style={styles.verseText}>{dailyVerse.text}</Text>
            <Text style={styles.verseSource}>
              — {dailyVerse.book_name} {dailyVerse.chapter}:{dailyVerse.verse}
            </Text>
            {showVerseDetails && verseAnnotation && (
              <View style={styles.verseDetails}>
                <Text style={styles.verseDetailText}>{verseAnnotation.commentary}</Text>
                {verseAnnotation.crossRefs.length > 0 && (
                  <View style={styles.crossRefRow}>
                    {verseAnnotation.crossRefs.map((ref, i) => (
                      <View key={i} style={styles.crossRefChip}>
                        <Text style={styles.crossRefChipText}>{ref.ref}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
            <Text style={styles.tapHint}>탭하여 관련 자료 보기</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.loadingText}>말씀을 불러오는 중...</Text>
        )}

        <View style={styles.divider} />

        {/* 묵상 읽기표 — 읽기 전용 대시보드 */}
        <SectionLabel label="묵상 읽기표" />
        <CircleProgress percent={progressPercent} dayNumber={dayNumber} totalDays={totalDays} />
        <WeekDots completedDates={weekHistory} />

        {/* 오늘 읽을 말씀 — 탭하면 성경 탭으로 이동 */}
        {readings.length > 0 && (
          <View style={styles.readingList}>
            <Text style={styles.readingTitle}>오늘 읽을 말씀</Text>
            {readings.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={styles.readingItem}
                activeOpacity={0.6}
                onPress={() => {
                  setCurrentPosition(r.book_id, r.start_chapter);
                  router.push('/(tabs)/bible');
                }}
              >
                <View style={styles.readingItemLeft}>
                  {r.completed ? (
                    <View style={styles.checkDone}>
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    </View>
                  ) : (
                    <View style={styles.checkEmpty} />
                  )}
                  <Text style={[styles.readingText, r.completed && styles.readingTextDone]}>
                    {r.book_name || getBookName(r.book_id)}{' '}
                    {r.start_chapter === r.end_chapter
                      ? `${r.start_chapter}장`
                      : `${r.start_chapter}-${r.end_chapter}장`}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.divider} />

        {/* 묵상 노트 — 미리보기, 탭하면 노트 탭으로 이동 */}
        <TouchableOpacity
          activeOpacity={0.6}
          onPress={() => router.push('/(tabs)/notes')}
        >
          <SectionLabel label="묵상 노트" right={
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          } />
          {recentNotes.length > 0 ? (
            recentNotes.map((note) => {
              const date = new Date(note.created_at);
              const dateStr = `${date.getMonth() + 1}월 ${date.getDate()}일`;
              return (
                <View key={note.id} style={styles.notePreview}>
                  <Text style={styles.noteDate}>{dateStr}</Text>
                  <Text style={styles.noteContent} numberOfLines={1}>{note.content}</Text>
                </View>
              );
            })
          ) : (
            <Text style={styles.noteEmpty}>아직 작성된 노트가 없습니다</Text>
          )}
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* 미니 플레이어 */}
        <SectionLabel label="앰비언트" />
        <MiniPlayer />

        <View style={{ height: 100 }} />
      </ScrollView>
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
    color: colors.textSecondary,
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
    lineHeight: 22,
    color: '#444444',
  },
  crossRefRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  crossRefChip: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  crossRefChipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.textPrimary,
  },
  tapHint: {
    fontFamily: fonts.sansRegular,
    fontSize: 10.5,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 10,
  },
  loadingText: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingVertical: 20,
  },

  // 읽기 목록 (읽기 전용)
  readingList: {
    marginTop: 20,
  },
  readingTitle: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  readingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  readingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkDone: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkEmpty: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  readingText: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: colors.textPrimary,
  },
  readingTextDone: {
    textDecorationLine: 'line-through',
    opacity: 0.4,
  },

  // 노트 미리보기
  notePreview: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  noteDate: {
    fontFamily: fonts.sansRegular,
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 3,
  },
  noteContent: {
    fontFamily: fonts.sansRegular,
    fontSize: 13.5,
    color: colors.textPrimary,
  },
  noteEmpty: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.textTertiary,
    paddingVertical: 12,
  },
});
