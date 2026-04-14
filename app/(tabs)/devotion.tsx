import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, typography } from '../../lib/theme';
import { getISODate, getWeekDates, formatDateKo } from '../../lib/utils';
import { useAppStore } from '../../lib/store';
import {
  getWeeklyChaptersRead,
  getWeeklyPrayerCount,
  logPrayer,
  hasPrayedToday,
  getDailyReadings,
  toggleDailyReading,
  addDailyReading,
  deleteDailyReading,
  markDayCompleted,
  getAllNotes,
  saveNote,
  getAllPrayerRequests,
  addPrayerRequest,
  togglePrayerAnswered,
  deletePrayerRequest,
  getTotalBibleProgress,
  getBibleCompletionProgress,
  getBookCompletions,
  BookProgress,
  BookReadCount,
  DailyReading,
  Note,
  PrayerRequest,
} from '../../lib/bible-data';
import { WEEKLY_GOALS } from '../../lib/reading-plan';
import { SectionLabel } from '../../components/SectionLabel';
import { NoteCard } from '../../components/NoteCard';
import { AddReadingModal } from '../../components/AddReadingModal';

export default function DevotionScreen() {
  const router = useRouter();
  const setCurrentPosition = useAppStore((s) => s.setCurrentPosition);

  const [weekChapters, setWeekChapters] = useState(0);
  const [weekPrayers, setWeekPrayers] = useState(0);
  const [prayedToday, setPrayedToday] = useState(false);
  const [readings, setReadings] = useState<DailyReading[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteText, setNoteText] = useState('');
  const [prayerRequests, setPrayerRequests] = useState<PrayerRequest[]>([]);
  const [prayerText, setPrayerText] = useState('');
  const [bibleTotal, setBibleTotal] = useState({ read: 0, total: 1189 });
  const [bookProgress, setBookProgress] = useState<BookProgress[]>([]);
  const [bookCompletions, setBookCompletions] = useState<BookReadCount[]>([]);
  const [showBooks, setShowBooks] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const today = getISODate();
  const weekDates = getWeekDates().map(getISODate);

  async function loadData() {
    const [ch, pr, prayed, r, n, prayers, total, progress, completions] = await Promise.all([
      getWeeklyChaptersRead(weekDates),
      getWeeklyPrayerCount(weekDates),
      hasPrayedToday(today),
      getDailyReadings(today),
      getAllNotes(),
      getAllPrayerRequests(),
      getTotalBibleProgress(),
      getBibleCompletionProgress(),
      getBookCompletions(),
    ]);
    setWeekChapters(ch);
    setWeekPrayers(pr);
    setPrayedToday(prayed);
    setReadings(r);
    setNotes(n);
    setPrayerRequests(prayers);
    setBibleTotal(total);
    setBookProgress(progress);
    setBookCompletions(completions);
  }

  useFocusEffect(useCallback(() => { loadData(); }, []));

  async function handlePrayer() {
    await logPrayer(today);
    setPrayedToday(true);
    setWeekPrayers((p) => p + 1);
  }

  async function handleToggleReading(id: number) {
    await toggleDailyReading(id);
    const updated = await getDailyReadings(today);
    setReadings(updated);
    if (updated.length > 0 && updated.every((r) => r.completed)) await markDayCompleted(today);
    setWeekChapters(await getWeeklyChaptersRead(weekDates));
  }

  async function handleDeleteReading(id: number) {
    Alert.alert('삭제', '이 읽을 말씀을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => { await deleteDailyReading(id); await loadData(); }},
    ]);
  }

  async function handleAddReading(bookId: number, startChapter: number, endChapter: number) {
    await addDailyReading(today, bookId, startChapter, endChapter);
    await loadData();
  }

  async function handleSaveNote() {
    if (!noteText.trim()) return;
    await saveNote(noteText.trim());
    setNoteText('');
    setNotes(await getAllNotes());
  }

  async function handleAddPrayer() {
    if (!prayerText.trim()) return;
    await addPrayerRequest(prayerText.trim());
    setPrayerText('');
    setPrayerRequests(await getAllPrayerRequests());
  }

  async function handleTogglePrayer(id: number) {
    await togglePrayerAnswered(id);
    setPrayerRequests(await getAllPrayerRequests());
  }

  async function handleDeletePrayer(id: number) {
    Alert.alert('삭제', '이 기도제목을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => { await deletePrayerRequest(id); setPrayerRequests(await getAllPrayerRequests()); }},
    ]);
  }

  const chapterPercent = Math.min((weekChapters / WEEKLY_GOALS.readingChapters) * 100, 100);
  const prayerPercent = Math.min((weekPrayers / WEEKLY_GOALS.prayerCount) * 100, 100);
  const biblePercent = bibleTotal.total > 0 ? (bibleTotal.read / bibleTotal.total) * 100 : 0;

  // 읽은 적 있는 책만 필터
  const readBooks = bookProgress.filter((b) => b.readChapters > 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>경건생활</Text>

        {/* 성경통독 */}
        <View style={styles.bibleCard}>
          <View style={styles.bibleCardHeader}>
            <Ionicons name="book" size={18} color={colors.accent} />
            <Text style={styles.bibleCardTitle}>성경통독</Text>
          </View>
          <View style={styles.bibleStats}>
            <Text style={styles.bibleChapters}>
              <Text style={styles.bibleChaptersBold}>{bibleTotal.read}</Text> / {bibleTotal.total}장
            </Text>
            <Text style={styles.biblePercent}>{Math.round(biblePercent)}%</Text>
          </View>
          <View style={styles.bibleProgressBar}>
            <View style={[styles.bibleProgressFill, { width: `${biblePercent}%` }]} />
          </View>

          {/* 회독 완료 칩 */}
          {bookCompletions.length > 0 && (
            <View style={styles.completionsRow}>
              {bookCompletions.map((b) => (
                <View key={b.bookId} style={styles.completionChip}>
                  <Text style={styles.completionName}>{b.name}</Text>
                  <Text style={styles.completionCount}>{b.completions}회독</Text>
                </View>
              ))}
            </View>
          )}

          {/* 권별 상세 토글 */}
          <TouchableOpacity style={styles.detailToggle} onPress={() => setShowBooks(!showBooks)}>
            <Text style={styles.detailToggleText}>{showBooks ? '접기' : '권별 상세 보기'}</Text>
            <Ionicons name={showBooks ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textSecondary} />
          </TouchableOpacity>

          {showBooks && readBooks.length > 0 && (
            <View style={styles.bookList}>
              {readBooks.map((b) => {
                const pct = Math.round((b.readChapters / b.totalChapters) * 100);
                return (
                  <TouchableOpacity
                    key={b.bookId}
                    style={styles.bookItem}
                    onPress={() => { setCurrentPosition(b.bookId, 1); router.push('/(tabs)/bible'); }}
                  >
                    <Text style={styles.bookName}>{b.name}</Text>
                    <View style={styles.bookBarContainer}>
                      <View style={styles.bookBar}>
                        <View style={[styles.bookBarFill, { width: `${pct}%` }]} />
                      </View>
                    </View>
                    <Text style={styles.bookPct}>{b.readChapters}/{b.totalChapters}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {showBooks && readBooks.length === 0 && (
            <Text style={styles.emptyText}>아직 읽은 책이 없습니다</Text>
          )}
        </View>

        <View style={styles.divider} />

        {/* 주간 요약 */}
        <SectionLabel label="이번 주 목표" />
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{weekChapters}<Text style={styles.summaryUnit}>/{WEEKLY_GOALS.readingChapters}장</Text></Text>
            <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${chapterPercent}%` }]} /></View>
            <Text style={styles.summaryLabel}>말씀 읽기</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{weekPrayers}<Text style={styles.summaryUnit}>/{WEEKLY_GOALS.prayerCount}회</Text></Text>
            <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${prayerPercent}%` }]} /></View>
            <Text style={styles.summaryLabel}>기도</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* 기도 — 기도제목 + 오늘의 기도 합침 */}
        <SectionLabel label="기도" />

        {/* 기도제목 입력 */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.prayerInput}
            placeholder="기도제목을 적어주세요..."
            placeholderTextColor={colors.textTertiary}
            value={prayerText}
            onChangeText={setPrayerText}
            onSubmitEditing={handleAddPrayer}
            returnKeyType="done"
          />
          {prayerText.trim().length > 0 && (
            <TouchableOpacity style={styles.addBtn} onPress={handleAddPrayer}>
              <Ionicons name="add" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>

        {/* 기도제목 목록 */}
        {prayerRequests.map((pr) => (
          <View key={pr.id} style={styles.prayerItem}>
            <TouchableOpacity onPress={() => handleTogglePrayer(pr.id)} style={styles.prayerItemLeft}>
              <Ionicons
                name={pr.answered ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={pr.answered ? colors.accent : colors.textTertiary}
              />
              <Text style={[styles.prayerItemText, pr.answered && styles.prayerItemDone]}>{pr.content}</Text>
              {pr.answered && <Text style={styles.answeredLabel}>응답</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDeletePrayer(pr.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        ))}

        {/* 오늘의 기도 체크 — 기도제목 아래 */}
        <TouchableOpacity
          style={[styles.prayerButton, prayedToday && styles.prayerButtonDone]}
          onPress={prayedToday ? undefined : handlePrayer}
          activeOpacity={prayedToday ? 1 : 0.6}
        >
          <Ionicons name={prayedToday ? 'checkmark-circle' : 'heart-outline'} size={22} color={prayedToday ? '#FFFFFF' : colors.accent} />
          <Text style={[styles.prayerBtnText, prayedToday && styles.prayerBtnTextDone]}>
            {prayedToday ? '오늘의 기도를 완료했어요' : '기도했어요'}
          </Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* 오늘 읽을 말씀 */}
        <View style={styles.sectionHeader}>
          <SectionLabel label="오늘 읽을 말씀" />
          <TouchableOpacity onPress={() => setShowAddModal(true)}>
            <Ionicons name="add-circle-outline" size={22} color={colors.accent} />
          </TouchableOpacity>
        </View>
        {readings.length === 0 ? (
          <TouchableOpacity style={styles.emptyReading} onPress={() => setShowAddModal(true)}>
            <Text style={styles.emptyText}>읽을 말씀을 추가해 주세요</Text>
          </TouchableOpacity>
        ) : (
          readings.map((r) => (
            <View key={r.id} style={styles.readingItem}>
              <TouchableOpacity onPress={() => handleToggleReading(r.id)}>
                <View style={[styles.checkbox, r.completed && styles.checkboxDone]}>
                  {r.completed && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.readingContent} onPress={() => { setCurrentPosition(r.book_id, r.start_chapter); router.push('/(tabs)/bible'); }}>
                <Text style={[styles.readingText, r.completed && styles.readingTextDone]}>
                  {r.book_name} {r.start_chapter === r.end_chapter ? `${r.start_chapter}장` : `${r.start_chapter}-${r.end_chapter}장`}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeleteReading(r.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          ))
        )}

        <View style={styles.divider} />

        {/* 묵상 노트 */}
        <SectionLabel label="묵상 노트" right={<Text style={typography.dateText}>{formatDateKo()}</Text>} />
        <TextInput
          style={styles.noteInput}
          placeholder="오늘의 묵상을 기록해 보세요..."
          placeholderTextColor={colors.textTertiary}
          multiline
          value={noteText}
          onChangeText={setNoteText}
        />
        {noteText.trim().length > 0 && (
          <TouchableOpacity style={styles.saveButton} onPress={handleSaveNote}>
            <Text style={styles.saveButtonText}>저장</Text>
          </TouchableOpacity>
        )}
        {notes.length > 0 && (
          <View style={styles.notesList}>
            {notes.slice(0, 5).map((note) => (
              <NoteCard key={note.id} note={note} onPress={() => router.push(`/note/${note.id}`)} />
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <AddReadingModal visible={showAddModal} onClose={() => setShowAddModal(false)} onAdd={handleAddReading} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.screenPadding, paddingTop: 14 },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 17, color: colors.textPrimary, marginBottom: 20 },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.sectionGap },

  // 성경통독
  bibleCard: { backgroundColor: colors.surface, borderRadius: spacing.cardRadius, padding: 20 },
  bibleCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  bibleCardTitle: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.textPrimary },
  bibleStats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
  bibleChapters: { fontFamily: fonts.sansRegular, fontSize: 14, color: colors.textSecondary },
  bibleChaptersBold: { fontFamily: fonts.sansSemiBold, fontSize: 22, color: colors.textPrimary },
  biblePercent: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.accent },
  bibleProgressBar: { height: 6, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 3 },
  bibleProgressFill: { height: 6, backgroundColor: colors.accent, borderRadius: 3 },
  completionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  completionChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.accentLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  completionName: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.accent },
  completionCount: { fontFamily: fonts.sansSemiBold, fontSize: 10, color: colors.accent },
  detailToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.04)' },
  detailToggleText: { fontFamily: fonts.sansRegular, fontSize: 12, color: colors.textSecondary },
  bookList: { marginTop: 12 },
  bookItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  bookName: { fontFamily: fonts.sansRegular, fontSize: 12, color: colors.textPrimary, width: 70 },
  bookBarContainer: { flex: 1 },
  bookBar: { height: 4, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 2 },
  bookBarFill: { height: 4, backgroundColor: colors.accent, borderRadius: 2 },
  bookPct: { fontFamily: fonts.sansRegular, fontSize: 10, color: colors.textSecondary, width: 36, textAlign: 'right' },

  // 주간 요약
  summaryRow: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: spacing.cardRadius, padding: 20 },
  summaryItem: { flex: 1, alignItems: 'center', gap: 6 },
  summaryDivider: { width: 1, backgroundColor: colors.divider, marginHorizontal: 16 },
  summaryValue: { fontFamily: fonts.sansSemiBold, fontSize: 28, color: colors.textPrimary },
  summaryUnit: { fontFamily: fonts.sansRegular, fontSize: 13, color: colors.textSecondary },
  summaryLabel: { fontFamily: fonts.sansRegular, fontSize: 11, color: colors.textSecondary },
  progressBar: { width: '100%', height: 4, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: colors.accent, borderRadius: 2 },

  // 기도
  inputRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  prayerInput: { flex: 1, fontFamily: fonts.sansRegular, fontSize: 14, color: colors.textPrimary, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  addBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  prayerItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider },
  prayerItemLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  prayerItemText: { flex: 1, fontFamily: fonts.sansRegular, fontSize: 14, color: colors.textPrimary },
  prayerItemDone: { textDecorationLine: 'line-through', opacity: 0.4 },
  answeredLabel: { fontFamily: fonts.sansSemiBold, fontSize: 10, color: colors.accent, backgroundColor: colors.accentLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  prayerButton: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: spacing.cardRadius, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', marginTop: 12 },
  prayerButtonDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  prayerBtnText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.textPrimary },
  prayerBtnTextDone: { color: '#FFFFFF' },

  // 읽기
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  emptyReading: { padding: 20, borderRadius: spacing.cardRadius, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', borderStyle: 'dashed', alignItems: 'center' },
  emptyText: { fontFamily: fonts.sansRegular, fontSize: 13, color: colors.textTertiary },
  readingItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.12)', alignItems: 'center', justifyContent: 'center' },
  checkboxDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  readingContent: { flex: 1 },
  readingText: { fontFamily: fonts.sansRegular, fontSize: 14, color: colors.textPrimary },
  readingTextDone: { textDecorationLine: 'line-through', opacity: 0.4 },

  // 노트
  noteInput: { fontFamily: fonts.sansRegular, fontSize: 14, color: colors.textPrimary, backgroundColor: 'rgba(0,0,0,0.015)', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', borderRadius: 12, padding: 16, minHeight: 80, textAlignVertical: 'top' },
  saveButton: { alignSelf: 'flex-end', backgroundColor: colors.accent, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, marginTop: 10 },
  saveButtonText: { fontFamily: fonts.sansMedium, fontSize: 13, color: '#FFFFFF' },
  notesList: { marginTop: 20 },
});
