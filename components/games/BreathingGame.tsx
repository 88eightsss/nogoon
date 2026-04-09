// ═══════════════════════════════════════════════════════════════════════════
//  BREATHING RESET — Standard Game
//  ────────────────────────────────
//  A guided box-breathing exercise. The user follows an animated circle
//  through 3 complete breath cycles: Inhale → Hold → Exhale → Hold.
//
//  WHY IT WORKS AS A PATTERN INTERRUPT:
//  Slow intentional breathing activates the parasympathetic nervous system
//  (the "rest and digest" mode), directly counteracting the dopamine-driven
//  urge loop that leads to doom-scrolling. After 3 cycles, the craving
//  is measurably reduced for most people.
//
//  SCORING: Flat 80 points — this is not a competition. The value is in
//  doing it, not in doing it fast. We want users to go slow.
//
//  TIMING (box breathing, clinically validated):
//    Inhale:     4 seconds
//    Hold:       4 seconds
//    Exhale:     4 seconds
//    Hold:       4 seconds
//    One cycle:  16 seconds × 3 cycles = 48 seconds total
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Pressable,
  SafeAreaView,
} from 'react-native';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

// ─── Constants ────────────────────────────────────────────────────────────────

const PHASE_DURATION_MS = 4000; // Each phase (inhale/hold/exhale/hold) = 4 seconds
const TOTAL_CYCLES      = 3;    // User completes 3 full cycles before done
const SCORE             = 80;   // Flat score — reward is the calm, not the points

// The 4 phases in order, cycling continuously
type BreathPhase = 'inhale' | 'hold-in' | 'exhale' | 'hold-out';

const PHASES: BreathPhase[] = ['inhale', 'hold-in', 'exhale', 'hold-out'];

// User-facing labels and colors for each phase
const PHASE_CONFIG: Record<BreathPhase, { label: string; sublabel: string; color: string }> = {
  'inhale':   { label: 'Breathe In',  sublabel: 'slowly through your nose',  color: COLORS.cyan    },
  'hold-in':  { label: 'Hold',        sublabel: 'stay calm and still',        color: COLORS.purple  },
  'exhale':   { label: 'Breathe Out', sublabel: 'slowly through your mouth',  color: COLORS.green   },
  'hold-out': { label: 'Hold',        sublabel: 'empty and relaxed',          color: COLORS.warning },
};

// ─── Circle sizes ─────────────────────────────────────────────────────────────

