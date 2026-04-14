import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, typography } from '../../lib/theme';
import { getISODate, getWeekDates, formatDateKo } from '../../lib/utils';
import { useAppStore } from '../../lib/store';
import {
  getWeeklyChaptersRead,
  getWeeklyPrayerCount,
  getWeeklyDailyDetail,
  logPrayer,
  hasPrayedToday,
  getDailyReadings,
  toggleDailyReading,
  addDailyReading,
  markDayCompleted,
  getAllNotes,
  saveNote,
  DailyReading,
  Note,
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
  const [showAddModal, setShowAddModal] = useState(false);

  const today = getISODate();
  const weekDates = getWeekDates().map(getISODate);

  async function loadData() {
    const ch = await getWeeklyChaptersRead(weekDates);
    setWeekChapters(ch);

    const pr = await getWeeklyPrayerCount(weekDates);
    setWeekPrayers(pr);

    const prayed = await hasPrayedToday(today);
    setPrayedToday(prayed);

    const r = await getDailyReadings(today);
    setReadings(r);

    const n = await getAllNotes();
    setNotes(n);
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

    // 주간 장수 리로드
    const ch = await getWeeklyChaptersRead(weekDates);
    setWeekChapters(ch);
  }

  async function handleAddReading(bookId: number, startChapter: number, endChapter: number) {
    await addDailyReading(today, bookId, startChapter, endChapter);
    const r = await getDailyReadings(today);
    setReadings(r);
  }

  async function handleSaveNote() {
    if (!noteText.trim()) return;
    await saveNote(noteText.trim());
    setNoteText('');
    const n = await getAllNotes();
    setNotes(n);
  }

  const chapterPercent = Math.min((weekChapters / WEEKLY_GOALS.readingChapters) * 100, 100);
  const prayerPercent = Math.min((weekPrayers / WEEKLY_GOALS.prayerCount) * 100, 100);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>경건생활</Text>

        {/* 주간 요약 */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{weekChapters}<Text style={styles.summaryUnit}>/{WEEKLY_GOALS.readingChapters}장</Text></Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${chapterPercent}%` }]} />
            </View>
            <Text style={styles.summaryLabel}>말씀 읽기</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{weekPrayers}<Text style={styles.summaryUnit}>/{WEEKLY_GOALS.prayerCount}회</Text></Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${prayerPercent}%` }]} />
            </View>
            <Text style={styles.summaryLabel}>기도</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* 기도 체크 */}
        <SectionLabel label="오늘의 기도" />
        <TouchableOpacity
          style={[styles.prayerButton, prayedToday && styles.prayerButtonDone]}
          onPress={prayedToday ? undefined : handlePrayer}
          activeOpacity={prayedToday ? 1 : 0.6}
        >
          <Ionicons
            name={prayedToday ? 'checkmark-circle' : 'heart-outline'}
            size={22}
            color={prayedToday ? '#FFFFFF' : colors.accent}
          />
          <Text style={[styles.prayerText, prayedToday && styles.prayerTextDone]}>
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
              <TouchableOpacity
                style={styles.readingContent}
                onPress={() => {
                  setCurrentPosition(r.book_id, r.start_chapter);
                  router.push('/(tabs)/bible');
                }}
              >
                <Text style={[styles.readingText, r.completed && styles.readingTextDone]}>
                  {r.book_name}{' '}
                  {r.start_chapter === r.end_chapter
                    ? `${r.start_chapter}장`
                    : `${r.start_chapter}-${r.end_chapter}장`}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          ))
        )}

        <View style={styles.divider} />

        {/* 묵상 노트 */}
        <SectionLabel label="묵상 노트" right={
          <Text style={typography.dateText}>{formatDateKo()}</Text>
        } />
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
              <NoteCard
                key={note.id}
                note={note}
                onPress={() => router.push(`/note/${note.id}`)}
              />
            ))}
          </View>
        )}

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
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.screenPadding, paddingTop: 14 },
  title: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 17,
    color: colors.textPrimary,
    marginBottom: 20,
  },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.sectionGap },

  // 주간 요약
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: spacing.cardRadius,
    padding: 20,
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 6 },
  summaryDivider: { width: 1, backgroundColor: colors.divider, marginHorizontal: 16 },
  summaryValue: { fontFamily: fonts.sansSemiBold, fontSize: 28, color: colors.textPrimary },
  summaryUnit: { fontFamily: fonts.sansRegular, fontSize: 13, color: colors.textSecondary },
  summaryLabel: { fontFamily: fonts.sansRegular, fontSize: 11, color: colors.textSecondary },
  progressBar: { width: '100%', height: 4, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: colors.accent, borderRadius: 2 },

  // 기도
  prayerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderRadius: spacing.cardRadius,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  prayerButtonDone: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  prayerText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.textPrimary },
  prayerTextDone: { color: '#FFFFFF' },

  // 읽기 목록
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  emptyReading: {
    padding: 20,
    borderRadius: spacing.cardRadius,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  emptyText: { fontFamily: fonts.sansRegular, fontSize: 13, color: colors.textTertiary },
  readingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  readingContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  readingText: { fontFamily: fonts.sansRegular, fontSize: 14, color: colors.textPrimary },
  readingTextDone: { textDecorationLine: 'line-through', opacity: 0.4 },

  // 노트
  noteInput: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: 'rgba(0,0,0,0.015)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    borderRadius: 12,
    padding: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    alignSelf: 'flex-end',
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  saveButtonText: { fontFamily: fonts.sansMedium, fontSize: 13, color: '#FFFFFF' },
  notesList: { marginTop: 20 },
});
