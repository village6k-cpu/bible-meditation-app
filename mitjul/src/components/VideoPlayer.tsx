import React, { useCallback, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space, type } from '../theme/tokens';

interface Props {
  thumbnail: string | null; // 로컬 절대 경로 또는 원격 URL
  embedUrl: string | null; // 유튜브·비메오 임베드 — 없으면 누를 때 바깥으로 연다
  title?: string | null;
  creator?: string | null;
  onOpenExternal?: () => void;
}

// 붙여넣은 링크가 그 자리에서 얼굴을 갖고, 누르면 그 자리에서 재생된다.
// 재생 전에는 썸네일 위에 흰 원 하나 — 모노톤의 유일한 버튼.
export function VideoPlayer({ thumbnail, embedUrl, title, creator, onOpenExternal }: Props) {
  const { palette } = useTheme();
  // 재생 상태는 눌렀던 그 주소에 속한다 — 다른 링크·다른 칩으로 바뀌면 포스터로 돌아간다
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const playing = !!embedUrl && playingUrl === embedUrl;
  // 화면을 떠나면(고치기·연관 기록으로) 소리도 멈춘다
  useFocusEffect(useCallback(() => () => setPlayingUrl(null), []));

  const playable = !!embedUrl;
  const src = embedUrl ? withAutoplay(embedUrl) : null;
  const origin = embedUrl ? originOf(embedUrl) : '';

  return (
    <View>
      <View style={[styles.frame, { backgroundColor: '#000000' }]}>
        {playing && src ? (
          <WebView
            style={styles.web}
            source={{ uri: src }}
            javaScriptEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            allowsFullscreenVideo
            scrollEnabled={false}
            // 플레이어 밖으로 나가는 항해(로고·'YouTube에서 보기')는 틀 안이 아니라 바깥 앱으로
            onOpenWindow={(e) => {
              Linking.openURL(e.nativeEvent.targetUrl).catch(() => {});
            }}
            onShouldStartLoadWithRequest={(req) => {
              if (req.isTopFrame === false) return true;
              if (req.url.startsWith(origin) || req.url.startsWith('about:')) return true;
              Linking.openURL(req.url).catch(() => {});
              return false;
            }}
          />
        ) : (
          <Pressable
            onPress={() => (playable ? setPlayingUrl(embedUrl) : onOpenExternal?.())}
            accessibilityRole="button"
            accessibilityLabel={playable ? '재생' : '링크 열기'}
            style={({ pressed }) => [styles.poster, { opacity: pressed ? 0.85 : 1 }]}
          >
            {thumbnail ? (
              <Image source={{ uri: thumbnail }} style={styles.thumb} resizeMode="cover" />
            ) : (
              <View style={[styles.thumb, { backgroundColor: '#1C1C1C' }]} />
            )}
            <View style={styles.playWrap}>
              <View style={styles.playCircle}>
                <Ionicons
                  name={playable ? 'play' : 'open-outline'}
                  size={22}
                  color="#111111"
                  style={playable ? { marginLeft: 3 } : undefined}
                />
              </View>
            </View>
          </Pressable>
        )}
      </View>
      {title || creator ? (
        <View style={styles.caption}>
          {title ? (
            <Text style={[type.label, { color: palette.textPrimary }]} numberOfLines={2}>
              {title}
            </Text>
          ) : null}
          {creator ? (
            <Text style={[type.caption, { color: palette.textSecondary, marginTop: 2 }]} numberOfLines={1}>
              {creator}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// autoplay는 쿼리에, 비메오의 '#t=' 시점은 그 뒤에 그대로
function withAutoplay(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set('autoplay', '1');
    return u.toString();
  } catch {
    return url;
  }
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  web: {
    flex: 1,
    backgroundColor: '#000000',
  },
  poster: {
    flex: 1,
  },
  thumb: {
    ...StyleSheet.absoluteFillObject,
  },
  playWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    // 밝은 썸네일 위에서도 원이 보이도록 얇은 그림자
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  caption: {
    marginTop: space.s,
  },
});
