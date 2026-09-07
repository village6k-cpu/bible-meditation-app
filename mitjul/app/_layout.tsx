import React from 'react';
import { Platform, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import {
  IBMPlexSansKR_400Regular,
  IBMPlexSansKR_500Medium,
  IBMPlexSansKR_600SemiBold,
} from '@expo-google-fonts/ibm-plex-sans-kr';
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
} from '@expo-google-fonts/ibm-plex-mono';
import { migrate } from '../src/db/migrations';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import { S } from '../src/core/strings.ko';

SplashScreen.preventAutoHideAsync();

function Shell() {
  const { palette, isDark } = useTheme();

  React.useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="compose" options={{ presentation: 'modal' }} />
        <Stack.Screen name="entry/[id]" />
        <Stack.Screen name="tag/[name]" />
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexSansKR_400Regular,
    IBMPlexSansKR_500Medium,
    IBMPlexSansKR_600SemiBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });

  // 글자가 곧 구조인 앱 — 폰트 없이 지면을 먼저 보여주지 않는다
  if (!fontsLoaded && !fontError) return null;

  if (Platform.OS === 'web') {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#FFFFFF',
        }}
      >
        <Text style={{ fontSize: 18, color: '#111111' }}>
          {S.appName} — 아직 웹은 준비 중이에요. 아이폰에서 만나요.
        </Text>
      </View>
    );
  }

  return (
    <SQLiteProvider databaseName="mitjul.db" onInit={migrate}>
      <ThemeProvider>
        <Shell />
      </ThemeProvider>
    </SQLiteProvider>
  );
}
