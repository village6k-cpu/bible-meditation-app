import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Entry, MEAL_SLOT_LABELS } from '../core/types';
import { specOf } from '../core/registry';
import { imageAbs } from '../export/files';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space, type, underline } from '../theme/tokens';

interface Props {
  entry: Entry;
  tags?: string[];
  meta?: string; // 카드 하단에 조용히 붙는 문구 ('읽은 지 47일' 등)
  onPress: () => void;
}

// 낱장 — 유형마다 다른 조판으로 렌더링되는 기록 카드.
// 인용문이 있으면 인용문이 주인공이고, 그 아래 인주 밑줄이 그어진다.
export function EntryCard({ entry, tags, meta, onPress }: Props) {
  const { palette } = useTheme();
  const spec = specOf(entry.type);
  const photo = imageAbs(entry.image_uri);

  const sourceLine =
    entry.type === 'book'
      ? [entry.subtitle, entry.title ? `『${entry.title}』` : null, entry.page ? `p.${entry.page}` : null]
          .filter(Boolean)
          .join(', ')
      : entry.type === 'video'
        ? [entry.title, entry.subtitle].filter(Boolean).join(' — ')
        : entry.type === 'workout'
          ? [entry.title, entry.minutes ? `${entry.minutes}분` : null].filter(Boolean).join(' · ')
          : entry.type === 'meal' && entry.slot
            ? MEAL_SLOT_LABELS[entry.slot]
            : (entry.title ?? '');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { borderBottomColor: palette.divider, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {/* 유형 뱃지 행 */}
      <View style={styles.badgeRow}>
        <Text style={[type.micro, { color: palette.textTertiary }]}>{spec.label}</Text>
        <View style={styles.badgeRight}>
          {entry.url ? <Ionicons name="link-outline" size={12} color={palette.secondary} /> : null}
          {entry.pinned === 1 ? (
            <Ionicons name="bookmark" size={12} color={palette.accent} />
          ) : null}
        </View>
      </View>

      {/* 순간: 사진이 주인공 */}
      {entry.type === 'moment' && photo ? (
        <Image source={{ uri: photo }} style={[styles.momentPhoto, { backgroundColor: palette.surfaceSunken }]} />
      ) : null}

      {/* 묵상: 쪽빛 본문 주소 */}
      {entry.type === 'verse' && entry.subtitle ? (
        <Text style={[type.label, { color: palette.secondary, marginBottom: space.xs }]}>
          {entry.subtitle}
        </Text>
      ) : null}

      {/* 인용문 + 인주 밑줄 */}
      {entry.quote ? (
        <View style={styles.quoteWrap}>
          <Text style={[type.quote, { color: palette.textPrimary }]} numberOfLines={5}>
            {entry.quote}
          </Text>
          <View
            style={{
              height: underline.thickness,
              width: 56,
              marginTop: underline.offset + 4,
              backgroundColor: palette.accent,
            }}
          />
        </View>
      ) : null}

      {/* 본문 */}
      {entry.body ? (
        <Text
          style={[type.bodySerif, { color: palette.textPrimary, marginTop: entry.quote ? space.s : 0 }]}
          numberOfLines={entry.quote ? 2 : 4}
        >
          {entry.body}
        </Text>
      ) : null}

      {/* 출처·부가 정보 */}
      {sourceLine ? (
        <Text style={[type.caption, { color: palette.textSecondary, marginTop: space.s }]} numberOfLines={1}>
          {entry.type === 'book' && entry.quote ? `— ${sourceLine}` : sourceLine}
        </Text>
      ) : null}

      {/* 순간이 아닌 유형의 사진은 아래 작게 */}
      {photo && entry.type !== 'moment' ? (
        <Image source={{ uri: photo }} style={[styles.photo, { backgroundColor: palette.surfaceSunken }]} />
      ) : null}

      {/* 태그와 메타 */}
      {(tags && tags.length > 0) || meta ? (
        <View style={styles.footRow}>
          <Text style={[type.caption, { color: palette.textTertiary, flex: 1 }]} numberOfLines={1}>
            {tags && tags.length > 0 ? tags.map((t) => `#${t}`).join('  ') : ''}
          </Text>
          {meta ? <Text style={[type.caption, { color: palette.textTertiary }]}>{meta}</Text> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: space.l,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.s,
  },
  badgeRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
  },
  quoteWrap: {
    marginBottom: space.xs,
  },
  momentPhoto: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.card,
    marginBottom: space.m,
  },
  photo: {
    width: '100%',
    height: 140,
    borderRadius: radius.card,
    marginTop: space.m,
  },
  footRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.m,
    gap: space.m,
  },
});
