// ─── Standalone Breathe Screen ───────────────────────────────────────────────
//
// Lets the user access BreathRhythm or GroundingExercise at any time —
// not just during a gate intercept. Accessible from the Home screen.
//
// Flow:
//   Pick phase → "Guide me" (Breathe, then Ground, then the Waiting Room urge timer, about 3 minutes),
//                or choose Breathe, Ground Yourself or Sit with the urge (Waiting Room) on its own
//   Playing phase → game runs full-screen
//   Done phase → brief "well done" message → goes back

import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { BreathRhythm }     from '@/components/games/BreathRhythm';
import { GroundingExercise } from '@/components/games/GroundingExercise';
import { FONTS } from '@/constants/Colors';
import { useThemedColors } from '@/hooks/useThemedColors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { Glyph } from '@/components/ui/Glyph';

type Phase = 'pick' | 'breathing' | 'grounding' | 'done';

const OPTIONS = [
  {
    id:      'breathing' as const,
    emoji:   'droplet',
    title:   'Breathe',
    sub:     'Hold to breathe in, let go to breathe out · 1 minute',
    color:   '#4ecdc4', // teal accent, matches breathing exercise
  },
  {
    id:      'grounding' as const,
    emoji:   'feather',
    title:   'Ground Yourself',
    sub:     'Type what you notice · anchors you here · 2 minutes',
    color:   '#2E7D32', // forest green accent, matches grounding exercise
  },
  {
    id:      'waiting' as const,
    emoji:   'clock',
    title:   'Sit with the urge',
    sub:     'Watch it rise and pass on its own · the Waiting Room',
    color:   '#0277BD',
  },
];

export default function BreatheScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [phase, setPhase] = useState<Phase>(
    mode === 'grounding' ? 'grounding' :
    mode === 'breathing' ? 'breathing' :
    'pick'
  );
  // True while running "Guide me": Breathe, then Ground, then the Waiting Room.
  const [guided, setGuided] = useState(false);
  const C = useThemedColors();
  const insets = useSafeAreaInsets();

  // The exercises are shared with the gate, where there must be no way out, so they have
  // no exit of their own. Opened from the Calm tab you can always leave — previously only
  // the hardware back button worked, which gesture-nav users don't always find.
  const closeButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close"
      onPress={() => router.back()}
      hitSlop={12}
      style={[
        styles.closeBtn,
        { top: insets.top + 8, backgroundColor: C.surfaceHigh, borderColor: C.cardBorder },
      ]}
    >
      <Feather name="x" size={18} color={C.textSecondary} />
    </Pressable>
  );

  // ── Done ───────────────────────────────────────────────────────────────────
  if (phase === 'done') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
        <View style={styles.doneContainer}>
          <Feather name="feather" size={60} color={C.green} />
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
    return (
      <View style={styles.flex}>
        <BreathRhythm onComplete={() => setPhase(guided ? 'grounding' : 'done')} />
        {closeButton}
      </View>
    );
  }
  if (phase === 'grounding') {
    return (
      <View style={styles.flex}>
        <GroundingExercise onComplete={() => (guided ? router.replace('/waiting-room' as any) : setPhase('done'))} />
        {closeButton}
      </View>
    );
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

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Guide me. Breathe, then ground yourself, then sit with the urge. About 3 minutes."
          style={({ pressed }) => [
            styles.optionCard,
            { backgroundColor: pressed ? C.surfaceHigh : C.surface, borderColor: C.cyan + '88', marginBottom: SPACING.md },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setGuided(true);
            setPhase('breathing');
          }}
        >
          <View style={{ width: 40, alignItems: 'center' }}><Feather name="navigation" size={26} color={C.cyan} /></View>
          <View style={styles.optionText}>
            <Text style={[styles.optionTitle, { color: C.textPrimary }]}>Guide me</Text>
            <Text style={[styles.optionSub, { color: C.textSecondary }]}>Breathe, then ground, then sit with the urge · about 3 minutes</Text>
          </View>
          <Feather name="chevron-right" size={18} color={C.cyan} />
        </Pressable>

        <Text style={[styles.subheading, { color: C.textMuted, marginBottom: SPACING.sm }]}>Or pick one</Text>
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
                if (opt.id === 'waiting') { router.replace('/waiting-room' as any); return; }
                setGuided(false);
                setPhase(opt.id);
              }}
            >
              <View style={{ width: 40, alignItems: 'center' }}><Glyph name={opt.emoji} size={28} color={C.cyan} /></View>
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

  flex: { flex: 1 },
  closeBtn: {
    position: 'absolute',
    right: SPACING.lg,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
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
