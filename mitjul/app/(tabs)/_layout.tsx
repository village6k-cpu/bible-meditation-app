import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/theme/ThemeProvider';
import { fonts } from '../../src/theme/tokens';
import { S } from '../../src/core/strings.ko';

// 활성 탭은 아이콘 아래 짧은 인주색 획 — 탭바에서도 밑줄을 긋는다.
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
        tabBarLabelStyle: { fontFamily: fonts.sans, fontSize: 10 },
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
            <TabIcon name="today-outline" color={color} focused={focused} accent={palette.accent} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: S.tab_library,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="library-outline" color={color} focused={focused} accent={palette.accent} />
          ),
        }}
      />
      <Tabs.Screen
        name="capture"
        options={{
          title: '',
          tabBarButton: () => (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/compose');
              }}
              style={({ pressed }) => [
                styles.captureButton,
                {
                  backgroundColor: pressed ? palette.accentInk : palette.accent,
                  shadowColor: palette.accentInk,
                },
              ]}
            >
              <Ionicons name="add" size={28} color={palette.surface} />
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
        name="trends"
        options={{
          title: S.tab_trends,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="pulse-outline" color={color} focused={focused} accent={palette.accent} />
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
    width: 12,
    height: 2,
    borderRadius: 1,
  },
  captureButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: -14,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
});
