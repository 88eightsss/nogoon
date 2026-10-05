// ─── The Waiting Room ─────────────────────────────────────────────────────────
//
// A 5-second psychological speed bump between "I want to unlock" and "unlocked."
//
// What it does:
//   Every time a user tries to unlock a blocked app, they land here first.
//   The screen pretends to be loading for 5 seconds while displaying one
//   hard truth about the app they're trying to open. Then it routes to post-game.
//
// Why this works:
//   Behavioral research shows that inserting any deliberate pause between
//   impulse and action significantly reduces follow-through on compulsive urges.
//   5 seconds is long enough to break the automaticity, short enough that
//   users don't feel punished. The content makes the pause feel meaningful
//   rather than arbitrary.
//
// Usage:
//   From gate.tsx, instead of routing to /post-game directly,
//   route to /waiting-room?app=com.instagram.android
//   The waiting room then routes to /post-game after the countdown.

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useUserStore } from '@/stores/useUserStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FONTS } from '@/constants/Colors';
import { useThemedColors, type ArcadeColors } from '@/hooks/useThemedColors';
import { SPACING, RADIUS } from '@/constants/Spacing';

// ─── Truth Pool ───────────────────────────────────────────────────────────────
// One truth shown per waiting room visit, rotated randomly.
// Keep these grounded, not preachy.

const TRUTHS = [
  {
    stat: 'No end',
    context: 'Feeds are built so nothing ever finishes. There is no last page, so you have to be the one to stop.',
    reflection: "Stopping is a skill. You're practicing it.",
  },
  {
    stat: 'Designed',
    context: 'Apps are tested and tuned to keep you scrolling a little longer than you meant to.',
    reflection: "They're good at it. You can be better at noticing.",
  },
  {
    stat: 'Autopilot',
    context: 'Most opens happen before you decide to open them. Thumb, icon, scroll.',
    reflection: 'This pause is you deciding.',
  },
  {
    stat: 'It passes',
    context: 'An urge rises, peaks, and fades, usually within minutes, whether or not you act on it.',
    reflection: 'You only have to outlast the wave.',
  },
  {
    stat: 'Dopamine',
    context: "Unpredictable rewards, like a surprise like or a fresh post, are the same pattern slot machines use to hold attention.",
    reflection: 'Your phone can feel like a casino in your pocket.',
  },
  {
    stat: 'Just a second',
    context: "\"I'll only check for a second\" is how most long sessions start.",
    reflection: 'You only meant to look.',
  },
  {
    stat: 'Your time',
    context: 'Whatever you open next gets your attention, and you only have so much of it today.',
    reflection: 'Spend it on purpose.',
  },
  {
    stat: 'Choice',
    context: 'Wanting to stop and stopping are different things. The gap between them is this screen.',
    reflection: 'You are already standing in it.',
  },
];

// Pick a random truth seeded by the hour so it changes throughout the day
// but stays consistent within a session
function pickTruth() {
  const hourSeed = Math.floor(Date.now() / 3_600_000);
  return TRUTHS[hourSeed % TRUTHS.length];
}

// ─── Component ────────────────────────────────────────────────────────────────

const COUNTDOWN = 5;

