// ═══════════════════════════════════════════════════════════════════════════
//  INTENTION CHECK — "Why Am I Here?"
//  ─────────────────────────────────
//  A short self-reflection exercise that surfaces the real reason the user
//  opened the blocked site or app.
//
//  WHY THIS WORKS AS A PATTERN INTERRUPT:
//  Most app-opening is automatic (habit loop: cue → routine → reward).
//  Asking "why" forces the prefrontal cortex back online, breaking the
//  automatic behavior before it completes. Even if the user still unlocks,
//  they're now doing it consciously — not on autopilot.
//
//  FLOW:
//    Step 1 — "Right now I'm feeling..." (bored / anxious / lonely / procrastinating / genuinely need it)
//    Step 2 — Based on answer, show a 1-sentence reframe. Non-judgmental.
//    Step 3 — "Now that you know why — your call."
//    Done    — Award 25 pause tokens (no wrong answers, this is reflection)
//
//  WHY THIS REPLACES FLAPPY BIRD:
//  Flappy was fun/stimulating — it substituted one dopamine hit for another.
//  Intention Check gives the brain something it actually needs: clarity.
//
//  Props:
//    onComplete(score) — called when the user finishes (always 25 pts)
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  SafeAreaView,
  Animated,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

interface IntentionCheckProps {
  onComplete: (score: number) => void;
}

// Fixed score — 25 pause tokens. There are no wrong answers here.
const SCORE = 25;

// ─── Question data ─────────────────────────────────────────────────────────────

// Step 1: Why are you here?
const FEELING_OPTIONS = [
  {
    id: 'bored',
    label: 'Bored',
    emoji: '😐',
    reframe: "Boredom is uncomfortable — but it's also where creativity lives. What's one thing you've been putting off?",
    color: COLORS.textSecondary,
  },
  {
    id: 'anxious',
    label: 'Anxious',
    emoji: '😟',
    reframe: "Scrolling numbs anxiety for about 90 seconds, then it comes back stronger. The feed won't fix what's worrying you.",
    color: COLORS.warning,
  },
  {
    id: 'lonely',
    label: 'Lonely',
    emoji: '🥺',
    reframe: "Social media gives the feeling of connection without the substance of it. Is there someone you could actually message or call?",
    color: COLORS.purple,
  },
  {
    id: 'procrastinating',
    label: 'Avoiding something',
    emoji: '😅',
    reframe: "The task isn't going anywhere. Five minutes of scrolling usually turns into forty. What's the smallest possible next step?",
    color: COLORS.cyan,
  },
  {
    id: 'need',
    label: 'I genuinely need it',
    emoji: '✅',
    reframe: "Fair enough. If there's a real reason, go ahead. You made it conscious — that's what matters.",
    color: COLORS.green,
  },
  {
    id: 'habit',
    label: 'Just habit — I don\'t even know why',
    emoji: '🔄',
    reframe: "That's the most honest answer. Automatic behavior is the hardest to break — and you just interrupted it. That's the whole point.",
    color: COLORS.indigoBright,
  },
] as const;

type FeelId = (typeof FEELING_OPTIONS)[number]['id'];
type Step = 'feeling' | 'reframe' | 'done';

// ─── Main component ────────────────────────────────────────────────────────────

