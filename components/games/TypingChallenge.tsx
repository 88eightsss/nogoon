// ─── Typing Challenge — Pro Game ──────────────────────────────────────────────
//
// The user must type a displayed phrase exactly as shown, including
// punctuation and capitalisation, within the time limit.
//
// WHY IT WORKS AS PATTERN INTERRUPTION:
// Typing requires fine motor coordination AND working memory simultaneously.
// This dual-task load completely breaks the automatic, reflexive nature of
// doom-scrolling. It's cognitively "expensive" in a satisfying way.
//
// SCORING:
//   Base score = 80 pts
//   Speed bonus = up to +40 pts (faster = more)
//   Accuracy tracked per character but the game requires 100% to submit
//
// DURATION: Passed in as prop (30s default, 60s or 90s for Pro users who set it)

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

// ─── Phrase bank ───────────────────────────────────────────────────────────────
// Each phrase is chosen to reinforce the app's values while keeping fingers busy.
// They're short enough to be completable in 30s but require real focus.

const PHRASES = [
  'I am stronger than this urge.',
  'Every second I wait, the craving shrinks.',
  'Today I choose clarity over comfort.',
  'One moment of discomfort now, pride later.',
  'My brain is rewiring itself right now.',
  'I broke the pattern today.',
  'Dopamine fasting builds the real reward.',
  'This is temporary. My progress is permanent.',
  'I am not my impulse. I am my response.',
  'Small wins become permanent strength.',
  'The urge is just noise. I am the signal.',
  'Two minutes of focus changes the next hour.',
  'I choose who I am becoming.',
  'Resistance is the workout. Strength is the result.',
  'My future self is proud of what I just did.',
] as const;

interface Props {
  onComplete: (score: number) => void;
  duration?: number; // seconds — defaults to 30
}

