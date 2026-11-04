// ─── My plans (if-then) ───────────────────────────────────────────────────────
//
// "When ___, I will ___." Writing the plan ahead of time makes it much easier to follow when the urge
// shows up (implementation intentions). Up to five, in the person's own words, kept on the phone.
// The gate shows one of them. Not medical advice; nothing here is a treatment.

import { useState } from 'react';
import { ScrollView, View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';
import { useRecoveryStore } from '@/stores/useRecoveryStore';

const IDEAS = [
  { when: "I'm in bed and reach for my phone", then: 'put it across the room and read two pages' },
  { when: "I'm bored after dinner", then: 'go for a ten minute walk' },
  { when: "I feel stressed", then: 'open Calm and breathe for one minute' },
];

export default function PlansScreen() {
  const { colors, cardStyle } = useTheme();
  const plans = useRecoveryStore((s) => s.plans);
  const addPlan = useRecoveryStore((s) => s.addPlan);
  const removePlan = useRecoveryStore((s) => s.removePlan);
  const [when, setWhen] = useState('');
  const [then, setThen] = useState('');
  const ready = when.trim().length >= 3 && then.trim().length >= 3 && plans.length < 5;
  const save = () => { if (!ready) return; addPlan(when, then); setWhen(''); setThen(''); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
            <Feather name="arrow-left" size={22} color={colors.textSecondary} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>My plans</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            Decide ahead of time what you will do when it gets hard. A plan made in a calm moment is easier to follow in a weak one.
          </Text>

          {plans.map((p) => (
            <View key={p.id} style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.textMuted }]}>WHEN</Text>
                <Text style={[styles.body, { color: colors.text }]}>{p.when}</Text>
                <Text style={[styles.label, { color: colors.textMuted, marginTop: 6 }]}>I WILL</Text>
                <Text style={[styles.body, { color: colors.text }]}>{p.then}</Text>
              </View>
              <Pressable onPress={() => removePlan(p.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Remove this plan">
                <Feather name="x" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
          ))}

          {plans.length < 5 ? (
            <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder, flexDirection: 'column', alignItems: 'stretch' }]}>
              <Text style={[styles.label, { color: colors.textMuted }]}>WHEN</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                value={when} onChangeText={setWhen} maxLength={80}
                placeholder="I'm in bed and reach for my phone" placeholderTextColor={colors.textMuted}
                accessibilityLabel="When"
              />
              <Text style={[styles.label, { color: colors.textMuted }]}>I WILL</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                value={then} onChangeText={setThen} maxLength={80}
                placeholder="put it across the room and read two pages" placeholderTextColor={colors.textMuted}
                returnKeyType="done" onSubmitEditing={save}
                accessibilityLabel="I will"
              />
              <Pressable
                onPress={save} disabled={!ready}
                style={[styles.btn, { backgroundColor: ready ? colors.accent : colors.surface, borderColor: ready ? colors.accent : colors.border, opacity: ready ? 1 : 0.5 }]}
                accessibilityRole="button"
              >
                <Text style={[styles.btnText, { color: ready ? colors.background : colors.textMuted }]}>Save plan</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={[styles.sub, { color: colors.textMuted }]}>That's five. Remove one to add another.</Text>
          )}

          {plans.length === 0 && (
            <View style={{ gap: SPACING.sm }}>
              <Text style={[styles.label, { color: colors.textMuted }]}>IDEAS TO START FROM</Text>
              {IDEAS.map((i) => (
                <Pressable key={i.when} onPress={() => { setWhen(i.when); setThen(i.then); }} accessibilityRole="button" style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
                  <Text style={[styles.body, { color: colors.textSecondary, flex: 1 }]}>When {i.when}, I will {i.then}.</Text>
                  <Feather name="plus" size={16} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          )}

          <Text style={[styles.note, { color: colors.textMuted }]}>
            NoGoon is a self-help tool, not medical care. If this is hurting your life, talking to a professional can help.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.huge },
  title: { fontFamily: FONTS.display, fontSize: 28 },
  sub: { fontFamily: FONTS.body, fontSize: 14, lineHeight: 20 },
  card: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md },
  label: { fontFamily: FONTS.bodyMedium, fontSize: 11, letterSpacing: 0.8 },
  body: { fontFamily: FONTS.body, fontSize: 15, lineHeight: 21 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontFamily: FONTS.body, fontSize: 14, marginBottom: SPACING.sm },
  btn: { borderWidth: 1, borderRadius: 999, paddingVertical: 12, alignItems: 'center', minHeight: 44 },
  btnText: { fontFamily: FONTS.bodyBold, fontSize: 14 },
  note: { fontFamily: FONTS.body, fontSize: 12, lineHeight: 17, marginTop: SPACING.md },
});
