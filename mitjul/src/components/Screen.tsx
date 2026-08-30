import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { space, type } from '../theme/tokens';
import { Underline } from './Underline';

interface Props {
  title?: string;
  caption?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}

// 지면 스캐폴드 — 세리프 제목 아래 인주 획 하나.
export function Screen({ title, caption, right, children }: Props) {
  const { palette } = useTheme();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={['top']}>
      {title ? (
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            {caption ? (
              <Text style={[type.caption, { color: palette.textTertiary }]}>{caption}</Text>
            ) : null}
            <Text style={[type.display, { color: palette.textPrimary }]}>{title}</Text>
            <Underline width={40} />
          </View>
          {right}
        </View>
      ) : null}
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: space.gutter,
    paddingTop: space.m,
    paddingBottom: space.l,
  },
});
