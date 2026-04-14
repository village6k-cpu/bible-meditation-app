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
  getAllNotes,
  getWeeklyChaptersRead,
  getWeeklyPrayerCount,
  getWeeklyDailyDetail,
  logPrayer,
  hasPrayedToday,
  Verse,
  Note,
} from '../../lib/bible-data';
import { getAnnotation } from '../../lib/cross-references';
import { WEEKLY_GOALS, DAILY_IDEAL } from '../../lib/reading-plan';
import { SectionLabel } from '../../components/SectionLabel';
import { MiniPlayer } from '../../components/MiniPlayer';

export default function HomeScreen() {
  const userName = useAppStore((s) => s.userName);
  const router = useRouter();

  const [dailyVerse, setDailyVerse] = useState<(Verse & { book_name: string }) | null>(null);
  const [showVerseDetails, setShowVerseDetails] = useState(false);
  const [weekChapters, setWeekChapters] = useState(0);
  const [weekPrayers, setWeekPrayers] = useState(0);
  const [dailyDetail, setDailyDetail] = useState<{ date: string; chapters: number; prayed: boolean }[]>([]);
  const [prayedToday, setPrayedToday] = useState(false);
  const [recentNotes, setRecentNotes] = useState<Note[]>([]);

  const today = getISODate();
  const weekDates = getWeekDates().map(getISODate);

  async function loadData() {
    const verse = await getRandomVerse();
    setDailyVerse(verse);

    const ch = await getWeeklyChaptersRead(weekDates);
    setWeekChapters(ch);

    const pr = await getWeeklyPrayerCount(weekDates);
    setWeekPrayers(pr);

    const detail = await getWeeklyDailyDetail(weekDates);
    setDailyDetail(detail);

    const prayed = await hasPrayedToday(today);
    setPrayedToday(prayed);

    const notes = await getAllNotes();
    setRecentNotes(notes.slice(0, 2));
  }

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function handlePrayer() {
    await logPrayer(today);
    setPrayedToday(true);
    setWeekPrayers((p) => p + 1);
  }

  const verseAnnotation = dailyVerse
    ? getAnnotation(dailyVerse.book_id, dailyVerse.chapter, dailyVerse.verse)
    : null;

  const chapterPercent = Math.min((weekChapters / WEEKLY_GOALS.readingChapters) * 100, 100);
  const prayerPercent = Math.min((weekPrayers / WEEKLY_GOALS.prayerCount) * 100, 100);

  const dayLabels = ['월', '화', '수', '목', '금', '토', '일'];

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

        {/* 이번 주 경건생활 */}
        <SectionLabel label="이번 주 경건생활" />

        {/* 말씀 & 기도 프로그레스 */}
        <View style={styles.goalsRow}>
          {/* 말씀 읽기 */}
          <TouchableOpacity
            style={styles.goalCard}
            activeOpacity={0.6}
            onPress={() => router.push('/(tabs)/bible')}
          >
            <Ionicons name="book-outline" size={20} color={colors.accent} />
            <Text style={styles.goalCount}>
              <Text style={styles.goalCurrent}>{weekChapters}</Text>
              /{WEEKLY_GOALS.readingChapters}장
            </Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${chapterPercent}%` }]} />
            </View>
            <Text style={styles.goalLabel}>말씀 읽기</Text>
          </TouchableOpacity>

          {/* 기도 */}
          <TouchableOpacity
            style={styles.goalCard}
            activeOpacity={0.6}
            onPress={prayedToday ? undefined : handlePrayer}
          >
            <Ionicons name="heart-outline" size={20} color={colors.accent} />
            <Text style={styles.goalCount}>
              <Text style={styles.goalCurrent}>{weekPrayers}</Text>
              /{WEEKLY_GOALS.prayerCount}회
            </Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${prayerPercent}%` }]} />
            </View>
            <Text style={styles.goalLabel}>
              {prayedToday ? '오늘 기도 완료' : '기도 체크하기'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 주간 도트 */}
        <View style={styles.weekRow}>
          {dayLabels.map((label, i) => {
            const detail = dailyDetail[i];
            const isToday = detail?.date === today;
            const hasActivity = detail && (detail.chapters > 0 || detail.prayed);
            const isFuture = detail && detail.date > today;

            return (
              <View key={i} style={styles.dayCol}>
                <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{label}</Text>
                <View style={[
                  styles.dayDot,
                  hasActivity && styles.dayDotActive,
                  isToday && !hasActivity && styles.dayDotToday,
                  isFuture && styles.dayDotFuture,
                ]}>
                  {hasActivity && (
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  )}
                  {isToday && !hasActivity && (
                    <View style={styles.todayInner} />
                  )}
                </View>
                {detail && detail.chapters > 0 && (
                  <Text style={styles.dayChapters}>{detail.chapters}장</Text>
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.divider} />

        {/* 묵상 노트 미리보기 */}
        <TouchableOpacity activeOpacity={0.6} onPress={() => router.push('/(tabs)/notes')}>
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
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: spacing.screenPadding, paddingTop: 12 },
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

  // 오늘의 말씀
  verseText: { fontFamily: fonts.serifLight, fontSize: 15, lineHeight: 30, color: colors.textPrimary },
  verseSource: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: colors.textSecondary, marginTop: 10 },
  verseDetails: { backgroundColor: colors.surface, borderRadius: spacing.cardRadius, padding: 16, marginTop: 14 },
  verseDetailText: { fontFamily: fonts.sansRegular, fontSize: 13, lineHeight: 22, color: '#444444' },
  crossRefRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  crossRefChip: { backgroundColor: 'rgba(0,0,0,0.04)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  crossRefChipText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.textPrimary },
  tapHint: { fontFamily: fonts.sansRegular, fontSize: 10.5, color: colors.textTertiary, textAlign: 'center', marginTop: 10 },
  loadingText: { fontFamily: fonts.sansRegular, fontSize: 13, color: colors.textTertiary, textAlign: 'center', paddingVertical: 20 },

  // 주간 목표 카드
  goalsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  goalCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: spacing.cardRadius,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  goalCount: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  goalCurrent: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 24,
    color: colors.textPrimary,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 2,
  },
  progressFill: {
    height: 4,
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  goalLabel: {
    fontFamily: fonts.sansRegular,
    fontSize: 11,
    color: colors.textSecondary,
  },

  // 주간 도트
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { alignItems: 'center', gap: 6 },
  dayLabel: { fontFamily: fonts.sansRegular, fontSize: 11, color: colors.textSecondary },
  dayLabelToday: { color: colors.accent, fontFamily: fonts.sansSemiBold },
  dayDot: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDotActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  dayDotToday: {
    borderColor: colors.accent,
  },
  dayDotFuture: {
    borderColor: 'rgba(0,0,0,0.06)',
  },
  todayInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  dayChapters: {
    fontFamily: fonts.sansRegular,
    fontSize: 9,
    color: colors.textSecondary,
  },

  // 노트 미리보기
  notePreview: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider },
  noteDate: { fontFamily: fonts.sansRegular, fontSize: 11, color: colors.textSecondary, marginBottom: 3 },
  noteContent: { fontFamily: fonts.sansRegular, fontSize: 13.5, color: colors.textPrimary },
  noteEmpty: { fontFamily: fonts.sansRegular, fontSize: 13, color: colors.textTertiary, paddingVertical: 12 },
});
