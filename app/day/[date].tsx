import { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../../lib/theme';
import { formatISODateKo, getISODate } from '../../lib/utils';
import { SectionLabel } from '../../components/SectionLabel';
import { EntryCard } from '../../components/EntryCard';
import {
  Entry,
  DayLog,
  Todo,
  DayMeditation,
  getEntriesByDate,
  getDayLog,
  getTodosByDate,
  getMeditationsByDate,
  upsertDayLog,
  addTodo,
  toggleTodo,
  deleteTodo,
} from '../../lib/journal-db';
import { EntryType, ENTRY_TYPE_LABELS } from '../../lib/journal-utils';
import { buildSingleDayMarkdown, shareMarkdown } from '../../lib/export-md';

const TYPE_ORDER: EntryType[] = ['moment', 'media', 'writing', 'meal', 'workout'];

export default function DayDetailScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [dayLog, setDayLog] = useState<DayLog | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [meditations, setMeditations] = useState<DayMeditation[]>([]);
  const [dayTitle, setDayTitle] = useState('');
  const [newTodo, setNewTodo] = useState('');

  const load = useCallback(async () => {
    if (!date) return;
    const [e, l, t, m] = await Promise.all([
      getEntriesByDate(date),
      getDayLog(date),
      getTodosByDate(date),
      getMeditationsByDate(date),
    ]);
    setEntries(e);
    setDayLog(l);
    setTodos(t);
    setMeditations(m);
    setDayTitle(l?.day_title ?? '');
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!date) return null;

  async function saveDayTitle() {
    const next = dayTitle.trim() || null;
    if (next === (dayLog?.day_title ?? null)) return;
    await upsertDayLog(date!, { day_title: next });
    setDayLog(await getDayLog(date!));
  }

  async function handleAddTodo() {
    const content = newTodo.trim();
    if (!content) return;
    setNewTodo('');
    await addTodo(date!, content);
    setTodos(await getTodosByDate(date!));
  }

  async function handleToggleTodo(id: number) {
    await toggleTodo(id);
    setTodos(await getTodosByDate(date!));
  }

  async function handleDeleteTodo(id: number) {
    await deleteTodo(id);
    setTodos(await getTodosByDate(date!));
  }

  async function handleWorkoutToggle() {
    const next = dayLog?.workout_done === 1 ? 0 : 1;
    await upsertDayLog(date!, { workout_done: next });
    setDayLog(await getDayLog(date!));
  }

  async function handleDiet(value: number | null) {
    await upsertDayLog(date!, { diet_kept: value });
    setDayLog(await getDayLog(date!));
  }

  async function handleExport() {
    const md = await buildSingleDayMarkdown(date!);
    await shareMarkdown(md, `${date}.md`);
  }

  const workoutFromEntries = entries.some((e) => e.type === 'workout');
  const workoutOn = workoutFromEntries || dayLog?.workout_done === 1;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            // The title input may still be focused — persist before leaving
            saveDayTitle();
            router.back();
          }}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerDate}>
          {date === getISODate() ? '오늘' : formatISODateKo(date)}
        </Text>
        <TouchableOpacity onPress={handleExport} hitSlop={8}>
          <Ionicons name="share-outline" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Day title */}
        <TextInput
          style={styles.dayTitleInput}
          placeholder="오늘 하루를 한 줄로"
          placeholderTextColor={colors.textTertiary}
          value={dayTitle}
          onChangeText={setDayTitle}
          onBlur={saveDayTitle}
        />

        {/* Habits */}
        <View style={styles.habitRow}>
          <TouchableOpacity
            style={[styles.habitButton, workoutOn && styles.habitButtonOn]}
            onPress={handleWorkoutToggle}
            disabled={workoutFromEntries}
          >
            <Text style={[styles.habitButtonText, workoutOn && styles.habitButtonTextOn]}>
              운동 {workoutOn ? '완료' : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.habitButton, dayLog?.diet_kept === 1 && styles.habitButtonOn]}
            onPress={() => handleDiet(dayLog?.diet_kept === 1 ? null : 1)}
          >
            <Text
              style={[styles.habitButtonText, dayLog?.diet_kept === 1 && styles.habitButtonTextOn]}
            >
              식단 지킴
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.habitButton, dayLog?.diet_kept === 0 && styles.habitButtonMissed]}
            onPress={() => handleDiet(dayLog?.diet_kept === 0 ? null : 0)}
          >
            <Text
              style={[
                styles.habitButtonText,
                dayLog?.diet_kept === 0 && styles.habitButtonTextMissed,
              ]}
            >
              식단 못 지킴
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* Todos */}
        <SectionLabel label="할 일" />
        {todos.map((t) => (
          <View key={t.id} style={styles.todoRow}>
            <TouchableOpacity
              style={styles.todoMain}
              onPress={() => handleToggleTodo(t.id)}
            >
              <Ionicons
                name={t.done === 1 ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={t.done === 1 ? colors.accentGreen : colors.textTertiary}
              />
              <Text style={[styles.todoText, t.done === 1 && styles.todoTextDone]}>
                {t.content}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDeleteTodo(t.id)} hitSlop={8}>
              <Ionicons name="close" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        ))}
        <View style={styles.todoAddRow}>
          <TextInput
            style={styles.todoInput}
            placeholder="할 일 추가"
            placeholderTextColor={colors.textTertiary}
            value={newTodo}
            onChangeText={setNewTodo}
            onSubmitEditing={handleAddTodo}
            returnKeyType="done"
            blurOnSubmit={false}
          />
          {newTodo.trim().length > 0 && (
            <TouchableOpacity onPress={handleAddTodo} hitSlop={8}>
              <Ionicons name="add-circle-outline" size={22} color={colors.accentGreen} />
            </TouchableOpacity>
          )}
        </View>

        {/* Meditations */}
        {meditations.length > 0 && (
          <>
            <View style={styles.divider} />
            <SectionLabel label="말씀 묵상" />
            {meditations.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={styles.meditationCard}
                onPress={() => router.push(`/note/${m.id}`)}
              >
                {m.book_name && m.chapter ? (
                  <Text style={styles.meditationRef}>
                    {m.book_name} {m.chapter}
                    {m.verse ? `:${m.verse}` : ''}
                  </Text>
                ) : null}
                <Text style={styles.meditationText} numberOfLines={3}>
                  {m.content}
                </Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Entries grouped by type */}
        {TYPE_ORDER.map((type) => {
          const group = entries.filter((e) => e.type === type);
          if (group.length === 0) return null;
          return (
            <View key={type}>
              <View style={styles.divider} />
              <SectionLabel label={ENTRY_TYPE_LABELS[type]} />
              {group.map((e) => (
                <EntryCard key={e.id} entry={e} onPress={() => router.push(`/entry/${e.id}`)} />
              ))}
            </View>
          );
        })}

        {/* Add entry */}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push(`/entry/new?date=${date}`)}
        >
          <Ionicons name="add" size={16} color={colors.accentGreen} />
          <Text style={styles.addButtonText}>기록 남기기</Text>
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerDate: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  scroll: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 18,
  },
  dayTitleInput: {
    fontFamily: fonts.serifLight,
    fontSize: 17,
    color: colors.textPrimary,
    paddingVertical: 6,
    marginBottom: 14,
  },
  habitRow: {
    flexDirection: 'row',
    gap: 8,
  },
  habitButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  habitButtonOn: {
    backgroundColor: colors.accentGreen,
    borderColor: colors.accentGreen,
  },
  habitButtonMissed: {
    borderColor: colors.accentRed,
  },
  habitButtonText: {
    fontFamily: fonts.sansRegular,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  habitButtonTextOn: {
    color: '#FFFFFF',
  },
  habitButtonTextMissed: {
    color: colors.accentRed,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: 22,
  },
  todoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  todoMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  todoText: {
    flex: 1,
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: colors.textPrimary,
  },
  todoTextDone: {
    color: colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  todoAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  todoInput: {
    flex: 1,
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: colors.textPrimary,
    paddingVertical: 4,
  },
  meditationCard: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  meditationRef: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.accentGreen,
    marginBottom: 6,
  },
  meditationText: {
    fontFamily: fonts.serifLight,
    fontSize: 14.5,
    lineHeight: 26,
    color: colors.textPrimary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 14,
    marginTop: 28,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderStyle: 'dashed',
  },
  addButtonText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13.5,
    color: colors.accentGreen,
  },
});
