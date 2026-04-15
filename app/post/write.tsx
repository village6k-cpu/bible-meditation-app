import { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../lib/theme';
import { useAppStore } from '../../lib/store';
import { createPost } from '../../lib/bible-data';

const CATEGORIES = [
  { key: 'sharing', label: '나눔', color: '#5B7A3A' },
  { key: 'prayer', label: '기도', color: '#7B6AA0' },
  { key: 'thanks', label: '감사', color: '#C15F3C' },
];

export default function WritePostScreen() {
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const gid = parseInt(groupId ?? '1');
  const userName = useAppStore((s) => s.userName);

  const [category, setCategory] = useState('sharing');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  async function handleSubmit() {
    if (!title.trim() || !content.trim()) return;
    await createPost(gid, userName || '익명', title.trim(), content.trim(), category);
    router.back();
  }

  const canSubmit = title.trim().length > 0 && content.trim().length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.cancelText}>취소</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>글쓰기</Text>
        <TouchableOpacity onPress={handleSubmit} disabled={!canSubmit}>
          <Text style={[styles.submitText, !canSubmit && styles.submitDisabled]}>등록</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* 카테고리 선택 */}
          <View style={styles.catSection}>
            <Text style={styles.label}>분류</Text>
            <View style={styles.catRow}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.key}
                  style={[styles.catChip, category === cat.key && { backgroundColor: cat.color }]}
                  onPress={() => setCategory(cat.key)}
                >
                  <Text style={[styles.catChipText, category === cat.key && styles.catChipTextActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.divider} />

          {/* 제목 */}
          <TextInput
            style={styles.titleInput}
            placeholder="제목을 입력하세요"
            placeholderTextColor={colors.textTertiary}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />

          <View style={styles.divider} />

          {/* 내용 */}
          <TextInput
            style={styles.contentInput}
            placeholder="가족에게 나누고 싶은 이야기를 적어주세요..."
            placeholderTextColor={colors.textTertiary}
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  headerTitle: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.textPrimary },
  cancelText: { fontFamily: fonts.sansRegular, fontSize: 15, color: colors.textSecondary },
  submitText: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.accent },
  submitDisabled: { color: colors.textTertiary },

  scroll: { flex: 1 },

  // 카테고리
  catSection: { paddingHorizontal: 20, paddingVertical: 16 },
  label: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: colors.textSecondary, marginBottom: 10 },
  catRow: { flexDirection: 'row', gap: 8 },
  catChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)',
  },
  catChipText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textSecondary },
  catChipTextActive: { color: '#FFFFFF' },

  divider: { height: 1, backgroundColor: colors.divider, marginHorizontal: 20 },

  // 제목
  titleInput: {
    fontFamily: fonts.sansMedium, fontSize: 17, color: colors.textPrimary,
    paddingHorizontal: 20, paddingVertical: 16,
  },

  // 내용
  contentInput: {
    fontFamily: fonts.sansRegular, fontSize: 15, lineHeight: 24, color: colors.textPrimary,
    paddingHorizontal: 20, paddingVertical: 16, minHeight: 300,
  },
});
