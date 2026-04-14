import { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, spacing, typography } from '../../lib/theme';
import { formatDateKo, getGreeting, getISODate, getWeekDates } from '../../lib/utils';
import { useAppStore } from '../../lib/store';
import {
  getRandomVerse,
  getAllNotes,
  getWeeklyChaptersRead,
  getWeeklyPrayerCount,
  getWeeklyDailyDetail,
  getAllPrayerRequests,
  getTotalBibleProgress,
  getBookCompletions,
  Verse,
  Note,
  PrayerRequest,
  BookReadCount,
} from '../../lib/bible-data';
import { getAnnotation } from '../../lib/cross-references';
import { WEEKLY_GOALS } from '../../lib/reading-plan';
import { SectionLabel } from '../../components/SectionLabel';
import { MiniPlayer } from '../../components/MiniPlayer';
import { GrowingTree } from '../../components/GrowingTree';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// 시간대별 테마
function getTimeTheme() {
  const hour = new Date().getHours();

  if (hour < 6) {
    // 새벽
    return {
      gradient: ['rgba(27,40,56,0.85)', 'rgba(44,37,32,0.4)', 'transparent'] as const,
      gradientLocations: [0, 0.4, 0.75] as const,
      textColor: '#F4F3EE',
      subTextColor: 'rgba(244,243,238,0.55)',
      labelColor: 'rgba(244,243,238,0.7)',
      dividerColor: 'rgba(255,255,255,0.08)',
      isDark: true,
    };
  }
  if (hour < 12) {
    // 아침
    return {
      gradient: ['rgba(232,213,176,0.35)', 'rgba(240,224,196,0.15)', 'transparent'] as const,
      gradientLocations: [0, 0.4, 0.7] as const,
      textColor: colors.textPrimary,
      subTextColor: colors.textSecondary,
      labelColor: colors.accent,
      dividerColor: colors.divider,
      isDark: false,
    };
  }
  if (hour < 17) {
    // 오후 — 그라데이션 없음
    return {
      gradient: null,
      gradientLocations: null,
      textColor: colors.textPrimary,
      subTextColor: colors.textSecondary,
      labelColor: colors.accent,
      dividerColor: colors.divider,
      isDark: false,
    };
  }
  if (hour < 21) {
    // 저녁
    return {
      gradient: ['rgba(212,165,116,0.25)', 'rgba(222,187,148,0.1)', 'transparent'] as const,
      gradientLocations: [0, 0.4, 0.7] as const,
      textColor: colors.textPrimary,
      subTextColor: colors.textSecondary,
      labelColor: colors.accent,
      dividerColor: colors.divider,
      isDark: false,
    };
  }
  // 밤
  return {
    gradient: ['rgba(30,27,24,0.8)', 'rgba(44,37,32,0.35)', 'transparent'] as const,
    gradientLocations: [0, 0.4, 0.72] as const,
    textColor: '#F4F3EE',
    subTextColor: 'rgba(244,243,238,0.5)',
    labelColor: '#E8A87C',
    dividerColor: 'rgba(255,255,255,0.08)',
    isDark: true,
  };
}

