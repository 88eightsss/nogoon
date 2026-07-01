// ─── BreathRhythm — Standard Game ────────────────────────────────────────────
//
// Upgraded breathing game. A glowing orb expands and contracts with animated
// ring pulses, guided by a dynamic label. More immersive than BreathingGame.
//
// PATTERN: Box breathing — 4s in, 4s hold, 4s out, 4s hold. Repeat 4 cycles.
//
// NO INTERACTION required — the user just watches and breathes along.
// The orb expands on inhale, contracts on exhale.
//
// SCORING: flat 80 pts on completion (same as BreathingGame)

import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Pressable,
  Animated,
  AppState,
  type AppStateStatus,
} from 'react-native';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

// ─── Breath phases ────────────────────────────────────────────────────────────

type Phase = 'in' | 'hold-in' | 'out' | 'hold-out';

interface BreathStep {
  phase:    Phase;
  label:    string;
  duration: number; // ms
  toScale:  number; // target orb scale
}

const STEPS: BreathStep[] = [
  { phase: 'in',       label: 'Breathe in...',  duration: 4000, toScale: 1.35 },
  { phase: 'hold-in',  label: 'Hold...',         duration: 4000, toScale: 1.35 },
  { phase: 'out',      label: 'Breathe out...',  duration: 4000, toScale: 0.75 },
  { phase: 'hold-out', label: 'Hold...',         duration: 4000, toScale: 0.75 },
];

const TOTAL_CYCLES = 4;
const STEP_COUNT   = STEPS.length;

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onComplete: (score: number) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BreathRhythm({ onComplete }: Props) {
  const [phase, setPhase]         = useState<'ready' | 'breathing' | 'done'>('ready');
  const [stepIdx, setStepIdx]     = useState(0);
  const [cycle, setCycle]         = useState(0);
  const [currentStep, setCurrentStep] = useState<BreathStep>(STEPS[0]);

  // Orb scale
  const orbScale = useRef(new Animated.Value(1)).current;

  // Outer ring opacity (pulses on inhale)
  const ring1Opacity = useRef(new Animated.Value(0.15)).current;
  const ring2Opacity = useRef(new Animated.Value(0.08)).current;

  // Label fade
  const labelOpacity = useRef(new Animated.Value(1)).current;

  const animRef   = useRef<Animated.CompositeAnimation | null>(null);
  const stepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Run the breath sequence ───────────────────────────────────────────────

  const runStep = (idx: number, cycleNum: number) => {
    const step = STEPS[idx];
    setCurrentStep(step);
    setStepIdx(idx);

    // Fade label
    Animated.sequence([
      Animated.timing(labelOpacity, { toValue: 0,   duration: 150, useNativeDriver: true }),
      Animated.timing(labelOpacity, { toValue: 1,   duration: 250, useNativeDriver: true }),
    ]).start();

    // Orb scale
    const orbAnim = Animated.timing(orbScale, {
      toValue:  step.toScale,
      duration: step.duration,
      useNativeDriver: true,
    });

    // Ring pulse on inhale/hold-in
    const isExpand = step.phase === 'in' || step.phase === 'hold-in';
    const ringAnim = Animated.parallel([
      Animated.timing(ring1Opacity, {
        toValue:  isExpand ? 0.25 : 0.08,
        duration: step.duration,
        useNativeDriver: true,
      }),
      Animated.timing(ring2Opacity, {
        toValue:  isExpand ? 0.12 : 0.04,
        duration: step.duration,
        useNativeDriver: true,
      }),
    ]);

    animRef.current = Animated.parallel([orbAnim, ringAnim]);
    animRef.current.start(() => {
      const nextIdx  = (idx + 1) % STEP_COUNT;
      const nextCycle = nextIdx === 0 ? cycleNum + 1 : cycleNum;

      if (nextCycle >= TOTAL_CYCLES) {
        setPhase('done');
        setTimeout(() => onComplete(80), 600);
        return;
      }

      if (nextIdx === 0) setCycle(nextCycle);
      stepTimer.current = setTimeout(() => runStep(nextIdx, nextCycle), 100);
    });
  };

  // ── AppState: pause when backgrounded ────────────────────────────────────

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') animRef.current?.stop();
    });
    return () => sub.remove();
  }, []);

  // ── Cleanup ───────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      animRef.current?.stop();
      if (stepTimer.current) clearTimeout(stepTimer.current);
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE: READY
  // ─────────────────────────────────────────────────────────────────────────

  if (phase === 'ready') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.readyContainer}>
          <Text style={styles.readyEmoji}>🌬️</Text>
          <Text style={styles.readyTitle}>Breath Rhythm</Text>
          <View style={styles.readyCard}>
            <Text style={styles.readyLabel}>BOX BREATHING</Text>
            <Text style={styles.readyRule}>
              Breathe in 4 · Hold 4 · Out 4 · Hold 4{'\n\n'}
              Follow the orb for {TOTAL_CYCLES} cycles. Breathe through your nose if you can.
            </Text>
          </View>
          <Text style={styles.readyTime}>
            ~{Math.round((TOTAL_CYCLES * STEP_COUNT * 4) / 60)} minutes
          </Text>
          <Pressable
            style={styles.startButton}
            onPress={() => {
              setPhase('breathing');
              runStep(0, 0);
            }}
          >
            <Text style={styles.startButtonText}>Begin</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE: BREATHING / DONE
  // ─────────────────────────────────────────────────────────────────────────

  const progressTotal  = TOTAL_CYCLES * STEP_COUNT;
  const progressNow    = cycle * STEP_COUNT + stepIdx;
  const progressWidth  = `${(progressNow / progressTotal) * 100}%`;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.breathContainer}>

        {/* ── Cycle counter ── */}
        <View style={styles.cycleRow}>
          {Array.from({ length: TOTAL_CYCLES }).map((_, i) => (
            <View
              key={i}
              style={[styles.cycleDot, i < cycle && styles.cycleDotDone, i === cycle && styles.cycleDotActive]}
            />
          ))}
        </View>

        {/* ── Orb ── */}
        <View style={styles.orbContainer}>
          {/* Outer rings */}
          <Animated.View style={[styles.ring2, { opacity: ring2Opacity }]} />
          <Animated.View style={[styles.ring1, { opacity: ring1Opacity }]} />

          {/* Main orb */}
          <Animated.View style={[styles.orb, { transform: [{ scale: orbScale }] }]}>
            <View style={styles.orbInner} />
          </Animated.View>
        </View>

        {/* ── Label ── */}
        <Animated.View style={[styles.labelWrap, { opacity: labelOpacity }]}>
          <Text style={styles.breathLabel}>{currentStep.label}</Text>
          <Text style={styles.breathSub}>
            {currentStep.phase === 'in'       ? '↑ expand with your lungs' :
             currentStep.phase === 'hold-in'  ? '— stay full' :
             currentStep.phase === 'out'      ? '↓ release slowly' :
                                                '— stay empty'}
          </Text>
        </Animated.View>

        {/* ── Done overlay ── */}
        {phase === 'done' && (
          <View style={styles.doneOverlay}>
            <Text style={styles.doneEmoji}>🌬️</Text>
            <Text style={styles.doneTitle}>Well done</Text>
            <Text style={styles.doneSub}>Nervous system reset</Text>
          </View>
        )}

      </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const ORB_SIZE  = 140;
