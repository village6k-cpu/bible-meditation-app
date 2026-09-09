import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/theme/ThemeProvider';
import { fonts } from '../../src/theme/tokens';
import { S } from '../../src/core/strings.ko';

// 활성 탭은 아이콘 아래 짧은 먹색 획. 색이 아니라 획으로 상태를 말한다.
function TabIcon({ name, color, focused, accent }: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  focused: boolean;
  accent: string;
}) {
  return (
    <View style={styles.iconWrap}>
      <Ionicons name={name} size={22} color={color} />
      <View style={[styles.stroke, { backgroundColor: focused ? accent : 'transparent' }]} />
    </View>
  );
}

export default function TabLayout() {
  const { palette } = useTheme();
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.textPrimary,
        tabBarInactiveTintColor: palette.textTertiary,
        tabBarLabelStyle: { fontFamily: fonts.sansMedium, fontSize: 10, letterSpacing: -0.2 },
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: palette.divider,
          elevation: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: S.tab_today,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="download-outline" color={color} focused={focused} accent={palette.accent} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: S.tab_library,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="list-outline" color={color} focused={focused} accent={palette.accent} />
          ),
        }}
      />
      <Tabs.Screen
        name="capture"
        options={{
          title: '',
          tabBarButton: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={S.tab_capture}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/new');
              }}
              style={({ pressed }) => [
                styles.captureButton,
                {
                  backgroundColor: palette.accent,
                  opacity: pressed ? 0.7 : 1,
                  shadowColor: palette.accentInk,
                },
              ]}
            >
              <Ionicons name="add" size={28} color={palette.onAccent} />
            </Pressable>
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
          },
        }}
      />
      <Tabs.Screen
        name="review"
        options={{
          title: S.tab_review,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="albums-outline" color={color} focused={focused} accent={palette.accent} />
          ),
        }}
      />
      <Tabs.Screen
        name="trends"
        options={{
          title: S.tab_trends,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="stats-chart-outline" color={color} focused={focused} accent={palette.accent} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    gap: 3,
  },
  stroke: {
    width: 14,
    height: 2,
  },
  captureButton: {
    width: 46,
    height: 46,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    // 안드로이드는 부모 밖 터치가 잘리므로 탭바 안에 머문다
    marginTop: Platform.OS === 'ios' ? -14 : 0,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
});
