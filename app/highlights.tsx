import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../lib/theme';
import { useAppStore } from '../lib/store';
import { getAllHighlights, Highlight } from '../lib/bible-data';

type HighlightWithMeta = Highlight & { text: string; book_name: string };

export default function HighlightsScreen() {
  const router = useRouter();
  const setCurrentPosition = useAppStore((s) => s.setCurrentPosition);
  const [highlights, setHighlights] = useState<HighlightWithMeta[]>([]);

  useFocusEffect(useCallback(() => {
    getAllHighlights().then(setHighlights);
  }, []));

  // 색상별 그룹
  const grouped = highlights.reduce((acc, h) => {
    if (!acc[h.color]) acc[h.color] = [];
    acc[h.color].push(h);
    return acc;
  }, {} as Record<string, HighlightWithMeta[]>);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>하이라이트</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {highlights.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>아직 하이라이트한 구절이 없습니다</Text>
            <Text style={styles.emptyHint}>성경 읽기에서 구절을 꾹 눌러 하이라이트하세요</Text>
          </View>
        ) : (
          Object.entries(grouped).map(([color, items]) => (
            <View key={color} style={styles.group}>
              <View style={[styles.groupBar, { backgroundColor: color }]} />
              <View style={styles.groupContent}>
                {items.map((h, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.item}
                    activeOpacity={0.6}
                    onPress={() => {
                      setCurrentPosition(h.book_id, h.chapter);
                      router.push('/(tabs)/bible');
                    }}
                  >
                    <Text style={styles.ref}>{h.book_name} {h.chapter}:{h.verse}</Text>
                    <Text style={styles.text}>{h.text}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 17, color: colors.textPrimary },
  scroll: { paddingHorizontal: spacing.screenPadding, paddingTop: 20 },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyText: { fontFamily: fonts.sansRegular, fontSize: 15, color: colors.textSecondary },
  emptyHint: { fontFamily: fonts.sansRegular, fontSize: 12, color: colors.textTertiary, marginTop: 8 },

  group: { flexDirection: 'row', marginBottom: 24 },
  groupBar: { width: 4, borderRadius: 2, marginRight: 14 },
  groupContent: { flex: 1 },
  item: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider },
  ref: { fontFamily: fonts.sansSemiBold, fontSize: 11, color: colors.accent, marginBottom: 4 },
  text: { fontFamily: fonts.serifLight, fontSize: 14.5, lineHeight: 24, color: colors.textPrimary },
});
