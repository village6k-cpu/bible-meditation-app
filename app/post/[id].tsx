import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../../lib/theme';
import { useAppStore } from '../../lib/store';
import { getPost, getComments, addComment, likePost, deletePost, BoardPost, BoardComment } from '../../lib/bible-data';

const CATEGORY_LABELS: Record<string, string> = {
  sharing: '나눔',
  prayer: '기도',
  thanks: '감사',
  general: '일반',
};

const CATEGORY_COLORS: Record<string, string> = {
  sharing: '#5B7A3A',
  prayer: '#7B6AA0',
  thanks: '#C15F3C',
  general: '#999999',
};

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatCommentDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const userName = useAppStore((s) => s.userName);

  const [post, setPost] = useState<BoardPost | null>(null);
  const [comments, setComments] = useState<BoardComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [liked, setLiked] = useState(false);

  async function loadData() {
    const postId = parseInt(id);
    if (isNaN(postId)) return;
    const [p, c] = await Promise.all([
      getPost(postId),
      getComments(postId),
    ]);
    setPost(p);
    setComments(c);
  }

  useFocusEffect(useCallback(() => { loadData(); }, [id]));

  async function handleComment() {
    if (!commentText.trim() || !post) return;
    await addComment(post.id, userName || '익명', commentText.trim());
    setCommentText('');
    setComments(await getComments(post.id));
  }

  async function handleLike() {
    if (!post || liked) return;
    await likePost(post.id);
    setLiked(true);
    setPost((prev) => prev ? { ...prev, likes: prev.likes + 1 } : null);
  }

  async function handleDelete() {
    if (!post) return;
    Alert.alert('삭제', '이 글을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => { await deletePost(post.id); router.back(); } },
    ]);
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>불러오는 중...</Text>
      </SafeAreaView>
    );
  }

  const catColor = CATEGORY_COLORS[post.category] ?? '#999';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>가족</Text>
        <TouchableOpacity onPress={handleDelete} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* 게시글 */}
        <View style={styles.postSection}>
          <View style={styles.catBadge}>
            <Text style={[styles.catBadgeText, { color: catColor }]}>
              {CATEGORY_LABELS[post.category] ?? post.category}
            </Text>
          </View>
          <Text style={styles.postTitle}>{post.title}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaAuthor}>{post.author}</Text>
            <Text style={styles.metaSep}>·</Text>
            <Text style={styles.metaDate}>{formatFullDate(post.created_at)}</Text>
            <Text style={styles.metaSep}>·</Text>
            <Text style={styles.metaViews}>조회 {post.views}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* 본문 */}
        <Text style={styles.postContent}>{post.content}</Text>

        {/* 좋아요 */}
        <View style={styles.likeRow}>
          <TouchableOpacity style={[styles.likeBtn, liked && styles.likeBtnActive]} onPress={handleLike}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={16} color={liked ? colors.accent : colors.textSecondary} />
            <Text style={[styles.likeBtnText, liked && styles.likeBtnTextActive]}>
              {post.likes > 0 ? post.likes : '좋아요'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* 댓글 */}
        <Text style={styles.commentHeader}>댓글 {comments.length}</Text>
        {comments.map((c) => (
          <View key={c.id} style={styles.commentItem}>
            <View style={styles.commentTop}>
              <Text style={styles.commentAuthor}>{c.author}</Text>
              <Text style={styles.commentDate}>{formatCommentDate(c.created_at)}</Text>
            </View>
            <Text style={styles.commentContent}>{c.content}</Text>
          </View>
        ))}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* 댓글 입력 */}
      <View style={styles.commentInputRow}>
        <TextInput
          style={styles.commentInput}
          placeholder="댓글을 입력하세요..."
          placeholderTextColor={colors.textTertiary}
          value={commentText}
          onChangeText={setCommentText}
          returnKeyType="send"
          onSubmitEditing={handleComment}
        />
        <TouchableOpacity style={styles.commentSend} onPress={handleComment} disabled={!commentText.trim()}>
          <Ionicons name="send" size={18} color={commentText.trim() ? colors.accent : colors.textTertiary} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingText: { fontFamily: fonts.sansRegular, fontSize: 14, color: colors.textTertiary, textAlign: 'center', paddingTop: 100 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  headerTitle: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.textPrimary },

  scroll: { flex: 1 },

  // 게시글 정보
  postSection: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  catBadge: { marginBottom: 8 },
  catBadgeText: { fontFamily: fonts.sansSemiBold, fontSize: 11 },
  postTitle: { fontFamily: fonts.sansSemiBold, fontSize: 18, lineHeight: 26, color: colors.textPrimary, marginBottom: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaAuthor: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.textPrimary },
  metaSep: { fontSize: 10, color: colors.textTertiary },
  metaDate: { fontFamily: fonts.sansRegular, fontSize: 12, color: colors.textSecondary },
  metaViews: { fontFamily: fonts.sansRegular, fontSize: 12, color: colors.textSecondary },

  divider: { height: 1, backgroundColor: colors.divider, marginHorizontal: 20 },

  // 본문
  postContent: {
    fontFamily: fonts.sansRegular, fontSize: 15, lineHeight: 26,
    color: colors.textPrimary, paddingHorizontal: 20, paddingVertical: 20,
  },

  // 좋아요
  likeRow: { paddingHorizontal: 20, paddingBottom: 16 },
  likeBtn: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)',
  },
  likeBtnActive: { borderColor: colors.accentLight, backgroundColor: colors.accentLight },
  likeBtnText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.textSecondary },
  likeBtnTextActive: { color: colors.accent },

  // 댓글
  commentHeader: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.textPrimary, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  commentItem: { paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.04)' },
  commentTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  commentAuthor: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: colors.textPrimary },
  commentDate: { fontFamily: fonts.sansRegular, fontSize: 11, color: colors.textTertiary },
  commentContent: { fontFamily: fonts.sansRegular, fontSize: 14, lineHeight: 22, color: colors.textPrimary },

  // 댓글 입력
  commentInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: colors.divider,
    backgroundColor: colors.background,
  },
  commentInput: {
    flex: 1, fontFamily: fonts.sansRegular, fontSize: 14, color: colors.textPrimary,
    backgroundColor: colors.surface, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  commentSend: { padding: 8 },
});
