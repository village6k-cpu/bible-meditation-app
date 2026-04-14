import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, spacing } from '../lib/theme';
import { setUserName } from '../lib/bible-data';
import { useAppStore } from '../lib/store';

export default function OnboardingScreen() {
  const [name, setName] = useState('');
  const router = useRouter();
  const setStoreName = useAppStore((s) => s.setUserName);

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    await setUserName(trimmed);
    setStoreName(trimmed);
    router.replace('/');
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.title}>이름을 알려주세요</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="이름"
          placeholderTextColor={colors.textTertiary}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />
        <TouchableOpacity
          style={[styles.button, !name.trim() && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!name.trim()}
        >
          <Text style={[styles.buttonText, !name.trim() && styles.buttonTextDisabled]}>
            시작하기
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPadding,
  },
  title: {
    fontFamily: fonts.serifLight,
    fontSize: 21,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 40,
  },
  input: {
    fontFamily: fonts.sansRegular,
    fontSize: 18,
    color: colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    paddingVertical: 12,
    textAlign: 'center',
    marginBottom: 40,
  },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: spacing.buttonRadius,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: colors.surface,
  },
  buttonText: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: '#FFFFFF',
  },
  buttonTextDisabled: {
    color: colors.textTertiary,
  },
});
