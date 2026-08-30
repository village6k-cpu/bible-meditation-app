import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';
import { TypePicker } from '../src/components/TypePicker';
import { Underline } from '../src/components/Underline';
import { S } from '../src/core/strings.ko';
import { addDays, formatDayKo, todayKey } from '../src/core/dates';
import { REGISTRY, specOf } from '../src/core/registry';
import { parseTagInput } from '../src/core/tags';
import { EntryInput, EntryType, MEAL_SLOTS, MEAL_SLOT_LABELS, MealSlot } from '../src/core/types';
import { createEntry, getEntry, recentTitles, tagsOf, updateEntry } from '../src/db/entryRepo';
import { imageAbs, persistImage } from '../src/export/files';
import { useTheme } from '../src/theme/ThemeProvider';
import { radius, space, type } from '../src/theme/tokens';

const MINUTE_CHIPS = [10, 20, 30, 45, 60];

function isEntryType(v: string | undefined): v is EntryType {
  return !!v && v in REGISTRY;
}

export default function ComposeScreen() {
  const { palette } = useTheme();
  const db = useSQLiteContext();
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string; id?: string }>();
  const editingId = params.id ?? null;

  const [entryType, setEntryType] = useState<EntryType | null>(
    isEntryType(params.type) ? params.type : null
  );
  const [day, setDay] = useState(todayKey());
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [quote, setQuote] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [page, setPage] = useState('');
  const [slot, setSlot] = useState<MealSlot>('breakfast');
  const [minutes, setMinutes] = useState<number | null>(null);
  const [practiced, setPracticed] = useState(true);
  const [dueTime, setDueTime] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageIsNew, setImageIsNew] = useState(false);
  const [tagText, setTagText] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadedDone, setLoadedDone] = useState<number | null>(null);
  const bodyRef = useRef<TextInput>(null);
  const navigation = useNavigation();

  // 쓰던 내용이 있는데 시트를 내리면 확인 없이 사라지지 않도록
  const dirtyRef = useRef(false);
  const savedRef = useRef(false);
  dirtyRef.current =
    !saved &&
    (title.trim().length > 0 ||
      subtitle.trim().length > 0 ||
      quote.trim().length > 0 ||
      body.trim().length > 0 ||
      url.trim().length > 0 ||
      tagText.trim().length > 0 ||
      imageIsNew);
  savedRef.current = saved;

  useEffect(() => {
    const unsubscribe = (navigation as any).addListener('beforeRemove', (e: any) => {
      if (!dirtyRef.current || savedRef.current) return;
      e.preventDefault();
      Alert.alert('쓰던 기록이 있어요', '지금 닫으면 사라져요.', [
        { text: '계속 쓰기', style: 'cancel' },
        {
          text: S.compose_close,
          style: 'destructive',
          onPress: () => (navigation as any).dispatch(e.data.action),
        },
      ]);
    });
    return unsubscribe;
  }, [navigation]);

  // 시간대에 맞는 식사 슬롯 기본값
  useEffect(() => {
    const h = new Date().getHours();
    setSlot(h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 18 ? 'snack' : 'dinner');
  }, []);

  useEffect(() => {
    if (!editingId) return;
    getEntry(db, editingId).then(async (e) => {
      if (!e) return;
      setEntryType(e.type);
      setDay(e.day);
      setTitle(e.title ?? '');
      setSubtitle(e.subtitle ?? '');
      setQuote(e.quote ?? '');
      setBody(e.body ?? '');
      setUrl(e.url ?? '');
      setPage(e.page ? String(e.page) : '');
      if (e.slot) setSlot(e.slot);
      setMinutes(e.minutes);
      setPracticed(e.practiced !== 0);
      setDueTime(e.due_time ?? '');
      setImageUri(e.image_uri);
      setImageIsNew(false);
      setLoadedDone(e.done);
      // 태그도 폼에 되살린다 — 빈 채로 저장하면 기존 태그가 전부 지워지니까
      const existing = (await tagsOf(db, [e.id])).get(e.id) ?? [];
      setTagText(existing.map((t) => `#${t}`).join(' '));
    });
  }, [db, editingId]);

  useEffect(() => {
    if (entryType === 'book' || entryType === 'workout') {
      recentTitles(db, entryType).then(setSuggestions);
    } else {
      setSuggestions([]);
    }
  }, [db, entryType]);

  const spec = entryType ? specOf(entryType) : null;

  async function pickPhoto(fromCamera: boolean) {
    const ImagePicker = require('expo-image-picker');
    if (fromCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('카메라를 열 수 없어요', '설정에서 카메라 접근을 허용해 주세요.', [
          { text: '취소', style: 'cancel' },
          { text: '설정 열기', onPress: () => Linking.openSettings() },
        ]);
        return;
      }
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (!result.canceled && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
      setImageIsNew(true);
    }
  }

  const filled: Record<string, boolean> = {
    title: title.trim().length > 0,
    quote: quote.trim().length > 0,
    body: body.trim().length > 0,
    image_uri: imageUri !== null,
    url: url.trim().length > 0,
    minutes: minutes !== null,
  };
  const canSave = spec !== null && spec.requiresOneOf.some((f) => filled[f]);

  function handleSave() {
    if (!spec || !canSave || saving) return;
    // 지금 유형이 저장하지 않는 필드에 쓴 내용이 있으면, 버리기 전에 묻는다
    const dropped: string[] = [];
    if (!spec.fields.title && title.trim()) dropped.push('제목');
    if (!spec.fields.quote && quote.trim()) dropped.push('밑줄');
    if (!spec.fields.url && url.trim()) dropped.push('링크');
    if (!spec.fields.body && body.trim()) dropped.push('본문');
    if (dropped.length > 0) {
      Alert.alert(S.compose_dropped_warning, `${dropped.join(', ')} 항목이에요. 계속할까요?`, [
        { text: '취소', style: 'cancel' },
        { text: '계속', onPress: () => void doSave() },
      ]);
      return;
    }
    void doSave();
  }

  async function doSave() {
    if (!spec || saving) return;
    setSaving(true);
    try {
      let storedImage = imageUri;
      if (imageUri && imageIsNew) storedImage = await persistImage(imageUri);

      const input: EntryInput = {
        type: spec.key,
        day,
        title: spec.fields.title && title.trim() ? title.trim() : null,
        subtitle: spec.fields.subtitle && subtitle.trim() ? subtitle.trim() : null,
        quote: spec.fields.quote && quote.trim() ? quote.trim() : null,
        body: spec.fields.body && body.trim() ? body.trim() : null,
        url: spec.fields.url && url.trim() ? url.trim() : null,
        image_uri: spec.fields.image ? storedImage : null,
        page: spec.fields.page && page.trim() ? Number(page) || null : null,
        slot: spec.fields.slot ? slot : null,
        minutes: spec.fields.minutes ? minutes : null,
        practiced: spec.fields.practiced || spec.key === 'workout' ? (practiced ? 1 : 0) : null,
        done: spec.key === 'task' ? (loadedDone ?? 0) : null,
        due_time: spec.fields.dueTime && dueTime.trim() ? dueTime.trim() : null,
        tags: parseTagInput(tagText),
      };

      if (editingId) {
        await updateEntry(db, editingId, input);
      } else {
        await createEntry(db, input);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaved(true);
    } catch {
      Alert.alert('저장하지 못했어요', '잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  }

  // 저장 인사 화면을 잠깐 보여준 뒤 닫는다 — 제스처로 먼저 닫혔으면 타이머를 거둔다
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => router.back(), 1000);
    return () => clearTimeout(timer);
  }, [saved, router]);

  const photoPreview = imageIsNew ? imageUri : imageAbs(imageUri);
  const today = todayKey();

  // 저장 직후 — 밑줄이 그어지는 그 순간
  if (saved) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]}>
        <View style={styles.savedWrap}>
          <Text style={[type.quote, { color: palette.textPrimary, textAlign: 'center' }]}>
            {entryType === 'task' ? S.save_task_done : S.save_done}
          </Text>
          <Underline width={72} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* 헤더 */}
        <View style={[styles.header, { borderBottomColor: palette.divider }]}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={[type.label, { color: palette.textSecondary }]}>{S.compose_close}</Text>
          </Pressable>
          <Text style={[type.label, { color: palette.textPrimary }]}>
            {spec ? spec.label : S.compose_title}
          </Text>
          <Pressable onPress={handleSave} disabled={!canSave || saving} hitSlop={8}>
            <Text
              style={[
                type.label,
                { color: canSave && !saving ? palette.accent : palette.textTertiary },
              ]}
            >
              {S.compose_save}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 1단계 — 유형 선택 */}
          {!spec ? (
            <TypePicker selected={entryType} onSelect={setEntryType} />
          ) : (
            <>
              {/* 유형 바꾸기(새 기록일 때만) + 날짜 */}
              {!editingId && (
                <Pressable onPress={() => setEntryType(null)} style={styles.typeBack}>
                  <Ionicons name="chevron-back" size={13} color={palette.textTertiary} />
                  <Text style={[type.caption, { color: palette.textTertiary }]}>
                    {S.compose_title}
                  </Text>
                </Pressable>
              )}
              <View style={styles.dateRow}>
                <Pressable onPress={() => setDay(addDays(day, -1))} hitSlop={10}>
                  <Ionicons name="chevron-back" size={15} color={palette.textSecondary} />
                </Pressable>
                <Text style={[type.caption, { color: palette.textSecondary }]}>
                  {day === today ? `오늘 · ${formatDayKo(day)}` : formatDayKo(day)}
                </Text>
                <Pressable
                  onPress={() => setDay(addDays(day, 1))}
                  hitSlop={10}
                  disabled={day >= today}
                  style={day >= today && { opacity: 0.25 }}
                >
                  <Ionicons name="chevron-forward" size={15} color={palette.textSecondary} />
                </Pressable>
              </View>

              {/* 식사 슬롯 */}
              {spec.fields.slot && (
                <View style={styles.chipRow}>
                  {MEAL_SLOTS.map((s) => (
                    <Chip
                      key={s}
                      label={MEAL_SLOT_LABELS[s]}
                      active={slot === s}
                      onPress={() => setSlot(s)}
                    />
                  ))}
                </View>
              )}

              {/* 제목·부제 */}
              {spec.fields.title && (
                <>
                  <Field
                    value={title}
                    onChangeText={setTitle}
                    placeholder={spec.fields.title.placeholder}
                  />
                  {suggestions.length > 0 && !title && (
                    <View style={styles.chipRow}>
                      {suggestions.map((s) => (
                        <Chip key={s} label={s} active={false} onPress={() => setTitle(s)} />
                      ))}
                    </View>
                  )}
                </>
              )}
              {spec.fields.subtitle && (
                <Field
                  value={subtitle}
                  onChangeText={setSubtitle}
                  placeholder={spec.fields.subtitle.placeholder}
                  color={entryType === 'verse' ? palette.secondary : undefined}
                />
              )}

              {/* URL */}
              {spec.fields.url && (
                <Field
                  value={url}
                  onChangeText={setUrl}
                  placeholder="https://"
                  autoCapitalize="none"
                  keyboardType="url"
                  color={palette.secondary}
                />
              )}

              {/* 인용문 — 세리프, 포커스 시 밑줄 */}
              {spec.fields.quote && (
                <QuoteField
                  value={quote}
                  onChangeText={setQuote}
                  placeholder={spec.fields.quote.placeholder}
                />
              )}

              {/* 쪽수 */}
              {spec.fields.page && (
                <Field
                  value={page}
                  onChangeText={setPage}
                  placeholder="쪽수 (선택)"
                  keyboardType="number-pad"
                  short
                />
              )}

              {/* 운동 분 */}
              {spec.fields.minutes && (
                <View style={styles.chipRow}>
                  {MINUTE_CHIPS.map((m) => (
                    <Chip
                      key={m}
                      label={`${m}${S.compose_minutes_suffix}`}
                      active={minutes === m}
                      onPress={() => setMinutes(minutes === m ? null : m)}
                    />
                  ))}
                </View>
              )}

              {/* 본문 */}
              {spec.fields.body && (
                <TextInput
                  ref={bodyRef}
                  style={[
                    entryType === 'writing' || entryType === 'verse' ? type.bodySerif : type.label,
                    styles.bodyInput,
                    {
                      color: palette.textPrimary,
                      backgroundColor: palette.surfaceSunken,
                      minHeight: entryType === 'writing' ? 200 : 96,
                    },
                  ]}
                  placeholder={spec.fields.body.placeholder}
                  placeholderTextColor={palette.textTertiary}
                  value={body}
                  onChangeText={setBody}
                  multiline
                />
              )}

              {/* 할 일 시간 */}
              {spec.fields.dueTime && (
                <Field
                  value={dueTime}
                  onChangeText={setDueTime}
                  placeholder="시간 (예: 14:00, 선택)"
                  short
                />
              )}

              {/* 실천 토글 */}
              {spec.fields.practiced && (
                <Pressable onPress={() => setPracticed(!practiced)} style={styles.toggleRow}>
                  <Ionicons
                    name={practiced ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={practiced ? palette.accent : palette.textTertiary}
                  />
                  <Text style={[type.label, { color: palette.textPrimary }]}>
                    {spec.fields.practiced.label}
                  </Text>
                </Pressable>
              )}

              {/* 사진 */}
              {spec.fields.image &&
                (photoPreview ? (
                  <View>
                    <Image
                      source={{ uri: photoPreview }}
                      style={[styles.photo, { backgroundColor: palette.surfaceSunken }]}
                    />
                    <Pressable
                      style={styles.photoRemove}
                      onPress={() => {
                        setImageUri(null);
                        setImageIsNew(false);
                      }}
                      hitSlop={8}
                    >
                      <Ionicons name="close-circle" size={22} color={palette.textSecondary} />
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.chipRow}>
                    <Chip
                      label={S.compose_photo_camera}
                      icon="camera-outline"
                      active={false}
                      onPress={() => pickPhoto(true)}
                    />
                    <Chip
                      label={S.compose_photo_album}
                      icon="images-outline"
                      active={false}
                      onPress={() => pickPhoto(false)}
                    />
                  </View>
                ))}

              {/* 태그 */}
              {entryType !== 'task' && (
                <Field
                  value={tagText}
                  onChangeText={setTagText}
                  placeholder={S.compose_tags_placeholder}
                  autoCapitalize="none"
                />
              )}
            </>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  value,
  onChangeText,
  placeholder,
  color,
  short,
  autoCapitalize,
  keyboardType,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  color?: string;
  short?: boolean;
  autoCapitalize?: 'none' | 'sentences';
  keyboardType?: 'default' | 'url' | 'number-pad';
}) {
  const { palette } = useTheme();
  return (
    <TextInput
      style={[
        type.label,
        styles.field,
        {
          color: color ?? palette.textPrimary,
          backgroundColor: palette.surfaceSunken,
          width: short ? 160 : undefined,
        },
      ]}
      placeholder={placeholder}
      placeholderTextColor={palette.textTertiary}
      value={value}
      onChangeText={onChangeText}
      autoCapitalize={autoCapitalize}
      keyboardType={keyboardType}
    />
  );
}

