import React, { useCallback, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';
import { Screen } from '../../src/components/Screen';
import { EntryCard } from '../../src/components/EntryCard';
import { TypePicker } from '../../src/components/TypePicker';
import { Underline } from '../../src/components/Underline';
import { S } from '../../src/core/strings.ko';
import { agoLabelKo, formatDayKo, todayKey } from '../../src/core/dates';
import { pickDeck, DeckSlot } from '../../src/core/resurface';
import { Entry } from '../../src/core/types';
import {
  createEntry,
  entriesOfDay,
  getEntry,
  recordShown,
  resurfaceCandidates,
  setReaction,
  setTaskDone,
  tagsOf,
} from '../../src/db/entryRepo';
import { useTheme } from '../../src/theme/ThemeProvider';
import { radius, space, type } from '../../src/theme/tokens';

interface DeckItem {
  entry: Entry;
  slot: DeckSlot;
}

const SLOT_CAPTION: Record<DeckSlot, (e: Entry, today: string) => string> = {
  anniversary: (e, today) => agoLabelKo(e.day, today),
  pinned: () => S.resurface_pinned_caption,
  forgotten: () => S.resurface_forgotten_caption,
};

export default function TodayScreen() {
  const { palette } = useTheme();
  const db = useSQLiteContext();
  const router = useRouter();

  const [today, setToday] = useState(todayKey());
  const [deck, setDeck] = useState<DeckItem[]>([]);
  const [tasks, setTasks] = useState<Entry[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [tagMap, setTagMap] = useState<Map<string, string[]>>(new Map());
  const [newTask, setNewTask] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const day = todayKey();
    setToday(day);

    const all = await entriesOfDay(db, day);
    setTasks(all.filter((e) => e.type === 'task'));
    const nonTask = all.filter((e) => e.type !== 'task');
    setEntries(nonTask);
    setTagMap(await tagsOf(db, nonTask.map((e) => e.id)));

    const candidates = await resurfaceCandidates(db, day);
    const cards = pickDeck(day, candidates);
    const loaded: DeckItem[] = [];
    for (const c of cards) {
      const entry = await getEntry(db, c.id);
      if (entry) loaded.push({ entry, slot: c.slot });
    }
    setDeck(loaded);
    await recordShown(db, loaded.map((d) => d.entry.id), day);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  }

  async function handleKeep(item: DeckItem) {
    await setReaction(db, item.entry.id, todayKey(), 'kept');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast(S.resurface_kept_toast);
    setDeck((prev) =>
      prev.map((d) =>
        d.entry.id === item.entry.id ? { ...d, entry: { ...d.entry, pinned: 1 } } : d
      )
    );
  }

  async function handleRetire(item: DeckItem) {
    await setReaction(db, item.entry.id, todayKey(), 'retired');
    Haptics.selectionAsync();
    showToast(S.resurface_retired_toast);
    setDeck((prev) => prev.filter((d) => d.entry.id !== item.entry.id));
  }

  async function handleAddTask() {
    const content = newTask.trim();
    if (!content) return;
    setNewTask('');
    await createEntry(db, { type: 'task', day: todayKey(), title: content, done: 0 });
    setTasks((await entriesOfDay(db, todayKey())).filter((e) => e.type === 'task'));
  }

  async function handleToggleTask(task: Entry) {
    await setTaskDone(db, task.id, task.done !== 1);
    Haptics.selectionAsync();
    setTasks((await entriesOfDay(db, todayKey())).filter((e) => e.type === 'task'));
  }

  const cardWidth = Dimensions.get('window').width - space.gutter * 2;
  const isEmpty = entries.length === 0 && tasks.length === 0 && deck.length === 0;

  return (
    <Screen
      title={S.tab_today}
      caption={formatDayKo(today)}
      right={
        <Pressable onPress={() => router.push('/settings')} hitSlop={10} style={styles.gear}>
          <Ionicons name="ellipsis-horizontal" size={20} color={palette.textTertiary} />
        </Pressable>
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
      >
        {/* 남기기 칩 바 — 한 번의 탭으로 유형별 폼까지 */}
        <View style={styles.chipBar}>
          <TypePicker compact onSelect={(t) => router.push(`/compose?type=${t}`)} />
        </View>

        {/* 다시 만나는 밑줄 */}
        {deck.length > 0 && (
          <View style={styles.section}>
            <Text style={[type.micro, styles.sectionLabel, { color: palette.accent }]}>
              {S.resurface_header}
            </Text>
            <ScrollView
              horizontal
              pagingEnabled
              snapToInterval={cardWidth + space.m}
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: space.m }}
            >
              {deck.map((item) => (
                <Pressable
                  key={item.entry.id}
                  onPress={() => router.push(`/entry/${item.entry.id}`)}
                  style={[
                    styles.deckCard,
                    { width: cardWidth, backgroundColor: palette.surface, borderColor: palette.divider },
                  ]}
                >
                  <Text style={[type.caption, { color: palette.textTertiary }]}>
                    {SLOT_CAPTION[item.slot](item.entry, today)}
                  </Text>
                  <Text
                    style={[type.quote, { color: palette.textPrimary, marginTop: space.s }]}
                    numberOfLines={4}
                  >
                    {item.entry.quote ?? item.entry.body ?? item.entry.title ?? ''}
                  </Text>
                  <Underline width={56} />
                  {item.entry.title && item.entry.quote ? (
                    <Text
                      style={[type.caption, { color: palette.textSecondary, marginTop: space.s }]}
                      numberOfLines={1}
                    >
                      — {item.entry.subtitle ? `${item.entry.subtitle}, ` : ''}『{item.entry.title}』
                    </Text>
                  ) : null}
                  <View style={styles.deckActions}>
                    <Pressable onPress={() => handleKeep(item)} hitSlop={8} style={styles.deckAction}>
                      <Ionicons
                        name={item.entry.pinned === 1 ? 'bookmark' : 'bookmark-outline'}
                        size={14}
                        color={palette.accent}
                      />
                      <Text style={[type.caption, { color: palette.accent }]}>
                        {S.resurface_keep}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => handleRetire(item)} hitSlop={8} style={styles.deckAction}>
                      <Text style={[type.caption, { color: palette.textTertiary }]}>
                        {S.resurface_retire}
                      </Text>
                    </Pressable>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* 오늘 할 일 */}
        <View style={styles.section}>
          <Text style={[type.micro, styles.sectionLabel, { color: palette.textTertiary }]}>
            {S.today_tasks}
          </Text>
          {tasks.map((task) => (
            <View key={task.id} style={styles.taskRow}>
              <Pressable onPress={() => handleToggleTask(task)} style={styles.taskMain} hitSlop={4}>
                <Ionicons
                  name={task.done === 1 ? 'checkmark-circle' : 'ellipse-outline'}
                  size={20}
                  color={task.done === 1 ? palette.accent : palette.textTertiary}
                />
                <Text
                  style={[
                    type.label,
                    { color: task.done === 1 ? palette.textTertiary : palette.textPrimary },
                    task.done === 1 && styles.taskDone,
                  ]}
                >
                  {task.title}
                </Text>
              </Pressable>
              {task.due_time ? (
                <Text style={[type.caption, { color: palette.textTertiary }]}>{task.due_time}</Text>
              ) : null}
            </View>
          ))}
          <View style={styles.taskAddRow}>
            <Ionicons name="add" size={16} color={palette.textTertiary} />
            <TextInput
              style={[type.label, styles.taskInput, { color: palette.textPrimary }]}
              placeholder={S.today_task_placeholder}
              placeholderTextColor={palette.textTertiary}
              value={newTask}
              onChangeText={setNewTask}
              onSubmitEditing={handleAddTask}
              returnKeyType="done"
              submitBehavior="submit"
            />
          </View>
        </View>

        {/* 오늘의 기록 */}
        <View style={styles.section}>
          <Text style={[type.micro, styles.sectionLabel, { color: palette.textTertiary }]}>
            {S.today_entries}
          </Text>
          {entries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              tags={tagMap.get(entry.id)}
              onPress={() => router.push(`/entry/${entry.id}`)}
            />
          ))}
          {isEmpty && (
            <View style={styles.empty}>
              <Text style={[type.bodySerif, { color: palette.textSecondary, textAlign: 'center' }]}>
                {S.empty_today}
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      {toast ? (
        <View style={[styles.toast, { backgroundColor: palette.textPrimary }]}>
          <Text style={[type.caption, { color: palette.bg }]}>{toast}</Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  gear: { paddingBottom: space.m },
  scroll: { paddingHorizontal: space.gutter },
  chipBar: { marginBottom: space.xl },
  section: { marginBottom: space.xxl },
  sectionLabel: {
    textTransform: 'uppercase',
    marginBottom: space.m,
  },
  deckCard: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.l,
  },
  deckActions: {
    flexDirection: 'row',
    gap: space.xl,
    marginTop: space.l,
  },
  deckAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.s,
  },
  taskMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
  },
  taskDone: {
    textDecorationLine: 'line-through',
  },
  taskAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingVertical: space.s,
  },
  taskInput: {
    flex: 1,
    paddingVertical: 2,
  },
  empty: {
    paddingVertical: space.xxxl,
  },
  toast: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    paddingHorizontal: space.xl,
    paddingVertical: space.m,
    borderRadius: radius.chip,
  },
});
