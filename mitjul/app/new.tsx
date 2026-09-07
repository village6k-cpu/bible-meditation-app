import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
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
import { S } from '../src/core/strings.ko';
import { todayKey } from '../src/core/dates';
import { Capture, Signal, SignalKind, parseCapture } from '../src/core/parse';
import { REGISTRY, TYPE_ORDER, specOf } from '../src/core/registry';
import { EntryInput, EntryType, Source, SourceKind } from '../src/core/types';
import { createEntry } from '../src/db/entryRepo';
import { createSource, findSourceByUrl, recentSources, touchSource } from '../src/db/sourceRepo';
import { cacheRemoteImage } from '../src/export/files';
import { LinkMeta, fallbackTitle, previewLink, resolveLink } from '../src/export/linkMeta';
import { useTheme } from '../src/theme/ThemeProvider';
import { grid, radius, space, type } from '../src/theme/tokens';

// 한 칸에 적으면 구조가 붙는다.
// 유형을 고르고 칸을 채우는 일은 사용자가 아니라 파서가 한다 — 사람은 틀렸을 때만 손댄다.

export default function NewEntryScreen() {
  const { palette } = useTheme();
  const db = useSQLiteContext();
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ type?: string }>();
  const presetType = params.type && params.type in REGISTRY ? (params.type as EntryType) : null;

  const [text, setText] = useState('');
  const [typeOverride, setTypeOverride] = useState<EntryType | null>(presetType);
  const [dropped, setDropped] = useState<SignalKind[]>([]); // 사용자가 되돌린 신호
  const [showTypes, setShowTypes] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [linkMeta, setLinkMeta] = useState<LinkMeta | null>(null);
  const [resolving, setResolving] = useState(false);
  const [clipHint, setClipHint] = useState(false);
  const [saving, setSaving] = useState(false);
  const [count, setCount] = useState(0);

  const inputRef = useRef<TextInput>(null);
  const resolveSeq = useRef(0);
  const savedRef = useRef(false);

  const parsed = useMemo(() => parseCapture(text), [text]);
  const entryType = typeOverride ?? parsed.type;
  const spec = specOf(entryType);
  const sourceKinds = spec.sourceKinds ?? [];
  const sourced = sourceKinds.length > 0;
  const selectedSource = sourceId ? (sources.find((s) => s.id === sourceId) ?? null) : null;

  // 되돌린 신호는 없는 셈 친다
  const live = useMemo(() => applyDropped(parsed, dropped), [parsed, dropped]);
  const canSave = !saving && (live.rest.length > 0 || !!live.url || !!live.quote);

  // 쓰던 글이 있는데 시트를 내리면 확인 없이 사라지지 않도록
  useEffect(() => {
    const unsub = (navigation as any).addListener('beforeRemove', (e: any) => {
      if (savedRef.current || text.trim().length === 0) return;
      e.preventDefault();
      Alert.alert(S.capture_discard_title, S.capture_discard_body, [
        { text: S.capture_keep_writing, style: 'cancel' },
        {
          text: S.compose_close,
          style: 'destructive',
          onPress: () => (navigation as any).dispatch(e.data.action),
        },
      ]);
    });
    return unsub;
  }, [navigation, text]);

  // 클립보드에 링크가 있으면 한 번의 탭으로 (iOS는 읽지 않고 있는지만 확인한다)
  const checkClipboard = useCallback(async () => {
    try {
      setClipHint(Platform.OS === 'ios' ? await Clipboard.hasUrlAsync() : false);
    } catch {
      setClipHint(false);
    }
  }, []);
  useEffect(() => {
    void checkClipboard();
  }, [checkClipboard]);

  // 출처가 붙는 유형이면 최근 순으로 불러 첫 것을 미리 고른다
  useEffect(() => {
    let alive = true;
    if (!sourced) {
      setSources([]);
      setSourceId(null);
      return;
    }
    recentSources(db, sourceKinds).then((rs) => {
      if (!alive) return;
      setSources(rs);
      setSourceId((prev) => (prev && rs.some((s) => s.id === prev) ? prev : (rs[0]?.id ?? null)));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, sourced, sourceKinds.join(',')]);

  // 링크를 적으면 제목·채널·썸네일을 읽어 온다. 이미 담아둔 링크면 그 출처를 고른다.
  useEffect(() => {
    const preview = live.url ? previewLink(live.url) : null;
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
        const existing = await findSourceByUrl(db, preview.canonicalUrl);
        if (seq !== resolveSeq.current) return;
        if (existing) {
          setSources((prev) => (prev.some((s) => s.id === existing.id) ? prev : [existing, ...prev]));
          setSourceId(existing.id);
          setLinkMeta({ ...preview, title: existing.title, creator: existing.creator });
          return;
        }
        const meta = await resolveLink(preview.url, ctrl.signal);
        if (seq !== resolveSeq.current || !meta) return;
        setLinkMeta(meta);
      } finally {
        if (seq === resolveSeq.current) setResolving(false);
      }
    }, 450);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
      resolveSeq.current += 1;
    };
  }, [live.url, db]);

  async function paste() {
    try {
      const clip = await Clipboard.getStringAsync();
      if (!clip.trim()) return;
      setText((prev) => (prev.trim() ? `${prev.trim()} ${clip.trim()}` : clip.trim()));
      setClipHint(false);
    } catch {
      Alert.alert(S.compose_clipboard_empty);
    }
  }

  function toggleSignal(kind: SignalKind) {
    setDropped((prev) => (prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]));
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      let source: Source | null = selectedSource;

      // 링크는 출처를 스스로 만든다 — 제목·채널·얼굴까지
      if (entryType === 'link' && linkMeta) {
        const kind: SourceKind = linkMeta.video ? 'video' : 'article';
        const name = linkMeta.title || fallbackTitle(linkMeta);
        const thumb = linkMeta.thumbnailUrl ? await cacheRemoteImage(linkMeta.thumbnailUrl) : null;
        source = await createSource(db, kind, name, linkMeta.creator, {
          url: linkMeta.canonicalUrl,
          thumbnail_uri: thumb,
        });
        setSources((prev) => [source as Source, ...prev.filter((s) => s.id !== source!.id)]);
        setSourceId(source.id);
      } else if (!sourced) {
        source = null;
      }

      const tags = live.tags;
      if (source) await touchSource(db, source.id, tags);

      const input: EntryInput = {
        type: entryType,
        day: todayKey(),
        source_id: source?.id ?? null,
        title: source ? source.title : (live.title ?? null),
        subtitle: source ? source.creator : (live.subtitle ?? null),
        quote: spec.fields.quote ? live.quote : null,
        body: live.body ?? (spec.fields.quote ? null : live.rest || null),
        url: spec.fields.url ? (live.url ?? source?.url ?? null) : null,
        image_uri: source?.thumbnail_uri ?? null,
        page: spec.fields.page ? live.page : null,
        slot: spec.fields.slot ? live.slot : null,
        minutes: spec.fields.minutes ? live.minutes : null,
        practiced: entryType === 'meal' || entryType === 'workout' ? 1 : null,
        done: entryType === 'task' ? (live.done ? 1 : 0) : null,
        due_time: spec.fields.dueTime ? live.dueTime : null,
        tags,
      };
      await createEntry(db, input);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // 이어서 적는다 — 시트는 닫지 않고 칸만 비운다
      setCount((n) => n + 1);
      setText('');
      setTypeOverride(presetType);
      setDropped([]);
      setLinkMeta(null);
      void checkClipboard();
      inputRef.current?.focus();
    } catch {
      Alert.alert(S.capture_save_failed);
    } finally {
      setSaving(false);
    }
  }

  function close() {
    savedRef.current = true;
    router.back();
  }

  const signals = live.signals.filter((s) => s.kind !== 'tag' || true);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* 머리 — 왼쪽 나가기, 가운데 이번에 담은 수, 오른쪽 저장 */}
        <View style={[styles.header, { borderBottomColor: palette.divider }]}>
          <Pressable onPress={close} hitSlop={10}>
            <Text style={[type.label, { color: palette.textSecondary }]}>
              {count > 0 ? S.capture_done : S.compose_close}
            </Text>
          </Pressable>
          <Text style={[type.mono, { color: palette.textTertiary }]}>
            {count > 0 ? S.capture_count(count) : S.capture_title}
          </Text>
          <Pressable onPress={save} disabled={!canSave} hitSlop={10}>
            <Text
              style={[type.label, { color: canSave ? palette.accent : palette.textTertiary }]}
            >
              {S.capture_save}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TextInput
            ref={inputRef}
            style={[type.body, styles.input, { color: palette.textPrimary }]}
            placeholder={S.capture_placeholder}
            placeholderTextColor={palette.textTertiary}
            value={text}
            onChangeText={setText}
            autoFocus
            multiline
            textAlignVertical="top"
          />

          {clipHint && text.trim().length === 0 ? (
            <Pressable onPress={paste} style={styles.pasteRow} hitSlop={6}>
              <Ionicons name="clipboard-outline" size={13} color={palette.textSecondary} />
              <Text style={[type.caption, { color: palette.textSecondary }]}>
                {S.compose_paste_clipboard}
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>

        {/* 읽어낸 구조 — 유형 하나와 신호들. 전부 한 번의 탭으로 되돌릴 수 있다 */}
        <View style={[styles.structure, { borderTopColor: palette.divider }]}>
          <View style={styles.chipRow}>
            <Pressable
              onPress={() => setShowTypes((v) => !v)}
              style={[
                styles.typeChip,
                {
                  backgroundColor: live.confident || typeOverride ? palette.accent : 'transparent',
                  borderColor: live.confident || typeOverride ? palette.accent : palette.divider,
                },
              ]}
            >
              <Text
                style={[
                  type.micro,
                  {
                    color:
                      live.confident || typeOverride ? palette.onAccent : palette.textSecondary,
                  },
                ]}
              >
                {spec.label.toUpperCase()}
              </Text>
              <Ionicons
                name="chevron-down"
                size={11}
                color={live.confident || typeOverride ? palette.onAccent : palette.textTertiary}
              />
            </Pressable>

            {signals.map((s) => (
              <SignalChip
                key={`${s.kind}-${s.start}`}
                signal={s}
                off={dropped.includes(s.kind)}
                onPress={() => toggleSignal(s.kind)}
              />
            ))}
            {resolving ? (
              <Text style={[type.mono, { color: palette.textTertiary }]}>
                {S.compose_link_reading}
              </Text>
            ) : null}
          </View>

          {showTypes ? (
            <View style={styles.typeGrid}>
              {TYPE_ORDER.map((t) => {
                const on = t === entryType;
                return (
                  <Pressable
                    key={t}
                    onPress={() => {
                      setTypeOverride(t);
                      setShowTypes(false);
                    }}
                    style={[
                      styles.typeCell,
                      {
                        borderColor: on ? palette.accent : palette.divider,
                        backgroundColor: on ? palette.accent : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={[type.caption, { color: on ? palette.onAccent : palette.textSecondary }]}
                    >
                      {REGISTRY[t].label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* 출처 — 책은 고르고, 링크는 스스로 붙는다 */}
          {sourced ? (
            <>
              <Pressable
                onPress={() => entryType !== 'link' && setShowSources((v) => !v)}
                style={[styles.metaRow, { borderTopColor: palette.divider }]}
              >
                <Text style={[type.micro, { color: palette.textTertiary }]}>
                  {S.capture_source_label}
                </Text>
                <Text
                  style={[type.caption, { color: palette.textPrimary, flex: 1, textAlign: 'right' }]}
                  numberOfLines={1}
                >
                  {entryType === 'link'
                    ? (linkMeta?.title ?? (linkMeta ? fallbackTitle(linkMeta) : S.capture_source_auto))
                    : (selectedSource?.title ?? S.capture_source_none)}
                </Text>
                {entryType !== 'link' ? (
                  <Ionicons name="chevron-down" size={13} color={palette.textTertiary} />
                ) : null}
              </Pressable>

              {showSources && entryType !== 'link' ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.sourceStrip}
                >
                  {sources.map((s) => (
                    <Pressable
                      key={s.id}
                      onPress={() => {
                        setSourceId(s.id);
                        setShowSources(false);
                      }}
                      style={[
                        styles.sourceChip,
                        {
                          borderColor: s.id === sourceId ? palette.accent : palette.divider,
                          backgroundColor: s.id === sourceId ? palette.accent : 'transparent',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          type.caption,
                          { color: s.id === sourceId ? palette.onAccent : palette.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        {s.title}
                      </Text>
                    </Pressable>
                  ))}
                  {sources.length === 0 ? (
                    <Text style={[type.caption, { color: palette.textTertiary }]}>
                      {S.capture_source_empty}
                    </Text>
                  ) : null}
                </ScrollView>
              ) : null}
            </>
          ) : null}

          <Text style={[type.mono, styles.hint, { color: palette.textTertiary }]}>
            {S.capture_hint}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// 되돌린 신호를 지운 결과 — 값은 비우고, 글은 원문에 그대로 남는다
function applyDropped(c: Capture, dropped: SignalKind[]): Capture {
  if (dropped.length === 0) return c;
  const off = (k: SignalKind) => dropped.includes(k);
  const restored = c.signals
    .filter((s) => off(s.kind))
    .map((s) => s.label)
    .join(' ');
  return {
    ...c,
    url: off('url') ? null : c.url,
    page: off('page') ? null : c.page,
    subtitle: off('verse') ? null : c.subtitle,
    tags: off('tag') ? [] : c.tags,
    minutes: off('minutes') ? null : c.minutes,
    slot: off('slot') ? null : c.slot,
    dueTime: off('time') ? null : c.dueTime,
    quote: off('quote') ? null : c.quote,
    body: [c.body, restored].filter(Boolean).join(' ') || null,
    rest: [c.rest, restored].filter(Boolean).join(' '),
  };
}

function SignalChip({
  signal,
  off,
  onPress,
}: {
  signal: Signal;
  off: boolean;
  onPress: () => void;
}) {
  const { palette } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.signalChip,
        {
          borderColor: palette.divider,
          backgroundColor: off ? 'transparent' : palette.surfaceSunken,
          opacity: off ? 0.45 : 1,
        },
      ]}
    >
      <Text
        style={[
          type.mono,
          {
            color: off ? palette.textTertiary : palette.textPrimary,
            textDecorationLine: off ? 'line-through' : 'none',
          },
        ]}
        numberOfLines={1}
      >
        {signal.label}
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
    height: grid.row,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scroll: {
    paddingHorizontal: space.gutter,
    paddingTop: space.l,
    flexGrow: 1,
  },
  input: {
    fontSize: 17,
    lineHeight: 26,
    minHeight: 120,
    padding: 0,
  },
  pasteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: space.l,
  },
  structure: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.m,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.gutter,
    marginBottom: space.m,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.s,
    height: 26,
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
  },
  signalChip: {
    justifyContent: 'center',
    paddingHorizontal: space.s,
    height: 26,
    maxWidth: 190,
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: space.gutter,
    marginBottom: space.m,
  },
  typeCell: {
    paddingHorizontal: space.m,
    height: 30,
    justifyContent: 'center',
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingHorizontal: space.gutter,
    height: grid.row,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sourceStrip: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: space.gutter,
    paddingBottom: space.m,
  },
  sourceChip: {
    justifyContent: 'center',
    paddingHorizontal: space.m,
    height: 30,
    maxWidth: 200,
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
  },
  hint: {
    paddingHorizontal: space.gutter,
    paddingBottom: space.m,
  },
});
