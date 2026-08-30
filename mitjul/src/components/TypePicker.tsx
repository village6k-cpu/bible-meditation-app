import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EntryType } from '../core/types';
import { REGISTRY, TYPE_ORDER } from '../core/registry';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space, type } from '../theme/tokens';

interface Props {
  selected?: EntryType | null;
  onSelect: (t: EntryType) => void;
  compact?: boolean; // 오늘 화면의 칩 바 — 한 줄 가로 스크롤용
}

export function TypePicker({ selected, onSelect, compact = false }: Props) {
  const { palette } = useTheme();

  if (compact) {
    return (
      <View style={styles.chipRow}>
        {TYPE_ORDER.map((t) => (
          <Pressable
            key={t}
            onPress={() => onSelect(t)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: palette.surface,
                borderColor: palette.divider,
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <Ionicons name={REGISTRY[t].icon as never} size={13} color={palette.textSecondary} />
            <Text style={[type.caption, { color: palette.textSecondary }]}>{REGISTRY[t].label}</Text>
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {TYPE_ORDER.map((t) => {
        const active = selected === t;
        return (
          <Pressable
            key={t}
            onPress={() => onSelect(t)}
            style={({ pressed }) => [
              styles.cell,
              {
                backgroundColor: active ? palette.accentSoft : palette.surface,
                borderColor: active ? palette.accent : palette.divider,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Ionicons
              name={REGISTRY[t].icon as never}
              size={20}
              color={active ? palette.accent : palette.textSecondary}
            />
            <Text
              style={[type.micro, { color: active ? palette.accent : palette.textSecondary }]}
            >
              {REGISTRY[t].label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.s,
  },
  cell: {
    width: '23%',
    flexGrow: 1,
    aspectRatio: 1.15,
    borderRadius: radius.card,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.s,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: space.m,
    paddingVertical: 7,
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
