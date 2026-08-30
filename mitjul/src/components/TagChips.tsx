import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space, type } from '../theme/tokens';

interface Props {
  tags: string[];
  selected?: string | null;
  onPress?: (tag: string) => void;
  horizontal?: boolean;
}

export function TagChips({ tags, selected, onPress, horizontal = true }: Props) {
  const { palette } = useTheme();
  if (tags.length === 0) return null;

  const chips = tags.map((t) => {
    const active = selected === t;
    return (
      <Pressable
        key={t}
        onPress={onPress ? () => onPress(t) : undefined}
        style={({ pressed }) => [
          styles.chip,
          {
            backgroundColor: active ? palette.accent : palette.surfaceSunken,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Text style={[type.caption, { color: active ? palette.surface : palette.textSecondary }]}>
          #{t}
        </Text>
      </Pressable>
    );
  });

  if (!horizontal) return <>{chips}</>;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.row}
    >
      {chips}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: space.s,
    paddingHorizontal: space.gutter,
  },
  chip: {
    paddingHorizontal: space.m,
    paddingVertical: 6,
    borderRadius: radius.chip,
  },
});
