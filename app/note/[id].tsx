import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, fonts, spacing } from '../../lib/theme';
import { getNote, updateNote, deleteNote, Note } from '../../lib/bible-data';

export default function NoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [note, setNote] = useState<Note | null>(null);
  const [content, setContent] = useState('');

  useEffect(() => {
    if (id) {
      getNote(Number(id)).then((n) => {
        if (n) {
          setNote(n);
          setContent(n.content);
        }
      });
    }
  }, [id]);

  async function handleSave() {
    if (note && content.trim()) {
      await updateNote(note.id, content.trim());
      router.back();
    }
  }

  async function handleDelete() {
    if (note) {
      await deleteNote(note.id);
      router.back();
    }
  }

  if (!note) return null;

  const date = new Date(note.created_at);
  const dateStr = `${date.getMonth() + 1}월 ${date.getDate()}일`;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.headerButton}>닫기</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSave}>
          <Text style={styles.headerButton}>저장</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.meta}>
        <Text style={styles.date}>{dateStr}</Text>
      </View>

      <TextInput
        style={styles.input}
        value={content}
        onChangeText={setContent}
        multiline
        autoFocus
      />

      <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
        <Text style={styles.deleteText}>노트 삭제</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerButton: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.accentGreen,
  },
  meta: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 16,
  },
  date: {
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  input: {
    flex: 1,
    fontFamily: fonts.sansRegular,
    fontSize: 15,
    lineHeight: 26,
    color: colors.textPrimary,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 16,
    textAlignVertical: 'top',
  },
  deleteButton: {
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  deleteText: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.accentRed,
    textAlign: 'center',
  },
});
