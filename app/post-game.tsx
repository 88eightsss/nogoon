// ═══════════════════════════════════════════════════════════════════════════
//  POST-GAME DECISION SCREEN
//  ─────────────────────────
//  Shown immediately after the user completes a game inside the Gate Trigger.
//  The user makes one of two choices:
//
//    WALK AWAY  — keeps the streak, banks the points, goes back to life
//    UNLOCK     — spends 200 points, resets the streak, access for 10 min
//
//  Route params (strings, because URL params are always strings):
//    pointsEarned — e.g. "85"
//    gameName     — e.g. "Stroop Challenge"
//
//  Animations use React Native's built-in Animated API (not Reanimated),
//  so this works in Expo Go without any native modules.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Animated,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useUserStore } from '@/stores/useUserStore';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
import { AdBanner } from '@/components/ads/AdBanner';
import { Card } from '@/components/ui/Card';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { TYPE } from '@/constants/Typography';

// ─── Micro-learning cards ──────────────────────────────────────────────────────

// Seven cards rooted in real behavioral science. One is chosen at random
// each time the screen appears. The goal: teach while the user is receptive.
const MICRO_CARDS = [
  {
    emoji: '⏱️',
    title: 'The 90-Second Rule',
    body: 'A physiological craving lasts about 90 seconds in your body. If you ride it out without acting, the wave breaks on its own.',
    source: 'Dr. Jill Bolte Taylor — My Stroke of Insight',
    accent: COLORS.cyan,
  },
  {
    emoji: '📉',
    title: 'Dopamine Reset',
    body: "Every time you resist an urge, you're lowering the spike and raising your baseline. The things you used to need more of start to feel like enough.",
    source: 'Dr. Anna Lembke — Dopamine Nation',
    accent: COLORS.purple,
  },
  {
    emoji: '⚡',
    title: 'Pattern Interruption',
    body: 'Playing a cognitively demanding game right after a trigger physically reroutes the neural pathway before the habitual behavior can fire.',
    source: 'Cognitive Behavioral Neuroscience',
    accent: COLORS.green,
  },
  {
    emoji: '🎰',
    title: 'Variable Reward Loop',
    body: 'Social media uses unpredictable rewards — the same mechanism as slot machines — to keep dopamine elevated and attention locked in.',
    source: 'B.J. Fogg — Persuasive Technology',
    accent: COLORS.warning,
  },
  {
    emoji: '⌚',
    title: 'The 10-Minute Rule',
    body: 'Waiting just 10 minutes before acting on a craving reduces its felt intensity by up to 40% in most people. Time is a disruptor.',
    source: 'Behavioral Psychology Research',
    accent: COLORS.cyan,
  },
  {
    emoji: '🏄',
    title: 'Urge Surfing',
    body: 'Rather than fighting a craving, observe it like a wave. Notice where you feel it in your body. It rises, peaks, and passes — without you doing anything.',
    source: 'Acceptance & Commitment Therapy (ACT)',
    accent: COLORS.purple,
  },
  {
    emoji: '🔄',
    title: 'Habit Stacking',
    body: "Habits have three parts: cue \u2192 routine \u2192 reward. You kept the cue and reward. You just swapped the routine for a game. That's exactly how new habits form.",
    source: 'Charles Duhigg — The Power of Habit',
    accent: COLORS.green,
  },
] as const;

// The percentage of users who walk away vs unlock
const SOCIAL_PROOF_PERCENT = 93;

// XP earned = half of points earned, rounded up
const pointsToXP = (pts: number) => Math.round(pts * 0.5);

// ─── Main component ────────────────────────────────────────────────────────────