export function IntentionCheck({ onComplete }: IntentionCheckProps) {
  const [step, setStep]               = useState<Step>('feeling');
  const [selectedFeel, setSelectedFeel] = useState<typeof FEELING_OPTIONS[number] | null>(null);

  // Fade animation between steps
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const fadeToNext = (next: () => void) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      next();
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    });
  };

  const handleSelectFeeling = (option: typeof FEELING_OPTIONS[number]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedFeel(option);
    fadeToNext(() => setStep('reframe'));
  };

  const handleContinueFromReframe = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fadeToNext(() => setStep('done'));
  };

  const handleFinish = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete(SCORE);
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER: Step 1 — pick a feeling
  // ══════════════════════════════════════════════════════════════════════════

  if (step === 'feeling') {
    return (
      <SafeAreaView style={styles.safe}>
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.stepLabel}>STEP 1 OF 2</Text>
            <Text style={styles.question}>Right now,{'\n'}I'm here because...</Text>

            <View style={styles.optionsGrid}>
              {FEELING_OPTIONS.map((option) => (
                <Pressable
                  key={option.id}
                  style={[
                    styles.optionCard,
                    { borderColor: option.color + '55' },
                  ]}
                  onPress={() => handleSelectFeeling(option)}
                >
                  <Text style={styles.optionEmoji}>{option.emoji}</Text>
                  <Text style={[styles.optionLabel, { color: option.color }]}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* No wrong answers note — keeps it non-judgmental */}
            <Text style={styles.noWrongNote}>No wrong answers. Just honesty.</Text>
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER: Step 2 — reframe based on their answer
  // ══════════════════════════════════════════════════════════════════════════

  if (step === 'reframe' && selectedFeel) {
    return (
      <SafeAreaView style={styles.safe}>
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
          <View style={styles.reframeContainer}>
            {/* Their answer reflected back */}
            <View style={[styles.answerChip, { borderColor: selectedFeel.color + '55' }]}>
              <Text style={styles.answerEmoji}>{selectedFeel.emoji}</Text>
              <Text style={[styles.answerLabel, { color: selectedFeel.color }]}>
                {selectedFeel.label}
              </Text>
            </View>

            <Text style={styles.stepLabel}>STEP 2 OF 2</Text>

            {/* The reframe — one sentence, no lecture */}
            <Text style={styles.reframeText}>{selectedFeel.reframe}</Text>

            <Text style={styles.callToAction}>
              Now that you know why —{'\n'}your call.
            </Text>

            <Pressable
              style={[styles.continueButton, { backgroundColor: selectedFeel.color + '22', borderColor: selectedFeel.color + '55' }]}
              onPress={handleContinueFromReframe}
            >
              <Text style={[styles.continueButtonText, { color: selectedFeel.color }]}>
                Got it
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER: Done
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <View style={styles.doneContainer}>
          <Text style={styles.doneEmoji}>🪞</Text>
          <Text style={styles.doneTitle}>You looked inward.</Text>
          <Text style={styles.doneBody}>
            That moment of honesty is{'\n'}what breaks the loop.
          </Text>

          <Pressable style={styles.finishButton} onPress={handleFinish}>
            <Text style={styles.finishButtonText}>Continue (+{SCORE} tokens)</Text>
          </Pressable>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxxl,
    paddingBottom: SPACING.xxl,
    gap: SPACING.xl,
  },

  stepLabel: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 2,
    textAlign: 'center',
  },
  question: {
    fontFamily: FONTS.display,
    fontSize: 34,
    color: COLORS.textPrimary,
    textAlign: 'center',
    lineHeight: 42,
    letterSpacing: -0.5,
  },

  optionsGrid: {
    gap: SPACING.sm,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
  },
  optionEmoji: {
    fontSize: 24,
  },
  optionLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 16,
    flex: 1,
  },

  noWrongNote: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // ── Reframe screen ──
  reframeContainer: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxxl,
    alignItems: 'center',
    gap: SPACING.xl,
  },
  answerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  answerEmoji: { fontSize: 18 },
  answerLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
  },
  reframeText: {
    fontFamily: FONTS.body,
    fontSize: 18,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 30,
  },
  callToAction: {
    fontFamily: FONTS.display,
    fontSize: 22,
    color: COLORS.textPrimary,
    textAlign: 'center',
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  continueButton: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xxxl,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  continueButtonText: {
    fontFamily: FONTS.display,
    fontSize: 20,
    letterSpacing: -0.3,
  },

  // ── Done screen ──
  doneContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
    gap: SPACING.xl,
  },
  doneEmoji: { fontSize: 64 },
  doneTitle: {
    fontFamily: FONTS.display,
    fontSize: 36,
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  doneBody: {
    fontFamily: FONTS.body,
    fontSize: 17,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 28,
  },
  finishButton: {
    backgroundColor: COLORS.indigo,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xxl,
    borderRadius: RADIUS.md,
  },
  finishButtonText: {
    fontFamily: FONTS.display,
    fontSize: 18,
    color: COLORS.background,
    letterSpacing: -0.3,
  },
});
