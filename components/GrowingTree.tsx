import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { colors, fonts } from '../lib/theme';

const LEAF_COLORS = ['#7D8B6A', '#6B7D5A', '#8B9B72', '#9DAE82', '#5C6E4A'];
const GOLDEN_ANGLE = 137.5;

interface Props {
  progress: number; // 0-1
  dayNumber: number;
  totalDays: number;
}

function generateLeaves(progress: number): { cx: number; cy: number; r: number; color: string }[] {
  const count = Math.max(2, Math.round(progress * 30));
  const leaves: { cx: number; cy: number; r: number; color: string }[] = [];

  for (let i = 0; i < count; i++) {
    const angle = (i * GOLDEN_ANGLE * Math.PI) / 180;
    const dist = 12 + (i / count) * 35;
    const cx = 50 + Math.cos(angle) * dist;
    const cy = 40 + Math.sin(angle) * dist * 0.7 - (progress * 15);
    const r = 3 + Math.random() * 3.5;
    const color = LEAF_COLORS[i % LEAF_COLORS.length];
    leaves.push({ cx, cy, r, color });
  }

  return leaves;
}

function generateFruits(progress: number): { cx: number; cy: number }[] {
  if (progress < 0.45) return [];
  const count = progress > 0.7 ? 3 : 2;
  const fruits = [
    { cx: 35, cy: 48 },
    { cx: 68, cy: 38 },
    { cx: 52, cy: 28 },
  ];
  return fruits.slice(0, count);
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function AnimatedLeaf({ cx, cy, r, color, delay }: { cx: number; cy: number; r: number; color: string; delay: number }) {
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(scale, {
      toValue: 1,
      duration: 600,
      delay,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <AnimatedCircle
      cx={cx}
      cy={cy}
      r={r}
      fill={color}
      opacity={0.85}
    />
  );
}

export function GrowingTree({ progress, dayNumber, totalDays }: Props) {
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const leaves = generateLeaves(clampedProgress);
  const fruits = generateFruits(clampedProgress);

  // 줄기 높이
  const trunkHeight = 30 + clampedProgress * 40;

  // 가지
  const hasBranches = clampedProgress >= 0.08;
  const hasExtraBranch = clampedProgress >= 0.25;

  return (
    <View style={styles.container}>
      {/* 나무 SVG */}
      <View style={styles.treeContainer}>
        <Svg width={140} height={148} viewBox="0 0 100 110">
          {/* 줄기 */}
          <Path
            d={`M50,105 Q50,${105 - trunkHeight} 50,${105 - trunkHeight}`}
            stroke="#8B6843"
            strokeWidth={2.5}
            fill="none"
            strokeLinecap="round"
          />

          {/* 가지 */}
          {hasBranches && (
            <G>
              <Path
                d={`M50,${105 - trunkHeight * 0.6} Q38,${105 - trunkHeight * 0.7} 32,${105 - trunkHeight * 0.55}`}
                stroke="#8B6843"
                strokeWidth={1.8}
                fill="none"
                strokeLinecap="round"
              />
              <Path
                d={`M50,${105 - trunkHeight * 0.5} Q62,${105 - trunkHeight * 0.6} 70,${105 - trunkHeight * 0.45}`}
                stroke="#8B6843"
                strokeWidth={1.8}
                fill="none"
                strokeLinecap="round"
              />
            </G>
          )}
          {hasExtraBranch && (
            <Path
              d={`M50,${105 - trunkHeight * 0.8} Q36,${105 - trunkHeight * 0.95} 28,${105 - trunkHeight * 0.85}`}
              stroke="#8B6843"
              strokeWidth={1.5}
              fill="none"
              strokeLinecap="round"
            />
          )}

          {/* 잎 */}
          {leaves.map((leaf, i) => (
            <AnimatedLeaf
              key={i}
              cx={leaf.cx}
              cy={leaf.cy}
              r={leaf.r}
              color={leaf.color}
              delay={i * 50}
            />
          ))}

          {/* 열매 */}
          {fruits.map((fruit, i) => (
            <Circle
              key={`fruit-${i}`}
              cx={fruit.cx}
              cy={fruit.cy}
              r={3.5}
              fill={colors.accent}
              opacity={0.9}
            />
          ))}

          {/* 바닥 */}
          <Path
            d="M30,105 Q50,108 70,105"
            stroke="#8B6843"
            strokeWidth={0.8}
            fill="none"
            opacity={0.3}
          />
        </Svg>
      </View>

      {/* 텍스트 */}
      <View style={styles.textContainer}>
        <Text style={styles.percent}>{Math.round(clampedProgress * 100)}</Text>
        <Text style={styles.dayText}>DAY {dayNumber} / {totalDays}</Text>
        <Text style={styles.hint}>매일 한 걸음씩,{'\n'}나무가 자라고 있어요</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 16,
  },
  treeContainer: {
    width: 140,
    height: 148,
  },
  textContainer: {
    flex: 1,
  },
  percent: {
    fontFamily: fonts.sansRegular,
    fontSize: 36,
    fontWeight: '200',
    color: colors.textPrimary,
  },
  dayText: {
    fontFamily: fonts.sansRegular,
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 1,
    marginTop: 4,
  },
  hint: {
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    color: colors.textTertiary,
    lineHeight: 18,
    marginTop: 10,
  },
});
