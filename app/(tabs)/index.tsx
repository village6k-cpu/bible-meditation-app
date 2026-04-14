import { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { colors, fonts, spacing, typography } from '../../lib/theme';
import { formatDateKo, getGreeting, getISODate, getWeekDates } from '../../lib/utils';
import { useAppStore } from '../../lib/store';
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
import { getTodaysPlan, getBookName, getDayNumber, getTotalDays } from '../../lib/reading-plan';
import { getAnnotation } from '../../lib/cross-references';
import { SectionLabel } from '../../components/SectionLabel';
import { CircleProgress } from '../../components/CircleProgress';
import { WeekDots } from '../../components/WeekDots';
import { ReadingChecklist } from '../../components/ReadingChecklist';
import { AddReadingModal } from '../../components/AddReadingModal';
import { MiniPlayer } from '../../components/MiniPlayer';

export default function HomeScreen() {
  const userName = useAppStore((s) => s.userName);
  const readingPlanStartDate = useAppStore((s) => s.readingPlanStartDate);
  const setReadingPlanStartDate = useAppStore((s) => s.setReadingPlanStartDate);
  const [dailyVerse, setDailyVerse] = useState<(Verse & { book_name: string }) | null>(null);
  const [showVerseDetails, setShowVerseDetails] = useState(false);
  const [readings, setReadings] = useState<DailyReading[]>([]);
  const [weekHistory, setWeekHistory] = useState<Record<string, boolean>>({});
  const [noteText, setNoteText] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const today = getISODate();

  async function loadData() {
    const verse = await getRandomVerse();
    setDailyVerse(verse);

    // 읽기표 시작일이 없으면 오늘로 설정
    if (!readingPlanStartDate) {
      setReadingPlanStartDate(today);
    }

    await seedTodaysReadings();
    await loadReadings();
    await loadWeekHistory();
  }

  // 오늘 읽기표가 비어있으면 연간 읽기표에서 자동 생성
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

  async function handleToggle(id: number) {
    await toggleDailyReading(id);
    await loadReadings();

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
  const dayNumber = readingPlanStartDate ? getDayNumber(readingPlanStartDate) : 1;
  const totalDays = getTotalDays();

  // 오늘의 말씀 관련 자료
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

        {/* 묵상 읽기표 */}
        <SectionLabel label="묵상 읽기표" />
        <CircleProgress percent={progressPercent} dayNumber={dayNumber} totalDays={totalDays} />
        <WeekDots completedDates={weekHistory} />
        <ReadingChecklist
          readings={readings}
          onToggle={handleToggle}
          onAdd={() => setShowAddModal(true)}
        />

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
