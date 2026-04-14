import { useState, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { colors, fonts, spacing } from '../../lib/theme';
import { useAppStore } from '../../lib/store';
import { getVerses, getSections, getBook, Verse, Section, Book } from '../../lib/bible-data';
import { VerseText } from '../../components/VerseText';
import { VerseBottomSheet } from '../../components/BottomSheet';
import { BookChapterPicker } from '../../components/BookChapterPicker';

export default function BibleScreen() {
  const { currentBookId, currentChapter, setCurrentPosition } = useAppStore();
  const [book, setBook] = useState<Book | null>(null);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [highlightedVerse, setHighlightedVerse] = useState<number | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState<Verse | null>(null);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  async function loadChapter() {
    const [b, v, s] = await Promise.all([
      getBook(currentBookId),
      getVerses(currentBookId, currentChapter),
      getSections(currentBookId, currentChapter),
    ]);
    setBook(b);
    setVerses(v);
    setSections(s);
    setHighlightedVerse(null);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  useFocusEffect(
    useCallback(() => {
      loadChapter();
    }, [currentBookId, currentChapter])
  );

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setShowScrollTop(e.nativeEvent.contentOffset.y > 300);
  }

  function handleLongPress(verse: Verse) {
    setHighlightedVerse(verse.verse);
    setSelectedVerse(verse);
    setShowBottomSheet(true);
  }

  function goToChapter(delta: number) {
    if (!book) return;
    const next = currentChapter + delta;
    if (next >= 1 && next <= book.chapter_count) {
      setCurrentPosition(currentBookId, next);
    }
  }

  function renderVerses() {
    if (sections.length === 0) {
      return verses.map((v) => (
        <VerseText
          key={v.verse}
          verse={v}
          highlighted={highlightedVerse === v.verse}
          onLongPress={handleLongPress}
        />
      ));
    }

    const elements: React.ReactNode[] = [];
    let verseIdx = 0;

    for (const section of sections) {
      if (section.title) {
        elements.push(
          <Text key={`title-${section.start_verse}`} style={styles.sectionTitle}>
            {section.title}
          </Text>
        );
      }

      while (verseIdx < verses.length && verses[verseIdx].verse <= section.end_verse) {
        const v = verses[verseIdx];
        elements.push(
          <VerseText
            key={v.verse}
            verse={v}
            highlighted={highlightedVerse === v.verse}
            onLongPress={handleLongPress}
          />
        );
        verseIdx++;
      }

      elements.push(<View key={`gap-${section.end_verse}`} style={{ height: 32 }} />);
    }

    while (verseIdx < verses.length) {
      const v = verses[verseIdx];
      elements.push(
        <VerseText
          key={v.verse}
          verse={v}
          highlighted={highlightedVerse === v.verse}
          onLongPress={handleLongPress}
        />
      );
      verseIdx++;
    }

    return elements;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setShowPicker(true)} style={styles.headerButton}>
          <Ionicons name="menu-outline" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {book?.name_ko} {currentChapter}장
        </Text>
        <TouchableOpacity style={styles.headerButton}>
          <Ionicons name="settings-outline" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Body */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={100}
      >
        <Text style={styles.chapterNumber}>{currentChapter}</Text>
        {renderVerses()}

        {/* Chapter navigation */}
        <View style={styles.chapterNav}>
          {currentChapter > 1 && (
            <TouchableOpacity onPress={() => goToChapter(-1)} style={styles.chapterNavButton}>
              <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
              <Text style={styles.chapterNavText}>{currentChapter - 1}장</Text>
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }} />
          {book && currentChapter < book.chapter_count && (
            <TouchableOpacity onPress={() => goToChapter(1)} style={styles.chapterNavButton}>
              <Text style={styles.chapterNavText}>{currentChapter + 1}장</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Scroll to top */}
      {showScrollTop && (
        <TouchableOpacity
          style={styles.scrollTopButton}
          onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
        >
          <Ionicons name="chevron-up" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      )}

      <VerseBottomSheet
        visible={showBottomSheet}
        verse={selectedVerse}
        bookName={book?.name_ko ?? ''}
        onClose={() => {
          setShowBottomSheet(false);
          setHighlightedVerse(null);
        }}
      />

      <BookChapterPicker
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={(bookId, chapter) => setCurrentPosition(bookId, chapter)}
      />
    </SafeAreaView>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerButton: {
    padding: 4,
  },
  headerTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 16,
  },
  chapterNumber: {
    fontFamily: fonts.sansRegular,
    fontSize: 64,
    fontWeight: '200',
    color: 'rgba(0,0,0,0.06)',
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 19,
    lineHeight: 19 * 1.5,
    color: colors.textPrimary,
    marginTop: 8,
    marginBottom: 12,
  },
  chapterNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 32,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    marginTop: 24,
  },
  chapterNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chapterNavText: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  scrollTopButton: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(250,250,248,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