export default function PostGameScreen() {
  // ── Route params ───────────────────────────────────────────────────────────
  // isBricked = '1' means BRICKED (Hard Mode) is active — unlock button is hidden
  const {
    pointsEarned: rawPoints = '0',
    gameName = 'Mini-Game',
    isBricked: brickedParam = '0',
  } = useLocalSearchParams<{ pointsEarned: string; gameName: string; isBricked: string }>();

  const pointsEarned = parseInt(rawPoints, 10);
  const xpEarned     = pointsToXP(pointsEarned);

  // Whether BRICKED mode is active (passed from gate.tsx as a route param)
  const isBrickedMode = brickedParam === '1';

  // ── Store ──────────────────────────────────────────────────────────────────
  const {
    points,
    streak,
    level,
    addPoints,
    addXP,
    incrementStreak,
    resetStreak,
    spendPoints,
    recordGamePlayed,
    streakRestoresLeft,
    useStreakRestore,
  } = useUserStore();
  const { isPro } = useSubscriptionStore();

  // ── Award points on mount (once only) ─────────────────────────────────────
  // The ref prevents this from running twice on strict-mode double renders.
  const awardedRef = useRef(false);
  useEffect(() => {
    if (awardedRef.current) return;
    awardedRef.current = true;
    addPoints(pointsEarned);
    addXP(xpEarned);
    // Pass the score and a simplified game ID so it's stored in Supabase game_sessions
    // and can power the weekly chart on the home screen
    recordGamePlayed(pointsEarned, gameName.toLowerCase().replace(/\s+/g, '_'));
  }, [addPoints, addXP, recordGamePlayed, pointsEarned, xpEarned, gameName]);

  // ── Random micro-learning card — chosen once per session ──────────────────
  const [card] = useState(
    () => MICRO_CARDS[Math.floor(Math.random() * MICRO_CARDS.length)]
  );

  // ── Score count-up animation ───────────────────────────────────────────────
  // Counts from 0 → pointsEarned over 1.2 seconds using plain JS setState.
  const [displayScore, setDisplayScore] = useState(0);
  useEffect(() => {
    const steps        = 30;
    const stepDuration = 1200 / steps;
    const increment    = pointsEarned / steps;
    let current        = 0;

    const interval = setInterval(() => {
      current += increment;
      if (current >= pointsEarned) {
        setDisplayScore(pointsEarned);
        clearInterval(interval);
      } else {
        setDisplayScore(Math.round(current));
      }
    }, stepDuration);

    return () => clearInterval(interval);
  }, [pointsEarned]);

  // ── Score card pop-in ──────────────────────────────────────────────────────
  // The card scales up from 0.7 and fades in when the screen first appears.
  const scoreScale   = useRef(new Animated.Value(0.7)).current;
  const scoreOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scoreScale, {
        toValue: 1,
        damping: 12,
        stiffness: 180,
        useNativeDriver: true,
      }),
      Animated.timing(scoreOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scoreScale, scoreOpacity]);

  // ── Can the user afford to unlock? ────────────────────────────────────────
  // Pro users unlock free. Free users need 200 pts.
  // If BRICKED mode is on, the unlock section is hidden entirely — no escape.
  const UNLOCK_COST = isPro ? 0 : 200;
  const canUnlock   = isPro || points >= UNLOCK_COST;

  // Pro perk: 1 streak restore per month. User can use it here instead of
  // resetting their streak when they choose to unlock.
  const canRestoreStreak = isPro && streakRestoresLeft > 0;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleWalkAway = () => {
    incrementStreak();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.dismissAll();
  };

  const handleUnlock = () => {
    if (!canUnlock) return;
    if (isPro) {
      // Pro users unlock free — no streak reset, no point deduction
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      router.dismissAll();
    } else {
      const success = spendPoints(UNLOCK_COST);
      if (success) {
        resetStreak();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        router.dismissAll();
      }
    }
  };

  // Pro-only: unlock AND save the streak using a monthly restore token
  const handleUnlockWithRestore = () => {
    if (!canRestoreStreak) return;
    const restored = useStreakRestore(); // returns false if 0 left
    if (restored) {
      // Streak is preserved — incrementStreak keeps it going
      incrementStreak();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.dismissAll();
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Large rectangle ad — post-game is the highest-attention moment.
             Users just completed something → high engagement = high ad value.
             This single placement typically earns 2–3× more than a home banner. ── */}
        <AdBanner size="largeBanner" />

        {/* ── Completion header ── */}
        <View style={styles.header}>
          <Text style={styles.completeLabel}>CHALLENGE COMPLETE</Text>
          <Text style={styles.gameNameText}>{gameName}</Text>
        </View>

        {/* ── Score display — pops in and counts up ── */}
        <Animated.View
          style={[
            styles.scoreCard,
            {
              opacity: scoreOpacity,
              transform: [{ scale: scoreScale }],
            },
          ]}
        >
          <Text style={styles.scorePrefix}>+</Text>
          <Text style={styles.scoreNumber}>{displayScore}</Text>
          <Text style={styles.scoreUnit}>points earned</Text>

          <View style={styles.xpChip}>
            <Ionicons name="flash" size={13} color={COLORS.purple} />
            <Text style={styles.xpChipText}>
              +{xpEarned} XP  ·  {level}
            </Text>
          </View>
        </Animated.View>

        {/* ── Micro-learning card ── */}
        <View style={[styles.microCard, { borderLeftColor: card.accent }]}>
          <View style={styles.microCardHeader}>
            <Text style={styles.microEmoji}>{card.emoji}</Text>
            <Text style={[styles.microTitle, { color: card.accent }]}>
              {card.title}
            </Text>
          </View>
          <Text style={styles.microBody}>{card.body}</Text>
          <Text style={styles.microSource}>— {card.source}</Text>
        </View>

        {/* ── Decision buttons ── */}
        <View style={styles.decisions}>

          {/* WALK AWAY — always the recommended, prominent action */}
          <Pressable style={styles.walkAwayButton} onPress={handleWalkAway}>
            <View style={styles.walkAwayInner}>
              <Text style={styles.walkAwayTitle}>Walk Away</Text>
              <Text style={styles.walkAwayStreak}>
                Keep Your {streak}-Day Streak 🔥
              </Text>
            </View>
            <Ionicons name="arrow-forward-circle" size={28} color={COLORS.background} />
          </Pressable>

          {/* ── BRICKED MODE: replace unlock section with a locked-out message ── */}
          {/* When BRICKED is active the user turned off their own escape hatch.
              We honour that commitment by hiding the unlock button entirely. */}
          {isBrickedMode ? (
            <View style={styles.brickedLockout}>
              <Text style={styles.brickedLockEmoji}>🧱</Text>
              <View style={styles.brickedLockText}>
                <Text style={styles.brickedLockTitle}>BRICKED Mode Active</Text>
                <Text style={styles.brickedLockSub}>
                  You disabled unlocking. Well done — walk away.
                </Text>
              </View>
            </View>
          ) : (
            /* ── Normal unlock section ── */
            <View style={styles.unlockWrapper}>
              <Pressable
                style={[
                  styles.unlockButton,
                  !canUnlock && styles.unlockButtonDisabled,
                ]}
                onPress={handleUnlock}
                disabled={!canUnlock}
              >
                <View style={styles.unlockInner}>
                  <Text
                    style={[
                      styles.unlockTitle,
                      !canUnlock && styles.unlockTitleDisabled,
                    ]}
                  >
                    {isPro ? 'Unlock (Pro — Free)' : `Unlock for ${UNLOCK_COST} points`}
                  </Text>
                  <Text style={styles.unlockBalance}>
                    {isPro
                      ? 'No streak reset · Pro perk'
                      : canUnlock
                        ? `Your balance: ${points.toLocaleString()} pts`
                        : `Need ${UNLOCK_COST - points} more points`}
                  </Text>
                </View>
                <Ionicons
                  name="lock-open-outline"
                  size={20}
                  color={canUnlock ? COLORS.textMuted : COLORS.textMuted + '55'}
                />
              </Pressable>

              {/* Show streak warning only for free users who can unlock */}
              {!isPro && canUnlock && (
                <Text style={styles.unlockWarning}>
                  Resets your streak · Access for 10 minutes
                </Text>
              )}

              {/* Pro streak protection — use monthly restore token to keep streak intact */}
              {isPro && canUnlock && canRestoreStreak && (
                <Pressable
                  style={styles.streakRestoreButton}
                  onPress={handleUnlockWithRestore}
                >
                  <Ionicons name="shield-checkmark" size={15} color={COLORS.purple} />
                  <Text style={styles.streakRestoreText}>
                    Use Streak Restore — keep your {streak}-day streak
                  </Text>
                  <Text style={styles.streakRestoreCount}>
                    {streakRestoresLeft} left this month
                  </Text>
                </Pressable>
              )}

              {/* Show upgrade prompt when user can't afford to unlock */}
              {!isPro && !canUnlock && (
                <Pressable
                  style={styles.upgradeHint}
                  onPress={() => router.push('/paywall')}
                >
                  <Ionicons name="flash" size={13} color={COLORS.purple} />
                  <Text style={styles.upgradeHintText}>
                    Get Pro — unlock free, anytime →
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        {/* ── Social proof ── */}
        <View style={styles.socialProof}>
          <View style={styles.proofBarRow}>
            <View style={styles.proofBarTrack}>
              <View
                style={[
                  styles.proofBarFill,
                  { width: `${SOCIAL_PROOF_PERCENT}%` },
                ]}
              />
            </View>
            <Text style={styles.proofPercent}>{SOCIAL_PROOF_PERCENT}%</Text>
          </View>
          <Text style={styles.proofStatement}>
            of NoGoon users who play one game{'\n'}choose to walk away
          </Text>
        </View>

        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xxl,
    gap: SPACING.lg,
  },

  header: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  completeLabel: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.green,
    letterSpacing: 2.5,
  },
  gameNameText: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textSecondary,
  },

  scoreCard: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.green + '33',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.xs,
  },
  scorePrefix: {
    fontFamily: FONTS.monoBold,
    fontSize: 32,
    color: COLORS.green,
    marginBottom: -16,
  },
  scoreNumber: {
    fontFamily: FONTS.monoBold,
    fontSize: 88,
    color: COLORS.green,
    lineHeight: 96,
  },
  scoreUnit: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  xpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.purpleDim,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.purple + '44',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    marginTop: SPACING.sm,
  },
  xpChipText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.purple,
  },

  microCard: {
    backgroundColor: COLORS.surfaceHigh,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderLeftWidth: 4,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  microCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  microEmoji: {
    fontSize: 22,
  },
  microTitle: {
    fontFamily: FONTS.display,
    fontSize: 18,
    letterSpacing: -0.2,
  },
  microBody: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 23,
  },
  microSource: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },

  decisions: {
    gap: SPACING.sm,
  },
  walkAwayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.green,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },
  walkAwayInner: {
    flex: 1,
  },
  walkAwayTitle: {
    fontFamily: FONTS.display,
    fontSize: 22,
    color: COLORS.background,
    letterSpacing: -0.3,
  },
  walkAwayStreak: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.background + 'cc',
    marginTop: 2,
  },
  unlockWrapper: {
    gap: SPACING.xs,
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },
  unlockButtonDisabled: {
    opacity: 0.45,
  },
  unlockInner: {
    flex: 1,
  },
  unlockTitle: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  unlockTitleDisabled: {
    color: COLORS.textMuted,
  },
  unlockBalance: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  unlockWarning: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.danger + 'aa',
    textAlign: 'center',
  },
  upgradeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  upgradeHintText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.purple,
  },

  // ── BRICKED lockout message ──
  // Replaces the unlock section when BRICKED mode is on.
  brickedLockout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.warning + '12',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.warning + '44',
    padding: SPACING.lg,
  },
  brickedLockEmoji: { fontSize: 28 },
  brickedLockText: { flex: 1, gap: 3 },
  brickedLockTitle: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.warning,
    letterSpacing: 2,
  },
  brickedLockSub: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  // ── Streak restore button (Pro only) ──
  // Sits below the unlock button. Lets the user unlock AND keep their streak.
  streakRestoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.purpleDim,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.purple + '44',
    padding: SPACING.md,
    flexWrap: 'wrap',
  },
  streakRestoreText: {
    flex: 1,
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.purple,
  },
  streakRestoreCount: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
  },

  socialProof: {
    alignItems: 'center',
    gap: SPACING.sm,
    paddingTop: SPACING.sm,
  },
  proofBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    width: '100%',
  },
  proofBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  proofBarFill: {
    height: '100%',
    backgroundColor: COLORS.green,
    borderRadius: RADIUS.full,
  },
  proofPercent: {
    fontFamily: FONTS.monoBold,
    fontSize: 14,
    color: COLORS.green,
    width: 40,
    textAlign: 'right',
  },
  proofStatement: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