export default function WaitingRoomScreen() {
  const COLORS = useThemedColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const params = useLocalSearchParams<{
    app?: string;
    pointsEarned?: string;
    gameName?: string;
    domain?: string;
    isBricked?: string;
    isColdTurkey?: string;
  }>();
  const isBricked = params.isBricked === '1';
  // Two ways to get here: from the blocking gate (`app` = the blocked app/site
  // the user is trying to open) or standalone from the Calm tab (no `app`).
  // Only the first has anything to unlock — and anything to walk away from.
  const fromGate = !!params.app;
  const recordWalkAway = useUserStore((s) => s.recordWalkAway);
  const addPoints = useUserStore((s) => s.addPoints);
  const addXP = useUserStore((s) => s.addXP);
  const recordGamePlayed = useUserStore((s) => s.recordGamePlayed);

  const [secondsLeft, setSecondsLeft]   = useState(COUNTDOWN);
  const [ready,       setReady]         = useState(false);
  const truth = useRef(pickTruth()).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Start the countdown + progress bar
  useEffect(() => {
    // Animate progress bar from 0 → 1 over COUNTDOWN seconds
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: COUNTDOWN * 1000,
      useNativeDriver: true,
    }).start();

    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          setReady(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [progressAnim]);

  const handleContinue = () => {
    // Navigate to post-game, passing through all params from gate.tsx.
    // 'app' carries the raw domain/package name needed by unlockTemporarily()
    // (e.g. 'com.instagram.android') — separate from 'domain' (pretty display name).
    router.replace({
      pathname: '/post-game',
      params: {
        pointsEarned:  params.pointsEarned,
        gameName:      params.gameName,
        app:           params.app,
        domain:        params.domain,
        isBricked:     params.isBricked,
        isColdTurkey:  params.isColdTurkey,
      },
    });
  };

  // Leaving instead of continuing, in the blocking flow, IS a walk-away — it
  // used to be thrown away unrecorded, so the user's best moment earned nothing.
  // Standalone (Calm tab) visits record nothing: there was no urge to beat.
  const leftRef = useRef(false);   // guards a double-tap from recording twice
  const handleBack = () => {
    if (leftRef.current) return;
    leftRef.current = true;
    if (fromGate) {
      recordWalkAway();
      // The game was played and then the user walked away right here, so post-game
      // (which normally awards these) is never reached — credit it now, once.
      const pts = Number(params.pointsEarned) || 0;
      if (pts > 0) {
        addPoints(pts);
        addXP(Math.round(pts * 0.5));   // same half-of-points rule post-game uses
      }
      if (params.gameName && params.gameName !== 'Waiting Room') {
        recordGamePlayed(pts, params.gameName.toLowerCase().replace(/\s+/g, '_'));
      }
    }
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* Top — loading bar */}
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              { transform: [{ scaleX: progressAnim }], transformOrigin: 'left' },
            ]}
          />
        </View>

        {/* Main content */}
        <View style={styles.main}>
          <Text style={styles.label}>
            {ready ? 'Ready.' : `Processing… ${secondsLeft}`}
          </Text>

          {/* Truth card */}
          <View style={styles.truthCard}>
            <Text style={styles.statNumber}>{truth.stat}</Text>
            <Text style={styles.statContext}>{truth.context}</Text>
            <View style={styles.divider} />
            <Text style={styles.reflection}>{truth.reflection}</Text>
          </View>
        </View>

        {/* Bottom actions */}
        <View style={styles.actions}>
          {isBricked ? (
            // Hard lock — "Open Anyway" is never available
            <>
              <View style={styles.brickedNotice}>
                <Text style={styles.brickedText}>
                  You set a hard lock on this app. It can't be opened until the lock expires.
                </Text>
              </View>
              <Pressable style={styles.backLink} onPress={handleBack}>
                <Text style={styles.backLinkText}>Go home</Text>
              </Pressable>
            </>
          ) : ready && !fromGate ? (
            // Calm-tab visit: nothing to unlock, so don't offer a path into the
            // post-game screen (that screen awards a walk-away and streak day).
            <Pressable style={styles.continueButton} onPress={handleBack}>
              <Text style={styles.continueLabel}>I made it through</Text>
            </Pressable>
          ) : ready ? (
            <>
              <Pressable
                style={styles.continueButton}
                onPress={handleContinue}
              >
                <Text style={styles.continueLabel}>Open Anyway</Text>
              </Pressable>
              <Pressable style={styles.backLink} onPress={handleBack}>
                <Text style={styles.backLinkText}>Actually, take me home</Text>
              </Pressable>
            </>
          ) : (
            <Pressable style={styles.backLink} onPress={handleBack}>
              <Text style={styles.backLinkText}>Never mind, go back</Text>
            </Pressable>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (COLORS: ArcadeColors) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },

  // ── Progress bar ──
  progressTrack: {
    height: 3,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    marginTop: SPACING.md,
    overflow: 'hidden',
  },
  progressFill: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.green,
    borderRadius: 2,
  },

  // ── Main ──
  main: {
    flex: 1,
    justifyContent: 'center',
  },
  label: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: SPACING.lg,
  },

  // ── Truth card ──
  truthCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  statNumber: {
    fontFamily: FONTS.bodyBold,
    fontSize: 48,
    color: COLORS.textPrimary,
    letterSpacing: -2,
    marginBottom: SPACING.xs,
  },
  statContext: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: SPACING.md,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  reflection: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 16,
    color: COLORS.textPrimary,
    lineHeight: 24,
    fontStyle: 'italic',
  },

  // ── Actions ──
  actions: {
    gap: SPACING.sm,
  },
  continueButton: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  continueLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 15,
    color: COLORS.textMuted,
  },
  backLink: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  backLinkText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
    color: COLORS.green,
  },
  brickedNotice: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
  },
  brickedText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
