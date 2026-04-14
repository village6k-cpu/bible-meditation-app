import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../lib/theme';
import { Book, getAllBooks } from '../lib/bible-data';

interface Props {
  visible: boolean;
  onClose: () => void;
  onAdd: (bookId: number, startChapter: number, endChapter: number) => void;
}

type Step = 'testament' | 'book' | 'chapter';

export function AddReadingModal({ visible, onClose, onAdd }: Props) {
  const [step, setStep] = useState<Step>('testament');
  const [testament, setTestament] = useState<'old' | 'new'>('old');
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  useEffect(() => {
    if (visible) {
      setStep('testament');
      setSelectedBook(null);
      getAllBooks().then(setBooks);
    }
  }, [visible]);

  const filteredBooks = books.filter((b) => b.testament === testament);

  function handleSelectBook(book: Book) {
    setSelectedBook(book);
    setStep('chapter');
  }

  function handleSelectChapter(chapter: number) {
    if (!selectedBook) return;
    onAdd(selectedBook.id, chapter, chapter);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={step === 'testament' ? onClose : () => setStep(step === 'chapter' ? 'book' : 'testament')}>
            <Text style={styles.headerButton}>{step === 'testament' ? '닫기' : '뒤로'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {step === 'testament' ? '읽을 말씀 추가' : step === 'book' ? (testament === 'old' ? '구약' : '신약') : selectedBook?.name_ko}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {step === 'testament' && (
          <View style={styles.testamentRow}>
            <TouchableOpacity
              style={[styles.testamentButton, testament === 'old' && styles.testamentActive]}
              onPress={() => { setTestament('old'); setStep('book'); }}
            >
              <Text style={[styles.testamentText, testament === 'old' && styles.testamentTextActive]}>구약</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.testamentButton, testament === 'new' && styles.testamentActive]}
              onPress={() => { setTestament('new'); setStep('book'); }}
            >
              <Text style={[styles.testamentText, testament === 'new' && styles.testamentTextActive]}>신약</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'book' && (
          <ScrollView style={styles.list}>
            {filteredBooks.map((book) => (
              <TouchableOpacity key={book.id} style={styles.listItem} onPress={() => handleSelectBook(book)}>
                <Text style={styles.listItemText}>{book.name_ko}</Text>
                <Text style={styles.listItemSub}>{book.chapter_count}장</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {step === 'chapter' && selectedBook && (
          <ScrollView contentContainerStyle={styles.chapterGrid}>
            {Array.from({ length: selectedBook.chapter_count }, (_, i) => i + 1).map((ch) => (
              <TouchableOpacity key={ch} style={styles.chapterCell} onPress={() => handleSelectChapter(ch)}>
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
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
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
  headerButton: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.accent,
  },
  headerTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  testamentRow: {
    flexDirection: 'row',
    padding: spacing.screenPadding,
    gap: 12,
  },
  testamentButton: {
    flex: 1,
    paddingVertical: 40,
    borderRadius: spacing.cardRadius,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  testamentActive: {
    backgroundColor: colors.accent,
  },
  testamentText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  testamentTextActive: {
    color: '#FFFFFF',
  },
  list: {
    flex: 1,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  listItemText: {
    fontFamily: fonts.sansRegular,
    fontSize: 15,
    color: colors.textPrimary,
  },
  listItemSub: {
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    color: colors.textSecondary,
  },
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
  chapterText: {
    fontFamily: fonts.sansRegular,
    fontSize: 15,
    color: colors.textPrimary,
  },
});
