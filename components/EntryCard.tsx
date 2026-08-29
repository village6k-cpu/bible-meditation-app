import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../lib/theme';
import { Entry, photoUriToAbsolute } from '../lib/journal-db';
import {
  ENTRY_TYPE_LABELS,
  MEAL_SLOT_LABELS,
  MEDIA_KIND_LABELS,
  parseTags,
} from '../lib/journal-utils';
import { formatISODateKo } from '../lib/utils';

interface Props {
  entry: Entry;
  onPress: () => void;
  showDate?: boolean;
}

function microLabel(entry: Entry): string {
  if (entry.type === 'media') {
    const kind = entry.media_kind ? MEDIA_KIND_LABELS[entry.media_kind] : '감상';
    return entry.title ? `${kind} · ${entry.title}` : kind;
  }
  if (entry.type === 'meal') {
    return entry.meal_slot ? `식사 · ${MEAL_SLOT_LABELS[entry.meal_slot]}` : '식사';
  }
  if (entry.type === 'workout') {
    return entry.minutes ? `운동 · ${entry.minutes}분` : '운동';
  }
  if (entry.type === 'writing' && entry.title) {
    return `글 · ${entry.title}`;
  }
  return ENTRY_TYPE_LABELS[entry.type];
}

export function EntryCard({ entry, onPress, showDate = false }: Props) {
  const photo = photoUriToAbsolute(entry.photo_uri);
  const tags = parseTags(entry.tags);

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.headerRow}>
        <Text style={styles.microLabel} numberOfLines={1}>
          {microLabel(entry)}
        </Text>
        <View style={styles.headerRight}>
          {entry.link ? (
            <Ionicons name="link-outline" size={13} color={colors.textTertiary} />
          ) : null}
          {entry.pinned === 1 ? (
            <Ionicons name="star" size={13} color={colors.accentGreen} />
          ) : null}
        </View>
      </View>

      {showDate && <Text style={styles.date}>{formatISODateKo(entry.date)}</Text>}

      {entry.quote ? (
        <Text style={styles.quote} numberOfLines={4}>
          {entry.quote}
        </Text>
      ) : null}

      {entry.body ? (
        <Text style={styles.body} numberOfLines={entry.quote ? 2 : 4}>
          {entry.body}
        </Text>
      ) : null}

      {photo ? <Image source={{ uri: photo }} style={styles.photo} /> : null}

      {tags.length > 0 && (
        <Text style={styles.tags} numberOfLines={1}>
          {tags.map((t) => `#${t}`).join('  ')}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  microLabel: {
    flex: 1,
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.accentGreen,
    marginRight: 8,
  },
  date: {
    fontFamily: fonts.sansRegular,
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  quote: {
    fontFamily: fonts.serifLight,
    fontSize: 15,
    lineHeight: 27,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  body: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  photo: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    marginTop: 10,
    backgroundColor: colors.surface,
  },
  tags: {
    fontFamily: fonts.sansRegular,
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 8,
  },
});
