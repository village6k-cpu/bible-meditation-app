import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, fonts } from '../lib/theme';

interface Props {
  percent: number; // 0-100
  size?: number;
  strokeWidth?: number;
}

export function CircleProgress({ percent, size = 140, strokeWidth = 4 }: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(percent, 100) / 100);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(0,0,0,0.05)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.accentGreen}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.labelContainer}>
        <Text style={styles.percentText}>{Math.round(percent)}</Text>
        <Text style={styles.subText}>오늘의 읽기</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  labelContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  percentText: {
    fontFamily: fonts.sansRegular,
    fontSize: 32,
    fontWeight: '300',
    color: colors.textPrimary,
  },
  subText: {
    fontFamily: fonts.sansRegular,
    fontSize: 10,
    color: '#AAAAAA',
    marginTop: 2,
  },
});