export default function HomeScreen() {
  const userName = useAppStore((s) => s.userName);
  const router = useRouter();
  const theme = useMemo(() => getTimeTheme(), []);

  const [dailyVerse, setDailyVerse] = useState<(Verse & { book_name: string }) | null>(null);
  const [showVerseDetails, setShowVerseDetails] = useState(false);
  const [weekChapters, setWeekChapters] = useState(0);
  const [weekPrayers, setWeekPrayers] = useState(0);
  const [dailyDetail, setDailyDetail] = useState<{ date: string; chapters: number; prayed: boolean }[]>([]);
  const [recentNotes, setRecentNotes] = useState<Note[]>([]);
  const [prayerRequests, setPrayerRequests] = useState<PrayerRequest[]>([]);
  const [bibleTotal, setBibleTotal] = useState({ read: 0, total: 1189 });
  const [bookCompletions, setBookCompletions] = useState<BookReadCount[]>([]);

  const today = getISODate();
  const weekDates = getWeekDates().map(getISODate);

  async function loadData() {
    const [verse, ch, pr, detail, notes, prayers, total, completions] = await Promise.all([
      getRandomVerse(),
      getWeeklyChaptersRead(weekDates),
      getWeeklyPrayerCount(weekDates),
      getWeeklyDailyDetail(weekDates),
      getAllNotes(),
      getAllPrayerRequests(),
      getTotalBibleProgress(),
      getBookCompletions(),
    ]);
    setDailyVerse(verse);
    setWeekChapters(ch);
    setWeekPrayers(pr);
    setDailyDetail(detail);
    setRecentNotes(notes.slice(0, 2));
    setPrayerRequests(prayers.filter((p) => !p.answered).slice(0, 3));
    setBibleTotal(total);
    setBookCompletions(completions);
  }

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const verseAnnotation = dailyVerse
    ? getAnnotation(dailyVerse.book_id, dailyVerse.chapter, dailyVerse.verse)
    : null;

  const chapterPercent = Math.min((weekChapters / WEEKLY_GOALS.readingChapters) * 100, 100);
  const prayerPercent = Math.min((weekPrayers / WEEKLY_GOALS.prayerCount) * 100, 100);
  const biblePercent = bibleTotal.total > 0 ? (bibleTotal.read / bibleTotal.total) * 100 : 0;
  const dayLabels = ['월', '화', '수', '목', '금', '토', '일'];

  // 읽기표 진행률 (주간 기준)
  const readingProgress = weekChapters / WEEKLY_GOALS.readingChapters;

  return (
    <View style={styles.container}>
      {/* 시간대별 그라데이션 오버레이 */}
      {theme.gradient && (
        <LinearGradient
          colors={[...theme.gradient]}
          locations={[...theme.gradientLocations]}
          style={styles.gradientOverlay}
          pointerEvents="none"
        />
      )}

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <Text style={[typography.dateText, { color: theme.subTextColor }]}>{formatDateKo()}</Text>
          <Text style={[styles.greeting, { color: theme.textColor }]}>
            <Text style={{ fontFamily: fonts.sansMedium }}>{userName}</Text>
            {'님, '}
            {getGreeting()}
          </Text>

          <View style={[styles.divider, { backgroundColor: theme.dividerColor }]} />

          {/* 오늘의 말씀 */}
          <SectionLabel label="오늘의 말씀" />
          {dailyVerse ? (
            <TouchableOpacity activeOpacity={0.7} onPress={() => setShowVerseDetails(!showVerseDetails)}>
              <Text style={[styles.verseText, theme.isDark && { color: theme.textColor }]}>{dailyVerse.text}</Text>
              <Text style={[styles.verseSource, { color: theme.subTextColor }]}>
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
              <Text style={[styles.tapHint, { color: theme.isDark ? 'rgba(244,243,238,0.35)' : colors.textTertiary }]}>
                탭하여 관련 자료 보기
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.loadingText}>말씀을 불러오는 중...</Text>
          )}

          <View style={styles.divider} />

          {/* 이번 주 경건생활 — 자라는 나무 */}
          <TouchableOpacity activeOpacity={0.6} onPress={() => router.push('/(tabs)/devotion')}>
            <SectionLabel label="이번 주 경건생활" right={
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            } />
          </TouchableOpacity>

          <GrowingTree
            progress={readingProgress}
            dayNumber={new Date().getDay() || 7}
            totalDays={7}
          />

          {/* 주간 목표 카드 */}
          <View style={styles.goalsRow}>
            <View style={styles.goalCard}>
              <Ionicons name="book-outline" size={18} color={colors.accent} />
              <Text style={styles.goalCount}>
                <Text style={styles.goalCurrent}>{weekChapters}</Text>/{WEEKLY_GOALS.readingChapters}장
              </Text>
              <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${chapterPercent}%` }]} /></View>
            </View>
            <View style={styles.goalCard}>
              <Ionicons name="heart-outline" size={18} color={colors.accent} />
              <Text style={styles.goalCount}>
                <Text style={styles.goalCurrent}>{weekPrayers}</Text>/{WEEKLY_GOALS.prayerCount}회
              </Text>
              <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${prayerPercent}%` }]} /></View>
            </View>
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
                  <View style={[styles.dayDot, hasActivity && styles.dayDotActive, isToday && !hasActivity && styles.dayDotToday, isFuture && styles.dayDotFuture]}>
                    {hasActivity && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                    {isToday && !hasActivity && <View style={styles.todayInner} />}
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.divider} />

          {/* 성경통독 */}
          <TouchableOpacity activeOpacity={0.6} onPress={() => router.push('/(tabs)/devotion')}>
            <SectionLabel label="성경통독" right={
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            } />
          </TouchableOpacity>
          <View style={styles.bibleCard}>
            <View style={styles.bibleStats}>
              <Text style={styles.bibleChapters}>
                <Text style={styles.bibleChaptersBold}>{bibleTotal.read}</Text> / {bibleTotal.total}장
              </Text>
              <Text style={styles.biblePercent}>{Math.round(biblePercent)}%</Text>
            </View>
            <View style={styles.bibleProgressBar}>
              <View style={[styles.bibleProgressFill, { width: `${biblePercent}%` }]} />
            </View>
            {bookCompletions.length > 0 && (
              <View style={styles.completionsRow}>
                {bookCompletions.slice(0, 5).map((b) => (
                  <View key={b.bookId} style={styles.completionChip}>
                    <Text style={styles.completionName}>{b.name}</Text>
                    <Text style={styles.completionCount}>{b.completions}회독</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.divider} />

          {/* 기도제목 */}
          <TouchableOpacity activeOpacity={0.6} onPress={() => router.push('/(tabs)/devotion')}>
            <SectionLabel label="기도제목" right={
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            } />
          </TouchableOpacity>
          {prayerRequests.length > 0 ? (
            prayerRequests.map((pr) => (
              <View key={pr.id} style={styles.prayerPreview}>
                <Ionicons name="ellipse-outline" size={14} color={colors.textTertiary} />
                <Text style={styles.prayerPreviewText} numberOfLines={1}>{pr.content}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>등록된 기도제목이 없습니다</Text>
          )}

          <View style={styles.divider} />

          {/* 묵상 노트 */}
          <TouchableOpacity activeOpacity={0.6} onPress={() => router.push('/(tabs)/devotion')}>
            <SectionLabel label="묵상 노트" right={
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            } />
          </TouchableOpacity>
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
            <Text style={styles.emptyText}>아직 작성된 노트가 없습니다</Text>
          )}

          <View style={styles.divider} />

          {/* 미니 플레이어 */}
          <SectionLabel label="앰비언트" />
          <MiniPlayer />

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.45,
    zIndex: 1,
  },
  scrollContent: { paddingHorizontal: spacing.screenPadding, paddingTop: 12, position: 'relative', zIndex: 2 },
  greeting: { fontFamily: fonts.serifLight, fontSize: 21, color: colors.textPrimary, marginTop: 6 },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.sectionGap },

  verseText: { fontFamily: fonts.serifLight, fontSize: 15, lineHeight: 30, color: colors.textPrimary },
  verseSource: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: colors.textSecondary, marginTop: 10 },
  verseDetails: { backgroundColor: colors.surface, borderRadius: spacing.cardRadius, padding: 16, marginTop: 14 },
  verseDetailText: { fontFamily: fonts.sansRegular, fontSize: 13, lineHeight: 22, color: '#444444' },
  crossRefRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  crossRefChip: { backgroundColor: 'rgba(0,0,0,0.04)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  crossRefChipText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.textPrimary },
  tapHint: { fontFamily: fonts.sansRegular, fontSize: 10.5, color: colors.textTertiary, textAlign: 'center', marginTop: 10 },
  loadingText: { fontFamily: fonts.sansRegular, fontSize: 13, color: colors.textTertiary, textAlign: 'center', paddingVertical: 20 },

  goalsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  goalCard: { flex: 1, backgroundColor: colors.surface, borderRadius: spacing.cardRadius, padding: 14, alignItems: 'center', gap: 6 },
  goalCount: { fontFamily: fonts.sansRegular, fontSize: 13, color: colors.textSecondary },
  goalCurrent: { fontFamily: fonts.sansSemiBold, fontSize: 22, color: colors.textPrimary },
  progressBar: { width: '100%', height: 4, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: colors.accent, borderRadius: 2 },

  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { alignItems: 'center', gap: 6 },
  dayLabel: { fontFamily: fonts.sansRegular, fontSize: 11, color: colors.textSecondary },
  dayLabelToday: { color: colors.accent, fontFamily: fonts.sansSemiBold },
  dayDot: { width: 32, height: 32, borderRadius: 9, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.1)', alignItems: 'center', justifyContent: 'center' },
  dayDotActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayDotToday: { borderColor: colors.accent },
  dayDotFuture: { borderColor: 'rgba(0,0,0,0.06)' },
  todayInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },

  bibleCard: { backgroundColor: colors.surface, borderRadius: spacing.cardRadius, padding: 16 },
  bibleStats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  bibleChapters: { fontFamily: fonts.sansRegular, fontSize: 14, color: colors.textSecondary },
  bibleChaptersBold: { fontFamily: fonts.sansSemiBold, fontSize: 20, color: colors.textPrimary },
  biblePercent: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.accent },
  bibleProgressBar: { height: 6, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 3 },
  bibleProgressFill: { height: 6, backgroundColor: colors.accent, borderRadius: 3 },
  completionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  completionChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.accentLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  completionName: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.accent },
  completionCount: { fontFamily: fonts.sansSemiBold, fontSize: 10, color: colors.accent },

  prayerPreview: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  prayerPreviewText: { flex: 1, fontFamily: fonts.sansRegular, fontSize: 13.5, color: colors.textPrimary },

  notePreview: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider },
  noteDate: { fontFamily: fonts.sansRegular, fontSize: 11, color: colors.textSecondary, marginBottom: 3 },
  noteContent: { fontFamily: fonts.sansRegular, fontSize: 13.5, color: colors.textPrimary },

  emptyText: { fontFamily: fonts.sansRegular, fontSize: 13, color: colors.textTertiary, paddingVertical: 8 },
});
