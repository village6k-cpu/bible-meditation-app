import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { Underline } from '../src/components/Underline';
import { S } from '../src/core/strings.ko';
import { ExportRange, exportRange } from '../src/export/exportService';
import { ThemeMode, useTheme } from '../src/theme/ThemeProvider';
import { radius, space, type } from '../src/theme/tokens';

const THEME_MODES: { key: ThemeMode; label: string }[] = [
  { key: 'system', label: S.settings_theme_system },
  { key: 'light', label: S.settings_theme_light },
  { key: 'dark', label: S.settings_theme_dark },
];

const EXPORT_RANGES: { key: ExportRange; label: string }[] = [
  { key: 'week', label: S.settings_export_week },
  { key: 'month', label: S.settings_export_month },
  { key: 'all', label: S.settings_export_all },
];

export default function SettingsScreen() {
  const { palette, mode, setMode } = useTheme();
  const db = useSQLiteContext();
  const router = useRouter();
  const [exporting, setExporting] = useState<ExportRange | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleExport(range: ExportRange) {
    if (exporting) return;
    setExporting(range);
    setMessage(null);
    try {
      const result = await exportRange(db, range);
      setMessage(result === 'empty' ? S.export_empty : S.export_done);
    } finally {
      setExporting(null);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={[type.label, { color: palette.textSecondary }]}>{S.compose_close}</Text>
        </Pressable>
        <Text style={[type.label, { color: palette.textPrimary }]}>{S.settings_title}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* 화면 */}
        <Text style={[type.micro, styles.sectionLabel, { color: palette.textTertiary }]}>
          {S.settings_theme}
        </Text>
        <View style={styles.chipRow}>
          {THEME_MODES.map((m) => {
            const active = mode === m.key;
            return (
              <Pressable
                key={m.key}
                onPress={() => setMode(m.key)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? palette.accent : palette.surfaceSunken,
                  },
                ]}
              >
                <Text
                  style={[type.caption, { color: active ? palette.surface : palette.textSecondary }]}
                >
                  {m.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.divider, { backgroundColor: palette.divider }]} />

        {/* 내보내기 */}
        <Text style={[type.micro, styles.sectionLabel, { color: palette.textTertiary }]}>
          {S.settings_export}
        </Text>
        <Text style={[type.caption, { color: palette.textSecondary, marginBottom: space.m }]}>
          하루 한 문서, 프런트매터 포함 — 옵시디언 데일리 노트 그대로예요.
        </Text>
        <View style={styles.chipRow}>
          {EXPORT_RANGES.map((r) => (
            <Pressable
              key={r.key}
              onPress={() => handleExport(r.key)}
              disabled={exporting !== null}
              style={[
                styles.exportChip,
                {
                  backgroundColor: palette.surfaceSunken,
                  opacity: exporting && exporting !== r.key ? 0.4 : 1,
                },
              ]}
            >
              <Ionicons name="download-outline" size={14} color={palette.textPrimary} />
              <Text style={[type.label, { color: palette.textPrimary }]}>
                {exporting === r.key ? '내보내는 중…' : r.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {message ? (
          <Text style={[type.caption, { color: palette.accent, marginTop: space.s }]}>
            {message}
          </Text>
        ) : null}

        <View style={[styles.divider, { backgroundColor: palette.divider }]} />

        {/* 앱 소개 */}
        <Text style={[type.micro, styles.sectionLabel, { color: palette.textTertiary }]}>
          {S.settings_about}
        </Text>
        <Text style={[type.quote, { color: palette.textPrimary }]}>{S.appName}</Text>
        <Underline width={44} />
        <Text style={[type.bodySerif, { color: palette.textSecondary, marginTop: space.m }]}>
          {S.tagline}
        </Text>
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
  scroll: {
    paddingHorizontal: space.gutter,
    paddingTop: space.xl,
  },
  sectionLabel: {
    textTransform: 'uppercase',
    marginBottom: space.m,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.s,
  },
  chip: {
    paddingHorizontal: space.l,
    paddingVertical: 9,
    borderRadius: radius.chip,
  },
  exportChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.l,
    paddingVertical: space.m,
    borderRadius: radius.button,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: space.xxl,
  },
});
