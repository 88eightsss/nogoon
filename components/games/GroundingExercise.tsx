// ═══════════════════════════════════════════════════════════════════════════
//  GROUNDING EXERCISE — "Ground Yourself"
//  ───────────────────────────────────────
//  Walks the user through the 5-4-3-2-1 grounding technique.
//  This is a clinically-validated anxiety and craving reduction method that
//  works by anchoring attention to physical senses — breaking the automatic
//  "open → scroll" loop by redirecting to the present moment.
//
//  HOW IT WORKS:
//    5 things you can SEE
//    4 things you can TOUCH / FEEL
//    3 things you can HEAR
//    2 things you can SMELL
//    1 thing you can TASTE
//
//  INTERACTION MODEL:
//  Rather than mindless tapping, the user types each observation.
//  Typing forces genuine attention — you have to articulate what you notice —
//  making it much harder to fake your way through and more therapeutically
//  effective.  Entries appear in a running list as you add them.
//
//  Props:
//    onComplete(score) — called when all steps are done (always 35 pts)
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Animated,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { FONTS } from '@/constants/Colors';
import { useThemedColors, type ArcadeColors } from '@/hooks/useThemedColors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { ProceedButton } from '@/components/ui/ProceedButton';
import { useSafeTimeout } from '@/hooks/useSafeTimeout';

interface GroundingExerciseProps {
  onComplete: (score: number) => void;
}

// ─── The 5 senses, with how many observations to log for each ─────────────────

const getSenses = (COLORS: ArcadeColors) => [
  {
    count: 5,
    sense: 'SEE',
    icon: '👁️',
    color: COLORS.cyan,
    prompt: 'Look around. Name 5 things you can see.',
    placeholder: 'I see...',
    completion: 'Good eyes.',
  },
  {
    count: 4,
    sense: 'FEEL',
    icon: '✋',
    color: COLORS.purple,
    prompt: 'Notice 4 things you can physically feel right now.',
    placeholder: 'I feel...',
    completion: 'Your body is here.',
  },
  {
    count: 3,
    sense: 'HEAR',
    icon: '👂',
    color: COLORS.indigoBright,
    prompt: 'Listen for 3 sounds around you.',
    placeholder: 'I hear...',
    completion: 'The world keeps going.',
  },
  {
    count: 2,
    sense: 'SMELL',
    icon: '👃',
    color: '#ff9d4d',
    prompt: 'Notice 2 things you can smell (or the absence of smell).',
    placeholder: 'I smell...',
    completion: 'Almost there.',
  },
  {
    count: 1,
    sense: 'TASTE',
    icon: '👅',
    color: COLORS.green,
    prompt: 'What\'s the one taste you notice right now?',
    placeholder: 'I taste...',
    completion: 'Done.',
  },
] as const;

const SCORE = 35;

// ─── Main component ────────────────────────────────────────────────────────────

