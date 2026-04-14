import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, spacing } from '../lib/theme';
import { Book, getAllBooks, getVerseCount } from '../lib/bible-data';

// 성경 분류
const BOOK_CATEGORIES: { label: string; range: [number, number] }[] = [
  { label: '율법서', range: [1, 5] },
  { label: '역사서', range: [6, 17] },
  { label: '시가서', range: [18, 22] },
  { label: '대선지서', range: [23, 27] },
  { label: '소선지서', range: [28, 39] },
  { label: '복음서', range: [40, 43] },
  { label: '역사', range: [44, 44] },
  { label: '바울서신', range: [45, 57] },
  { label: '공동서신', range: [58, 64] },
  { label: '예언서', range: [65, 66] },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (bookId: number, chapter: number, verse?: number) => void;
}

export function BookChapterPicker({ visible, onClose, onSelect }: Props) {
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [verseCount, setVerseCount] = useState(0);
  const [numpadTarget, setNumpadTarget] = useState<'chapter' | 'verse'>('chapter');
  const [numpadInput, setNumpadInput] = useState('');
  const chapterRef = useRef<ScrollView>(null);
  const verseRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible) {
      getAllBooks().then((b) => {
        setBooks(b);
        if (!selectedBook && b.length > 0) setSelectedBook(b[0]);
      });
      setSelectedChapter(null);
      setVerseCount(0);
      setNumpadInput('');
      setNumpadTarget('chapter');
    }
  }, [visible]);

  function handleBookSelect(book: Book) {
    setSelectedBook(book);
    setSelectedChapter(null);
    setVerseCount(0);
    setNumpadInput('');
    setNumpadTarget('chapter');
    chapterRef.current?.scrollTo({ y: 0, animated: false });
    verseRef.current?.scrollTo({ y: 0, animated: false });
  }

  async function handleChapterSelect(ch: number) {
    setSelectedChapter(ch);
    setNumpadInput('');
    setNumpadTarget('verse');
    if (selectedBook) {
      const count = await getVerseCount(selectedBook.id, ch);
      setVerseCount(count);
      verseRef.current?.scrollTo({ y: 0, animated: false });
    }
  }

  function handleVerseSelect(verse: number) {
    if (!selectedBook || !selectedChapter) return;
    onSelect(selectedBook.id, selectedChapter, verse);
    onClose();
  }

  // 장만 선택하고 바로 이동 (절 선택 안 함)
  function handleGoChapterOnly() {
    if (!selectedBook || !selectedChapter) return;
    onSelect(selectedBook.id, selectedChapter);
    onClose();
  }

  function handleNumpad(key: string) {
    if (key === 'back') {
      setNumpadInput((p) => p.slice(0, -1));
      return;
    }
    if (key === 'go') {
      const num = parseInt(numpadInput);
      if (numpadTarget === 'chapter') {
        if (num > 0 && selectedBook && num <= selectedBook.chapter_count) {
          handleChapterSelect(num);
        }
      } else {
        if (num > 0 && num <= verseCount) {
          handleVerseSelect(num);
        }
      }
      return;
    }
    const next = numpadInput + key;
    if (next.length <= 3) setNumpadInput(next);
  }

  function switchTarget(target: 'chapter' | 'verse') {
    setNumpadTarget(target);
    setNumpadInput('');
  }

  const chapters = selectedBook
    ? Array.from({ length: selectedBook.chapter_count }, (_, i) => i + 1)
    : [];
  const verses = selectedChapter
    ? Array.from({ length: verseCount }, (_, i) => i + 1)
    : [];

  const numpadNum = numpadInput ? parseInt(numpadInput) : 0;
  const maxNum = numpadTarget === 'chapter'
    ? (selectedBook?.chapter_count ?? 0)
    : verseCount;
  const numpadValid = numpadNum > 0 && numpadNum <= maxNum;

  const groupedBooks = BOOK_CATEGORIES.map((cat) => ({
    ...cat,
    books: books.filter((b) => b.id >= cat.range[0] && b.id <= cat.range[1]),
  })).filter((g) => g.books.length > 0);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* 헤더 */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>목차검색</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* 3단 컬럼: 책 | 장 | 절 */}
        <View style={styles.columns}>
          {/* 책 */}
          <ScrollView style={styles.bookCol} showsVerticalScrollIndicator={false}>
            {groupedBooks.map((group) => (
              <View key={group.label}>
                <Text style={styles.catLabel}>{group.label}</Text>
                {group.books.map((book) => {
                  const active = selectedBook?.id === book.id;
                  return (
                    <TouchableOpacity
                      key={book.id}
                      style={[styles.bookRow, active && styles.bookRowActive]}
                      onPress={() => handleBookSelect(book)}
                    >
                      <Text style={[styles.bookAbbr, active && styles.bookAbbrActive]}>
                        {book.name_abbr}
                      </Text>
                      <Text style={[styles.bookName, active && styles.bookNameActive]}>
                        {book.name_ko}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>

          <View style={styles.colDivider} />

          {/* 장 */}
          <ScrollView ref={chapterRef} style={styles.chapterCol} showsVerticalScrollIndicator={false}>
            {chapters.map((ch) => {
              const isSelected = selectedChapter === ch;
              const isNumpad = numpadTarget === 'chapter' && numpadNum === ch;
              return (
                <TouchableOpacity
                  key={ch}
                  style={[styles.cellRow, isSelected && styles.cellRowSelected, isNumpad && !isSelected && styles.cellRowHighlight]}
                  onPress={() => handleChapterSelect(ch)}
                >
                  <Text style={[styles.cellText, isSelected && styles.cellTextSelected, isNumpad && !isSelected && styles.cellTextHighlight]}>
                    {ch}장
                  </Text>
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 40 }} />
          </ScrollView>

          <View style={styles.colDivider} />

          {/* 절 */}
          <ScrollView ref={verseRef} style={styles.verseCol} showsVerticalScrollIndicator={false}>
            {selectedChapter ? (
              <>
                {verses.map((v) => {
                  const isNumpad = numpadTarget === 'verse' && numpadNum === v;
                  return (
                    <TouchableOpacity
                      key={v}
                      style={[styles.cellRow, isNumpad && styles.cellRowHighlight]}
                      onPress={() => handleVerseSelect(v)}
                    >
                      <Text style={[styles.cellText, isNumpad && styles.cellTextHighlight]}>
                        {v}절
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                <View style={{ height: 40 }} />
              </>
            ) : (
              <View style={styles.versePlaceholder}>
                <Text style={styles.versePlaceholderText}>장을 먼저{'\n'}선택하세요</Text>
              </View>
            )}
          </ScrollView>
        </View>

        {/* 하단 */}
        <View style={styles.bottom}>
          {/* 선택 표시 */}
          <View style={styles.refBar}>
            <Text style={styles.refText}>
              {selectedBook?.name_ko ?? ''}{' '}
              {numpadTarget === 'chapter' ? (
                <Text style={styles.refBold}>{numpadInput || (selectedChapter ? `${selectedChapter}` : '―')}</Text>
              ) : (
                <Text>{selectedChapter}</Text>
              )}
              장{' '}
              {selectedChapter && (
                <>
                  {numpadTarget === 'verse' ? (
                    <Text style={styles.refBold}>{numpadInput || '―'}</Text>
                  ) : null}
                  {numpadTarget === 'verse' ? <Text>절</Text> : null}
                </>
              )}
            </Text>
            {numpadInput ? (
              <TouchableOpacity onPress={() => setNumpadInput('')} style={styles.refClear}>
                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* 넘패드 */}
          <View style={styles.numpad}>
            {(['123', '456', '789', '_0_'] as const).map((row, ri) => (
              <View key={ri} style={styles.numRow}>
                {row.split('').map((k, ki) => {
                  if (k === '_') return <View key={ki} style={styles.numKey} />;
                  return (
                    <TouchableOpacity key={ki} style={styles.numKey} onPress={() => handleNumpad(k)}>
                      <Text style={styles.numKeyText}>{k}</Text>
                    </TouchableOpacity>
                  );
                })}
                {/* 오른쪽 열: 장 / 절 전환 + 백스페이스 + 이동 */}
                {ri === 0 && (
                  <TouchableOpacity
                    style={[styles.numKey, numpadTarget === 'chapter' && styles.numTargetActive]}
                    onPress={() => switchTarget('chapter')}
                  >
                    <Text style={[styles.numTargetText, numpadTarget === 'chapter' && styles.numTargetTextActive]}>
                      {selectedBook?.chapter_count ?? 0}장
                    </Text>
                  </TouchableOpacity>
                )}
                {ri === 1 && (
                  <TouchableOpacity
                    style={[styles.numKey, numpadTarget === 'verse' && styles.numTargetActive]}
                    onPress={() => selectedChapter ? switchTarget('verse') : undefined}
                    disabled={!selectedChapter}
                  >
                    <Text style={[
                      styles.numTargetText,
                      numpadTarget === 'verse' && styles.numTargetTextActive,
                      !selectedChapter && { color: colors.textTertiary },
                    ]}>
                      {verseCount > 0 ? `${verseCount}절` : '절'}
                    </Text>
                  </TouchableOpacity>
                )}
                {ri === 2 && (
                  <TouchableOpacity style={styles.numKey} onPress={() => handleNumpad('back')}>
                    <Ionicons name="backspace-outline" size={22} color={colors.textPrimary} />
                  </TouchableOpacity>
                )}
                {ri === 3 && (
                  <TouchableOpacity
                    style={styles.numKey}
                    onPress={() => handleNumpad('go')}
                    disabled={!numpadValid}
                  >
                    <Ionicons
                      name="arrow-forward-circle"
                      size={28}
                      color={numpadValid ? colors.accent : colors.textTertiary}
                    />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const NUMPAD_HEIGHT = 220;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerTitle: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.textPrimary },

  // 컬럼
  columns: { flex: 1, flexDirection: 'row' },
  colDivider: { width: 1, backgroundColor: colors.divider },

  // 책 컬럼
  bookCol: { flex: 5, paddingLeft: 16 },
  catLabel: {
    fontFamily: fonts.sansSemiBold, fontSize: 10, color: colors.textSecondary,
    letterSpacing: 0.5, marginTop: 16, marginBottom: 6, paddingLeft: 4,
  },
  bookRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, paddingHorizontal: 4, gap: 8,
  },
  bookRowActive: { backgroundColor: colors.accentLight, borderRadius: 8, marginRight: 8 },
  bookAbbr: { fontFamily: fonts.sansSemiBold, fontSize: 11, color: colors.textSecondary, width: 20, textAlign: 'center' },
  bookAbbrActive: { color: colors.accent },
  bookName: { fontFamily: fonts.sansRegular, fontSize: 14, color: colors.textPrimary },
  bookNameActive: { fontFamily: fonts.sansSemiBold, color: colors.accent },

  // 장/절 공용 셀
  chapterCol: { flex: 2, paddingTop: 8 },
  verseCol: { flex: 2, paddingTop: 8 },
  cellRow: { paddingVertical: 11, paddingHorizontal: 12 },
  cellRowSelected: { backgroundColor: colors.accent, marginHorizontal: 6, borderRadius: 8 },
  cellRowHighlight: { backgroundColor: colors.accentLight, marginHorizontal: 6, borderRadius: 8 },
  cellText: { fontFamily: fonts.sansRegular, fontSize: 14, color: colors.textPrimary, textAlign: 'center' },
  cellTextSelected: { color: '#FFFFFF', fontFamily: fonts.sansSemiBold },
  cellTextHighlight: { color: colors.accent, fontFamily: fonts.sansSemiBold },

  versePlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
  versePlaceholderText: { fontFamily: fonts.sansRegular, fontSize: 12, color: colors.textTertiary, textAlign: 'center', lineHeight: 20 },

  // 하단
  bottom: { borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surface },
  refBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 8 },
  refText: { fontFamily: fonts.sansRegular, fontSize: 15, color: colors.textPrimary },
  refBold: { fontFamily: fonts.sansSemiBold, fontSize: 17, color: colors.accent },
  refClear: { padding: 2 },

  // 넘패드
  numpad: { paddingBottom: 8, paddingHorizontal: 20 },
  numRow: { flexDirection: 'row', justifyContent: 'center' },
  numKey: { flex: 1, height: NUMPAD_HEIGHT / 4, alignItems: 'center', justifyContent: 'center' },
  numKeyText: { fontFamily: fonts.sansRegular, fontSize: 22, color: colors.textPrimary },
  numTargetActive: { backgroundColor: colors.accentLight, borderRadius: 8, marginHorizontal: 4 },
  numTargetText: { fontFamily: fonts.sansRegular, fontSize: 13, color: colors.textSecondary },
  numTargetTextActive: { color: colors.accent, fontFamily: fonts.sansSemiBold },
});
