import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';
import { EntryCard } from '../../src/components/EntryCard';
import { Underline } from '../../src/components/Underline';
import { S } from '../../src/core/strings.ko';
import { formatDayKo } from '../../src/core/dates';
import { specOf } from '../../src/core/registry';
import { Entry, MEAL_SLOT_LABELS } from '../../src/core/types';
import {
  deleteEntry,
  getEntry,
  recordRevisit,
  relatedEntries,
  tagsOf,
  togglePinned,
} from '../../src/db/entryRepo';
import { imageAbs } from '../../src/export/files';
import { useTheme } from '../../src/theme/ThemeProvider';
import { radius, space, type, underline } from '../../src/theme/tokens';

export default function EntryDetailScreen() {
  const { palette } = useTheme();
  const db = useSQLiteContext();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [entry, setEntry] = useState<Entry | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [related, setRelated] = useState<Entry[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    const e = await getEntry(db, id);
    setEntry(e);
    if (e) {
      // 다시 읽음 — 서재의 '먼지'가 실제 읽기를 반영하게 하는 한 줄
      await recordRevisit(db, e.id);
      setTags((await tagsOf(db, [e.id])).get(e.id) ?? []);
      setRelated(await relatedEntries(db, e));
    }
  }, [db, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!entry) {
    return <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} />;
  }

  const spec = specOf(entry.type);
  const photo = imageAbs(entry.image_uri);

  const sourceLine =
    entry.type === 'book'
      ? [entry.subtitle, entry.title ? `『${entry.title}』` : null, entry.page ? `p.${entry.page}` : null]
          .filter(Boolean)
          .join(', ')
      : null;

  async function handlePin() {
    await togglePinned(db, entry!.id);
    Haptics.selectionAsync();
    setEntry(await getEntry(db, entry!.id));
  }

  function handleDelete() {
    Alert.alert(S.detail_delete_title, undefined, [
      { text: S.detail_cancel, style: 'cancel' },
      {
        text: S.detail_delete_confirm,
        style: 'destructive',
        onPress: async () => {
          await deleteEntry(db, entry!.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={['top', 'bottom']}>
      {/* 헤더 */}
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={palette.textPrimary} />
        </Pressable>
        <View style={styles.headerActions}>
          <Pressable onPress={handlePin} hitSlop={8}>
            <Ionicons
              name={entry.pinned === 1 ? 'bookmark' : 'bookmark-outline'}
              size={19}
              color={entry.pinned === 1 ? palette.accent : palette.textSecondary}
            />
          </Pressable>
          <Pressable onPress={() => router.push(`/compose?id=${entry.id}`)} hitSlop={8}>
            <Ionicons name="create-outline" size={19} color={palette.textSecondary} />
          </Pressable>
          <Pressable onPress={handleDelete} hitSlop={8}>
            <Ionicons name="trash-outline" size={18} color={palette.textTertiary} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* 유형·날짜 */}
        <Text style={[type.micro, { color: palette.accent, textTransform: 'uppercase' }]}>
          {spec.label}
          {entry.pinned === 1 ? ` · ${S.detail_pinned}` : ''}
        </Text>
        <Text style={[type.caption, { color: palette.textTertiary, marginTop: 4 }]}>
          {formatDayKo(entry.day)}
        </Text>

        {/* 묵상 본문 주소 */}
        {entry.type === 'verse' && entry.subtitle ? (
          <Text style={[type.titleSerif, { color: palette.secondary, marginTop: space.xl }]}>
            {entry.subtitle}
          </Text>
        ) : null}

        {/* 제목(책 외 유형) */}
        {entry.title && entry.type !== 'book' ? (
          <Text style={[type.titleSerif, { color: palette.textPrimary, marginTop: space.xl }]}>
            {entry.title}
            {entry.type === 'video' && entry.subtitle ? (
              <Text style={[type.caption, { color: palette.textSecondary }]}>
                {'  '}— {entry.subtitle}
              </Text>
            ) : null}
          </Text>
        ) : null}

        {/* 인용문 — 이 화면의 주인공 */}
        {entry.quote ? (
          <View style={{ marginTop: space.xl }}>
            <Text style={[type.quote, { color: palette.textPrimary }]}>{entry.quote}</Text>
            <Underline width={64} />
            {sourceLine ? (
              <Text style={[type.caption, { color: palette.textSecondary, marginTop: space.m }]}>
                — {sourceLine}
              </Text>
            ) : null}
          </View>
        ) : entry.type === 'book' && sourceLine ? (
          <Text style={[type.titleSerif, { color: palette.textPrimary, marginTop: space.xl }]}>
            {sourceLine}
          </Text>
        ) : null}

        {/* 본문 */}
        {entry.body ? (
          <Text style={[type.bodySerif, { color: palette.textPrimary, marginTop: space.xl }]}>
            {entry.body}
          </Text>
        ) : null}

        {/* 식사·운동 요약 */}
        {entry.type === 'meal' && entry.slot ? (
          <Text style={[type.caption, { color: palette.textSecondary, marginTop: space.l }]}>
            {MEAL_SLOT_LABELS[entry.slot]}
            {entry.practiced === 1 ? ' · 잘 챙겨 먹었어요' : ''}
          </Text>
        ) : null}
        {entry.type === 'workout' ? (
          <Text style={[type.caption, { color: palette.textSecondary, marginTop: space.l }]}>
            {[entry.title, entry.minutes ? `${entry.minutes}분` : null].filter(Boolean).join(' · ')}
          </Text>
        ) : null}

        {/* 사진 */}
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={[styles.photo, { backgroundColor: palette.surfaceSunken }]}
          />
        ) : null}

        {/* 링크 */}
        {entry.url ? (
          <Pressable
            onPress={() => Linking.openURL(entry.url!).catch(() => {})}
            style={styles.linkRow}
          >
            <Ionicons name="link-outline" size={14} color={palette.secondary} />
            <Text style={[type.caption, { color: palette.secondary, flex: 1 }]} numberOfLines={1}>
              {entry.url}
            </Text>
          </Pressable>
        ) : null}

        {/* 갈피 */}
        {tags.length > 0 && (
          <View style={styles.tagRow}>
            {tags.map((t) => (
              <Pressable
                key={t}
                onPress={() => router.push(`/tag/${encodeURIComponent(t)}`)}
                style={[styles.tagChip, { backgroundColor: palette.surfaceSunken }]}
              >
                <Text style={[type.caption, { color: palette.textSecondary }]}>#{t}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* 같은 갈피에 꽂힌 기록 — 한 번의 읽기가 산책이 되도록 */}
        {related.length > 0 && (
          <View style={styles.relatedWrap}>
            <View style={[styles.dividerLine, { backgroundColor: palette.divider }]} />
            <Text style={[type.micro, { color: palette.textTertiary, textTransform: 'uppercase', marginBottom: space.s }]}>
              {S.detail_related}
            </Text>
            {related.map((r) => (
              <EntryCard key={r.id} entry={r} onPress={() => router.push(`/entry/${r.id}`)} />
            ))}
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.gutter,
    paddingVertical: space.l,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xl,
  },
  scroll: {
    paddingHorizontal: space.gutter,
    paddingTop: space.xl,
  },
  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.card,
    marginTop: space.xl,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: space.l,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.s,
    marginTop: space.xl,
  },
  tagChip: {
    paddingHorizontal: space.m,
    paddingVertical: 6,
    borderRadius: radius.chip,
  },
  relatedWrap: {
    marginTop: space.xl,
  },
  dividerLine: {
    height: StyleSheet.hairlineWidth,
    marginBottom: space.xl,
  },
});