// 인용문 필드 — 세리프로 입력되고, 포커스하면 아래에 인주 밑줄이 그어진다
function QuoteField({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
}) {
  const { palette } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.quoteWrap}>
      <TextInput
        style={[
          type.quote,
          styles.quoteInput,
          { color: palette.textPrimary, backgroundColor: palette.surfaceSunken },
        ]}
        placeholder={placeholder}
        placeholderTextColor={palette.textTertiary}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        multiline
      />
      {focused && <Underline width="100%" />}
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { palette } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? palette.accent : palette.surfaceSunken,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      {icon ? (
        <Ionicons name={icon} size={14} color={active ? palette.surface : palette.textSecondary} />
      ) : null}
      <Text
        style={[type.caption, { color: active ? palette.surface : palette.textSecondary }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.gutter,
    paddingVertical: space.l,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scroll: {
    paddingHorizontal: space.gutter,
    paddingTop: space.l,
  },
  typeBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: space.m,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.l,
    marginBottom: space.l,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.s,
    marginBottom: space.m,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: space.m,
    paddingVertical: 8,
    borderRadius: radius.chip,
    maxWidth: 200,
  },
  field: {
    borderRadius: radius.button,
    paddingHorizontal: space.l,
    paddingVertical: space.m,
    marginBottom: space.m,
  },
  quoteWrap: { marginBottom: space.m },
  quoteInput: {
    borderRadius: radius.button,
    paddingHorizontal: space.l,
    paddingVertical: space.m,
    minHeight: 88,
    textAlignVertical: 'top',
  },
  bodyInput: {
    borderRadius: radius.button,
    paddingHorizontal: space.l,
    paddingVertical: space.m,
    textAlignVertical: 'top',
    marginBottom: space.m,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    marginBottom: space.m,
  },
  photo: {
    width: '100%',
    height: 180,
    borderRadius: radius.card,
    marginBottom: space.m,
  },
  photoRemove: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  savedWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xxxl,
    gap: space.s,
  },
});