export function GroundingExercise({ onComplete }: GroundingExerciseProps) {
  const schedule = useSafeTimeout();   // timers are cancelled if the player leaves mid-finish
  const COLORS = useThemedColors();
  const SENSES = useMemo(() => getSenses(COLORS), [COLORS]);
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [senseIndex,  setSenseIndex]  = useState(0);
  // Logged observations per sense (parallel array to SENSES)
  const [logged, setLogged] = useState<string[][]>(SENSES.map(() => []));
  const [inputText, setInputText] = useState('');
  const [allDone,   setAllDone]   = useState(false);

  const inputRef = useRef<TextInput>(null);

  // New-item pop-in animation
  const newItemScale = useRef(new Animated.Value(0.8)).current;
  const newItemOpacity = useRef(new Animated.Value(0)).current;

  const currentSense = SENSES[senseIndex];
  const currentLogged = logged[senseIndex];
  const remaining = currentSense.count - currentLogged.length;

  const totalObs = SENSES.reduce((s, _, i) => s + (logged[i]?.length ?? 0), 0);
  const totalNeeded = SENSES.reduce((s, sense) => s + sense.count, 0);
  const progress = totalObs / totalNeeded;

  // Auto-focus the input when the sense changes
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, [senseIndex]);

  const animateNewItem = () => {
    newItemScale.setValue(0.8);
    newItemOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(newItemScale, { toValue: 1, damping: 12, useNativeDriver: true }),
      Animated.timing(newItemOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const handleSubmit = () => {
    const text = inputText.trim();
    if (text.length < 2) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateNewItem();

    const newLogged = logged.map((arr, i) =>
      i === senseIndex ? [...arr, text] : arr
    );
    setLogged(newLogged);
    setInputText('');

    const nowCount = newLogged[senseIndex].length;
    if (nowCount >= currentSense.count) {
      // Sense complete
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const nextIndex = senseIndex + 1;
      if (nextIndex >= SENSES.length) {
        setAllDone(true);
      } else {
        schedule(() => {
          setSenseIndex(nextIndex);
          setInputText('');
        }, 600);
      }
    }
  };

  const handleFinish = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete(SCORE);
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER: All done
  // ══════════════════════════════════════════════════════════════════════════

  if (allDone) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.doneScroll}>
          <Text style={styles.doneEmoji}>🌿</Text>
          <Text style={styles.doneTitle}>You're here.</Text>
          <Text style={styles.doneBody}>
            Most cravings last 90 seconds.{'\n'}
            You just noticed {totalNeeded} things around you.{'\n\n'}
            Now decide — with a clear head.
          </Text>

          {/* Summary of all observations */}
          <View style={styles.summaryContainer}>
            {SENSES.map((sense, i) => (
              <View key={sense.sense} style={styles.summarySection}>
                <Text style={[styles.summarySenseLabel, { color: sense.color }]}>
                  {sense.icon}  {sense.sense}
                </Text>
                {logged[i].map((obs, j) => (
                  <Text key={j} style={styles.summaryObs}>
                    • {obs}
                  </Text>
                ))}
              </View>
            ))}
          </View>

          <ProceedButton
            label={`Continue (+${SCORE} tokens)`}
            onPress={handleFinish}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER: Active sense
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>

          {/* ── Progress bar ── */}
          <View style={styles.progressBar}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: `${progress * 100}%` as any,
                  backgroundColor: currentSense.color,
                },
              ]}
            />
          </View>

          {/* ── Sense dots ── */}
          <View style={styles.dotsRow}>
            {SENSES.map((sense, i) => {
              const isCompleted = logged[i]?.length >= sense.count;
              const isCurrent   = i === senseIndex;
              return (
                <View
                  key={sense.sense}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: isCompleted
                        ? sense.color
                        : isCurrent
                          ? sense.color + '55'
                          : COLORS.border,
                      borderColor:  isCurrent ? sense.color : 'transparent',
                      borderWidth:  isCurrent ? 2 : 0,
                    },
                  ]}
                />
              );
            })}
          </View>

          {/* ── Sense header ── */}
          <View style={styles.senseHeader}>
            <Text style={styles.senseIcon}>{currentSense.icon}</Text>
            <Text style={[styles.senseName, { color: currentSense.color }]}>
              {currentSense.sense}
            </Text>
            <View style={[styles.countPill, { backgroundColor: currentSense.color + '22', borderColor: currentSense.color + '55' }]}>
              <Text style={[styles.countText, { color: currentSense.color }]}>
                {remaining} more
              </Text>
            </View>
          </View>

          {/* ── Prompt ── */}
          <Text style={styles.prompt}>{currentSense.prompt}</Text>

          {/* ── Logged items list ── */}
          <View style={styles.loggedList}>
            {currentLogged.map((item, idx) => (
              <Animated.View
                key={`${senseIndex}-${idx}`}
                style={[
                  styles.loggedItem,
                  { borderColor: currentSense.color + '44' },
                  idx === currentLogged.length - 1 && {
                    transform: [{ scale: newItemScale }],
                    opacity: newItemOpacity,
                  },
                ]}
              >
                <Feather name="check" size={13} color={currentSense.color} />
                <Text style={[styles.loggedText, { color: COLORS.textSecondary }]}>
                  {item}
                </Text>
              </Animated.View>
            ))}
          </View>

          {/* ── Text input + submit ── */}
          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              style={[
                styles.input,
                { borderColor: currentSense.color + '66', color: COLORS.textPrimary },
              ]}
              value={inputText}
              onChangeText={setInputText}
              placeholder={currentSense.placeholder}
              placeholderTextColor={COLORS.textMuted}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              autoCorrect={false}
              autoCapitalize="sentences"
              blurOnSubmit={false}
            />
            <Pressable
              style={[
                styles.submitBtn,
                { backgroundColor: currentSense.color + '22', borderColor: currentSense.color + '66' },
                inputText.trim().length < 2 && styles.submitBtnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={inputText.trim().length < 2}
            >
              <Feather
                name="arrow-right"
                size={20}
                color={inputText.trim().length >= 2 ? currentSense.color : COLORS.textMuted}
              />
            </Pressable>
          </View>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (COLORS: ArcadeColors) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    gap: SPACING.lg,
  },

  // ── Progress ──
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: RADIUS.full,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    justifyContent: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: RADIUS.full,
  },

  // ── Sense header ──
  senseHeader: {
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  senseIcon: {
    fontSize: 44,
  },
  senseName: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 3,
  },
  countPill: {
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    marginTop: 4,
  },
  countText: {
    fontFamily: FONTS.monoBold,
    fontSize: 13,
    letterSpacing: 0.5,
  },

  // ── Prompt ──
  prompt: {
    fontFamily: FONTS.body,
    fontSize: 17,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
  },

  // ── Logged items ──
  loggedList: {
    flex: 1,
    gap: SPACING.xs,
  },
  loggedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    backgroundColor: COLORS.surface,
  },
  loggedText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    flex: 1,
  },

  // ── Input row ──
  inputRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'center',
    paddingBottom: SPACING.xl,
  },
  input: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontFamily: FONTS.body,
    fontSize: 15,
    backgroundColor: COLORS.surface,
  },
  submitBtn: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.35,
  },

  // ── Done screen ──
  doneScroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxxl,
    paddingBottom: SPACING.xxxl,
    gap: SPACING.xl,
  },
  doneEmoji: {
    fontSize: 64,
  },
  doneTitle: {
    fontFamily: FONTS.display,
    fontSize: 40,
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  doneBody: {
    fontFamily: FONTS.body,
    fontSize: 17,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 28,
  },
  summaryContainer: {
    width: '100%',
    gap: SPACING.lg,
  },
  summarySection: {
    gap: SPACING.xs,
  },
  summarySenseLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  summaryObs: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 22,
    paddingLeft: SPACING.sm,
  },
});
