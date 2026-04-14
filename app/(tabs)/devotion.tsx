import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet } from 'react-native';
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
  markDayCompleted,
  getAllNotes,
  saveNote,
  getAllPrayerRequests,
  addPrayerRequest,
  togglePrayerAnswered,
  getTotalBibleProgress,
  getBibleCompletionProgress,
  BookProgress,
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
  const [showOT, setShowOT] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const today = getISODate();
  const weekDates = getWeekDates().map(getISODate);

  async function loadData() {
    const [ch, pr, prayed, r, n, prayers, total, progress] = await Promise.all([
      getWeeklyChaptersRead(weekDates),
      getWeeklyPrayerCount(weekDates),
      hasPrayedToday(today),
      getDailyReadings(today),
      getAllNotes(),
      getAllPrayerRequests(),
      getTotalBibleProgress(),
      getBibleCompletionProgress(),
    ]);
    setWeekChapters(ch);
    setWeekPrayers(pr);
    setPrayedToday(prayed);
    setReadings(r);
    setNotes(n);
    setPrayerRequests(prayers);
    setBibleTotal(total);
    setBookProgress(progress);
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
    if (updated.length > 0 && updated.every((r) => r.completed)) {
      await markDayCompleted(today);
    }
    const ch = await getWeeklyChaptersRead(weekDates);
    setWeekChapters(ch);
  }

  async function handleAddReading(bookId: number, startChapter: number, endChapter: number) {
    await addDailyReading(today, bookId, startChapter, endChapter);
    await loadData();
  }

  async function handleSaveNote() {
    if (!noteText.trim()) return;
    await saveNote(noteText.trim());
    setNoteText('');
    const n = await getAllNotes();
    setNotes(n);
  }

  async function handleAddPrayer() {
    if (!prayerText.trim()) return;
    await addPrayerRequest(prayerText.trim());
    setPrayerText('');
    const p = await getAllPrayerRequests();
    setPrayerRequests(p);
  }

  async function handleTogglePrayer(id: number) {
    await togglePrayerAnswered(id);
    const p = await getAllPrayerRequests();
    setPrayerRequests(p);
  }

  const chapterPercent = Math.min((weekChapters / WEEKLY_GOALS.readingChapters) * 100, 100);
  const prayerPercent = Math.min((weekPrayers / WEEKLY_GOALS.prayerCount) * 100, 100);
  const biblePercent = bibleTotal.total > 0 ? (bibleTotal.read / bibleTotal.total) * 100 : 0;

  const otBooks = bookProgress.filter((b) => b.testament === 'old');
  const ntBooks = bookProgress.filter((b) => b.testament === 'new');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>경건생활</Text>

        {/* 주간 요약 */}
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

        {/* 성경통독 체크표 */}
        <SectionLabel label="성경통독" />
        <View style={styles.bibleOverview}>
          <Text style={styles.bibleOverviewText}>
            <Text style={styles.bibleOverviewBold}>{bibleTotal.read}</Text>/{bibleTotal.total}장 ({Math.round(biblePercent)}%)
          </Text>
          <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${biblePercent}%` }]} /></View>
        </View>

        {/* 구약/신약 토글 */}
        <View style={styles.testamentToggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, showOT && styles.toggleBtnActive]}
            onPress={() => setShowOT(true)}
          >
            <Text style={[styles.toggleText, showOT && styles.toggleTextActive]}>구약 39권</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, !showOT && styles.toggleBtnActive]}
            onPress={() => setShowOT(false)}
          >
            <Text style={[styles.toggleText, !showOT && styles.toggleTextActive]}>신약 27권</Text>
          </TouchableOpacity>
        </View>

        {/* 통독 그리드 */}
        <View style={styles.bookGrid}>
          {(showOT ? otBooks : ntBooks).map((b) => {
            const pct = b.totalChapters > 0 ? b.readChapters / b.totalChapters : 0;
            const isDone = pct >= 1;
            return (
              <TouchableOpacity
                key={b.bookId}
                style={[styles.bookChip, isDone && styles.bookChipDone]}
                onPress={() => {
                  setCurrentPosition(b.bookId, 1);
                  router.push('/(tabs)/bible');
                }}
              >
                <Text style={[styles.bookName, isDone && styles.bookNameDone]}>{b.name}</Text>
                {b.readChapters > 0 && !isDone && (
                  <Text style={styles.bookCount}>{b.readChapters}/{b.totalChapters}</Text>
                )}
                {isDone && <Ionicons name="checkmark" size={10} color="#FFFFFF" />}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.divider} />

        {/* 기도 체크 */}
        <SectionLabel label="오늘의 기도" />
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

        {/* 기도제목 */}
        <SectionLabel label="기도제목" />
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
        {prayerRequests.map((pr) => (
          <TouchableOpacity
            key={pr.id}
            style={styles.prayerItem}
            onPress={() => handleTogglePrayer(pr.id)}
            activeOpacity={0.6}
          >
            <Ionicons
              name={pr.answered ? 'checkmark-circle' : 'ellipse-outline'}
              size={20}
              color={pr.answered ? colors.accent : colors.textTertiary}
            />
            <Text style={[styles.prayerItemText, pr.answered && styles.prayerItemDone]}>
              {pr.content}
            </Text>
            {pr.answered && <Text style={styles.answeredLabel}>응답</Text>}
          </TouchableOpacity>
        ))}

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
              <TouchableOpacity
                style={styles.readingContent}
                onPress={() => { setCurrentPosition(r.book_id, r.start_chapter); router.push('/(tabs)/bible'); }}
              >
                <Text style={[styles.readingText, r.completed && styles.readingTextDone]}>
                  {r.book_name} {r.start_chapter === r.end_chapter ? `${r.start_chapter}장` : `${r.start_chapter}-${r.end_chapter}장`}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
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

  // 주간 요약
  summaryRow: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: spacing.cardRadius, padding: 20 },
  summaryItem: { flex: 1, alignItems: 'center', gap: 6 },
  summaryDivider: { width: 1, backgroundColor: colors.divider, marginHorizontal: 16 },
  summaryValue: { fontFamily: fonts.sansSemiBold, fontSize: 28, color: colors.textPrimary },
  summaryUnit: { fontFamily: fonts.sansRegular, fontSize: 13, color: colors.textSecondary },
  summaryLabel: { fontFamily: fonts.sansRegular, fontSize: 11, color: colors.textSecondary },
  progressBar: { width: '100%', height: 4, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: colors.accent, borderRadius: 2 },

  // 성경통독
  bibleOverview: { marginBottom: 16, gap: 8 },
  bibleOverviewText: { fontFamily: fonts.sansRegular, fontSize: 14, color: colors.textSecondary },
  bibleOverviewBold: { fontFamily: fonts.sansSemiBold, fontSize: 18, color: colors.textPrimary },
  testamentToggle: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.surface, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: colors.accent },
  toggleText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textSecondary },
  toggleTextActive: { color: '#FFFFFF' },
  bookGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  bookChip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  bookChipDone: { backgroundColor: colors.accent },
  bookName: { fontFamily: fonts.sansRegular, fontSize: 11, color: colors.textPrimary },
  bookNameDone: { color: '#FFFFFF' },
  bookCount: { fontFamily: fonts.sansRegular, fontSize: 9, color: colors.textSecondary },

  // 기도 체크
  prayerButton: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16,
    borderRadius: spacing.cardRadius, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
  },
  prayerButtonDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  prayerBtnText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.textPrimary },
  prayerBtnTextDone: { color: '#FFFFFF' },

  // 기도제목
  inputRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  prayerInput: {
    flex: 1, fontFamily: fonts.sansRegular, fontSize: 14, color: colors.textPrimary,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  addBtn: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  prayerItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  prayerItemText: { flex: 1, fontFamily: fonts.sansRegular, fontSize: 14, color: colors.textPrimary },
  prayerItemDone: { textDecorationLine: 'line-through', opacity: 0.4 },
  answeredLabel: {
    fontFamily: fonts.sansSemiBold, fontSize: 10, color: colors.accent,
    backgroundColor: colors.accentLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4,
  },

  // 읽기
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  emptyReading: {
    padding: 20, borderRadius: spacing.cardRadius, borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)', borderStyle: 'dashed', alignItems: 'center',
  },
  emptyText: { fontFamily: fonts.sansRegular, fontSize: 13, color: colors.textTertiary },
  readingItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.12)', alignItems: 'center', justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  readingContent: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  readingText: { fontFamily: fonts.sansRegular, fontSize: 14, color: colors.textPrimary },
  readingTextDone: { textDecorationLine: 'line-through', opacity: 0.4 },

  // 노트
  noteInput: {
    fontFamily: fonts.sansRegular, fontSize: 14, color: colors.textPrimary,
    backgroundColor: 'rgba(0,0,0,0.015)', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
    borderRadius: 12, padding: 16, minHeight: 80, textAlignVertical: 'top',
  },
  saveButton: {
    alignSelf: 'flex-end', backgroundColor: colors.accent,
    paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, marginTop: 10,
  },
  saveButtonText: { fontFamily: fonts.sansMedium, fontSize: 13, color: '#FFFFFF' },
  notesList: { marginTop: 20 },
});
