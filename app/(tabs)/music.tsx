import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../../lib/theme';
import { useAppStore } from '../../lib/store';
import { TRACKS, togglePlayback, nextTrack, prevTrack, formatTime, setupAudio, playTrack } from '../../lib/audio';

function GradientOrb() {
  const pulse = useRef(new Animated.Value(1)).current;
  const isPlaying = useAppStore((s) => s.isPlaying);

  useEffect(() => {
    if (isPlaying) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.08, duration: 3000, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 3000, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulse.stopAnimation();
      Animated.timing(pulse, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
  }, [isPlaying]);

  return (
    <Animated.View style={[styles.orbContainer, { transform: [{ scale: pulse }] }]}>
      <View style={styles.orbOuter}>
        <View style={styles.orbInner} />
      </View>
    </Animated.View>
  );
}

function TrackListItem({ track, index, isActive }: { track: typeof TRACKS[0]; index: number; isActive: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.trackItem, isActive && styles.trackItemActive]}
      onPress={() => playTrack(index)}
      activeOpacity={0.6}
    >
      <View style={styles.trackItemLeft}>
        {isActive ? (
          <Ionicons name="musical-note" size={14} color={colors.accent} />
        ) : (
          <Text style={styles.trackNumber}>{index + 1}</Text>
        )}
        <View style={styles.trackItemInfo}>
          <Text style={[styles.trackItemTitle, isActive && { color: colors.accent }]}>
            {track.title}
          </Text>
          <Text style={styles.trackItemArtist}>{track.artist}</Text>
        </View>
      </View>
      <Text style={styles.trackDuration}>{formatTime(track.duration)}</Text>
    </TouchableOpacity>
  );
}

export default function MusicScreen() {
  const isPlaying = useAppStore((s) => s.isPlaying);
  const currentTrackIndex = useAppStore((s) => s.currentTrackIndex);
  const position = useAppStore((s) => s.playbackPosition);
  const duration = useAppStore((s) => s.playbackDuration);
  const volume = useAppStore((s) => s.volume);
  const showMiniPlayer = useAppStore((s) => s.showMiniPlayer);
  const setShowMiniPlayer = useAppStore((s) => s.setShowMiniPlayer);

  const currentTrack = currentTrackIndex >= 0 ? TRACKS[currentTrackIndex] : TRACKS[0];
  const progress = duration > 0 ? (position / duration) * 100 : 0;

  useEffect(() => {
    setupAudio();
  }, []);

  return (
    <LinearGradient colors={['#F4F3EE', '#EDE8E0']} style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Orb */}
          <GradientOrb />

          {/* Track info */}
          <Text style={styles.trackName}>{currentTrack.title}</Text>
          <Text style={styles.artist}>{currentTrack.artist}</Text>

          {/* Progress */}
          <View style={styles.timeline}>
            <View style={styles.timelineTrack}>
              <View style={[styles.timelineProgress, { width: `${Math.min(progress, 100)}%` }]} />
            </View>
            <View style={styles.timeLabels}>
              <Text style={styles.timeText}>{formatTime(position)}</Text>
              <Text style={styles.timeText}>{formatTime(duration || currentTrack.duration)}</Text>
            </View>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            <TouchableOpacity onPress={prevTrack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="play-skip-back" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.playButton} onPress={togglePlayback} activeOpacity={0.7}>
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={32}
                color={colors.accent}
                style={!isPlaying ? { marginLeft: 3 } : undefined}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={nextTrack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="play-skip-forward" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Volume */}
          <View style={styles.volume}>
            <Ionicons name="volume-low" size={15} color={colors.textTertiary} />
            <View style={styles.volumeTrack}>
              <View style={[styles.volumeProgress, { width: `${volume * 100}%` }]} />
            </View>
            <Ionicons name="volume-high" size={15} color={colors.textTertiary} />
          </View>

          {/* Toggle */}
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>성경 읽으며 듣기</Text>
            <Switch
              value={showMiniPlayer}
              onValueChange={setShowMiniPlayer}
              trackColor={{ false: colors.surfaceDim, true: 'rgba(193,95,60,0.3)' }}
              thumbColor={showMiniPlayer ? colors.accent : '#f4f3f4'}
            />
          </View>

          {/* Track list */}
          <View style={styles.trackListSection}>
            <Text style={styles.trackListTitle}>UP NEXT</Text>
            {TRACKS.map((track, index) => (
              <TrackListItem
                key={track.id}
                track={track}
                index={index}
                isActive={index === currentTrackIndex}
              />
            ))}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  scrollContent: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 24 },

  orbContainer: { marginBottom: 32 },
  orbOuter: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(193,95,60,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(193,95,60,0.12)',
  },

  trackName: {
    fontFamily: fonts.sansMedium,
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  artist: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 28,
  },

  timeline: { width: '100%', marginBottom: 24 },
  timelineTrack: {
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 1.5,
  },
  timelineProgress: {
    height: 3,
    backgroundColor: colors.accent,
    borderRadius: 1.5,
  },
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  timeText: {
    fontFamily: fonts.sansRegular,
    fontSize: 11,
    color: colors.textTertiary,
  },

  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 36,
    marginBottom: 28,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  volume: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 10,
    marginBottom: 24,
  },
  volumeTrack: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 1,
  },
  volumeProgress: {
    height: 2,
    backgroundColor: colors.textTertiary,
    borderRadius: 1,
  },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    marginBottom: 20,
  },
  toggleLabel: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: colors.textPrimary,
  },

  trackListSection: { width: '100%' },
  trackListTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10.5,
    letterSpacing: 10.5 * 0.1,
    color: colors.accent,
    marginBottom: 12,
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  trackItemActive: {
    backgroundColor: colors.accentLight,
    marginHorizontal: -12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderBottomWidth: 0,
  },
  trackItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  trackNumber: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.textTertiary,
    width: 14,
    textAlign: 'center',
  },
  trackItemInfo: { flex: 1 },
  trackItemTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  trackItemArtist: {
    fontFamily: fonts.sansRegular,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  trackDuration: {
    fontFamily: fonts.sansRegular,
    fontSize: 11,
    color: colors.textTertiary,
  },
});
