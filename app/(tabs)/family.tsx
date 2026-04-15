import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Modal, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../../lib/theme';
import { useAppStore } from '../../lib/store';
import { getMyGroups, getAllGroups, createGroup, joinGroup, Group } from '../../lib/bible-data';

function formatLastActivity(dateStr: string | undefined): string {
  if (!dateStr) return '아직 글 없음';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export default function FamilyScreen() {
  const router = useRouter();
  const userName = useAppStore((s) => s.userName);

  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  async function loadData() {
    const groups = await getMyGroups(userName || '익명');
    setMyGroups(groups);
  }

  useFocusEffect(useCallback(() => { loadData(); }, []));

  async function handleCreate() {
    if (!newName.trim()) return;
    await createGroup(newName.trim(), newDesc.trim(), userName || '익명');
    setNewName('');
    setNewDesc('');
    setShowCreate(false);
    await loadData();
  }

  async function handleShowJoin() {
    const all = await getAllGroups();
    const myIds = new Set(myGroups.map((g) => g.id));
    setAllGroups(all.filter((g) => !myIds.has(g.id)));
    setShowJoin(true);
  }

  async function handleJoin(groupId: number) {
    await joinGroup(groupId, userName || '익명');
    setShowJoin(false);
    await loadData();
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>가족</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={handleShowJoin} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="search-outline" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowCreate(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="add-circle-outline" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {myGroups.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>아직 모임이 없어요</Text>
            <Text style={styles.emptyDesc}>모임을 만들거나 참여해 보세요</Text>
            <View style={styles.emptyActions}>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowCreate(true)}>
                <Ionicons name="add" size={18} color={colors.accent} />
                <Text style={styles.emptyBtnText}>모임 만들기</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.emptyBtn} onPress={handleShowJoin}>
                <Ionicons name="search" size={18} color={colors.accent} />
                <Text style={styles.emptyBtnText}>모임 찾기</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          myGroups.map((group) => (
            <TouchableOpacity
              key={group.id}
              style={styles.groupCard}
              activeOpacity={0.6}
              onPress={() => router.push(`/post/board?groupId=${group.id}&groupName=${encodeURIComponent(group.name)}`)}
            >
              {/* 모임 아이콘 */}
              <View style={styles.groupIcon}>
                <Text style={styles.groupIconText}>{group.name.charAt(0)}</Text>
              </View>
              {/* 모임 정보 */}
              <View style={styles.groupInfo}>
                <Text style={styles.groupName}>{group.name}</Text>
                <Text style={styles.groupMeta}>
                  멤버 {group.member_count}명 · 글 {group.post_count ?? 0}개
                </Text>
              </View>
              {/* 마지막 활동 */}
              <Text style={styles.groupActivity}>{formatLastActivity(group.last_post_date)}</Text>
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 모임 만들기 모달 */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Text style={styles.modalCancel}>취소</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>모임 만들기</Text>
            <TouchableOpacity onPress={handleCreate} disabled={!newName.trim()}>
              <Text style={[styles.modalSubmit, !newName.trim() && styles.modalSubmitDisabled]}>만들기</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.inputLabel}>모임 이름</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="예: 청년부 셀그룹"
              placeholderTextColor={colors.textTertiary}
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
            <Text style={[styles.inputLabel, { marginTop: 20 }]}>소개 (선택)</Text>
            <TextInput
              style={[styles.modalInput, styles.modalInputMulti]}
              placeholder="모임을 소개해 주세요"
              placeholderTextColor={colors.textTertiary}
              value={newDesc}
              onChangeText={setNewDesc}
              multiline
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* 모임 찾기 모달 */}
      <Modal visible={showJoin} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowJoin(false)}>
              <Text style={styles.modalCancel}>닫기</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>모임 찾기</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView style={styles.modalBody}>
            {allGroups.length === 0 ? (
              <Text style={styles.joinEmpty}>참여 가능한 모임이 없습니다</Text>
            ) : (
              allGroups.map((group) => (
                <View key={group.id} style={styles.joinRow}>
                  <View style={styles.joinInfo}>
                    <Text style={styles.joinName}>{group.name}</Text>
                    {group.description ? <Text style={styles.joinDesc}>{group.description}</Text> : null}
                    <Text style={styles.joinMeta}>멤버 {group.member_count}명</Text>
                  </View>
                  <TouchableOpacity style={styles.joinBtn} onPress={() => handleJoin(group.id)}>
                    <Text style={styles.joinBtnText}>참여</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  headerTitle: { fontFamily: fonts.sansSemiBold, fontSize: 17, color: colors.textPrimary },
  headerRight: { flexDirection: 'row', gap: 14 },

  list: { flex: 1 },

  // 빈 상태
  empty: { alignItems: 'center', paddingTop: 100, paddingHorizontal: 40, gap: 8 },
  emptyTitle: { fontFamily: fonts.sansSemiBold, fontSize: 17, color: colors.textPrimary, marginTop: 8 },
  emptyDesc: { fontFamily: fonts.sansRegular, fontSize: 14, color: colors.textSecondary },
  emptyActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: colors.accentLight,
  },
  emptyBtnText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.accent },

  // 모임 카드
  groupCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  groupIcon: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  groupIconText: { fontFamily: fonts.sansSemiBold, fontSize: 20, color: colors.accent },
  groupInfo: { flex: 1, gap: 3 },
  groupName: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.textPrimary },
  groupMeta: { fontFamily: fonts.sansRegular, fontSize: 12, color: colors.textSecondary },
  groupActivity: { fontFamily: fonts.sansRegular, fontSize: 11, color: colors.textTertiary },

  // 모달
  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  modalTitle: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.textPrimary },
  modalCancel: { fontFamily: fonts.sansRegular, fontSize: 15, color: colors.textSecondary },
  modalSubmit: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.accent },
  modalSubmitDisabled: { color: colors.textTertiary },
  modalBody: { padding: 20 },
  inputLabel: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: colors.textSecondary, marginBottom: 8 },
  modalInput: {
    fontFamily: fonts.sansRegular, fontSize: 15, color: colors.textPrimary,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  modalInputMulti: { minHeight: 80, textAlignVertical: 'top' },

  // 모임 찾기
  joinEmpty: { fontFamily: fonts.sansRegular, fontSize: 14, color: colors.textTertiary, textAlign: 'center', paddingTop: 40 },
  joinRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  joinInfo: { flex: 1, gap: 2 },
  joinName: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.textPrimary },
  joinDesc: { fontFamily: fonts.sansRegular, fontSize: 13, color: colors.textSecondary },
  joinMeta: { fontFamily: fonts.sansRegular, fontSize: 11, color: colors.textTertiary },
  joinBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
    backgroundColor: colors.accent,
  },
  joinBtnText: { fontFamily: fonts.sansMedium, fontSize: 13, color: '#FFFFFF' },
});
