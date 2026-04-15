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
  getBook,
  Verse,
  Note,
  PrayerRequest,
  Book,
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
    // 새벽 — 깊은 남색에서 따뜻한 브라운을 거쳐 배경으로
    return {
      gradient: [
        '#2A3548',
        'rgba(42,53,72,0.96)',
        'rgba(56,50,44,0.78)',
        'rgba(85,75,62,0.45)',
        'rgba(150,138,118,0.15)',
        'rgba(250,250,248,0)',
      ] as const,
      gradientLocations: [0, 0.1, 0.28, 0.46, 0.64, 0.82] as const,
      textColor: '#F0EDE6',
      subTextColor: 'rgba(240,237,230,0.5)',
      labelColor: 'rgba(240,237,230,0.65)',
      dividerColor: 'rgba(255,255,255,0.06)',
      isDark: true,
    };
  }
  if (hour < 12) {
    // 아침 — 따뜻한 골드 톤이 부드럽게 퍼짐
    return {
      gradient: [
        'rgba(225,205,168,0.5)',
        'rgba(232,215,182,0.35)',
        'rgba(240,225,200,0.18)',
        'rgba(248,240,225,0.06)',
        'rgba(250,250,248,0)',
      ] as const,
      gradientLocations: [0, 0.18, 0.4, 0.6, 0.78] as const,
      textColor: colors.textPrimary,
      subTextColor: colors.textSecondary,
      labelColor: colors.accent,
      dividerColor: colors.divider,
      isDark: false,
    };
  }
  if (hour < 17) {
    // 오후 — 따뜻한 베이지/브라운 톤
    return {
      gradient: [
        'rgba(180,160,130,0.6)',
        'rgba(195,178,150,0.45)',
        'rgba(210,195,170,0.28)',
        'rgba(230,218,198,0.12)',
        'rgba(244,243,238,0)',
      ] as const,
      gradientLocations: [0, 0.15, 0.35, 0.55, 0.78] as const,
      textColor: colors.textPrimary,
      subTextColor: colors.textSecondary,
      labelColor: colors.accent,
      dividerColor: colors.divider,
      isDark: false,
    };
  }
  if (hour < 21) {
    // 저녁 — 노을빛 웜톤
    return {
      gradient: [
        'rgba(180,140,95,0.45)',
        'rgba(200,165,120,0.3)',
        'rgba(220,190,150,0.15)',
        'rgba(240,225,200,0.05)',
        'rgba(250,250,248,0)',
      ] as const,
      gradientLocations: [0, 0.18, 0.4, 0.6, 0.78] as const,
      textColor: colors.textPrimary,
      subTextColor: colors.textSecondary,
      labelColor: colors.accent,
      dividerColor: colors.divider,
      isDark: false,
    };
  }
  // 밤 — 깊은 다크 브라운에서 배경으로
  return {
    gradient: [
      '#1E1B18',
      'rgba(30,27,24,0.95)',
      'rgba(52,44,36,0.7)',
      'rgba(80,68,54,0.38)',
      'rgba(140,125,105,0.12)',
      'rgba(250,250,248,0)',
    ] as const,
    gradientLocations: [0, 0.1, 0.28, 0.46, 0.64, 0.82] as const,
    textColor: '#F0EDE6',
    subTextColor: 'rgba(240,237,230,0.45)',
    labelColor: '#D4A574',
    dividerColor: 'rgba(255,255,255,0.06)',
    isDark: true,
  };
}

