import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, fonts, spacing } from '../lib/theme';
import { addDays, getISODate } from '../lib/utils';
import { buildRangeMarkdown, shareMarkdown } from '../lib/export-md';

type RangeKey = 'thisMonth' | 'lastMonth' | 'all';

const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'thisMonth', label: '이번 달' },
  { key: 'lastMonth', label: '지난 달' },
  { key: 'all', label: '전체' },
];

function rangeFor(key: RangeKey): { start: string; end: string; name: string } {
  const today = getISODate();
  const [y, m] = today.split('-').map(Number);
  if (key === 'thisMonth') {
    const mm = String(m).padStart(2, '0');
    return { start: `${y}-${mm}-01`, end: today, name: `기록-${y}-${mm}` };
  }
  if (key === 'lastMonth') {
    const ly = m === 1 ? y - 1 : y;
    const lm = m === 1 ? 12 : m - 1;
    const mm = String(lm).padStart(2, '0');
    const lastDay = new Date(ly, lm, 0).getDate();
    return {
      start: `${ly}-${mm}-01`,
      end: `${ly}-${mm}-${String(lastDay).padStart(2, '0')}`,
      name: `기록-${ly}-${mm}`,
    };
  }
  return { start: '1970-01-01', end: addDays(today, 1), name: '기록-전체' };
}

export default function ExportScreen() {
  const router = useRouter();
  const [range, setRange] = useState<RangeKey>('thisMonth');
  const [preview, setPreview] = useState('');
  const [dayCount, setDayCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const { start, end } = rangeFor(range);
    buildRangeMarkdown(start, end).then(({ content, dayCount }) => {
      if (cancelled) return;
      setPreview(content.slice(0, 2000));
      setDayCount(dayCount);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [range]);

  async function handleExport() {
    if (sharing) return;
    setSharing(true);
    try {
      const { start, end, name } = rangeFor(range);
      const { content } = await buildRangeMarkdown(start, end);
      if (content) {
        await shareMarkdown(content, `${name}.md`);
      }
    } finally {
      setSharing(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.headerButton}>닫기</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>내보내기</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.body}>
        <View style={styles.rangeRow}>
          {RANGES.map((r) => (
            <TouchableOpacity
              key={r.key}
              style={[styles.rangeChip, range === r.key && styles.rangeChipActive]}
              onPress={() => setRange(r.key)}
            >
              <Text style={[styles.rangeText, range === r.key && styles.rangeTextActive]}>
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.caption}>
          하루당 하나의 문서, YAML 프런트매터 포함 — Obsidian에 바로 쌓입니다
        </Text>

        <View style={styles.previewBox}>
          {loading ? (
            <ActivityIndicator color={colors.accentGreen} />
          ) : preview ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.previewText}>{preview}</Text>
            </ScrollView>
          ) : (
            <Text style={styles.emptyText}>이 기간에는 기록이 없습니다</Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.exportButton, (loading || dayCount === 0) && styles.exportButtonDisabled]}
          onPress={handleExport}
          disabled={loading || sharing || dayCount === 0}
        >
          <Text style={styles.exportButtonText}>
            {sharing ? '내보내는 중...' : `${dayCount}일치 내보내기`}
          </Text>
        </TouchableOpacity>
      </View>
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
  headerTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  headerButton: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.accentGreen,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 18,
  },
  rangeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  rangeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  rangeChipActive: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  rangeText: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  rangeTextActive: {
    color: '#FFFFFF',
  },
  caption: {
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 14,
  },
  previewBox: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: 16,
    marginBottom: 16,
    justifyContent: 'center',
  },
  previewText: {
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    lineHeight: 19,
    color: colors.textPrimary,
  },
  emptyText: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  exportButton: {
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: 12,
    backgroundColor: colors.accentGreen,
    marginBottom: 10,
  },
  exportButtonDisabled: {
    opacity: 0.4,
  },
  exportButtonText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
});
