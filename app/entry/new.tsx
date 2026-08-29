import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../../lib/theme';
import { addDays, formatISODateKo, getISODate } from '../../lib/utils';
import {
  EntryType,
  ENTRY_TYPES,
  ENTRY_TYPE_LABELS,
  MediaKind,
  MEDIA_KINDS,
  MEDIA_KIND_LABELS,
  MealSlot,
  MEAL_SLOTS,
  MEAL_SLOT_LABELS,
  defaultMealSlot,
  detectMediaKind,
  isEntryType,
} from '../../lib/journal-utils';
import {
  saveEntry,
  updateEntry,
  getEntry,
  upsertDayLog,
  getAllTags,
  getRecentMediaTitles,
  persistPhoto,
  photoUriToAbsolute,
} from '../../lib/journal-db';

const BODY_PLACEHOLDERS: Record<EntryType, string> = {
  moment: '지금 이 순간을 남겨보세요',
  media: '메모를 남겨보세요',
  writing: '쓰고 싶은 글을 적어보세요',
  meal: '먹은 것, 느낀 것을 남겨보세요',
  workout: '어떤 운동을 했나요?',
};

const MINUTE_CHIPS = [10, 20, 30, 45, 60];

export default function EntryFormScreen() {
  const params = useLocalSearchParams<{ type?: string; date?: string; id?: string }>();
  const router = useRouter();
  const editingId = params.id ? Number(params.id) : null;

  const [type, setType] = useState<EntryType>(isEntryType(params.type) ? params.type : 'moment');
  const [date, setDate] = useState(params.date ?? getISODate());
  const [body, setBody] = useState('');
  const [quote, setQuote] = useState('');
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [mediaKind, setMediaKind] = useState<MediaKind>('book');
  const [mealSlot, setMealSlot] = useState<MealSlot>(defaultMealSlot());
  const [dietKept, setDietKept] = useState<boolean | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoIsNew, setPhotoIsNew] = useState(false);
  const [tagText, setTagText] = useState('');
  const [recentTags, setRecentTags] = useState<string[]>([]);
  const [recentTitles, setRecentTitles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const bodyRef = useRef<TextInput>(null);

  useEffect(() => {
    getAllTags(8).then((tags) => setRecentTags(tags.map((t) => t.tag)));
  }, []);

  useEffect(() => {
    if (type === 'media') {
      getRecentMediaTitles(mediaKind).then(setRecentTitles);
    }
  }, [type, mediaKind]);

  useEffect(() => {
    if (editingId) {
      getEntry(editingId).then((e) => {
        if (!e) return;
        setType(e.type);
        setDate(e.date);
        setBody(e.body ?? '');
        setQuote(e.quote ?? '');
        setTitle(e.title ?? '');
        setLink(e.link ?? '');
        if (e.media_kind) setMediaKind(e.media_kind);
        if (e.meal_slot) setMealSlot(e.meal_slot);
        setMinutes(e.minutes);
        setPhotoUri(e.photo_uri);
        setPhotoIsNew(false);
        setTagText(
          e.tags
            .split(',')
            .filter(Boolean)
            .map((t) => `#${t}`)
            .join(' ')
        );
      });
    } else {
      // Keyboard up on mount — capture must feel instant
      const t = setTimeout(() => bodyRef.current?.focus(), 350);
      return () => clearTimeout(t);
    }
  }, [editingId]);

  function handleLinkChange(text: string) {
    setLink(text);
    const detected = detectMediaKind(text);
    if (detected) setMediaKind(detected);
  }

  async function pickPhoto(fromCamera: boolean) {
    const ImagePicker = require('expo-image-picker');
    if (fromCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return;
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (!result.canceled && result.assets.length > 0) {
      setPhotoUri(result.assets[0].uri);
      setPhotoIsNew(true);
    }
  }

  const canSave =
    body.trim().length > 0 ||
    quote.trim().length > 0 ||
    title.trim().length > 0 ||
    photoUri !== null ||
    (type === 'workout' && minutes !== null);

  async function handleSave() {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      let storedPhoto = photoUri;
      if (photoUri && photoIsNew) {
        storedPhoto = await persistPhoto(photoUri);
      }
      const tags = tagText
        .split(/[\s,]+/)
        .map((t) => t.replace(/^#/, '').trim())
        .filter(Boolean);
      const input = {
        date,
        type,
        media_kind: type === 'media' ? mediaKind : null,
        title: title.trim() || null,
        quote: type === 'media' && quote.trim() ? quote.trim() : null,
        body: body.trim() || null,
        link: type === 'media' && link.trim() ? link.trim() : null,
        photo_uri: storedPhoto,
        minutes: type === 'workout' ? minutes : null,
        meal_slot: type === 'meal' ? mealSlot : null,
        tags,
      };
      if (editingId) {
        await updateEntry(editingId, input);
      } else {
        await saveEntry(input);
      }
      if (type === 'workout') {
        await upsertDayLog(date, { workout_done: 1 });
      }
      if (type === 'meal' && dietKept !== null) {
        await upsertDayLog(date, { diet_kept: dietKept ? 1 : 0 });
      }
      router.back();
    } finally {
      setSaving(false);
    }
  }

  const photoPreview = photoIsNew ? photoUri : photoUriToAbsolute(photoUri);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.headerButton}>닫기</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{editingId ? '기록 수정' : '기록 남기기'}</Text>
          <TouchableOpacity onPress={handleSave} disabled={!canSave || saving}>
            <Text style={[styles.headerButton, (!canSave || saving) && styles.headerButtonDisabled]}>
              저장
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Type chips */}
          <View style={styles.chipRow}>
            {ENTRY_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, type === t && styles.chipActive]}
                onPress={() => setType(t)}
              >
                <Text style={[styles.chipText, type === t && styles.chipTextActive]}>
                  {ENTRY_TYPE_LABELS[t]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Date row */}
          <View style={styles.dateRow}>
            <TouchableOpacity onPress={() => setDate(addDays(date, -1))} hitSlop={10}>
              <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.dateText}>
              {date === getISODate() ? `오늘 · ${formatISODateKo(date)}` : formatISODateKo(date)}
            </Text>
            <TouchableOpacity
              onPress={() => setDate(addDays(date, 1))}
              hitSlop={10}
              disabled={date >= getISODate()}
              style={date >= getISODate() && { opacity: 0.25 }}
            >
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Media fields */}
          {type === 'media' && (
            <>
              <View style={styles.chipRow}>
                {MEDIA_KINDS.map((k) => (
                  <TouchableOpacity
                    key={k}
                    style={[styles.chipSmall, mediaKind === k && styles.chipActive]}
                    onPress={() => setMediaKind(k)}
                  >
                    <Text style={[styles.chipTextSmall, mediaKind === k && styles.chipTextActive]}>
                      {MEDIA_KIND_LABELS[k]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.fieldInput}
                placeholder="제목 (책·영상 이름)"
                placeholderTextColor={colors.textTertiary}
                value={title}
                onChangeText={setTitle}
              />
              {recentTitles.length > 0 && !title && (
                <View style={styles.suggestRow}>
                  {recentTitles.map((t) => (
                    <TouchableOpacity key={t} style={styles.suggestChip} onPress={() => setTitle(t)}>
                      <Text style={styles.suggestText} numberOfLines={1}>
                        {t}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <TextInput
                style={styles.quoteInput}
                placeholder="밑줄 — 기억하고 싶은 구절"
                placeholderTextColor={colors.textTertiary}
                value={quote}
                onChangeText={setQuote}
                multiline
              />
              <TextInput
                style={styles.fieldInput}
                placeholder="링크 (URL)"
                placeholderTextColor={colors.textTertiary}
                value={link}
                onChangeText={handleLinkChange}
                autoCapitalize="none"
                keyboardType="url"
              />
            </>
          )}

          {/* Writing title */}
          {type === 'writing' && (
            <TextInput
              style={styles.fieldInput}
              placeholder="제목 (선택)"
              placeholderTextColor={colors.textTertiary}
              value={title}
              onChangeText={setTitle}
            />
          )}

          {/* Meal fields */}
          {type === 'meal' && (
            <>
              <View style={styles.chipRow}>
                {MEAL_SLOTS.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chipSmall, mealSlot === s && styles.chipActive]}
                    onPress={() => setMealSlot(s)}
                  >
                    <Text style={[styles.chipTextSmall, mealSlot === s && styles.chipTextActive]}>
                      {MEAL_SLOT_LABELS[s]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setDietKept(dietKept === true ? null : true)}
              >
                <Ionicons
                  name={dietKept === true ? 'checkmark-circle' : 'ellipse-outline'}
                  size={20}
                  color={dietKept === true ? colors.accentGreen : colors.textTertiary}
                />
                <Text style={styles.toggleText}>오늘 식단을 지켰어요</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Workout fields */}
          {type === 'workout' && (
            <View style={styles.chipRow}>
              {MINUTE_CHIPS.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.chipSmall, minutes === m && styles.chipActive]}
                  onPress={() => setMinutes(minutes === m ? null : m)}
                >
                  <Text style={[styles.chipTextSmall, minutes === m && styles.chipTextActive]}>
                    {m}분
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Body */}
          <TextInput
            ref={bodyRef}
            style={[styles.bodyInput, type === 'writing' && styles.bodyInputTall]}
            placeholder={BODY_PLACEHOLDERS[type]}
            placeholderTextColor={colors.textTertiary}
            value={body}
            onChangeText={setBody}
            multiline
          />

          {/* Photo */}
          {photoPreview ? (
            <View>
              <Image source={{ uri: photoPreview }} style={styles.photoPreview} />
              <TouchableOpacity
                style={styles.photoRemove}
                onPress={() => {
                  setPhotoUri(null);
                  setPhotoIsNew(false);
                }}
              >
                <Ionicons name="close-circle" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.photoRow}>
              <TouchableOpacity style={styles.photoButton} onPress={() => pickPhoto(true)}>
                <Ionicons name="camera-outline" size={18} color={colors.textSecondary} />
                <Text style={styles.photoButtonText}>카메라</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoButton} onPress={() => pickPhoto(false)}>
                <Ionicons name="images-outline" size={18} color={colors.textSecondary} />
                <Text style={styles.photoButtonText}>앨범</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Tags */}
          <TextInput
            style={styles.fieldInput}
            placeholder="#태그 (띄어쓰기로 구분)"
            placeholderTextColor={colors.textTertiary}
            value={tagText}
            onChangeText={setTagText}
            autoCapitalize="none"
          />
          {recentTags.length > 0 && (
            <View style={styles.suggestRow}>
              {recentTags.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={styles.suggestChip}
                  onPress={() => setTagText((prev) => (prev ? `${prev} #${t}` : `#${t}`))}
                >
                  <Text style={styles.suggestText}>#{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  headerButton: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.accentGreen,
  },
  headerButtonDisabled: {
    color: colors.textTertiary,
  },
  scroll: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 16,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  chipSmall: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  chipActive: {
    backgroundColor: colors.accentGreen,
    borderColor: colors.accentGreen,
  },
  chipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13.5,
    color: colors.textSecondary,
  },
  chipTextSmall: {
    fontFamily: fonts.sansRegular,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginBottom: 14,
  },
  dateText: {
    fontFamily: fonts.sansRegular,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  fieldInput: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  quoteInput: {
    fontFamily: fonts.serifLight,
    fontSize: 15,
    lineHeight: 26,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  bodyInput: {
    fontFamily: fonts.sansRegular,
    fontSize: 15,
    lineHeight: 24,
    color: colors.textPrimary,
    backgroundColor: 'rgba(0,0,0,0.015)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    borderRadius: 12,
    padding: 16,
    minHeight: 110,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  bodyInputTall: {
    minHeight: 220,
    fontFamily: fonts.serifLight,
    lineHeight: 28,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  toggleText: {
    fontFamily: fonts.sansRegular,
    fontSize: 13.5,
    color: colors.textPrimary,
  },
  photoRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  photoButtonText: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 14,
    backgroundColor: colors.surface,
  },
  photoRemove: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  suggestRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  suggestChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: colors.surface,
    maxWidth: 180,
  },
  suggestText: {
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    color: colors.textSecondary,
  },
});
