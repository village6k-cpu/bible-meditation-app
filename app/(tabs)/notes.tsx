import { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors, fonts, spacing } from '../../lib/theme';
import { getAllNotes, Note } from '../../lib/bible-data';
import { NoteCard } from '../../components/NoteCard';

export default function NotesScreen() {
  const [notes, setNotes] = useState<Note[]>([]);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      getAllNotes().then(setNotes);
    }, [])
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>묵상 노트</Text>
      {notes.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>아직 작성된 노트가 없습니다</Text>
        </View>
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <NoteCard
              note={item}
              onPress={() => router.push(`/note/${item.id}`)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 17,
    color: colors.textPrimary,
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 14,
  },
  list: {
    paddingHorizontal: spacing.screenPadding,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: colors.textTertiary,
  },
});
