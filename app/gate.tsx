// ═══════════════════════════════════════════════════════════════════════════
// NoGoon INTERCEPT SCREEN
// ───────────────────────
// Fires when a blocked site or app is detected.
//
// FLOW:
//   1. 'calm'   — 5-second breathing pause. Soft, no alarm energy.
//                 Shows streak or intention goal as a gentle reminder.
//   2. 'intent' — "Why are you here?" — 3 options. Treats users as adults.
//                 Habit/boredom → random game
//                 Feeling stressed → breathing game
//                 Actually need this → exit immediately (no punishment)
//   3. 'playing' — game runs, same post-game flow as before
//
// WHY THIS FLOW:
//   The old screen (shaking alert, "BLOCKED CONTENT") activates fight-or-
//   flight and adds cognitive load on top of an already impulsive moment.
//   Research (One Sec, 2023) shows a single forced pause reduces blocked-app
//   opens by up to 57%. We start with calm, then give a choice, then a game.
//
// Route params:
//   domain     — blocked site or app package name, e.g. "instagram.com"
//   confidence — detection confidence %, e.g. "97"
//   source     — 'web' (browser extension) or 'app' (Accessibility Service)
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  SafeAreaView,
  Animated,
  Easing,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { BreathRhythm }     from '@/components/games/BreathRhythm';
