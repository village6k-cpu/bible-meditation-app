import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../lib/theme';
import { Book, getAllBooks } from '../lib/bible-data';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (bookId: number, chapter: number) => void;
}

export function BookChapterPicker({ visible, onClose, onSelect }: Props) {
  const [testament, setTestament] = useState<'old' | 'new'>('old');
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  useEffect(() => {
    if (visible) {
      setSelectedBook(null);
      getAllBooks().then(setBooks);
    }
  }, [visible]);

  const filteredBooks = books.filter((b) => b.testament === testament);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={selectedBook ? () => setSelectedBook(null) : onClose}>
            <Text style={styles.headerButton}>{selectedBook ? '뒤로' : '닫기'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{selectedBook?.name_ko ?? '성경'}</Text>
          <View style={{ width: 40 }} />
        </View>

        {!selectedBook ? (
          <>
            <View style={styles.toggleRow}>
              {(['old', 'new'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.toggle, testament === t && styles.toggleActive]}
                  onPress={() => setTestament(t)}
                >
                  <Text style={[styles.toggleText, testament === t && styles.toggleTextActive]}>
                    {t === 'old' ? '구약' : '신약'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <ScrollView>
              {filteredBooks.map((book) => (
                <TouchableOpacity
                  key={book.id}
                  style={styles.bookItem}
                  onPress={() => setSelectedBook(book)}
                >
                  <Text style={styles.bookName}>{book.name_ko}</Text>
                  <Text style={styles.bookChapters}>{book.chapter_count}장</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        ) : (
          <ScrollView contentContainerStyle={styles.chapterGrid}>
            {Array.from({ length: selectedBook.chapter_count }, (_, i) => i + 1).map((ch) => (
              <TouchableOpacity
                key={ch}
                style={styles.chapterCell}
                onPress={() => {
                  onSelect(selectedBook.id, ch);
                  onClose();
                }}
              >
                <Text style={styles.chapterText}>{ch}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerButton: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.accentGreen },
  headerTitle: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.textPrimary },
  toggleRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 12,
    gap: 8,
  },
  toggle: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: spacing.buttonRadius,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  toggleActive: { backgroundColor: colors.accentGreen },
  toggleText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.textPrimary },
  toggleTextActive: { color: '#FFFFFF' },
  bookItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  bookName: { fontFamily: fonts.sansRegular, fontSize: 15, color: colors.textPrimary },
  bookChapters: { fontFamily: fonts.sansRegular, fontSize: 12, color: colors.textSecondary },
  chapterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.screenPadding,
    gap: 10,
  },
  chapterCell: {
    width: 52,
    height: 52,
    borderRadius: spacing.buttonRadius,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterText: { fontFamily: fonts.sansRegular, fontSize: 15, color: colors.textPrimary },
});
