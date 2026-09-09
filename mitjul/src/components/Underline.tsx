import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { underline } from '../theme/tokens';

interface Props {
  width?: number | `${number}%`;
  animated?: boolean; // true면 왼쪽에서 오른쪽으로 240ms에 그어진다
  delay?: number;
  color?: string;
}

// 이 앱의 시그니처 — 만년필로 긋는 밑줄.
export function Underline({ width = 48, animated = true, delay = 0, color }: Props) {
  const { palette } = useTheme();
  const progress = useRef(new Animated.Value(animated ? 0 : 1)).current;

  useEffect(() => {
    if (!animated) return;
    Animated.timing(progress, {
      toValue: 1,
      duration: 240,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [animated, delay, progress]);

  return (
    <View style={[styles.track, { width, marginTop: underline.offset }]}>
      <Animated.View
        style={{
          height: underline.thickness,
          backgroundColor: color ?? palette.accent,
          width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    overflow: 'hidden',
  },
});
