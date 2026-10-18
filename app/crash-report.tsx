// ─── Last crash report ────────────────────────────────────────────────────────
// If NoGoon ever stops unexpectedly, the app keeps the error on the phone. This screen shows it
// and shares it (Messages, email, anything) so it can be sent over without a computer.
// Nothing leaves the phone unless you tap Share.

import { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Share, NativeModules, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';

const { AppBlocker } = NativeModules;

export default function CrashReportScreen() {
  const { colors, cardStyle } = useTheme();
  const [report, setReport] = useState<string | null>(null);

  const load = useCallback(() => {
    if (Platform.OS !== 'android' || typeof AppBlocker?.getLastCrash !== 'function') { setReport(''); return; }
    AppBlocker.getLastCrash().then((t: string) => setReport(t || '')).catch(() => setReport(''));
  }, []);
  useFocusEffect(load);

  const clear = () => {
    AppBlocker?.clearLastCrash?.().then(() => setReport('')).catch(() => {});
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={[s.title, { color: colors.text }]}>Last crash report</Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView contentContainerStyle={s.content}>
        {report === null ? null : report === '' ? (
          <View style={[s.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
            <Feather name="check-circle" size={26} color={colors.success} />
            <Text style={[s.h, { color: colors.text }]}>No crash recorded</Text>
            <Text style={[s.p, { color: colors.textSecondary }]}>
              If NoGoon stops on you, the error is saved here. Come back and tap Share to send it over.
            </Text>
          </View>
        ) : (
          <>
            <Text style={[s.p, { color: colors.textSecondary }]}>
              This is what NoGoon recorded the last time it stopped. It has no personal data in it, only the error and your phone model.
            </Text>
            <View style={[s.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
              <Text selectable style={[s.mono, { color: colors.text }]}>{report}</Text>
            </View>
            <Pressable
              onPress={() => Share.share({ message: report }).catch(() => {})}
              style={[s.btn, { backgroundColor: colors.accent }]}
              accessibilityRole="button"
            >
              <Feather name="share-2" size={16} color="#fff" />
              <Text style={s.btnText}>Share this report</Text>
            </Pressable>
            <Pressable onPress={clear} style={s.ghost} accessibilityRole="button">
              <Text style={[s.p, { color: colors.textMuted }]}>Clear it</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  title: { fontFamily: FONTS.display, fontSize: 20 },
  content: { padding: SPACING.lg, gap: SPACING.md },
  card: { padding: SPACING.md, gap: 8, alignItems: 'flex-start' },
  h: { fontFamily: FONTS.bodyBold, fontSize: 16 },
  p: { fontFamily: FONTS.body, fontSize: 14, lineHeight: 20 },
  mono: { fontFamily: FONTS.mono, fontSize: 11, lineHeight: 16 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 999 },
  btnText: { fontFamily: FONTS.bodyBold, fontSize: 15, color: '#fff' },
  ghost: { alignItems: 'center', paddingVertical: 8 },
});
