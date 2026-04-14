import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../../lib/theme';
import { getAllPosts, BoardPost } from '../../lib/bible-data';

const CATEGORIES = [
  { key: 'all', label: '전체' },
  { key: 'sharing', label: '나눔' },
  { key: 'prayer', label: '기도' },
  { key: 'thanks', label: '감사' },
];

const CATEGORY_BADGES: Record<string, { label: string; color: string; bg: string }> = {
  sharing: { label: '나눔', color: '#5B7A3A', bg: 'rgba(91,122,58,0.1)' },
  prayer: { label: '기도', color: '#7B6AA0', bg: 'rgba(123,106,160,0.1)' },
  thanks: { label: '감사', color: '#C15F3C', bg: 'rgba(193,95,60,0.1)' },
};

function formatBoardDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export default function FamilyScreen() {
  const router = useRouter();
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [category, setCategory] = useState('all');

  async function loadPosts() {
    const p = await getAllPosts(category);
    setPosts(p);
  }

  useFocusEffect(useCallback(() => { loadPosts(); }, [category]));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>가족</Text>
      </View>

      {/* 카테고리 탭 */}
      <View style={styles.catRow}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            style={[styles.catTab, category === cat.key && styles.catTabActive]}
            onPress={() => setCategory(cat.key)}
          >
            <Text style={[styles.catTabText, category === cat.key && styles.catTabTextActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 테이블 헤더 */}
      <View style={styles.tableHeader}>
        <Text style={[styles.thCell, styles.thNum]}>번호</Text>
        <Text style={[styles.thCell, styles.thTitle]}>제목</Text>
        <Text style={[styles.thCell, styles.thAuthor]}>글쓴이</Text>
        <Text style={[styles.thCell, styles.thDate]}>날짜</Text>
      </View>

      {/* 게시글 목록 */}
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {posts.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={40} color={colors.textTertiary} />
            <Text style={styles.emptyText}>아직 글이 없습니다</Text>
            <Text style={styles.emptySubText}>첫 번째 글을 남겨보세요</Text>
          </View>
        ) : (
          posts.map((post, i) => {
            const badge = CATEGORY_BADGES[post.category];
            return (
              <TouchableOpacity
                key={post.id}
                style={[styles.row, i % 2 === 0 && styles.rowEven]}
                onPress={() => router.push(`/post/${post.id}`)}
                activeOpacity={0.6}
              >
                <Text style={[styles.cell, styles.cellNum]}>{post.id}</Text>
                <View style={[styles.cellTitleWrap]}>
                  {badge && (
                    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                    </View>
                  )}
                  <Text style={styles.cellTitle} numberOfLines={1}>
                    {post.title}
                  </Text>
                  {(post.comment_count ?? 0) > 0 && (
                    <Text style={styles.commentCount}>[{post.comment_count}]</Text>
                  )}
                </View>
                <Text style={[styles.cell, styles.cellAuthor]} numberOfLines={1}>{post.author}</Text>
                <Text style={[styles.cell, styles.cellDate]}>{formatBoardDate(post.created_at)}</Text>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 글쓰기 FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/post/write')}
        activeOpacity={0.8}
      >
        <Ionicons name="pencil" size={20} color="#FFFFFF" />
        <Text style={styles.fabText}>글쓰기</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  headerTitle: { fontFamily: fonts.sansSemiBold, fontSize: 17, color: colors.textPrimary },

  // 카테고리
  catRow: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 6,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  catTab: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
    backgroundColor: colors.surface,
  },
  catTabActive: { backgroundColor: colors.textPrimary },
  catTabText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.textSecondary },
  catTabTextActive: { color: colors.background },

  // 테이블 헤더
  tableHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.08)',
    backgroundColor: colors.surface,
  },
  thCell: { fontFamily: fonts.sansSemiBold, fontSize: 11, color: colors.textSecondary },
  thNum: { width: 36, textAlign: 'center' },
  thTitle: { flex: 1, paddingLeft: 8 },
  thAuthor: { width: 52, textAlign: 'center' },
  thDate: { width: 46, textAlign: 'center' },

  // 게시글 행
  list: { flex: 1 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  rowEven: { backgroundColor: 'rgba(0,0,0,0.015)' },
  cell: { fontFamily: fonts.sansRegular, fontSize: 13, color: colors.textPrimary },
  cellNum: { width: 36, textAlign: 'center', fontSize: 12, color: colors.textSecondary },
  cellTitleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5, paddingLeft: 8 },
  cellTitle: { fontFamily: fonts.sansRegular, fontSize: 13, color: colors.textPrimary, flexShrink: 1 },
  cellAuthor: { width: 52, textAlign: 'center', fontSize: 12, color: colors.textSecondary },
  cellDate: { width: 46, textAlign: 'center', fontSize: 11, color: colors.textSecondary },

  // 카테고리 뱃지
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeText: { fontFamily: fonts.sansSemiBold, fontSize: 10 },

  // 댓글 수
  commentCount: { fontFamily: fonts.sansSemiBold, fontSize: 11, color: colors.accent },

  // 빈 상태
  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyText: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.textSecondary },
  emptySubText: { fontFamily: fonts.sansRegular, fontSize: 13, color: colors.textTertiary },

  // FAB
  fab: {
    position: 'absolute', bottom: 100, right: 20,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.textPrimary, paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: 24, elevation: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8,
  },
  fabText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.background },
});
