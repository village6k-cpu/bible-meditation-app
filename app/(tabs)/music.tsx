import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../lib/theme';

export default function MusicScreen() {
  return (
    <LinearGradient colors={['#F5F0E8', '#EDE6DA']} style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Abstract orb */}
        <View style={styles.orbContainer}>
          <View style={styles.orb} />
        </View>

        {/* Track info */}
        <Text style={styles.trackName}>Peaceful Dwelling</Text>
        <Text style={styles.artist}>Ambient Worship</Text>

        {/* Timeline (placeholder) */}
        <View style={styles.timeline}>
          <View style={styles.timelineTrack}>
            <View style={[styles.timelineProgress, { width: '30%' }]} />
          </View>
          <View style={styles.timeLabels}>
            <Text style={styles.timeText}>0:00</Text>
            <Text style={styles.timeText}>15:00</Text>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity>
            <Ionicons name="play-skip-back" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.playButton}>
            <Ionicons name="play" size={32} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity>
            <Ionicons name="play-skip-forward" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Volume (placeholder) */}
        <View style={styles.volume}>
          <Ionicons name="volume-low" size={16} color={colors.textTertiary} />
          <View style={styles.volumeTrack}>
            <View style={[styles.volumeProgress, { width: '60%' }]} />
          </View>
          <Ionicons name="volume-high" size={16} color={colors.textTertiary} />
        </View>

        {/* Coming soon */}
        <Text style={styles.comingSoon}>음악이 곧 추가됩니다</Text>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  orbContainer: { marginBottom: 48 },
  orb: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(125,139,117,0.15)',
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
    marginBottom: 32,
  },
  timeline: { width: '100%', marginBottom: 32 },
  timelineTrack: {
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 1.5,
  },
  timelineProgress: {
    height: 3,
    backgroundColor: colors.textSecondary,
    borderRadius: 1.5,
  },
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
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
    marginBottom: 36,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: colors.textPrimary,
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
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 1,
  },
  volumeProgress: {
    height: 2,
    backgroundColor: colors.textTertiary,
    borderRadius: 1,
  },
  comingSoon: {
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 8,
  },
});
