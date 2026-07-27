// ═══════════════════════════════════════════════════════════════════════════
//  POST-GAME DECISION SCREEN
//  ─────────────────────────
//  Shown immediately after the user completes a game inside the Gate Trigger.
//  The user makes one of two choices:
//
//    WALK AWAY  — keeps the streak, banks the points, goes back to life
//    UNLOCK     — 5-second countdown friction, then timed access (5 / 10 / 20 min)
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
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useUserStore } from '@/stores/useUserStore';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
import { useAppBlocker } from '@/hooks/useAppBlocker';
import { AdBanner } from '@/components/ads/AdBanner';
import { AdRewarded } from '@/components/ads/AdRewarded';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

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


// XP earned = half of points earned, rounded up
const pointsToXP = (pts: number) => Math.round(pts * 0.5);

// ─── Main component ────────────────────────────────────────────────────────────

export default function PostGameScreen() {
  // ── Route params ───────────────────────────────────────────────────────────
  // isBricked = '1' means BRICKED (Hard Mode) is active — unlock button is hidden
  const {
    pointsEarned: rawPoints = '0',
    gameName = 'Mini-Game',
    domain = '',
    isBricked: brickedParam = '0',
  } = useLocalSearchParams<{ pointsEarned: string; gameName: string; domain: string; isBricked: string }>();

  // Format domain for display — "instagram.com" or "Instagram" depending on what was blocked
  const domainDisplay = domain || 'this site';

  const pointsEarned = parseInt(rawPoints, 10);
  const xpEarned     = pointsToXP(pointsEarned);

  // Whether BRICKED mode is active (passed from gate.tsx as a route param)
  const isBrickedMode = brickedParam === '1';

  // ── Store ──────────────────────────────────────────────────────────────────
  const {
    streak,
    level,
    walkAwayCount,
    addPoints,
    addXP,
    incrementStreak,
    recordGamePlayed,
    streakRestoresLeft,
    useStreakRestore,
    incrementWalkAway,
    intentionGoal,
    logTrigger,
    notifyPartner,
  } = useUserStore();
  const { isPro } = useSubscriptionStore();
  // Hook to tell the Android native module about the 10-min unlock
  const { unlockTemporarily } = useAppBlocker();

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

  // ── Walk-away celebration ──────────────────────────────────────────────────
  const [celebrating, setCelebrating] = useState(false);
  const [celebrationCount, setCelebrationCount] = useState(0);

  // ── Unlock countdown — replaces token-based friction ──────────────────────
  // Free users must wait 10s before the unlock button becomes active.
  // null = not started, N = counting down, 0 = ready to confirm.
  const [unlockCountdown, setUnlockCountdown] = useState<number | null>(null);
  const [bonusEarned, setBonusEarned] = useState(false);
  const [bonusPoints] = useState(50);
  const [selectedTrigger, setSelectedTrigger] = useState<string | null>(null);
  const [unlockMinutes, setUnlockMinutes] = useState<5 | 10 | 20>(20);

  useEffect(() => {
    if (unlockCountdown === null || unlockCountdown === 0) return;
    const t = setTimeout(() => setUnlockCountdown(c => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [unlockCountdown]);

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

  // Pro perk: 1 streak restore per month.
  const canRestoreStreak = isPro && streakRestoresLeft > 0;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleWalkAway = () => {
    const newCount = walkAwayCount + 1;
    setCelebrationCount(newCount);
    incrementStreak();
    if (selectedTrigger) logTrigger(selectedTrigger);
    incrementWalkAway();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCelebrating(true);
    setTimeout(() => router.dismissAll(), 1800);
  };

  const handleUnlock = () => {
    if (domain) unlockTemporarily(domain, unlockMinutes);
    notifyPartner(domainDisplay, 'unlock');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.dismissAll();
  };

  // Pro-only: unlock AND save the streak using a monthly restore token
  const handleUnlockWithRestore = () => {
    if (!canRestoreStreak) return;
    const restored = useStreakRestore();
    if (restored) {
      incrementStreak();
      if (domain) unlockTemporarily(domain, unlockMinutes);
      notifyPartner(domainDisplay, 'unlock');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.dismissAll();
    }
  };

  const startUnlockCountdown = () => {
    if (isPro) {
      // Pro: no countdown needed, just confirm
      setUnlockCountdown(0);
    } else {
      setUnlockCountdown(5);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════════════════

  // ── Walk-away celebration screen ──────────────────────────────────────────
  if (celebrating) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.celebrationContainer}>
          <Text style={styles.celebrationNumber}>{celebrationCount}</Text>
          <Text style={styles.celebrationLabel}>
            walk-away{celebrationCount === 1 ? '' : 's'}
          </Text>
          <Text style={styles.celebrationSub}>You made it.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Completion header ── */}
        <View style={styles.header}>
          <Text style={styles.completeEmoji}>
            {pointsEarned >= 80 ? '🏆' : pointsEarned >= 50 ? '⭐' : '✅'}
          </Text>
          <Text style={styles.completeLabel}>WELL PLAYED</Text>
          <Text style={styles.gameNameText}>{gameName}</Text>
          <Text style={styles.praiseText}>
            {pointsEarned >= 80
              ? 'Crushing it. That craving never stood a chance.'
              : pointsEarned >= 50
              ? 'Solid. You showed up for yourself.'
              : 'Every rep rewires the brain. Keep going.'}
          </Text>
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
          {/* "pause tokens" — renamed from "points" to reinforce the philosophy:
              this isn't a game economy, it's a friction buffer */}
          <Text style={styles.scoreUnit}>pause tokens</Text>

          <View style={styles.xpChip}>
            <Feather name="zap" size={13} color={COLORS.purple} />
            <Text style={styles.xpChipText}>
              +{xpEarned} XP  ·  {level}
            </Text>
          </View>
        </Animated.View>

        {/* ── Streak callout ── */}
        {streak > 0 && (
          <View style={styles.streakCallout}>
            <Text style={styles.streakCalloutEmoji}>🔥</Text>
            <View style={styles.streakCalloutText}>
              <Text style={styles.streakCalloutTitle}>
                {streak}-day streak
              </Text>
              <Text style={styles.streakCalloutSub}>
                {streak >= 30
                  ? 'Legendary. You\'re in the top 1%.'
                  : streak >= 14
                  ? 'Two weeks strong. This is a real habit now.'
                  : streak >= 7
                  ? 'One week in. The hardest part is behind you.'
                  : 'Building momentum — walk away to keep it.'}
              </Text>
            </View>
          </View>
        )}

        {/* ── Intention reminder — shown if user set a goal during onboarding ── */}
        {/* A gentle, non-preachy reminder of what they're protecting time for */}
        {intentionGoal ? (
          <View style={styles.intentionReminder}>
            <Text style={styles.intentionText}>
              You wanted more time for{' '}
              <Text style={styles.intentionGoal}>{intentionGoal}</Text>
            </Text>
          </View>
        ) : null}


        {/* ── Trigger tag — "what pulled you in?" ── */}
        {/* Optional one-tap label; logged only if user walks away */}
        <View style={styles.triggerRow}>
          <Text style={[styles.triggerLabel, { color: COLORS.textMuted }]}>What pulled you in?</Text>
          <View style={styles.triggerPills}>
            {[
              { id: 'bored',         emoji: '😴', label: 'Bored' },
              { id: 'stressed',      emoji: '😰', label: 'Stressed' },
              { id: 'habit',         emoji: '📱', label: 'Habit' },
              { id: 'fomo',          emoji: '😱', label: 'FOMO' },
            ].map((t) => {
              const active = selectedTrigger === t.id;
              return (
                <Pressable
                  key={t.id}
                  style={[
                    styles.triggerPill,
                    {
                      backgroundColor: active ? COLORS.indigoBright + '22' : COLORS.surface,
                      borderColor: active ? COLORS.indigoBright : COLORS.cardBorder,
                    },
                  ]}
                  onPress={() => {
                    setSelectedTrigger(active ? null : t.id);
                    Haptics.selectionAsync();
                  }}
                >
                  <Text style={styles.triggerPillEmoji}>{t.emoji}</Text>
                  <Text style={[styles.triggerPillText, { color: active ? COLORS.indigoBright : COLORS.textSecondary }]}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── Decision buttons ── */}
        <View style={styles.decisions}>

          {/* WALK AWAY — the dominant action */}
          <Pressable style={styles.walkAwayButton} onPress={handleWalkAway}>
            <Text style={styles.walkAwayTitle}>Walk Away</Text>
            <Feather name="arrow-right-circle" size={30} color={COLORS.textPrimary} />
          </Pressable>

          {/* BRICKED: locked out message */}
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
            /* ── Unlock — subtle text link with countdown friction ── */
            <View style={styles.unlockWrapper}>
              {unlockCountdown === null && (
                <Pressable style={styles.unlockLink} onPress={startUnlockCountdown}>
                  <Text style={styles.unlockLinkText}>
                    I still need to open it
                  </Text>
                </Pressable>
              )}

              {unlockCountdown !== null && unlockCountdown > 0 && (
                <View style={styles.unlockCountdownBox}>
                  <Text style={styles.unlockCountdownText}>
                    Opening in {unlockCountdown}s...
                  </Text>
                  <View style={styles.unlockCountdownTrack}>
                    <View
                      style={[
                        styles.unlockCountdownFill,
                        { width: `${((5 - unlockCountdown) / 5) * 100}%` },
                      ]}
                    />
                  </View>
                </View>
              )}

              {unlockCountdown === 0 && (
                <View style={styles.unlockConfirmBox}>
                  {/* Duration picker */}
                  <View style={styles.durationPicker}>
                    {([5, 10, 20] as const).map((m) => (
                      <Pressable
                        key={m}
                        style={[
                          styles.durationChip,
                          {
                            backgroundColor: unlockMinutes === m ? COLORS.surface : 'transparent',
                            borderColor: unlockMinutes === m ? COLORS.cardBorder : 'transparent',
                          },
                        ]}
                        onPress={() => { setUnlockMinutes(m); Haptics.selectionAsync(); }}
                      >
                        <Text style={[styles.durationChipText, { color: unlockMinutes === m ? COLORS.textPrimary : COLORS.textMuted }]}>
                          {m}m
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Pressable style={styles.unlockConfirmButton} onPress={handleUnlock}>
                    <Text style={styles.unlockConfirmText}>
                      Open {domainDisplay} — {unlockMinutes} min
                    </Text>
                  </Pressable>
                  {isPro && canRestoreStreak && (
                    <Pressable style={styles.streakRestoreButton} onPress={handleUnlockWithRestore}>
                      <Feather name="check-circle" size={15} color={COLORS.purple} />
                      <Text style={styles.streakRestoreText}>
                        Use Streak Restore — keep your {streak}-day streak
                      </Text>
                      <Text style={styles.streakRestoreCount}>
                        {streakRestoresLeft} left
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          )}
        </View>

        {/* ── Rewarded ad — optional bonus points for watching a 30s ad ── */}
        {/* Only shown to free users who haven't already claimed the bonus this session */}
        {!bonusEarned && (
          <AdRewarded
            bonusPoints={bonusPoints}
            onRewarded={() => {
              addPoints(bonusPoints);
              setBonusEarned(true);
            }}
          />
        )}
        {bonusEarned && (
          <View style={styles.bonusConfirm}>
            <Feather name="check-circle" size={14} color={COLORS.green} />
            <Text style={styles.bonusConfirmText}>+{bonusPoints} bonus points earned</Text>
          </View>
        )}

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

        {/* ── Ad banner ── */}
        <AdBanner size="largeBanner" />

        {/* ── Personal proof — real data, not a fake aggregate ── */}
        {walkAwayCount > 0 && (
          <View style={styles.socialProof}>
            <View style={styles.proofBarRow}>
              <View style={styles.proofBarTrack}>
                <View
                  style={[
                    styles.proofBarFill,
                    { width: `${Math.min((walkAwayCount / Math.max(walkAwayCount + 1, 10)) * 100, 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.proofPercent}>{walkAwayCount}×</Text>
            </View>
            <Text style={styles.proofStatement}>
              You've walked away {walkAwayCount} time{walkAwayCount === 1 ? '' : 's'} total.{'\n'}
              {walkAwayCount >= 10
                ? 'That\'s real discipline.'
                : walkAwayCount >= 5
                ? 'You\'re building a real pattern.'
                : 'Every walk-away rewires the habit.'}
            </Text>
          </View>
        )}

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
  completeEmoji: {
    fontSize: 48,
    marginBottom: SPACING.xs,
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
  praiseText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
    lineHeight: 20,
  },

  // ── Streak callout ──
  streakCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.warning + '12',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.warning + '33',
    padding: SPACING.md,
  },
  streakCalloutEmoji: { fontSize: 28 },
  streakCalloutText: { flex: 1, gap: 2 },
  streakCalloutTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    color: COLORS.warning,
  },
  streakCalloutSub: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
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

  // ── Intention reminder ──
  // Subtle card that shows what the user said they want more time for
  intentionReminder: {
    backgroundColor: COLORS.indigoDim,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.indigoBright + '33',
    padding: SPACING.md,
    alignItems: 'center',
  },
  intentionText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  intentionGoal: {
    fontFamily: FONTS.bodyBold,
    color: COLORS.indigoBright,
  },

  // ── Walk-away celebration screen ──
  celebrationContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  celebrationNumber: {
    fontFamily: FONTS.monoBold,
    fontSize: 96,
    color: COLORS.green,
    lineHeight: 104,
  },
  celebrationLabel: {
    fontFamily: FONTS.body,
    fontSize: 18,
    color: COLORS.textSecondary,
    letterSpacing: 0.2,
  },
  celebrationSub: {
    fontFamily: FONTS.displayRegular,
    fontSize: 28,
    color: COLORS.textPrimary,
    marginTop: SPACING.sm,
    letterSpacing: 0.3,
  },

  decisions: {
    gap: SPACING.sm,
  },
  walkAwayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.indigo,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.xl,
  },
  walkAwayTitle: {
    fontFamily: FONTS.display,
    fontSize: 28,
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  unlockWrapper: {
    alignItems: 'center',
    gap: SPACING.sm,
  },
  unlockLink: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  unlockLinkText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
    textDecorationLine: 'underline',
  },
  unlockCountdownBox: {
    width: '100%',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  unlockCountdownText: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  unlockCountdownTrack: {
    width: '60%',
    height: 3,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  unlockCountdownFill: {
    height: '100%',
    backgroundColor: COLORS.textMuted,
    borderRadius: RADIUS.full,
  },
  unlockConfirmBox: {
    width: '100%',
    gap: SPACING.sm,
  },
  unlockConfirmButton: {
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  unlockConfirmText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
    color: COLORS.textSecondary,
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

  // ── Rewarded ad confirmation ──
  bonusConfirm: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
  },
  bonusConfirmText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.green,
  },

  // ── Trigger tag row ────────────────────────────────────────────────────────
  triggerRow: {
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  triggerLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  triggerPills: {
    flexDirection: 'row',
    gap: SPACING.xs,
    justifyContent: 'center',
  },
  triggerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  triggerPillEmoji: {
    fontSize: 14,
  },
  triggerPillText: {
    fontFamily: FONTS.body,
    fontSize: 12,
  },

  // ── Duration picker ────────────────────────────────────────────────────────
  durationPicker: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  durationChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  durationChipText: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    letterSpacing: 0.3,
  },
});
