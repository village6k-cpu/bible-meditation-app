import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, typography } from '../../lib/theme';
import { formatISODateKo } from '../../lib/utils';
import {
  Entry,
  getEntry,
  deleteEntry,
  togglePinned,
  photoUriToAbsolute,
} from '../../lib/journal-db';
import {
  ENTRY_TYPE_LABELS,
  MEAL_SLOT_LABELS,
  MEDIA_KIND_LABELS,
  parseTags,
} from '../../lib/journal-utils';

export default function EntryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [entry, setEntry] = useState<Entry | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (id) getEntry(Number(id)).then(setEntry);
    }, [id])
  );

  if (!entry) return <SafeAreaView style={styles.container} />;

  const photo = photoUriToAbsolute(entry.photo_uri);
  const tags = parseTags(entry.tags);

  const label =
    entry.type === 'media'
      ? `${entry.media_kind ? MEDIA_KIND_LABELS[entry.media_kind] : '감상'}`
      : entry.type === 'meal'
        ? `식사${entry.meal_slot ? ` · ${MEAL_SLOT_LABELS[entry.meal_slot]}` : ''}`
        : entry.type === 'workout'
          ? `운동${entry.minutes ? ` · ${entry.minutes}분` : ''}`
          : ENTRY_TYPE_LABELS[entry.type];

  async function handleDelete() {
    Alert.alert('기록 삭제', '이 기록을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await deleteEntry(entry!.id);
          router.back();
        },
      },
    ]);
  }

  async function handlePin() {
    await togglePinned(entry!.id);
    const updated = await getEntry(entry!.id);
    setEntry(updated);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.headerButton}>닫기</Text>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handlePin} hitSlop={8}>
            <Ionicons
              name={entry.pinned === 1 ? 'star' : 'star-outline'}
              size={20}
              color={entry.pinned === 1 ? colors.accentGreen : colors.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push(`/entry/new?id=${entry.id}`)}
            hitSlop={8}
          >
            <Ionicons name="create-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} hitSlop={8}>
            <Ionicons name="trash-outline" size={19} color={colors.accentRed} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={typography.sectionLabel}>{label}</Text>
        <Text style={styles.date}>{formatISODateKo(entry.date)}</Text>

        {entry.title ? <Text style={styles.title}>{entry.title}</Text> : null}

        {entry.quote ? (
          <View style={styles.quoteBlock}>
            <Text style={styles.quote}>{entry.quote}</Text>
          </View>
        ) : null}

        {entry.body ? <Text style={styles.body}>{entry.body}</Text> : null}

        {photo ? <Image source={{ uri: photo }} style={styles.photo} /> : null}

        {entry.link ? (
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => Linking.openURL(entry.link!).catch(() => {})}
          >
            <Ionicons name="link-outline" size={15} color={colors.accentGreen} />
            <Text style={styles.linkText} numberOfLines={1}>
              {entry.link}
            </Text>
          </TouchableOpacity>
        ) : null}

        {tags.length > 0 && (
          <View style={styles.tagRow}>
            {tags.map((t) => (
              <View key={t} style={styles.tagChip}>
                <Text style={styles.tagText}>#{t}</Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.dayLink}
          onPress={() => router.push(`/day/${entry.date}`)}
        >
          <Text style={styles.dayLinkText}>이 날의 다른 기록 보기</Text>
          <Ionicons name="chevron-forward" size={13} color={colors.textSecondary} />
        </TouchableOpacity>
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
  headerButton: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.accentGreen,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  scroll: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 24,
    paddingBottom: 60,
  },
  date: {
    fontFamily: fonts.sansRegular,
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: 20,
  },
  title: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 19,
    lineHeight: 28,
    color: colors.textPrimary,
    marginBottom: 14,
  },
  quoteBlock: {
    borderLeftWidth: 2,
    borderLeftColor: colors.accentGreen,
    paddingLeft: 16,
    marginBottom: 18,
  },
  quote: {
    fontFamily: fonts.serifLight,
    fontSize: 16.5,
    lineHeight: 32,
    color: colors.textPrimary,
  },
  body: {
    fontFamily: fonts.sansRegular,
    fontSize: 14.5,
    lineHeight: 25,
    color: colors.textPrimary,
    marginBottom: 18,
  },
  photo: {
    width: '100%',
    height: 280,
    borderRadius: 12,
    marginBottom: 18,
    backgroundColor: colors.surface,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 18,
  },
  linkText: {
    flex: 1,
    fontFamily: fonts.sansRegular,
    fontSize: 12.5,
    color: colors.accentGreen,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 28,
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  tagText: {
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  dayLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  dayLinkText: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.textSecondary,
  },
});
