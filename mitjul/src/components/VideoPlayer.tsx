import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
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
  const [playing, setPlaying] = useState(false);

  const playable = !!embedUrl;
  const src = embedUrl ? `${embedUrl}${embedUrl.includes('?') ? '&' : '?'}autoplay=1` : null;

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
          />
        ) : (
          <Pressable
            onPress={() => (playable ? setPlaying(true) : onOpenExternal?.())}
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
  },
  caption: {
    marginTop: space.s,
  },
});
