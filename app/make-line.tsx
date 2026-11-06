// ─── Make: say it in a line ──────────────────────────────────────────────────
// One short prompt, a few lines of text. Saved only to the private gallery.

import { useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';
import { useMakeStore, promptOfTheDay, LINE_PROMPTS } from '@/stores/useMakeStore';

export default function MakeLineScreen() {
  const { colors } = useTheme();
  const prompt = useRef(promptOfTheDay(LINE_PROMPTS)).current;
  const addLine = useMakeStore((s) => s.addLine);
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);
  const ready = text.trim().length >= 3;

  const save = () => {
    if (!ready) return;
    addLine(prompt, text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setSaved(true);
  };

  if (saved) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Feather name="check-circle" size={44} color={colors.success} />
        <Text style={[styles.title, { color: colors.text, textAlign: 'center' }]}>That's yours.</Text>
        <Text style={[styles.sub, { color: colors.textSecondary, textAlign: 'center' }]}>Saved to Things I made. Only you can see it.</Text>
        <Pressable onPress={() => router.replace('/make' as any)} style={[styles.btn, { backgroundColor: colors.accent, alignSelf: 'stretch' }]} accessibilityRole="button">
          <Text style={[styles.btnText, { color: colors.onAccent }]}>See my things</Text>
        </Pressable>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={{ paddingVertical: SPACING.md }} accessibilityRole="button">
          <Text style={[styles.sub, { color: colors.textMuted }]}>Done for now</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1, gap: SPACING.md }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Feather name="arrow-left" size={22} color={colors.textSecondary} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>{prompt}</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>It does not have to be good. It is not shared with anyone.</Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={200}
          textAlignVertical="top"
          placeholder="Start anywhere..."
          placeholderTextColor={colors.textMuted}
          autoFocus
          accessibilityLabel="Your line"
        />
        <Text style={[styles.sub, { color: colors.textMuted, textAlign: 'right' }]}>{text.length} / 200</Text>
        <Pressable onPress={save} disabled={!ready} style={[styles.btn, { backgroundColor: ready ? colors.accent : colors.surface, opacity: ready ? 1 : 0.5 }]} accessibilityRole="button">
          <Text style={[styles.btnText, { color: ready ? colors.background : colors.textMuted }]}>Save it</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, padding: SPACING.lg, gap: SPACING.md },
  title: { fontFamily: FONTS.display, fontSize: 24, lineHeight: 30 },
  sub: { fontFamily: FONTS.body, fontSize: 14, lineHeight: 20 },
  input: { minHeight: 150, borderWidth: 1, borderRadius: 14, padding: SPACING.md, fontFamily: FONTS.body, fontSize: 16, lineHeight: 23 },
  btn: { borderRadius: 999, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: FONTS.bodyBold, fontSize: 16 },
});