const CIRCLE_MIN = 100; // Smallest circle size (exhale / hold-out)
const CIRCLE_MAX = 220; // Largest circle size (inhale / hold-in)

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onComplete: (score: number) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BreathingGame({ onComplete }: Props) {
  // 'intro' — shown before game starts (explains what to do)
  // 'playing' — active breathing exercise
  // 'complete' — all 3 cycles done
  const [gamePhase, setGamePhase] = useState<'intro' | 'playing' | 'complete'>('intro');

  // Which breath phase we're currently in (inhale/hold/exhale/hold)
  const [breathPhase, setBreathPhase] = useState<BreathPhase>('inhale');
  const breathPhaseRef = useRef<BreathPhase>('inhale');

  // Which cycle we're on (0 = first, 1 = second, 2 = third)
  const [cycleIndex, setCycleIndex] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);

  // Countdown within the current phase (4 → 1)
  const [countdown, setCountdown] = useState(4);

  // Animated circle size — the core visual feedback
  const circleSize = useRef(new Animated.Value(CIRCLE_MIN)).current;

  // Animated opacity for the phase label (fades in on phase change)
  const labelOpacity = useRef(new Animated.Value(0)).current;

  // ── Start the exercise ─────────────────────────────────────────────────────

  const startExercise = () => {
    setGamePhase('playing');
    setBreathPhase('inhale');
    breathPhaseRef.current = 'inhale';
    setPhaseIndex(0);
    setCycleIndex(0);
    setCountdown(4);
  };

  // ── Animate circle + label on phase change ─────────────────────────────────

  useEffect(() => {
    if (gamePhase !== 'playing') return;

    const isExpanding = breathPhase === 'inhale' || breathPhase === 'hold-in';
    const targetSize  = isExpanding ? CIRCLE_MAX : CIRCLE_MIN;

    // For inhale/exhale: animate smoothly over 4 seconds
    // For hold phases: snap to size instantly (already at target)
    const shouldAnimate = breathPhase === 'inhale' || breathPhase === 'exhale';

    if (shouldAnimate) {
      Animated.timing(circleSize, {
        toValue: targetSize,
        duration: PHASE_DURATION_MS,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false, // Animating size — must use JS driver
      }).start();
    } else {
      // Already at the right size for hold phases — just keep it there
      circleSize.setValue(targetSize);
    }

    // Fade in the label text
    labelOpacity.setValue(0);
    Animated.timing(labelOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [breathPhase, gamePhase]);

  // ── Countdown ticker — drives phase progression ────────────────────────────

  useEffect(() => {
    if (gamePhase !== 'playing') return;

    setCountdown(4); // Reset countdown at start of each phase

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Phase is complete — advance to next
          advancePhase();
          return 4; // Reset for next phase
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [breathPhase, gamePhase]);

  // ── Advance to the next breath phase ──────────────────────────────────────

  const advancePhase = () => {
    setPhaseIndex((prevPhaseIdx) => {
      const nextPhaseIdx = prevPhaseIdx + 1;

      // Check if we've completed a full cycle (all 4 phases)
      if (nextPhaseIdx >= PHASES.length) {
        setCycleIndex((prevCycle) => {
          const nextCycle = prevCycle + 1;

          if (nextCycle >= TOTAL_CYCLES) {
            // All 3 cycles complete! Show result.
            setGamePhase('complete');
            return prevCycle;
          }

          // Start next cycle from inhale
          const nextPhase = PHASES[0];
          setBreathPhase(nextPhase);
          breathPhaseRef.current = nextPhase;
          return nextCycle;
        });
        return 0; // Reset phase index to 0 (inhale)
      }

      // Advance to next phase within the cycle
      const nextPhase = PHASES[nextPhaseIdx];
      setBreathPhase(nextPhase);
      breathPhaseRef.current = nextPhase;
      return nextPhaseIdx;
    });
  };

  // ── Derive display values ──────────────────────────────────────────────────

  const config      = PHASE_CONFIG[breathPhase];
  const dotsTotal   = TOTAL_CYCLES;
  const dotsActive  = cycleIndex; // Filled dots = completed cycles

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER: Intro screen
  // ══════════════════════════════════════════════════════════════════════════

  if (gamePhase === 'intro') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centeredContainer}>

          {/* Big visual icon */}
          <Text style={styles.heroEmoji}>🌬️</Text>

          <Text style={styles.title}>Breathing Reset</Text>

          <Text style={styles.subtitle}>
            Follow the circle through 3 breath cycles.{'\n'}
            This takes about 48 seconds.
          </Text>

          {/* Visual explanation of the 4 phases */}
          <View style={styles.phaseList}>
            {PHASES.map((phase) => (
              <View key={phase} style={styles.phaseRow}>
                <View style={[styles.phaseDot, { backgroundColor: PHASE_CONFIG[phase].color }]} />
                <Text style={styles.phaseRowLabel}>{PHASE_CONFIG[phase].label}</Text>
                <Text style={styles.phaseRowTime}>4s</Text>
              </View>
            ))}
          </View>

          <Pressable style={styles.startButton} onPress={startExercise}>
            <Text style={styles.startButtonText}>Start Breathing →</Text>
          </Pressable>

          <Text style={styles.hint}>Put down your phone if you can</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER: Complete screen
  // ══════════════════════════════════════════════════════════════════════════

  if (gamePhase === 'complete') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centeredContainer}>

          <Text style={styles.heroEmoji}>✅</Text>
          <Text style={styles.title}>Well done</Text>

          <Text style={styles.subtitle}>
            You completed 3 full breath cycles.{'\n'}
            Your nervous system thanks you.
          </Text>

          <View style={styles.scoreCard}>
            <Text style={styles.scoreNumber}>{SCORE}</Text>
            <Text style={styles.scoreLabel}>points earned</Text>
          </View>

          <Text style={styles.scienceNote}>
            💡 Box breathing is used by Navy SEALs to stay calm under pressure.
            You just did the same thing.
          </Text>

          <Pressable style={styles.startButton} onPress={() => onComplete(SCORE)}>
            <Text style={styles.startButtonText}>Continue →</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER: Playing — the main breathing exercise
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.playingContainer}>

        {/* ── Cycle progress dots at top ── */}
        <View style={styles.cycleDotsRow}>
          {Array.from({ length: dotsTotal }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.cycleDot,
                i < dotsActive && styles.cycleDotDone,
                i === dotsActive && styles.cycleDotActive,
              ]}
            />
          ))}
        </View>

        <Text style={styles.cycleLabel}>
          Cycle {cycleIndex + 1} of {TOTAL_CYCLES}
        </Text>

        {/* ── Breathing circle — the core visual ── */}
        {/* The circle expands on inhale, contracts on exhale */}
        <View style={styles.circleArea}>
          {/* Outer glow ring — always slightly bigger than circle */}
          <Animated.View
            style={[
              styles.glowRing,
              {
                width:  Animated.add(circleSize, new Animated.Value(40)),
                height: Animated.add(circleSize, new Animated.Value(40)),
                borderRadius: Animated.divide(
                  Animated.add(circleSize, new Animated.Value(40)),
                  new Animated.Value(2)
                ),
                borderColor: config.color + '40',
              },
            ]}
          />

          {/* Main breathing circle */}
          <Animated.View
            style={[
              styles.breathCircle,
              {
                width:  circleSize,
                height: circleSize,
                borderRadius: Animated.divide(circleSize, new Animated.Value(2)),
                backgroundColor: config.color + '20',
                borderColor: config.color + '80',
              },
            ]}
          >
            {/* Countdown number inside the circle */}
            <Text style={[styles.countdownInCircle, { color: config.color }]}>
              {countdown}
            </Text>
          </Animated.View>
        </View>

        {/* ── Phase label — fades in on each new phase ── */}
        <Animated.View style={[styles.phaseLabelContainer, { opacity: labelOpacity }]}>
          <Text style={[styles.phaseLabel, { color: config.color }]}>
            {config.label}
          </Text>
          <Text style={styles.phaseSublabel}>{config.sublabel}</Text>
        </Animated.View>

      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── Intro / Complete screens ──────────────────────────────────────────────
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.lg,
  },

  heroEmoji: {
    fontSize: 72,
    lineHeight: 88,
  },

  title: {
    fontFamily: FONTS.display,
    fontSize: 34,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },

  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },

  // Phase explanation list on intro screen
  phaseList: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.lg,
    gap: SPACING.md,
  },

  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },

  phaseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  phaseRowLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 15,
    color: COLORS.textPrimary,
    flex: 1,
  },

  phaseRowTime: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: COLORS.textMuted,
  },

  startButton: {
    backgroundColor: COLORS.cyan,
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

  hint: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
  },

  // Complete screen score card
  scoreCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.xxl,
    alignItems: 'center',
    width: '100%',
  },

  scoreNumber: {
    fontFamily: FONTS.monoBold,
    fontSize: 72,
    color: COLORS.cyan,
    lineHeight: 84,
  },

  scoreLabel: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textSecondary,
  },

  scienceNote: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    width: '100%',
  },

  // ── Playing screen ────────────────────────────────────────────────────────
  playingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
  },

  // Progress dots at top
  cycleDotsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },

  cycleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  cycleDotDone: {
    backgroundColor: COLORS.cyan,
    borderColor: COLORS.cyan,
  },

  cycleDotActive: {
    borderColor: COLORS.cyan,
    backgroundColor: COLORS.cyan + '40',
  },

  cycleLabel: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // The area containing the glow ring + circle
  circleArea: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 280,
    height: 280,
  },

  // Soft glow halo around the circle
  glowRing: {
    position: 'absolute',
    borderWidth: 1.5,
  },

  // Main animated breathing circle
  breathCircle: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Large countdown number inside the circle
  countdownInCircle: {
    fontFamily: FONTS.monoBold,
    fontSize: 52,
    lineHeight: 60,
  },

  // Phase label below the circle
  phaseLabelContainer: {
    alignItems: 'center',
    gap: SPACING.xs,
  },

  phaseLabel: {
    fontFamily: FONTS.display,
    fontSize: 32,
    letterSpacing: -0.3,
  },

  phaseSublabel: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textMuted,
  },
});