export default function HomeScreen() {
  const userName = useAppStore((s) => s.userName);
  const lastReadBookId = useAppStore((s) => s.lastReadBookId);
  const lastReadChapter = useAppStore((s) => s.lastReadChapter);
  const setCurrentPosition = useAppStore((s) => s.setCurrentPosition);
  const router = useRouter();
  const [lastReadBook, setLastReadBook] = useState<Book | null>(null);
  const theme = useMemo(() => getTimeTheme(), []);

  const [dailyVerse, setDailyVerse] = useState<(Verse & { book_name: string }) | null>(null);
  const [showVerseDetails, setShowVerseDetails] = useState(false);
  const [weekChapters, setWeekChapters] = useState(0);
  const [weekPrayers, setWeekPrayers] = useState(0);
  const [dailyDetail, setDailyDetail] = useState<{ date: string; chapters: number; prayed: boolean }[]>([]);
  const [recentNotes, setRecentNotes] = useState<Note[]>([]);
  const [prayerRequests, setPrayerRequests] = useState<PrayerRequest[]>([]);

  const today = getISODate();
  const weekDates = getWeekDates().map(getISODate);

  async function loadData() {
    const [verse, ch, pr, detail, notes, prayers] = await Promise.all([
      getRandomVerse(),
      getWeeklyChaptersRead(weekDates),
      getWeeklyPrayerCount(weekDates),
      getWeeklyDailyDetail(weekDates),
      getAllNotes(),
      getAllPrayerRequests(),
    ]);
    setDailyVerse(verse);
    setWeekChapters(ch);
    setWeekPrayers(pr);
    setDailyDetail(detail);
    setRecentNotes(notes.slice(0, 2));
    setPrayerRequests(prayers.filter((p) => !p.answered).slice(0, 3));

    const lb = await getBook(lastReadBookId);
    setLastReadBook(lb);
  }

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const verseAnnotation = dailyVerse
    ? getAnnotation(dailyVerse.book_id, dailyVerse.chapter, dailyVerse.verse)
    : null;

  const chapterPercent = Math.min((weekChapters / WEEKLY_GOALS.readingChapters) * 100, 100);
  const prayerPercent = Math.min((weekPrayers / WEEKLY_GOALS.prayerCount) * 100, 100);
  const dayLabels = ['월', '화', '수', '목', '금', '토', '일'];

  // 읽기표 진행률 (주간 기준)
  const readingProgress = weekChapters / WEEKLY_GOALS.readingChapters;

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* 시간대별 그라데이션 — ScrollView 안에 absolute */}
          {theme.gradient && (
            <LinearGradient
              colors={[...theme.gradient]}
              locations={[...theme.gradientLocations]}
              style={styles.gradientOverlay}
              pointerEvents="none"
            />
          )}

          {/* Header */}
          <Text style={[typography.dateText, { color: theme.subTextColor }]}>{formatDateKo()}</Text>
          <Text style={[styles.greeting, { color: theme.textColor }]}>
            <Text style={{ fontFamily: fonts.sansMedium }}>{userName}</Text>
            {'님, '}
            {getGreeting()}
          </Text>

          <View style={[styles.divider, { backgroundColor: theme.dividerColor }]} />

          {/* 오늘의 말씀 — 그라데이션 아래이므로 항상 기본 색상 */}
          <SectionLabel label="오늘의 말씀" />
          {dailyVerse ? (
            <TouchableOpacity activeOpacity={0.7} onPress={() => setShowVerseDetails(!showVerseDetails)}>
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
              <Text style={styles.tapHint}>
                탭하여 관련 자료 보기
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.loadingText}>말씀을 불러오는 중...</Text>
          )}

          {/* 이어 읽기 */}
          {lastReadBook && (
            <TouchableOpacity
              style={styles.continueCard}
              activeOpacity={0.6}
              onPress={() => {
                const next = lastReadChapter + 1 <= lastReadBook.chapter_count ? lastReadChapter + 1 : lastReadChapter;
                setCurrentPosition(lastReadBookId, next);
                router.push('/(tabs)/bible');
              }}
            >
              <View style={styles.continueLeft}>
                <Ionicons name="book" size={16} color={colors.accent} />
                <View>
                  <Text style={styles.continueLabel}>이어 읽기</Text>
                  <Text style={styles.continueBook}>
                    {lastReadBook.name_ko} {lastReadChapter}장{useAppStore.getState().lastReadVerse > 0 ? ` ${useAppStore.getState().lastReadVerse}절` : ''}까지 읽었어요
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
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

          {/* 주간 도트 — 읽기/기도 각각 */}
          <View style={styles.weekTable}>
            <View style={styles.weekLabelCol}>
              <Text style={styles.weekTableLabel} />
              <Ionicons name="book-outline" size={12} color={colors.textSecondary} />
              <Ionicons name="heart-outline" size={12} color={colors.textSecondary} />
            </View>
            {dayLabels.map((label, i) => {
              const detail = dailyDetail[i];
              const isToday = detail?.date === today;
              const didRead = detail && detail.chapters > 0;
              const didPray = detail && detail.prayed;
              const isFuture = detail && detail.date > today;
              return (
                <View key={i} style={styles.weekTableCol}>
                  <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{label}</Text>
                  <View style={[styles.miniDot, didRead && styles.miniDotFilled, isFuture && styles.miniDotFuture, isToday && !didRead && styles.miniDotToday]} />
                  <View style={[styles.miniDot, didPray && styles.miniDotFilled, isFuture && styles.miniDotFuture, isToday && !didPray && styles.miniDotToday]} />
                </View>
              );
            })}
          </View>

          <View style={styles.divider} />

          {/* 기도 제목 */}
          <TouchableOpacity activeOpacity={0.6} onPress={() => router.push('/(tabs)/devotion')}>
            <SectionLabel label="기도 제목" right={
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            } />
          </TouchableOpacity>
          {prayerRequests.length > 0 ? (
            prayerRequests.map((pr, i) => (
              <View key={pr.id} style={[styles.prayerPreview, i > 0 && styles.prayerPreviewBorder]}>
                <Text style={styles.prayerBullet}>•</Text>
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
    top: -60,
    left: -spacing.screenPadding,
    right: -spacing.screenPadding,
    height: SCREEN_HEIGHT * 0.55,
  },
  scrollContent: { paddingHorizontal: spacing.screenPadding, paddingTop: 12 },
  greeting: { fontFamily: fonts.serifLight, fontSize: 21, color: colors.textPrimary, marginTop: 6 },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.sectionGap },

  sectionLabelText: {
    fontFamily: fonts.sansSemiBold, fontSize: 10.5, letterSpacing: 10.5 * 0.1,
    color: colors.accent, textTransform: 'uppercase' as const, marginBottom: 12,
  },

  // 이어 읽기
  continueCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: spacing.cardRadius,
    padding: 16, marginTop: 20,
  },
  continueLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  continueLabel: { fontFamily: fonts.sansSemiBold, fontSize: 10.5, color: colors.accent, letterSpacing: 0.5, marginBottom: 2 },
  continueBook: { fontFamily: fonts.sansRegular, fontSize: 13, color: colors.textPrimary },

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

  // 주간 테이블
  weekTable: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weekLabelCol: { alignItems: 'center', gap: 6, width: 20 },
  weekTableLabel: { height: 15 },
  weekTableCol: { alignItems: 'center', gap: 6, flex: 1 },
  dayLabel: { fontFamily: fonts.sansRegular, fontSize: 11, color: colors.textSecondary },
  dayLabelToday: { color: colors.accent, fontFamily: fonts.sansSemiBold },
  miniDot: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.08)' },
  miniDotFilled: { backgroundColor: colors.accent, borderColor: colors.accent },
  miniDotToday: { borderColor: colors.accent },
  miniDotFuture: { borderColor: 'rgba(0,0,0,0.04)' },

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

  prayerPreview: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  prayerPreviewBorder: { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.04)' },
  prayerBullet: { fontFamily: fonts.sansRegular, fontSize: 14, color: colors.textSecondary, width: 14, textAlign: 'center' },
  prayerPreviewText: { flex: 1, fontFamily: fonts.sansRegular, fontSize: 14, color: colors.textPrimary },

  notePreview: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider },
  noteDate: { fontFamily: fonts.sansRegular, fontSize: 11, color: colors.textSecondary, marginBottom: 3 },
  noteContent: { fontFamily: fonts.sansRegular, fontSize: 13.5, color: colors.textPrimary },

  emptyText: { fontFamily: fonts.sansRegular, fontSize: 13, color: colors.textTertiary, paddingVertical: 8 },
});
