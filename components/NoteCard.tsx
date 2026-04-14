import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts } from '../lib/theme';
import { Note } from '../lib/bible-data';

interface Props {
  note: Note;
  onPress: () => void;
}

export function NoteCard({ note, onPress }: Props) {
  const date = new Date(note.created_at);
  const dateStr = `${date.getMonth() + 1}월 ${date.getDate()}일`;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <Text style={styles.date}>{dateStr}</Text>
      {note.book_id && (
        <Text style={styles.ref}>
          {note.book_name ?? ''} {note.chapter}:{note.verse}
        </Text>
      )}
      <Text style={styles.preview} numberOfLines={2}>
        {note.content}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  date: {
    fontFamily: fonts.sansRegular,
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  ref: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.accent,
    marginBottom: 6,
  },
  preview: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textPrimary,
  },
});
