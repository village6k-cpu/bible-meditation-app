import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';
import { TypePicker } from '../src/components/TypePicker';
import { Underline } from '../src/components/Underline';
import { VideoPlayer } from '../src/components/VideoPlayer';
import { S } from '../src/core/strings.ko';
import { addDays, formatDayShortKo, todayKey } from '../src/core/dates';
import { parseVideoLink } from '../src/core/links';
import { REGISTRY, specOf } from '../src/core/registry';
import { parseTagInput } from '../src/core/tags';
import {
  EntryInput,
  EntryType,
  MEAL_SLOTS,
  MEAL_SLOT_LABELS,
  MealSlot,
  Source,
} from '../src/core/types';
import { createEntry, getEntry, recentTitles, tagsOf, updateEntry } from '../src/db/entryRepo';
import {
  createSource,
  deleteSource,
  findSource,
  findSourceByUrl,
  getSource,
  recentSources,
  renameSource,
  touchSource,
} from '../src/db/sourceRepo';
import { cacheRemoteImage, imageAbs, persistImage } from '../src/export/files';
import { LinkMeta, domainOf, previewLink, resolveLink } from '../src/export/linkMeta';
import { useTheme } from '../src/theme/ThemeProvider';
import { radius, space, type } from '../src/theme/tokens';

const MINUTE_CHIPS = [10, 20, 30, 45, 60];

function isEntryType(v: string | undefined): v is EntryType {
  return !!v && v in REGISTRY;
}

// 태그 입력은 '#독서 #신앙'이고 출처의 기본값은 '독서 신앙'이라, 정규화해서 견준다
function sameTags(a: string, b: string): boolean {
  const x = parseTagInput(a);
  const y = parseTagInput(b);
  return x.length === y.length && x.every((t, i) => t === y[i]);
}