const RING1_SIZE = 210;
const RING2_SIZE = 280;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── Ready ─────────────────────────────────────────────────────────────────
  readyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.xl,
  },

  readyEmoji: { fontSize: 72, lineHeight: 84 },

  readyTitle: {
    fontFamily: FONTS.display,
    fontSize:   34,
    color:      COLORS.textPrimary,
  },

  readyCard: {
    backgroundColor: COLORS.surface,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     COLORS.cardBorder,
    padding:         SPACING.xl,
    width:           '100%',
    gap:             SPACING.sm,
  },

  readyLabel: {
    fontFamily:    FONTS.mono,
    fontSize:      10,
    color:         '#4d8bff',
    letterSpacing: 1.2,
    textAlign:     'center',
  },

  readyRule: {
    fontFamily: FONTS.body,
    fontSize:   15,
    color:      COLORS.textSecondary,
    lineHeight: 22,
    textAlign:  'center',
  },

  readyTime: {
    fontFamily: FONTS.body,
    fontSize:   13,
    color:      COLORS.textMuted,
  },

  startButton: {
    backgroundColor: '#4d8bff',
    borderRadius:    RADIUS.md,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xxxl,
  },

  startButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize:   17,
    color:      '#ffffff',
  },

  // ── Breathing ─────────────────────────────────────────────────────────────
  breathContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },

  cycleRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },

  cycleDot: {
    width:        12,
    height:       12,
    borderRadius: 6,
    backgroundColor: COLORS.surface,
    borderWidth:  1,
    borderColor:  COLORS.cardBorder,
  },

  cycleDotDone: {
    backgroundColor: '#4d8bff',
    borderColor:     '#4d8bff',
  },

  cycleDotActive: {
    borderColor: '#4d8bff',
  },

  orbContainer: {
    width:          RING2_SIZE,
    height:         RING2_SIZE,
    alignItems:     'center',
    justifyContent: 'center',
  },

  ring2: {
    position:        'absolute',
    width:           RING2_SIZE,
    height:          RING2_SIZE,
    borderRadius:    RING2_SIZE / 2,
    backgroundColor: '#4d8bff',
  },

  ring1: {
    position:        'absolute',
    width:           RING1_SIZE,
    height:          RING1_SIZE,
    borderRadius:    RING1_SIZE / 2,
    backgroundColor: '#4d8bff',
  },

  orb: {
    width:           ORB_SIZE,
    height:          ORB_SIZE,
    borderRadius:    ORB_SIZE / 2,
    backgroundColor: '#4d8bff',
    alignItems:      'center',
    justifyContent:  'center',
  },

  orbInner: {
    width:           ORB_SIZE * 0.55,
    height:          ORB_SIZE * 0.55,
    borderRadius:    ORB_SIZE * 0.55 / 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },

  labelWrap: {
    alignItems: 'center',
    gap: SPACING.sm,
  },

  breathLabel: {
    fontFamily: FONTS.display,
    fontSize:   28,
    color:      COLORS.textPrimary,
    textAlign:  'center',
  },

  breathSub: {
    fontFamily: FONTS.body,
    fontSize:   13,
    color:      COLORS.textMuted,
    textAlign:  'center',
  },

  // ── Done overlay ──────────────────────────────────────────────────────────
  doneOverlay: {
    position:        'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(13,12,20,0.88)',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             SPACING.md,
  },

  doneEmoji: { fontSize: 56, lineHeight: 68 },

  doneTitle: {
    fontFamily: FONTS.display,
    fontSize:   34,
    color:      COLORS.textPrimary,
  },

  doneSub: {
    fontFamily: FONTS.body,
    fontSize:   16,
    color:      COLORS.textMuted,
  },
});
