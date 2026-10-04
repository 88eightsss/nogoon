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

import { useState, useEffect, useRef } from 'react';
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
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

// ─── Truth Pool ───────────────────────────────────────────────────────────────
// One truth shown per waiting room visit, rotated randomly.
// Keep these grounded, not preachy.

const TRUTHS = [
  {
    stat: '2.5 hours',
    context: 'The average person spends this much time on social media every day.',
    reflection: "What would you do with an extra 17 hours a week?",
  },
  {
    stat: '600 engineers',
    context: "Instagram's recommendation team. Their only job: keep you here longer.",
    reflection: "They're really good at it.",
  },
  {
    stat: '1 in 3',
    context: 'People say social media makes them feel worse after using it.',
    reflection: "They open it anyway. You know why.",
  },
  {
    stat: '47%',
    context: 'Of adults say they check their phone more than they want to.',
    reflection: "Wanting to stop and stopping are different things.",
  },
  {
    stat: '11 minutes',
    context: "That's how long a typical Instagram session lasts once you open it.",
    reflection: 'You only meant to check for a second.',
  },
  {
    stat: '$35/hour',
    context: "That's the median US hourly wage. Social media companies make $1.10 per hour of your attention.",
    reflection: 'They buy low, sell high.',
  },
  {
    stat: '86%',
    context: 'Of Gen Z say they use their phones while doing something else.',
    reflection: 'You stopped being fully present somewhere.',
  },
  {
    stat: '250 million',
    context: 'Dollars spent last year studying how to make apps more addictive.',
    reflection: 'This is an arms race. You need armor.',
  },
  {
    stat: '4 seconds',
    context: 'The average attention span on social media before scrolling.',
    reflection: 'What are you training your brain to do?',
  },
  {
    stat: 'Dopamine',
    context: "Variable reward schedules — unpredictable 'likes' — activate the same brain pathway as slot machines.",
    reflection: 'Your phone is a casino in your pocket.',
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
    if (fromGate) recordWalkAway();
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

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  container: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },

  // ── Progress bar ──
  progressTrack: {
    height: 3,
    backgroundColor: '#222',
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
    color: '#555',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: SPACING.lg,
  },

  // ── Truth card ──
  truthCard: {
    backgroundColor: '#141414',
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: '#222',
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
    color: '#888',
    lineHeight: 22,
    marginBottom: SPACING.md,
  },
  divider: {
    height: 1,
    backgroundColor: '#222',
    marginBottom: SPACING.md,
  },
  reflection: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 16,
    color: '#ccc',
    lineHeight: 24,
    fontStyle: 'italic',
  },

  // ── Actions ──
  actions: {
    gap: SPACING.sm,
  },
  continueButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  continueLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 15,
    color: '#666',
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
    backgroundColor: '#1a1a1a',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
  },
  brickedText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});
