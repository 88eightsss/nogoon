// ─── Standalone Breathe Screen ───────────────────────────────────────────────
//
// Lets the user access BreathRhythm or GroundingExercise at any time —
// not just during a gate intercept. Accessible from the Home screen.
//
// Flow:
//   Pick phase → choose BreathRhythm or GroundingExercise
//   Playing phase → game runs full-screen
//   Done phase → brief "well done" message → goes back

import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { BreathRhythm }     from '@/components/games/BreathRhythm';
import { GroundingExercise } from '@/components/games/GroundingExercise';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

type Phase = 'pick' | 'breathing' | 'grounding' | 'done';

const OPTIONS = [
  {
    id:      'breathing' as const,
    emoji:   '🫧',
    title:   'Breathing',
    sub:     'Follow the circle · 2 minutes',
    color:   '#4ecdc4',
  },
  {
    id:      'grounding' as const,
    emoji:   '🌿',
    title:   'Grounding',
    sub:     'Type what you notice · anchors you here',
    color:   COLORS.green,
  },
];

export default function BreatheScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [phase, setPhase] = useState<Phase>(
    mode === 'grounding' ? 'grounding' :
    mode === 'breathing' ? 'breathing' :
    'pick'
  );
  const C = COLORS;

  // ── Done ───────────────────────────────────────────────────────────────────
  if (phase === 'done') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
        <View style={styles.doneContainer}>
          <Text style={styles.doneEmoji}>🌿</Text>
          <Text style={[styles.doneTitle, { color: C.textPrimary }]}>That's it.</Text>
          <Text style={[styles.doneSub, { color: C.textSecondary }]}>
            A moment of calm, taken.
          </Text>
          <Pressable
            style={[styles.doneBtn, { borderColor: C.green + '88', backgroundColor: C.green + '18' }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.doneBtnText, { color: C.green }]}>Back to home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Playing ────────────────────────────────────────────────────────────────
  if (phase === 'breathing') {
    return <BreathRhythm onComplete={() => setPhase('done')} />;
  }
  if (phase === 'grounding') {
    return <GroundingExercise onComplete={() => setPhase('done')} />;
  }

  // ── Pick ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
      <View style={styles.container}>

        {/* Back button */}
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Feather name="arrow-left" size={22} color={C.textMuted} />
        </Pressable>

        <Text style={[styles.heading, { color: C.textPrimary }]}>
          Take a moment.
        </Text>
        <Text style={[styles.subheading, { color: C.textSecondary }]}>
          Pick what sounds right.
        </Text>

        <View style={styles.options}>
          {OPTIONS.map((opt) => (
            <Pressable
              key={opt.id}
              style={({ pressed }) => [
                styles.optionCard,
                {
                  backgroundColor: pressed ? C.surfaceHigh : C.surface,
                  borderColor: opt.color + '44',
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setPhase(opt.id);
              }}
            >
              <Text style={styles.optionEmoji}>{opt.emoji}</Text>
              <View style={styles.optionText}>
                <Text style={[styles.optionTitle, { color: C.textPrimary }]}>{opt.title}</Text>
                <Text style={[styles.optionSub, { color: C.textSecondary }]}>{opt.sub}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={opt.color} />
            </Pressable>
          ))}
        </View>

        <Text style={[styles.hint, { color: C.textMuted }]}>
          Urges fade in 90 seconds. You don't have to be in crisis to pause.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  container: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    gap: SPACING.xl,
  },

  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  heading: {
    fontFamily: FONTS.display,
    fontSize: 32,
    letterSpacing: 0.2,
    marginTop: SPACING.md,
  },
  subheading: {
    fontFamily: FONTS.body,
    fontSize: 16,
    marginTop: -SPACING.md,
  },

  options: { gap: SPACING.sm },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
  },
  optionEmoji: { fontSize: 32, width: 40, textAlign: 'center' },
  optionText: { flex: 1, gap: 3 },
  optionTitle: { fontFamily: FONTS.bodyBold, fontSize: 17 },
  optionSub:   { fontFamily: FONTS.body, fontSize: 13, lineHeight: 18 },

  hint: {
    fontFamily: FONTS.body,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: SPACING.lg,
  },

  // Done screen
  doneContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  doneEmoji: { fontSize: 64 },
  doneTitle: {
    fontFamily: FONTS.displayRegular,
    fontSize: 36,
    letterSpacing: 0.3,
  },
  doneSub: {
    fontFamily: FONTS.body,
    fontSize: 16,
  },
  doneBtn: {
    marginTop: SPACING.xl,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
  },
  doneBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    letterSpacing: 0.2,
  },
});
