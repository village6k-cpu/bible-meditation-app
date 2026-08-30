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
import { SectionLabel } from '../../components/SectionLabel';
import { CircleProgress } from '../../components/CircleProgress';
import { WeekDots } from '../../components/WeekDots';
import { ReadingChecklist } from '../../components/ReadingChecklist';
import { AddReadingModal } from '../../components/AddReadingModal';
import { MiniPlayer } from '../../components/MiniPlayer';

export default function HomeScreen() {
  const userName = useAppStore((s) => s.userName);
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

    await loadReadings();
    await loadWeekHistory();
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
        <Text style={typography.dateText}>{formatDateKo()}</Text>
        <Text style={styles.greeting}>
          <Text style={{ fontFamily: fonts.sansMedium }}>{userName}</Text>
          {'님, '}
          {getGreeting()}
        </Text>

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
