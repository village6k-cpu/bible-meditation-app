import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { initDatabases } from '../lib/db';
import { getUserName } from '../lib/bible-data';
import { useAppStore } from '../lib/store';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'NotoSerifKR-Light': require('../assets/fonts/NotoSerifKR-Light.otf'),
    'NotoSerifKR-SemiBold': require('../assets/fonts/NotoSerifKR-SemiBold.otf'),
    'Pretendard-Regular': require('../assets/fonts/Pretendard-Regular.otf'),
    'Pretendard-Medium': require('../assets/fonts/Pretendard-Medium.otf'),
    'Pretendard-SemiBold': require('../assets/fonts/Pretendard-SemiBold.otf'),
    'Pretendard-Bold': require('../assets/fonts/Pretendard-Bold.otf'),
  });

  const fontsReady = fontsLoaded || !!fontError;

  const setDbReady = useAppStore((s) => s.setDbReady);
  const setUserName = useAppStore((s) => s.setUserName);
  const dbReady = useAppStore((s) => s.dbReady);
  const userName = useAppStore((s) => s.userName);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    async function init() {
      try {
        await initDatabases();
        const name = await getUserName();
        if (name) setUserName(name);
      } catch (e) {
        console.warn('DB init failed (expected on web):', e);
      }
      setDbReady(true);
    }
    init();
  }, []);

  useEffect(() => {
    if (fontsReady && dbReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsReady, dbReady]);

  useEffect(() => {
    if (!dbReady || !fontsReady) return;

    const inOnboarding = segments[0] === 'onboarding';
    if (!userName && !inOnboarding) {
      router.replace('/onboarding');
    } else if (userName && inOnboarding) {
      router.replace('/');
    }
  }, [dbReady, fontsReady, userName, segments]);

  if (!fontsReady || !dbReady) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="note/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="highlights" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}