export function TypingChallenge({ onComplete, duration = 30 }: Props) {
  // Pick a random phrase once per session
  const [phrase] = useState(() => PHRASES[Math.floor(Math.random() * PHRASES.length)]);
  const [input, setInput]       = useState('');
  const [timeLeft, setTimeLeft] = useState(duration);
  const [phase, setPhase]       = useState<'ready' | 'playing' | 'complete' | 'failed'>('ready');
  const [startTime, setStartTime] = useState(0);
  const [wrongChar, setWrongChar] = useState(false);

  // Timer bar animation
  const timerBarWidth = useRef(new Animated.Value(1)).current;
  const shakeAnim     = useRef(new Animated.Value(0)).current;
  const inputRef      = useRef<TextInput>(null);
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Start the game ──────────────────────────────────────────────────────────

  const startGame = () => {
    setPhase('playing');
    setStartTime(Date.now());
    inputRef.current?.focus();

    Animated.timing(timerBarWidth, {
      toValue: 0,
      duration: duration * 1000,
      useNativeDriver: false,
    }).start();

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          setPhase('failed');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  // ── Handle text change ──────────────────────────────────────────────────────

  const handleChange = (text: string) => {
    if (phase !== 'playing') return;
    setInput(text);

    // Check if the typed text matches the beginning of the phrase
    const isCorrectSoFar = phrase.startsWith(text);

    if (!isCorrectSoFar) {
      // Wrong character — shake the input
      setWrongChar(true);
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: -8, duration: 40, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue:  8, duration: 40, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue:  0, duration: 40, useNativeDriver: true }),
      ]).start(() => setWrongChar(false));
      // Revert to last correct state
      setInput(text.slice(0, -1));
      return;
    }

    // Completed the full phrase
    if (text === phrase) {
      clearInterval(timerRef.current!);
      const elapsed = (Date.now() - startTime) / 1000;
      const speedBonus = Math.max(0, Math.round(40 * (1 - elapsed / duration)));
      const score = 80 + speedBonus;
      setPhase('complete');
      setTimeout(() => onComplete(score), 800);
    }
  };

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // ── Render each character with colour coding ────────────────────────────────

  const renderPhrase = () =>
    phrase.split('').map((char, i) => {
      let color = COLORS.textMuted;
      if (i < input.length) color = COLORS.green;         // typed correctly
      else if (i === input.length) color = COLORS.textPrimary; // cursor position
      return (
        <Text key={i} style={[styles.phraseChar, { color }]}>{char}</Text>
      );
    });

  // ══════════════════════════════════════════════════════════════════════════

  if (phase === 'ready') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.gameTitle}>⌨️  Typing Challenge</Text>
          <Text style={styles.gameSub}>
            Type the phrase exactly as shown.{'\n'}Every character must be perfect.
          </Text>
          <View style={styles.phrasePreview}>
            <Text style={styles.previewText}>"{phrase}"</Text>
          </View>
          <Pressable style={styles.startButton} onPress={startGame}>
            <Text style={styles.startButtonText}>Start Typing</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'complete') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.completeEmoji}>✅</Text>
          <Text style={styles.completeTitle}>Perfect!</Text>
          <Text style={styles.completeSub}>You typed every character correctly.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'failed') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.completeEmoji}>⏱️</Text>
          <Text style={styles.completeTitle}>Time's up</Text>
          <Text style={styles.completeSub}>Still counts — you broke the pattern.</Text>
          <Pressable style={styles.startButton} onPress={() => onComplete(40)}>
            <Text style={styles.startButtonText}>Continue</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Timer bar */}
        <View style={styles.timerTrack}>
          <Animated.View
            style={[
              styles.timerFill,
              {
                width: timerBarWidth.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }) as any,
                backgroundColor: timeLeft < 10 ? COLORS.danger : COLORS.green,
              },
            ]}
          />
        </View>

        <View style={styles.content}>
          {/* Time remaining */}
          <Text style={[styles.timer, timeLeft < 10 && { color: COLORS.danger }]}>
            {timeLeft}s
          </Text>

          {/* The phrase to type */}
          <View style={styles.phraseBox}>
            <View style={styles.phraseChars}>{renderPhrase()}</View>
          </View>

          {/* Progress */}
          <Text style={styles.progressLabel}>
            {input.length} / {phrase.length} characters
          </Text>

          {/* Hidden text input */}
          <Animated.View
            style={[
              styles.inputWrapper,
              wrongChar && { borderColor: COLORS.danger },
              { transform: [{ translateX: shakeAnim }] },
            ]}
          >
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              value={input}
              onChangeText={handleChange}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              placeholder="Start typing here…"
              placeholderTextColor={COLORS.textMuted}
              returnKeyType="done"
              blurOnSubmit={false}
            />
          </Animated.View>

          <Text style={styles.hintText}>
            Tip: capitalisation and punctuation must match exactly
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  kav:  { flex: 1 },

  timerTrack: {
    height: 4,
    backgroundColor: COLORS.border,
    width: '100%',
  },
  timerFill: {
    height: '100%',
    borderRadius: 2,
  },

  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    gap: SPACING.lg,
    alignItems: 'center',
  },

  timer: {
    fontFamily: FONTS.monoBold,
    fontSize: 48,
    color: COLORS.green,
    lineHeight: 52,
  },

  phraseBox: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.lg,
    width: '100%',
  },
  phraseChars: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 1,
  },
  phraseChar: {
    fontFamily: FONTS.mono,
    fontSize: 22,
    lineHeight: 30,
  },

  progressLabel: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.textMuted,
  },

  inputWrapper: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.green + '55',
    paddingHorizontal: SPACING.md,
  },
  textInput: {
    fontFamily: FONTS.body,
    fontSize: 16,
    color: COLORS.textPrimary,
    paddingVertical: SPACING.md,
  },

  hintText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
  },

  // Ready / complete states
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.lg,
  },
  gameTitle: {
    fontFamily: FONTS.display,
    fontSize: 28,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  gameSub: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  phrasePreview: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.lg,
    width: '100%',
  },
  previewText: {
    fontFamily: FONTS.mono,
    fontSize: 16,
    color: COLORS.green,
    textAlign: 'center',
    lineHeight: 24,
  },
  startButton: {
    backgroundColor: COLORS.green,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xxl,
    width: '100%',
    alignItems: 'center',
  },
  startButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 17,
    color: COLORS.background,
  },
  completeEmoji: { fontSize: 64 },
  completeTitle: {
    fontFamily: FONTS.display,
    fontSize: 32,
    color: COLORS.textPrimary,
  },
  completeSub: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
