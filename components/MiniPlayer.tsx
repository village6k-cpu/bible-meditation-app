import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../lib/theme';
import { useAppStore } from '../lib/store';
import { TRACKS, togglePlayback } from '../lib/audio';

function EqualizerBar({ delay }: { delay: number }) {
  const height = useRef(new Animated.Value(8)).current;
  const isPlaying = useAppStore((s) => s.isPlaying);

  useEffect(() => {
    if (isPlaying) {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(height, { toValue: 18, duration: 300 + delay, useNativeDriver: false }),
          Animated.timing(height, { toValue: 6, duration: 400 + delay, useNativeDriver: false }),
        ])
      ).start();
    } else {
      height.stopAnimation();
      Animated.timing(height, { toValue: 8, duration: 200, useNativeDriver: false }).start();
    }
  }, [isPlaying]);

  return <Animated.View style={[styles.bar, { height }]} />;
}

export function MiniPlayer() {
  const isPlaying = useAppStore((s) => s.isPlaying);
  const currentTrackIndex = useAppStore((s) => s.currentTrackIndex);
  const showMiniPlayer = useAppStore((s) => s.showMiniPlayer);

  if (!showMiniPlayer) return null;

  const track = currentTrackIndex >= 0 ? TRACKS[currentTrackIndex] : TRACKS[0];

  return (
    <TouchableOpacity
      style={[styles.container, isPlaying && styles.containerPlaying]}
      onPress={togglePlayback}
      activeOpacity={0.7}
    >
      <View style={styles.playButton}>
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={18}
          color="#FFFFFF"
          style={!isPlaying ? { marginLeft: 2 } : undefined}
        />
      </View>
      <View style={styles.info}>
        <Text style={styles.trackName}>{track.title}</Text>
        <Text style={styles.status}>
          {isPlaying ? '재생 중' : '탭하여 재생'}
        </Text>
      </View>
      {isPlaying && (
        <View style={styles.equalizer}>
          {[0, 80, 40, 120, 60].map((delay, i) => (
            <EqualizerBar key={i} delay={delay} />
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: spacing.cardRadius,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    backgroundColor: colors.background,
  },
  containerPlaying: {
    backgroundColor: 'rgba(193,95,60,0.05)',
    borderColor: 'rgba(193,95,60,0.12)',
  },
  playButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  trackName: {
    fontFamily: fonts.sansMedium,
    fontSize: 13.5,
    color: colors.textPrimary,
  },
  status: {
    fontFamily: fonts.sansRegular,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  equalizer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2.5,
    height: 20,
  },
  bar: {
    width: 3,
    backgroundColor: colors.accent,
    borderRadius: 1.5,
  },
});
