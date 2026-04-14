import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../lib/theme';
import { useAppStore } from '../lib/store';

export function MiniPlayer() {
  const { isPlaying, currentTrack, togglePlaying } = useAppStore();

  return (
    <View style={[styles.container, isPlaying && styles.containerPlaying]}>
      <TouchableOpacity style={styles.playButton} onPress={togglePlaying}>
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={18}
          color="#FFFFFF"
        />
      </TouchableOpacity>
      <View style={styles.info}>
        <Text style={styles.trackName}>{currentTrack}</Text>
        <Text style={styles.status}>
          {isPlaying ? '재생 중' : '일시정지'}
        </Text>
      </View>
      {isPlaying && (
        <View style={styles.equalizer}>
          {[12, 18, 10, 16].map((h, i) => (
            <View key={i} style={[styles.bar, { height: h }]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: spacing.cardRadius,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.background,
  },
  containerPlaying: {
    backgroundColor: 'rgba(125,139,117,0.05)',
  },
  playButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accentGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  trackName: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
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
    gap: 2,
  },
  bar: {
    width: 3,
    backgroundColor: colors.accentGreen,
    borderRadius: 1.5,
  },
});