export default function ComposeScreen() {
  const { palette } = useTheme();
  const db = useSQLiteContext();
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string; id?: string }>();
  const editingId = params.id ?? null;

  const [entryType, setEntryType] = useState<EntryType | null>(null);
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

  // 접힌 보조 항목 — 펼칠 때만 커서를 옮긴다 (편집으로 열릴 때는 조용히)
  const [showTags, setShowTags] = useState(false);
  const [tagsAutoFocus, setTagsAutoFocus] = useState(false);
  const [showMemo, setShowMemo] = useState(false);
  const [memoAutoFocus, setMemoAutoFocus] = useState(false);
  const [showDate, setShowDate] = useState(false);

  // 출처 — 책·영상은 한 번만 등록, 밑줄은 연속으로
  const [sources, setSources] = useState<Source[]>([]);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [newSource, setNewSource] = useState(false);
  const [sourceUrl, setSourceUrl] = useState(''); // 새 영상 출처의 링크
  const [editingSource, setEditingSource] = useState<Source | null>(null); // 이름 고치는 중인 출처
  const [legacy, setLegacy] = useState(false); // 출처 없이 남긴 옛 기록을 고치는 중
  const [count, setCount] = useState(0); // 이번 시트에서 이어 그은 밑줄 수
  const [flash, setFlash] = useState(false);

  // 링크가 먼저인 유형(영상) — 붙여넣는 순간 썸네일이 뜨고, 제목·채널은 링크에서 온다
  const [linkMeta, setLinkMeta] = useState<LinkMeta | null>(null);
  const [resolving, setResolving] = useState(false);
  const [clipHint, setClipHint] = useState(false); // 클립보드에 링크가 있다
  const [showTitleFields, setShowTitleFields] = useState(false); // 제목·채널을 손으로 적는 중
  const [knownHint, setKnownHint] = useState(false); // 붙여넣은 링크가 이미 담아둔 영상
  const autoTitle = useRef(false); // 제목이 링크에서 채워졌다(사용자가 고치지 않았다)
  const autoCreator = useRef(false);
  const resolveSeq = useRef(0);

  const quoteRef = useRef<TextInput>(null);
  const bodyRef = useRef<TextInput>(null);
  const linkRef = useRef<TextInput>(null);
  const pickSeq = useRef(0);
  const navigation = useNavigation();

  const spec = entryType ? specOf(entryType) : null;
  const sourced = !!spec?.sourced;
  const linkFirst = !!spec?.linkFirst;
  const selectedSource =
    !newSource && sourceId ? (sources.find((s) => s.id === sourceId) ?? null) : null;
  const selectedVideo = selectedSource?.url ? parseVideoLink(selectedSource.url) : null;

  // 쓰던 내용이 있는데 시트를 내리면 확인 없이 사라지지 않도록
  const dirtyRef = useRef(false);
  const savedRef = useRef(false);
  dirtyRef.current =
    !saved &&
    (quote.trim().length > 0 ||
      body.trim().length > 0 ||
      url.trim().length > 0 ||
      (!sourced && (title.trim().length > 0 || subtitle.trim().length > 0)) ||
      (newSource && !editingSource && (title.trim().length > 0 || sourceUrl.trim().length > 0)) ||
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

  // 유형을 고르면: 유형에 딸린 상태는 전부 비우고, 출처 유형은 마지막에 읽던 책이 이미 선택된 채 연다
  const pickType = useCallback(
    async (t: EntryType) => {
      const seq = ++pickSeq.current;
      setEntryType(t);
      setTitle('');
      setSubtitle('');
      setSourceUrl('');
      setTagText('');
      setShowTags(false);
      setShowMemo(false);
      setSources([]);
      setSourceId(null);
      setNewSource(false);
      setEditingSource(null);
      setLegacy(false);
      setLinkMeta(null);
      setShowTitleFields(false);
      setKnownHint(false);
      autoTitle.current = false;
      autoCreator.current = false;
      if (!REGISTRY[t].sourced) return;
      // 링크가 먼저인 유형은 링크 칸이 열린 채 시작한다 — 최근 영상은 칩으로만
      if (REGISTRY[t].linkFirst) {
        setNewSource(true);
        void checkClipboard();
      }
      const rs = await recentSources(db, t as Source['kind']);
      if (seq !== pickSeq.current) return; // 그새 다른 유형으로 옮겨 갔다
      setSources(rs);
      if (REGISTRY[t].linkFirst) return;
      if (rs.length > 0) {
        setSourceId(rs[0].id);
        setTagText(rs[0].last_tags);
      } else {
        setNewSource(true);
      }
    },
    [db]
  );

  // 클립보드에 링크가 있으면 붙여넣기 칩을 보여준다 — 읽지는 않는다(iOS는 읽는 순간 알림이 뜬다)
  async function checkClipboard() {
    try {
      const has =
        Platform.OS === 'ios' ? await Clipboard.hasUrlAsync() : await Clipboard.hasStringAsync();
      setClipHint(!!has);
    } catch {
      setClipHint(false);
    }
  }

  async function pasteFromClipboard() {
    try {
      const text = await Clipboard.getStringAsync();
      const found = previewLink(text);
      if (!found) {
        setClipHint(false);
        Alert.alert(S.compose_clipboard_empty);
        return;
      }
      setSourceUrl(found.url);
    } catch {
      Alert.alert(S.compose_clipboard_empty);
    }
  }

  useEffect(() => {
    if (!editingId && isEntryType(params.type)) pickType(params.type);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!editingId) return;
    let cancelled = false;
    getEntry(db, editingId).then(async (e) => {
      if (!e || cancelled) return;
      setEntryType(e.type);
      setDay(e.day);
      setTitle(e.title ?? '');
      setSubtitle(e.subtitle ?? '');
      setQuote(e.quote ?? '');
      setBody(e.body ?? '');
      setShowMemo(!!e.body);
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
      setShowTags(existing.length > 0);
      if (REGISTRY[e.type].sourced) {
        const kind = e.type as Source['kind'];
        const rs = await recentSources(db, kind);
        let own = e.source_id ? await getSource(db, e.source_id) : null;
        // 출처 없이 남긴 옛 기록 — 같은 제목의 출처가 있으면 그것을 고른다
        if (!own && e.title) own = await findSource(db, kind, e.title);
        if (cancelled) return;
        const ownSrc = own;
        setSources(ownSrc && !rs.some((s) => s.id === ownSrc.id) ? [ownSrc, ...rs] : rs);
        if (ownSrc) {
          setSourceId(ownSrc.id);
          setNewSource(false);
        } else {
          // 제목·저자를 새 출처 폼에 채워 두되, 제목 없이도 저장할 수 있게 둔다
          setLegacy(true);
          setNewSource(true);
          setShowTitleFields(true);
          if (REGISTRY[e.type].linkFirst) setSourceUrl(e.url ?? '');
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [db, editingId]);

  useEffect(() => {
    if (entryType === 'workout') {
      recentTitles(db, entryType).then(setSuggestions);
    } else {
      setSuggestions([]);
    }
  }, [db, entryType]);

  // 출처 유형을 새로 열면 커서는 이미 문장 칸에 — 붙여넣고 저장이 전부.
  // 그 사이 사용자가 다른 칸을 눌렀다면 가로채지 않는다.
  useEffect(() => {
    if (!spec || !sourced || editingId || newSource) return;
    const t = setTimeout(() => {
      if (TextInput.State.currentlyFocusedInput()) return;
      (quoteRef.current ?? bodyRef.current)?.focus();
    }, 350);
    return () => clearTimeout(t);
  }, [spec, sourced, editingId, newSource]);

  // 링크를 붙여넣으면: 유튜브는 썸네일이 즉시, 제목·채널은 잠시 뒤 링크에서.
  // 이미 담아둔 영상이면 새로 만들지 않고 그 출처를 고른다.
  useEffect(() => {
    if (!linkFirst || !newSource || editingSource) return;
    const preview = previewLink(sourceUrl);
    if (!preview) {
      setLinkMeta(null);
      setResolving(false);
      return;
    }
    setLinkMeta((prev) => (prev && prev.url === preview.url ? prev : preview));
    const seq = ++resolveSeq.current;
    const ctrl = new AbortController();
    setResolving(true);
    const timer = setTimeout(async () => {
      try {
        const existing = await findSourceByUrl(db, 'video', preview.canonicalUrl);
        if (seq !== resolveSeq.current) return;
        if (existing) {
          selectExistingFromLink(existing, preview);
          return;
        }
        const meta = await resolveLink(preview.url, ctrl.signal);
        if (seq !== resolveSeq.current || !meta) return;
        setLinkMeta(meta);
        if (meta.title) {
          setTitle((prev) => (!prev.trim() || autoTitle.current ? meta.title! : prev));
          autoTitle.current = true;
        } else {
          setShowTitleFields(true); // 링크에서 제목을 못 얻었다 — 손으로
        }
        if (meta.creator) {
          setSubtitle((prev) => (!prev.trim() || autoCreator.current ? meta.creator! : prev));
          autoCreator.current = true;
        }
      } finally {
        if (seq === resolveSeq.current) setResolving(false);
      }
    }, 450);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [sourceUrl, linkFirst, newSource, editingSource, db]);

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
    // 영상은 출처가 링크를 지니므로, 메모마다 링크를 다시 붙이지 않아도 된다
    url: url.trim().length > 0 || !!linkMeta || !!selectedSource?.url,
    minutes: minutes !== null,
  };
  const sourceReady =
    !sourced ||
    legacy ||
    (newSource ? title.trim().length > 0 || (linkFirst && !!linkMeta) : sourceId !== null);
  const canSave =
    spec !== null &&
    sourceReady &&
    (spec.requiresOneOf.some((f) => filled[f]) || (legacy && filled.title));

  // 태그를 손대지 않았으면(비었거나 이전 출처의 기본값 그대로면) 새 출처의 기본 태그로 바꾼다
  function selectSource(s: Source) {
    const prev = sources.find((x) => x.id === sourceId);
    const untouched = !tagText.trim() || (prev !== undefined && sameTags(tagText, prev.last_tags));
    if (editingSource) cancelRename();
    setSourceId(s.id);
    setNewSource(false);
    if (untouched) setTagText(s.last_tags);
  }

  function startNewSource() {
    setEditingSource(null);
    setNewSource(true);
    setTitle('');
    setSubtitle('');
    setSourceUrl('');
    setTagText('');
    setLinkMeta(null);
    setShowTitleFields(false);
    setKnownHint(false);
    autoTitle.current = false;
    autoCreator.current = false;
    if (linkFirst) void checkClipboard();
  }

  // 붙여넣은 링크가 이미 담아둔 영상이면 — 그 출처에 메모를 이어서
  function selectExistingFromLink(existing: Source, meta: LinkMeta) {
    setSources((prev) => (prev.some((s) => s.id === existing.id) ? prev : [existing, ...prev]));
    setSourceId(existing.id);
    setNewSource(false);
    setLinkMeta(null);
    setSourceUrl('');
    setResolving(false);
    setKnownHint(true);
    if (meta.url !== meta.canonicalUrl) setUrl(meta.url); // 시점이 있는 링크는 기록에 남긴다
    setTagText((prev) => (prev.trim() ? prev : existing.last_tags));
    setTimeout(() => bodyRef.current?.focus(), 50);
  }

  // 출처 칩을 길게 누르면 — 잘못 친 제목은 영원하지 않아야 한다
  function sourceActions(s: Source) {
    Alert.alert(s.title, s.creator ?? undefined, [
      { text: S.source_rename, onPress: () => startRename(s) },
      { text: S.source_delete, style: 'destructive', onPress: () => confirmDeleteSource(s) },
      { text: S.detail_cancel, style: 'cancel' },
    ]);
  }

  function startRename(s: Source) {
    setEditingSource(s);
    setNewSource(true);
    setTitle(s.title);
    setSubtitle(s.creator ?? '');
    setSourceUrl(s.url ?? '');
    setLinkMeta(null);
    setShowTitleFields(true);
  }

  function cancelRename() {
    setEditingSource(null);
    setNewSource(false);
    setTitle('');
    setSubtitle('');
    setSourceUrl('');
    setLinkMeta(null);
  }

  async function applyRename(): Promise<Source | null> {
    if (!editingSource) return null;
    const t = title.trim();
    if (!t) return editingSource;
    const creator = subtitle.trim() || null;
    const u = sourceUrl.trim() ? (previewLink(sourceUrl)?.canonicalUrl ?? sourceUrl.trim()) : null;
    await renameSource(db, editingSource.id, t, creator, u);
    const updated: Source = { ...editingSource, title: t, creator, url: u };
    setSources((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setSourceId(updated.id);
    setEditingSource(null);
    setNewSource(false);
    setTitle('');
    setSubtitle('');
    setSourceUrl('');
    return updated;
  }

  function confirmDeleteSource(s: Source) {
    Alert.alert(S.source_delete_title, S.source_delete_body, [
      { text: S.detail_cancel, style: 'cancel' },
      { text: S.detail_delete_confirm, style: 'destructive', onPress: () => void removeSource(s) },
    ]);
  }

  async function removeSource(s: Source) {
    try {
      await deleteSource(db, s.id);
    } catch {
      Alert.alert('지우지 못했어요', '잠시 후 다시 시도해 주세요.');
      return;
    }
    const rest = sources.filter((x) => x.id !== s.id);
    setSources(rest);
    if (editingSource?.id === s.id) cancelRename();
    if (sourceId === s.id) {
      if (rest.length > 0) {
        setSourceId(rest[0].id);
        setTagText(rest[0].last_tags);
      } else {
        setSourceId(null);
        setNewSource(true);
        if (editingId) setLegacy(true);
      }
    }
  }

  function handleSave() {
    if (!spec || !canSave || saving) return;
    // 지금 유형이 저장하지 않는 필드에 쓴 내용이 있으면, 버리기 전에 묻는다
    const dropped: string[] = [];
    if (!sourced && !spec.fields.title && title.trim()) dropped.push('제목');
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

      const tags = parseTagInput(tagText);

      // 출처: 이름을 고치는 중이면 먼저 반영하고, 새로 적었으면 찾거나 만들고, 골랐으면 그것을
      let source: Source | null = null;
      if (sourced) {
        const kind = spec.key as Source['kind'];
        if (editingSource) {
          source = await applyRename();
        } else if (newSource) {
          // 링크가 먼저인 유형은 제목이 없어도 링크에서 온 제목(없으면 도메인)으로 등록한다
          const meta = linkFirst ? linkMeta : null;
          const name = title.trim() || meta?.title || (meta ? domainOf(meta.url) : '');
          if (name) {
            const thumb = meta?.thumbnailUrl ? await cacheRemoteImage(meta.thumbnailUrl) : null;
            const created = await createSource(db, kind, name, subtitle.trim() || meta?.creator || null, {
              url: meta?.canonicalUrl ?? (sourceUrl.trim() || null),
              thumbnail_uri: thumb,
            });
            source = created;
            setSources((prev) =>
              prev.some((s) => s.id === created.id) ? prev : [created, ...prev]
            );
            setSourceId(created.id);
            setNewSource(false);
            setLegacy(false);
          }
        } else if (sourceId) {
          source = sources.find((s) => s.id === sourceId) ?? (await getSource(db, sourceId));
        }
        // 새 밑줄일 때만 맨 앞으로 — 옛 기록을 고쳤다고 읽던 책이 바뀌면 안 된다
        if (source && !editingId) {
          await touchSource(db, source.id, tags);
          const sid = source.id;
          const joined = tags.join(' ');
          const now = Date.now();
          setSources((prev) =>
            prev.map((s) => (s.id === sid ? { ...s, last_tags: joined, last_used_at: now } : s))
          );
        }
      }

      const src = source;
      const input: EntryInput = {
        type: spec.key,
        day,
        source_id: src?.id ?? null,
        title: src ? src.title : spec.fields.title && title.trim() ? title.trim() : null,
        subtitle: src
          ? src.creator
          : spec.fields.subtitle && subtitle.trim()
            ? subtitle.trim()
            : null,
        quote: spec.fields.quote && quote.trim() ? quote.trim() : null,
        body: spec.fields.body && body.trim() ? body.trim() : null,
        url: spec.fields.url
          ? url.trim() || linkMeta?.url || sourceUrl.trim() || src?.url || null
          : null,
        // 영상은 사진 대신 출처의 썸네일을 지닌다 — 카드와 상세에 얼굴이 있도록
        image_uri: spec.fields.image ? storedImage : (src?.thumbnail_uri ?? null),
        page: spec.fields.page && page.trim() ? Number(page) || null : null,
        slot: spec.fields.slot ? slot : null,
        minutes: spec.fields.minutes ? minutes : null,
        practiced: spec.fields.practiced || spec.key === 'workout' ? (practiced ? 1 : 0) : null,
        done: spec.key === 'task' ? (loadedDone ?? 0) : null,
        due_time: spec.fields.dueTime && dueTime.trim() ? dueTime.trim() : null,
        tags,
      };

      if (editingId) {
        await updateEntry(db, editingId, input);
      } else {
        await createEntry(db, input);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // 연속 긋기 — 출처가 있는 새 기록은 시트를 닫지 않고 같은 책에 빈 칸을 다시 연다.
      // 링크가 먼저인 유형은 다음 링크를 받을 준비를 한다 (방금 영상은 칩으로 남는다)
      if (sourced && !editingId) {
        setCount((n) => n + 1);
        setQuote('');
        setBody('');
        setUrl('');
        setPage('');
        setImageUri(null);
        setImageIsNew(false);
        setFlash(true);
        setKnownHint(false);
        if (linkFirst) {
          setNewSource(true);
          setSourceUrl('');
          setLinkMeta(null);
          setTitle('');
          setSubtitle('');
          setShowTitleFields(false);
          autoTitle.current = false;
          autoCreator.current = false;
          void checkClipboard();
          setTimeout(() => linkRef.current?.focus(), 50);
        } else {
          (quoteRef.current ?? bodyRef.current)?.focus();
        }
        return;
      }
      setSaved(true);
    } catch {
      Alert.alert('저장하지 못했어요', '잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(false), 900);
    return () => clearTimeout(t);
  }, [flash]);

  // 저장 인사 화면을 잠깐 보여준 뒤 닫는다 — 제스처로 먼저 닫혔으면 타이머를 거둔다
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => router.back(), 1000);
    return () => clearTimeout(timer);
  }, [saved, router]);

  const photoPreview = imageIsNew ? imageUri : imageAbs(imageUri);
  const today = todayKey();

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

  const headerTitle = spec
    ? `${spec.label}${count > 0 ? ` · ${S.compose_nth(count)}` : ''}`
    : S.compose_title;
  const parsedTags = parseTagInput(tagText);
  const tagPreview =
    parsedTags.length > 0
      ? `#${parsedTags[0]}${parsedTags.length > 1 ? ' 외' : ''}`
      : S.compose_add_tags;
  const memoCollapsed = spec?.key === 'book' && !showMemo;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* 헤더 — 방금 담아둔 인사는 여기서, 입력칸이 밀리지 않게 */}
        <View style={[styles.header, { borderBottomColor: palette.divider }]}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={[type.label, { color: palette.textSecondary }]}>
              {count > 0 ? S.compose_stop : S.compose_close}
            </Text>
          </Pressable>
          <Text style={[type.label, { color: palette.textPrimary }]}>
            {flash ? S.compose_flash : headerTitle}
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
          {!spec ? (
            <TypePicker selected={entryType} onSelect={(t) => void pickType(t)} />
          ) : (
            <>
              {/* 유형 바꾸기 — 첫 밑줄을 긋고 나면 자리는 그대로 두고 사라진다 */}
              {!editingId && (
                <Pressable
                  disabled={count > 0}
                  onPress={() => setEntryType(null)}
                  style={[styles.typeBack, count > 0 && { opacity: 0 }]}
                >
                  <Ionicons name="chevron-back" size={13} color={palette.textTertiary} />
                  <Text style={[type.caption, { color: palette.textTertiary }]}>
                    {S.compose_title}
                  </Text>
                </Pressable>
              )}

              {/* 출처 스트립 — 최근 읽던 책이 맨 앞, 이미 선택됨. 길게 누르면 고치기·지우기 */}
              {sourced && (
                <>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    style={styles.sourceStrip}
                    contentContainerStyle={styles.sourceStripContent}
                  >
                    {sources.map((s) => (
                      <Chip
                        key={s.id}
                        label={s.title}
                        active={!newSource && sourceId === s.id}
                        onPress={() => selectSource(s)}
                        onLongPress={() => sourceActions(s)}
                      />
                    ))}
                    <Chip
                      label={S.compose_new_source(spec.label)}
                      active={newSource && !editingSource}
                      outline
                      onPress={startNewSource}
                    />
                  </ScrollView>
                  {newSource && (
                    <View style={styles.sourceForm}>
                      {/* 링크가 먼저 — 붙여넣는 순간 썸네일이 뜨고, 제목·채널은 알아서 온다 */}
                      {linkFirst && !editingSource && (
                        <>
                          {clipHint && !sourceUrl.trim() && (
                            <View style={styles.chipRow}>
                              <Chip
                                label={S.compose_paste_clipboard}
                                icon="clipboard-outline"
                                outline
                                onPress={() => void pasteFromClipboard()}
                              />
                            </View>
                          )}
                          <Field
                            inputRef={linkRef}
                            value={sourceUrl}
                            onChangeText={setSourceUrl}
                            placeholder={S.compose_link_placeholder}
                            autoCapitalize="none"
                            keyboardType="url"
                            autoFocus={!legacy}
                            color={palette.secondary}
                          />
                          {linkMeta && (
                            <View style={{ marginBottom: space.m }}>
                              <VideoPlayer
                                thumbnail={linkMeta.thumbnailUrl}
                                embedUrl={linkMeta.video?.embedUrl ?? null}
                                title={
                                  title.trim() ||
                                  linkMeta.title ||
                                  (resolving ? S.compose_link_reading : domainOf(linkMeta.url))
                                }
                                creator={subtitle.trim() || linkMeta.creator}
                                onOpenExternal={() => Linking.openURL(linkMeta.url).catch(() => {})}
                              />
                              {!showTitleFields && (
                                <Pressable
                                  onPress={() => setShowTitleFields(true)}
                                  hitSlop={8}
                                  style={{ marginTop: space.xs }}
                                >
                                  <Text style={[type.caption, { color: palette.textTertiary }]}>
                                    {S.compose_edit_title}
                                  </Text>
                                </Pressable>
                              )}
                            </View>
                          )}
                          {!linkMeta && !showTitleFields && !legacy && (
                            <Pressable
                              onPress={() => setShowTitleFields(true)}
                              hitSlop={8}
                              style={{ marginBottom: space.m }}
                            >
                              <Text style={[type.caption, { color: palette.textTertiary }]}>
                                {S.compose_no_link}
                              </Text>
                            </Pressable>
                          )}
                        </>
                      )}
                      {(!linkFirst || editingSource || showTitleFields) && (
                        <View style={styles.sourceFormRow}>
                          <Field
                            value={title}
                            onChangeText={(t) => {
                              autoTitle.current = false;
                              setTitle(t);
                            }}
                            placeholder={spec.fields.title?.placeholder ?? ''}
                            autoFocus={!legacy && !linkFirst}
                            grow
                          />
                          <Field
                            value={subtitle}
                            onChangeText={(t) => {
                              autoCreator.current = false;
                              setSubtitle(t);
                            }}
                            placeholder={spec.fields.subtitle?.placeholder ?? ''}
                            short
                          />
                        </View>
                      )}
                      {spec.fields.url && (editingSource || !linkFirst) && (
                        <Field
                          value={sourceUrl}
                          onChangeText={setSourceUrl}
                          placeholder="링크"
                          autoCapitalize="none"
                          keyboardType="url"
                          color={palette.secondary}
                        />
                      )}
                      {editingSource && (
                        <View style={styles.renameRow}>
                          <Pressable
                            onPress={() =>
                              void applyRename().catch(() =>
                                Alert.alert('고치지 못했어요', '잠시 후 다시 시도해 주세요.')
                              )
                            }
                            hitSlop={8}
                          >
                            <Text style={[type.label, { color: palette.accent }]}>
                              {S.source_rename_done}
                            </Text>
                          </Pressable>
                          <Pressable onPress={cancelRename} hitSlop={8}>
                            <Text style={[type.label, { color: palette.textSecondary }]}>
                              {S.detail_cancel}
                            </Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  )}
                  {/* 고른 영상 — 얼굴이 있고, 누르면 그 자리에서 재생된다 */}
                  {linkFirst && selectedSource && (selectedSource.thumbnail_uri || selectedVideo) && (
                    <View style={{ marginBottom: space.m }}>
                      <VideoPlayer
                        thumbnail={imageAbs(selectedSource.thumbnail_uri)}
                        embedUrl={selectedVideo?.embedUrl ?? null}
                        onOpenExternal={() =>
                          selectedSource.url && Linking.openURL(selectedSource.url).catch(() => {})
                        }
                      />
                      {knownHint && (
                        <Text style={[type.caption, { color: palette.textTertiary, marginTop: space.xs }]}>
                          {S.compose_link_known}
                        </Text>
                      )}
                    </View>
                  )}
                </>
              )}

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

              {/* 제목·부제 (출처 없는 유형) */}
              {!sourced && spec.fields.title && (
                <>
                  <Field
                    value={title}
                    onChangeText={setTitle}
                    placeholder={spec.fields.title.placeholder}
                  />
                  {suggestions.length > 0 && !title && (
                    <View style={styles.chipRow}>
                      {suggestions.map((s) => (
                        <Chip key={s} label={s} onPress={() => setTitle(s)} />
                      ))}
                    </View>
                  )}
                </>
              )}
              {!sourced && spec.fields.subtitle && (
                <Field
                  value={subtitle}
                  onChangeText={setSubtitle}
                  placeholder={spec.fields.subtitle.placeholder}
                  color={entryType === 'verse' ? palette.secondary : undefined}
                />
              )}

              {/* 인용문 — 세리프, 포커스 시 밑줄. 이 시트의 주인공 */}
              {spec.fields.quote && (
                <QuoteField
                  inputRef={quoteRef}
                  value={quote}
                  onChangeText={setQuote}
                  placeholder={spec.fields.quote.placeholder}
                />
              )}

              {/* 기록마다 다는 링크 — 출처가 링크를 지니고 있으면 묻지 않는다 */}
              {spec.fields.url && !newSource && !selectedSource?.url && (
                <Field
                  value={url}
                  onChangeText={setUrl}
                  placeholder="링크 (선택)"
                  autoCapitalize="none"
                  keyboardType="url"
                  color={palette.secondary}
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

              {/* 본문 — 책에서는 접혀 있고, 영상에서는 메모가 주인공 */}
              {spec.fields.body && !memoCollapsed && (
                <TextInput
                  ref={bodyRef}
                  style={[
                    entryType === 'writing' || entryType === 'verse' ? type.bodySerif : type.label,
                    styles.bodyInput,
                    {
                      color: palette.textPrimary,
                      backgroundColor: palette.surfaceSunken,
                      minHeight: entryType === 'writing' ? 200 : sourced ? 44 : 96,
                    },
                  ]}
                  placeholder={spec.fields.body.placeholder}
                  placeholderTextColor={palette.textTertiary}
                  value={body}
                  onChangeText={setBody}
                  autoFocus={memoAutoFocus}
                  multiline
                />
              )}
              {spec.key === 'video' && sourceReady && !canSave && (
                <Text style={[type.caption, styles.hint, { color: palette.textTertiary }]}>
                  {S.compose_video_hint}
                </Text>
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

              {/* 접힌 보조 항목 — 쪽수 · 메모 · 태그 · 날짜 · 사진 */}
              <View style={styles.chipRow}>
                {spec.fields.page && (
                  <TextInput
                    style={[
                      type.caption,
                      styles.pageInput,
                      { color: palette.textPrimary, backgroundColor: palette.surfaceSunken },
                    ]}
                    placeholder="쪽 (선택)"
                    placeholderTextColor={palette.textTertiary}
                    value={page}
                    onChangeText={setPage}
                    keyboardType="number-pad"
                  />
                )}
                {memoCollapsed && (
                  <Chip
                    label={S.compose_add_memo}
                    outline
                    onPress={() => {
                      setMemoAutoFocus(true);
                      setShowMemo(true);
                    }}
                  />
                )}
                {entryType !== 'task' && !showTags && (
                  <Chip
                    label={tagPreview}
                    outline
                    onPress={() => {
                      setTagsAutoFocus(true);
                      setShowTags(true);
                    }}
                  />
                )}
                {/* 날짜는 한 번 눌러 펼친 뒤에만 옮길 수 있다 — 스쳐 눌러 온종일 어제로 적히지 않도록 */}
                <Chip
                  label={day === today ? '오늘' : formatDayShortKo(day)}
                  active={showDate}
                  outline
                  onPress={() => setShowDate((v) => !v)}
                />
                {showDate && (
                  <>
                    <Chip
                      label="‹"
                      outline
                      accessibilityLabel={S.compose_day_prev}
                      onPress={() => setDay(addDays(day, -1))}
                    />
                    {day < today && (
                      <Chip
                        label="›"
                        outline
                        accessibilityLabel={S.compose_day_next}
                        onPress={() => setDay(addDays(day, 1))}
                      />
                    )}
                  </>
                )}
                {spec.fields.image && !photoPreview && (
                  <>
                    <Chip
                      label=""
                      icon="camera-outline"
                      outline
                      accessibilityLabel={S.compose_photo_camera}
                      onPress={() => pickPhoto(true)}
                    />
                    <Chip
                      label=""
                      icon="images-outline"
                      outline
                      accessibilityLabel={S.compose_photo_album}
                      onPress={() => pickPhoto(false)}
                    />
                  </>
                )}
              </View>
              {entryType !== 'task' && showTags && (
                <Field
                  value={tagText}
                  onChangeText={setTagText}
                  placeholder={S.compose_tags_placeholder}
                  autoCapitalize="none"
                  autoFocus={tagsAutoFocus}
                />
              )}
              {photoPreview ? (
                <View style={{ marginTop: space.m }}>
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
              ) : null}

              {sourced && !editingId && count === 0 && (
                <Text style={[type.caption, styles.hint, { color: palette.textTertiary }]}>
                  {S.compose_continuous_hint(spec.label)}
                </Text>
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
  inputRef,
  value,
  onChangeText,
  placeholder,
  color,
  short,
  grow,
  autoFocus,
  autoCapitalize,
  keyboardType,
}: {
  inputRef?: React.RefObject<TextInput | null>;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  color?: string;
  short?: boolean;
  grow?: boolean;
  autoFocus?: boolean;
  autoCapitalize?: 'none' | 'sentences';
  keyboardType?: 'default' | 'url' | 'number-pad';
}) {
  const { palette } = useTheme();
  return (
    <TextInput
      ref={inputRef}
      style={[
        type.label,
        styles.field,
        {
          color: color ?? palette.textPrimary,
          backgroundColor: palette.surfaceSunken,
          width: short ? 130 : undefined,
          flex: grow ? 1 : undefined,
        },
      ]}
      placeholder={placeholder}
      placeholderTextColor={palette.textTertiary}
      value={value}
      onChangeText={onChangeText}
      autoFocus={autoFocus}
      autoCapitalize={autoCapitalize}
      keyboardType={keyboardType}
    />
  );
}

// 인용문 필드 — 세리프로 입력되고, 포커스하면 아래에 밑줄이 그어진다
function QuoteField({
  inputRef,
  value,
  onChangeText,
  placeholder,
}: {
  inputRef: React.RefObject<TextInput | null>;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
}) {
  const { palette } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.quoteWrap}>
      <TextInput
        ref={inputRef}
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
  active = false,
  onPress,
  onLongPress,
  icon,
  outline,
  accessibilityLabel,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  outline?: boolean;
  accessibilityLabel?: string;
}) {
  const { palette } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (label || undefined)}
      style={({ pressed }) => [
        styles.chip,
        outline
          ? {
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: active ? palette.accent : palette.divider,
              backgroundColor: active ? palette.accentSoft : 'transparent',
            }
          : { backgroundColor: active ? palette.accent : palette.surfaceSunken },
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={14}
          color={active && !outline ? palette.onAccent : palette.textSecondary}
        />
      ) : null}
      {label ? (
        <Text
          style={[
            type.caption,
            {
              color:
                active && !outline
                  ? palette.onAccent
                  : active
                    ? palette.accent
                    : palette.textSecondary,
            },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      ) : null}
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
  sourceStrip: {
    marginHorizontal: -space.gutter,
    marginBottom: space.m,
  },
  sourceStripContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    paddingHorizontal: space.gutter,
  },
  sourceForm: {
    marginBottom: 0,
  },
  sourceFormRow: {
    flexDirection: 'row',
    gap: space.s,
  },
  renameRow: {
    flexDirection: 'row',
    gap: space.xl,
    marginBottom: space.m,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.s,
    marginBottom: space.m,
    paddingHorizontal: 0,
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
  pageInput: {
    width: 84,
    borderRadius: radius.chip,
    paddingHorizontal: space.m,
    paddingVertical: 8,
  },
  quoteWrap: { marginBottom: space.m },
  quoteInput: {
    borderRadius: radius.button,
    paddingHorizontal: space.l,
    paddingVertical: space.m,
    minHeight: 96,
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
  },
  photoRemove: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  hint: {
    marginTop: space.s,
  },
  savedWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xxxl,
    gap: space.s,
  },
});