import { GroundingExercise } from '@/components/games/GroundingExercise';
import { OddOneOut }         from '@/components/games/OddOneOut';
import { ColorSort }         from '@/components/games/ColorSort';
import { BallSort }          from '@/components/games/BallSort';
import { NumberFlow }        from '@/components/games/NumberFlow';
import { GemMatch }          from '@/components/games/GemMatch';
import { WordWeave }         from '@/components/games/WordWeave';
import { StackGame }         from '@/components/games/StackGame';
import { PatternMemory }     from '@/components/games/PatternMemory';
import { WarpGame }          from '@/components/games/WarpGame';
import { IntentionCheck }    from '@/components/games/IntentionCheck';
import { TypingChallenge }   from '@/components/games/TypingChallenge';
import { PACKAGE_TO_NAME } from '@/hooks/useAppBlocker';
import { useUserStore } from '@/stores/useUserStore';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
import { getColors, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { STANDARD_GAMES, PRO_GAMES, pickRandomGame, getGameById, type GameId } from '@/constants/games';

// ─── Intent options ────────────────────────────────────────────────────────────

type IntentOption = {
  id: 'habit' | 'stress' | 'need';
  label: string;
  sublabel: string;
  emoji: string;
  action: 'random-game' | 'breathing' | 'exit';
};

const INTENT_OPTIONS: IntentOption[] = [
  {
    id: 'habit',
    label: 'Habit or boredom',
    sublabel: "You don't really need it right now",
    emoji: '👀',
    action: 'random-game',
  },
  {
    id: 'stress',
    label: 'Feeling stressed',
    sublabel: "Something's got you on edge",
    emoji: '😮‍💨',
    action: 'breathing',
  },
  {
    id: 'need',
    label: 'I actually need this',
    sublabel: 'Legitimate reason — go ahead',
    emoji: '✓',
    action: 'exit',
  },
];

// ─── Main component ────────────────────────────────────────────────────────────

type Phase = 'calm' | 'intent' | 'pick' | 'playing';

export default function NoGoonScreen() {
  const {
    domain = 'instagram.com',
    confidence = '97',
    source = 'web',
  } = useLocalSearchParams<{
    domain: string;
    confidence: string;
    source: string;
  }>();

  const { isBricked, gameDuration, streak, walkAwayCount, intentionGoal, colorScheme, gameMode } =
    useUserStore();
  const { isPro } = useSubscriptionStore();

  const C = getColors(colorScheme ?? 'dark');

  const isAppBlock = source === 'app';
  const displayDomain = isAppBlock
    ? (PACKAGE_TO_NAME[domain] ?? domain)
    : domain;

  const [phase, setPhase] = useState<Phase>('calm');
  const [selectedGame, setSelectedGame] = useState<GameId | null>(null);

  // ── Calm phase — pulsing circle animation ────────────────────────────────
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.4)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in content
    Animated.timing(contentOpacity, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // Gentle pulse loop
    const doPulse = () => {
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseScale, {
            toValue: 1.12,
            duration: 2200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseScale, {
            toValue: 1,
            duration: 2200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, {
            toValue: 0.8,
            duration: 2200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.4,
            duration: 2200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => doPulse());
    };
    doPulse();

    // Soft haptic — not the jarring Warning type
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Auto-advance to intent after 5 seconds
    const timer = setTimeout(() => setPhase('intent'), 5000);
    return () => clearTimeout(timer);
  }, []);

  // ── Intent selection ──────────────────────────────────────────────────────
  const handleIntent = useCallback(
    (option: IntentOption) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (option.action === 'exit') {
        router.dismissAll();
        return;
      }

      if (option.action === 'breathing') {
        setSelectedGame('breathing');
        setPhase('playing');
        return;
      }

      // random-game — respect the gameMode setting
      if (gameMode === 'choose') {
        setPhase('pick');
      } else {
        setSelectedGame(pickRandomGame(isPro));
        setPhase('playing');
      }
    },
    [isPro]
  );

  // ── Game completion ────────────────────────────────────────────────────────
  const handleGameComplete = useCallback(
    (score: number) => {
      router.replace({
        pathname: '/post-game',
        params: {
          pointsEarned: String(score),
          gameName: selectedGame ?? 'Mini-Game',
          domain: displayDomain,
          isBricked: isBricked ? '1' : '0',
        },
      });
    },
    [selectedGame, isBricked, displayDomain]
  );

  // ── Context line shown on calm screen ────────────────────────────────────
  // Shows the user's intention goal if set, otherwise streak, otherwise nothing.
  const contextLine = intentionGoal
    ? `You wanted more time for: ${intentionGoal}`
    : streak > 1
    ? `${streak}-day streak 🔥 — don't break it now`
    : walkAwayCount > 0
    ? `You've walked away ${walkAwayCount} time${walkAwayCount === 1 ? '' : 's'} — you've got this`
    : null;

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: Playing
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === 'playing' && selectedGame) {
    if (selectedGame === 'breathing')  return <BreathRhythm    onComplete={handleGameComplete} />;
    if (selectedGame === 'grounding')  return <GroundingExercise onComplete={handleGameComplete} />;
    if (selectedGame === 'oddone')     return <OddOneOut        onComplete={handleGameComplete} />;
    if (selectedGame === 'colorsort')  return <ColorSort        onComplete={handleGameComplete} />;
    if (selectedGame === 'ballsort')   return <BallSort         onComplete={handleGameComplete} />;
    if (selectedGame === 'numberflow') return <NumberFlow       onComplete={handleGameComplete} />;
    if (selectedGame === 'gemmatch')   return <GemMatch         onComplete={handleGameComplete} />;
    if (selectedGame === 'wordweave')  return <WordWeave        onComplete={handleGameComplete} />;
    if (selectedGame === 'stack')      return <StackGame        onComplete={handleGameComplete} />;
    if (selectedGame === 'memory')     return <PatternMemory    onComplete={handleGameComplete} />;
    if (selectedGame === 'warp')       return <WarpGame         onComplete={handleGameComplete} />;
    if (selectedGame === 'intention')  return <IntentionCheck   onComplete={handleGameComplete} />;
    if (selectedGame === 'typing')     return <TypingChallenge  onComplete={handleGameComplete} duration={gameDuration} />;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: Pick — game chooser (when gameMode === 'choose')
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === 'pick') {
    const pool = isPro
      ? [...STANDARD_GAMES, ...PRO_GAMES]
      : [...STANDARD_GAMES];

    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
        <View style={[styles.intentContainer, { paddingTop: 48 }]}>
          <Text style={[styles.intentTitle, { color: C.textPrimary }]}>
            Pick a game
          </Text>
          <View style={styles.intentOptions}>
            {pool.map((g) => {
              const meta = getGameById(g.id);
              if (!meta) return null;
              return (
                <Pressable
                  key={g.id}
                  style={({ pressed }) => [
                    styles.intentCard,
                    {
                      backgroundColor: pressed ? C.surfaceHigh : C.surface,
                      borderColor: meta.color + '44',
                    },
                  ]}
                  onPress={() => {
                    setSelectedGame(g.id as GameId);
                    setPhase('playing');
                  }}
                >
                  <Text style={styles.intentEmoji}>{meta.emoji}</Text>
                  <Text style={[styles.intentCardLabel, { color: C.textPrimary }]}>
                    {meta.name}
                  </Text>
                  {'isPro' in g && (g as { isPro?: boolean }).isPro && (
                    <Text style={[styles.proTag, { color: '#7dd3fc' }]}>✦</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: Intent — "Why are you here?"
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === 'intent') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
        <Animated.View style={[styles.intentContainer, { opacity: contentOpacity }]}>

          {/* App context */}
          <View style={[styles.domainPill, { backgroundColor: C.surface, borderColor: C.cardBorder }]}>
            <Feather
              name={isAppBlock ? 'smartphone' : 'globe'}
              size={13}
              color={C.textMuted}
            />
            <Text style={[styles.domainText, { color: C.textMuted }]}>
              {displayDomain}
            </Text>
          </View>

          <Text style={[styles.intentTitle, { color: C.textPrimary }]}>
            Quick check —{'\n'}why are you here?
          </Text>

          <View style={styles.intentOptions}>
            {INTENT_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                style={({ pressed }) => [
                  styles.intentCard,
                  {
                    backgroundColor: pressed ? C.surfaceHigh : C.surface,
                    borderColor: C.cardBorder,
                  },
                ]}
                onPress={() => handleIntent(option)}
              >
                <Text style={styles.intentEmoji}>{option.emoji}</Text>
                <View style={styles.intentCardText}>
                  <Text style={[styles.intentCardLabel, { color: C.textPrimary }]}>
                    {option.label}
                  </Text>
                  <Text style={[styles.intentCardSub, { color: C.textSecondary }]}>
                    {option.sublabel}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={C.textMuted} />
              </Pressable>
            ))}
          </View>

        </Animated.View>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: Calm — initial 5-second pause
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
      <Animated.View style={[styles.calmContainer, { opacity: contentOpacity }]}>

        {/* Pulsing circle */}
        <View style={styles.circleWrapper}>
          <Animated.View
            style={[
              styles.pulseOuter,
              {
                backgroundColor: C.indigoBright + '18',
                borderColor: C.indigoBright + '30',
                transform: [{ scale: pulseScale }],
                opacity: pulseOpacity,
              },
            ]}
          />
          <View style={[styles.pulseInner, { backgroundColor: C.indigoBright + '25', borderColor: C.indigoBright + '50' }]}>
            <Feather name="wind" size={32} color={C.indigoBright} />
          </View>
        </View>

        {/* Main message */}
        <Text style={[styles.calmTitle, { color: C.textPrimary }]}>
          Slow down{'\n'}for a sec.
        </Text>

        {/* Context line — personal, not punishing */}
        {contextLine ? (
          <Text style={[styles.contextLine, { color: C.textSecondary }]}>
            {contextLine}
          </Text>
        ) : (
          <Text style={[styles.contextLine, { color: C.textMuted }]}>
            Most cravings pass in 90 seconds.
          </Text>
        )}

        {/* Hard lock banner */}
        {isBricked && (
          <View style={[styles.hardLockBanner, { backgroundColor: C.warning + '18', borderColor: C.warning + '55' }]}>
            <Feather name="lock" size={14} color={C.warning} />
            <Text style={[styles.hardLockText, { color: C.warning }]}>
              Hard lock is on — no skip option
            </Text>
          </View>
        )}

        {/* Skip for "I actually need this" */}
        {!isBricked && (
          <Pressable style={styles.skipRow} onPress={() => router.dismissAll()}>
            <Text style={[styles.skipText, { color: C.textMuted }]}>
              I actually need this right now
            </Text>
          </Pressable>
        )}

        {/* Subtle progress — 5 dots fill over 5 seconds */}
        <ProgressDots color={C.indigoBright} />

      </Animated.View>
    </SafeAreaView>
  );
}

// ─── Progress dots — 5 fill one per second ────────────────────────────────────

function ProgressDots({ color }: { color: string }) {
  const [filled, setFilled] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFilled((prev) => Math.min(prev + 1, 5));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: 5 }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.progressDot,
            { backgroundColor: i < filled ? color : color + '30' },
          ]}
        />
      ))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },

  // ── Calm screen ──────────────────────────────────────────────────────────
  calmContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.xl,
  },

  circleWrapper: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },

  pulseOuter: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1.5,
  },

  pulseInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  calmTitle: {
    fontFamily: FONTS.display,
    fontSize: 40,
    textAlign: 'center',
    lineHeight: 48,
    letterSpacing: -0.5,
  },

  contextLine: {
    fontFamily: FONTS.body,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: SPACING.lg,
  },

  hardLockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },

  hardLockText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
  },

  skipRow: {
    paddingVertical: SPACING.sm,
  },

  skipText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    textDecorationLine: 'underline',
  },

  dotsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },

  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // ── Intent screen ─────────────────────────────────────────────────────────
  intentContainer: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xxxl,
    gap: SPACING.xl,
  },

  domainPill: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },

  domainText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
  },

  intentTitle: {
    fontFamily: FONTS.display,
    fontSize: 34,
    lineHeight: 42,
    letterSpacing: -0.3,
  },

  intentOptions: {
    gap: SPACING.sm,
  },

  intentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.lg,
  },

  intentEmoji: {
    fontSize: 28,
    width: 36,
    textAlign: 'center',
  },

  intentCardText: {
    flex: 1,
    gap: 2,
  },

  intentCardLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    flex: 1,
  },

  proTag: {
    fontFamily: FONTS.mono,
    fontSize: 13,
  },

  intentCardSub: {
    fontFamily: FONTS.body,
    fontSize: 13,
    lineHeight: 18,
  },
});
