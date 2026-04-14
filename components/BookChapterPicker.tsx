import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, spacing } from '../lib/theme';
import { Book, getAllBooks, getVerseCount } from '../lib/bible-data';

const ROW_HEIGHT = 44;

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
  const [vCount, setVCount] = useState(0);
  const [numTarget, setNumTarget] = useState<'chapter' | 'verse'>('chapter');
  const [numInput, setNumInput] = useState('');
  const chapterRef = useRef<ScrollView>(null);
  const verseRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible) {
      getAllBooks().then((b) => {
        setBooks(b);
        if (!selectedBook && b.length > 0) setSelectedBook(b[0]);
      });
      setSelectedChapter(null);
      setVCount(0);
      setNumInput('');
      setNumTarget('chapter');
    }
  }, [visible]);

  function handleBookSelect(book: Book) {
    setSelectedBook(book);
    setSelectedChapter(null);
    setVCount(0);
    setNumInput('');
    setNumTarget('chapter');
    chapterRef.current?.scrollTo({ y: 0, animated: false });
    verseRef.current?.scrollTo({ y: 0, animated: false });
  }

  async function handleChapterSelect(ch: number) {
    setSelectedChapter(ch);
    setNumInput('');
    setNumTarget('verse');
    if (selectedBook) {
      const count = await getVerseCount(selectedBook.id, ch);
      setVCount(count);
      verseRef.current?.scrollTo({ y: 0, animated: false });
    }
  }

  function handleVerseSelect(verse: number) {
    if (!selectedBook || !selectedChapter) return;
    onSelect(selectedBook.id, selectedChapter, verse);
    onClose();
  }

  function handleNumpad(key: string) {
    if (key === 'back') {
      setNumInput((p) => p.slice(0, -1));
      return;
    }
    if (key === 'go') {
      const num = parseInt(numInput);
      if (numTarget === 'chapter') {
        if (num > 0 && selectedBook && num <= selectedBook.chapter_count) {
          handleChapterSelect(num);
        }
      } else {
        if (num > 0 && num <= vCount) {
          handleVerseSelect(num);
        }
      }
      return;
    }
    const next = numInput + key;
    if (next.length <= 3) setNumInput(next);
  }

  const chapters = selectedBook
    ? Array.from({ length: selectedBook.chapter_count }, (_, i) => i + 1)
    : [];
  const verses = selectedChapter
    ? Array.from({ length: vCount }, (_, i) => i + 1)
    : [];

  const numNum = numInput ? parseInt(numInput) : 0;
  const maxNum = numTarget === 'chapter' ? (selectedBook?.chapter_count ?? 0) : vCount;
  const numValid = numNum > 0 && numNum <= maxNum;

  const grouped = BOOK_CATEGORIES.map((cat) => ({
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

        {/* 3단 컬럼 */}
        <View style={styles.columns}>
          {/* 책 */}
          <ScrollView style={styles.bookCol} showsVerticalScrollIndicator={false}>
            {grouped.map((group) => (
              <View key={group.label}>
                <View style={styles.catRow}>
                  <Text style={styles.catLabel}>{group.label}</Text>
                </View>
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
                      <Text
                        style={[styles.bookName, active && styles.bookNameActive]}
                        numberOfLines={1}
                      >
                        {book.name_ko}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
            <View style={{ height: 60 }} />
          </ScrollView>

          <View style={styles.colDivider} />

          {/* 장 */}
          <ScrollView ref={chapterRef} style={styles.numCol} showsVerticalScrollIndicator={false}>
            {chapters.map((ch) => {
              const isSel = selectedChapter === ch;
              const isNum = numTarget === 'chapter' && numNum === ch;
              return (
                <TouchableOpacity
                  key={ch}
                  style={[styles.numRow, isSel && styles.numRowSelected, isNum && !isSel && styles.numRowHighlight]}
                  onPress={() => handleChapterSelect(ch)}
                >
                  <Text style={[styles.numText, isSel && styles.numTextSelected, isNum && !isSel && styles.numTextHighlight]}>
                    {ch}
                  </Text>
                  <Text style={[styles.numSuffix, isSel && styles.numSuffixSelected, isNum && !isSel && styles.numSuffixHighlight]}>
                    편
                  </Text>
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 60 }} />
          </ScrollView>

          <View style={styles.colDivider} />

          {/* 절 */}
          <ScrollView ref={verseRef} style={styles.numCol} showsVerticalScrollIndicator={false}>
            {selectedChapter ? (
              <>
                {verses.map((v) => {
                  const isNum = numTarget === 'verse' && numNum === v;
                  return (
                    <TouchableOpacity
                      key={v}
                      style={[styles.numRow, isNum && styles.numRowHighlight]}
                      onPress={() => handleVerseSelect(v)}
                    >
                      <Text style={[styles.numText, isNum && styles.numTextHighlight]}>
                        {v}
                      </Text>
                      <Text style={[styles.numSuffix, isNum && styles.numSuffixHighlight]}>
                        절
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                <View style={{ height: 60 }} />
              </>
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderText}>장을 먼저{'\n'}선택</Text>
              </View>
            )}
          </ScrollView>
        </View>

        {/* 하단 */}
        <View style={styles.bottom}>
          <View style={styles.refBar}>
            <Text style={styles.refText}>
              {selectedBook?.name_ko ?? ''}{' '}
              {numTarget === 'chapter' && numInput ? (
                <Text style={styles.refBold}>{numInput}</Text>
              ) : (
                <Text>{selectedChapter ?? '―'}</Text>
              )}
              편
              {selectedChapter != null && numTarget === 'verse' ? (
                <Text> <Text style={styles.refBold}>{numInput || '―'}</Text>절</Text>
              ) : null}
            </Text>
            {numInput ? (
              <TouchableOpacity onPress={() => setNumInput('')} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* 넘패드 */}
          <View style={styles.pad}>
            {[
              ['1', '2', '3'],
              ['4', '5', '6'],
              ['7', '8', '9'],
              [null, '0', null],
            ].map((row, ri) => (
              <View key={ri} style={styles.padRow}>
                {row.map((k, ki) =>
                  k === null ? (
                    <View key={ki} style={styles.padKey} />
                  ) : (
                    <TouchableOpacity key={ki} style={styles.padKey} onPress={() => handleNumpad(k)}>
                      <Text style={styles.padKeyText}>{k}</Text>
                    </TouchableOpacity>
                  )
                )}
                {/* 4번째 열 */}
                {ri === 0 && (
                  <TouchableOpacity
                    style={[styles.padKey, numTarget === 'chapter' && styles.padTargetOn]}
                    onPress={() => { setNumTarget('chapter'); setNumInput(''); }}
                  >
                    <Text style={[styles.padTargetText, numTarget === 'chapter' && styles.padTargetTextOn]}>
                      {selectedBook?.chapter_count ?? 0}편
                    </Text>
                  </TouchableOpacity>
                )}
                {ri === 1 && (
                  <TouchableOpacity
                    style={[styles.padKey, numTarget === 'verse' && styles.padTargetOn]}
                    onPress={() => { if (selectedChapter) { setNumTarget('verse'); setNumInput(''); } }}
                    disabled={!selectedChapter}
                  >
                    <Text style={[
                      styles.padTargetText,
                      numTarget === 'verse' && styles.padTargetTextOn,
                      !selectedChapter && { opacity: 0.3 },
                    ]}>
                      {vCount > 0 ? `${vCount}절` : '절'}
                    </Text>
                  </TouchableOpacity>
                )}
                {ri === 2 && (
                  <TouchableOpacity style={styles.padKey} onPress={() => handleNumpad('back')}>
                    <Ionicons name="backspace-outline" size={22} color={colors.textPrimary} />
                  </TouchableOpacity>
                )}
                {ri === 3 && (
                  <TouchableOpacity style={styles.padKey} onPress={() => handleNumpad('go')} disabled={!numValid}>
                    <Ionicons name="arrow-forward-circle" size={28} color={numValid ? colors.accent : colors.textTertiary} />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  headerTitle: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.textPrimary },

  /* 3단 컬럼 */
  columns: { flex: 1, flexDirection: 'row' },
  colDivider: { width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.12)' },

  /* 책 컬럼 */
  bookCol: { flex: 4.5 },
  catRow: { paddingTop: 14, paddingBottom: 4, paddingHorizontal: 14 },
  catLabel: { fontFamily: fonts.sansSemiBold, fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8 },
  bookRow: {
    flexDirection: 'row', alignItems: 'center',
    height: ROW_HEIGHT, paddingHorizontal: 14, gap: 8,
  },
  bookRowActive: { backgroundColor: colors.accentLight },
  bookAbbr: {
    fontFamily: fonts.sansSemiBold, fontSize: 12, color: colors.textSecondary,
    width: 22, textAlign: 'center',
  },
  bookAbbrActive: { color: colors.accent },
  bookName: { fontFamily: fonts.sansRegular, fontSize: 14, color: colors.textPrimary, flex: 1 },
  bookNameActive: { fontFamily: fonts.sansSemiBold, color: colors.accent },

  /* 장/절 컬럼 */
  numCol: { flex: 2.75 },
  numRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    height: ROW_HEIGHT, paddingRight: 16, gap: 2,
  },
  numRowSelected: { backgroundColor: colors.accent, marginHorizontal: 4, borderRadius: 6 },
  numRowHighlight: { backgroundColor: colors.accentLight, marginHorizontal: 4, borderRadius: 6 },
  numText: { fontFamily: fonts.sansRegular, fontSize: 15, color: colors.textPrimary, minWidth: 28, textAlign: 'right' },
  numTextSelected: { color: '#FFF', fontFamily: fonts.sansSemiBold },
  numTextHighlight: { color: colors.accent, fontFamily: fonts.sansSemiBold },
  numSuffix: { fontFamily: fonts.sansRegular, fontSize: 12, color: colors.textSecondary },
  numSuffixSelected: { color: 'rgba(255,255,255,0.7)' },
  numSuffixHighlight: { color: colors.accent },

  placeholder: { paddingTop: 60, alignItems: 'center' },
  placeholderText: { fontFamily: fonts.sansRegular, fontSize: 12, color: colors.textTertiary, textAlign: 'center', lineHeight: 20 },

  /* 하단 */
  bottom: { borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surface },
  refBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, gap: 6,
  },
  refText: { fontFamily: fonts.sansRegular, fontSize: 15, color: colors.textPrimary },
  refBold: { fontFamily: fonts.sansSemiBold, fontSize: 17, color: colors.accent },

  /* 넘패드 */
  pad: { paddingBottom: 6, paddingHorizontal: 16 },
  padRow: { flexDirection: 'row' },
  padKey: { flex: 1, height: 52, alignItems: 'center', justifyContent: 'center' },
  padKeyText: { fontFamily: fonts.sansRegular, fontSize: 22, color: colors.textPrimary },
  padTargetOn: { backgroundColor: colors.accentLight, borderRadius: 8, marginHorizontal: 2 },
  padTargetText: { fontFamily: fonts.sansRegular, fontSize: 13, color: colors.textSecondary },
  padTargetTextOn: { fontFamily: fonts.sansSemiBold, color: colors.accent },
});
