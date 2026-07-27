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
//   domain — blocked site or app package name, e.g. "instagram.com"
//   source — 'web' (browser URL match) or 'app' (package name match)
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { BreathRhythm }     from '@/components/games/BreathRhythm';
import { GroundingExercise } from '@/components/games/GroundingExercise';
import { OddOneOut }         from '@/components/games/OddOneOut';
import { ColorSort }         from '@/components/games/ColorSort';
import { BallSort }          from '@/components/games/BallSort';
import { TwentyFortyEight } from '@/components/games/TwentyFortyEight';
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
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { STANDARD_GAMES, PRO_GAMES, pickRandomGame, getGameById, type GameId } from '@/constants/games';
import { useAdInterstitial } from '@/components/ads/AdInterstitial';

// ─── Rapid re-entry sarcasm pages ─────────────────────────────────────────────

const SARCASM_PAGES = [
  { bg: '#f59e0b', msg: "Oh. You're back already.", emoji: '👋' },
  { bg: '#dc2626', msg: "That was… impressively fast.", emoji: '⚡' },
  { bg: '#7c3aed', msg: "Miss us that much?", emoji: '🥹' },
  { bg: '#0e7490', msg: "Bold strategy, honestly.", emoji: '🎯' },
  { bg: '#be185d', msg: "Your restraint is truly inspiring.", emoji: '🏆' },
  { bg: '#1d4ed8', msg: "This time for sure, right?", emoji: '👀' },
  { bg: '#047857', msg: "The urge must be strong today.", emoji: '💪' },
  { bg: '#b45309', msg: "We believe in you. We really do.", emoji: '🙏' },
  { bg: '#4f46e5', msg: "Almost through it. Breathe.", emoji: '🌬️' },
  { bg: '#0f766e', msg: "Last one. You've got this.", emoji: '✨' },
] as const;

const CHECKIN_OPTIONS = [
  { id: 'aware',  label: 'I caught myself',       sub: 'That awareness is everything' },
  { id: 'funny',  label: 'That was kind of funny', sub: 'Good. Keep that lightness' },
  { id: 'honest', label: 'I still want to go back', sub: "Honest. Let's try the game" },
] as const;

// ─── Intent options ────────────────────────────────────────────────────────────

type IntentOption = {
  id: 'habit' | 'stress';
  label: string;
  sublabel: string;
  emoji: string;
  action: 'random-game' | 'calm-game';
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
    action: 'calm-game',
  },
];

// Low-stimulation games only — for stressed users.
// Excludes timed/high-pressure games: warp, stack, typing, wordweave, memory, numberflow.
const CALM_GAMES: GameId[] = ['breathing', 'grounding', 'colorsort', 'ballsort', 'oddone'];

// ─── Constants ────────────────────────────────────────────────────────────────

const OVERRIDE_PHRASE = 'I am choosing to open this intentionally';

// ─── Block schedule helper ─────────────────────────────────────────────────────
// Returns true if the current time falls within the block window.
// Handles overnight ranges (e.g. 22:00 → 08:00).
function isWithinBlockSchedule(start: string, end: string, days: number[] = []): boolean {
  const now = new Date();
  // Check day of week first (0=Sun…6=Sat). Empty array = every day.
  if (days.length > 0 && !days.includes(now.getDay())) return false;
  const [sh = 0, sm = 0] = start.split(':').map(Number);
  const [eh = 0, em = 0] = end.split(':').map(Number);
  const nowMin   = now.getHours() * 60 + now.getMinutes();
  const startMin = sh * 60 + sm;
  const endMin   = eh * 60 + em;
  if (startMin <= endMin) {
    return nowMin >= startMin && nowMin < endMin;
  }
  // Overnight: active from start until midnight, and again from midnight until end
  return nowMin >= startMin || nowMin < endMin;
}

function pickCalmGame(): GameId {
  return CALM_GAMES[Math.floor(Math.random() * CALM_GAMES.length)];
}

// ─── Main component ────────────────────────────────────────────────────────────

type Phase = 'sarcasm' | 'checkin' | 'lockout' | 'calm' | 'friction' | 'intent' | 'nogames' | 'context' | 'pick' | 'playing' | 'override';

export default function NoGoonScreen() {
  const {
    domain = 'instagram.com',
    source = 'web',
    rapid = '0',
    rapidCount: rapidCountStr = '0',
  } = useLocalSearchParams<{
    domain: string;
    source: string;
    rapid: string;
    rapidCount: string;
  }>();

  const isRapidEntry   = rapid === '1';
  const rapidEntryCount = parseInt(rapidCountStr, 10);

  const {
    isBricked, gameDuration, streak, walkAwayCount, intentionGoal, gameMode, noGames,
    openCounts, openCountDate, incrementOpenCount,
    dailyIntention, intentionDate,
    windDownEnabled, windDownHour,
    blockScheduleEnabled, blockScheduleStart, blockScheduleEnd, blockScheduleDays,
    blocklist, addSite,
    focusSessionEnd, endFocusSession,
    notifyPartner,
  } = useUserStore();
  const { isPro } = useSubscriptionStore();
  const { maybeShowInterstitial } = useAdInterstitial();

  const C = COLORS;

  const isAppBlock = source === 'app';
  const displayDomain = isAppBlock
    ? (PACKAGE_TO_NAME[domain] ?? domain)
    : domain;

  // Quick-add: show only for scroll-triggered intercepts on sites not yet blocked
  const [quickAdded, setQuickAdded] = useState(false);
  const showQuickAdd = source === 'scroll' && !blocklist.includes(domain) && !quickAdded;

  // Focus session: if one is active, skip the game and show a hard block.
  // focusTick forces a re-render every 60s so the countdown stays accurate.
  const [, setFocusTick] = useState(0);
  useEffect(() => {
    if (!focusSessionEnd) return;
    const interval = setInterval(() => setFocusTick(t => t + 1), 60_000);
    return () => clearInterval(interval);
  }, [focusSessionEnd]);

  const now = Date.now();
  const isFocusSession = focusSessionEnd != null && focusSessionEnd > now;
  const focusMinutesLeft = isFocusSession ? Math.ceil((focusSessionEnd! - now) / 60_000) : 0;

  // Guard against setState / navigation calls after the component unmounts.
  // Happens when the gate is rapidly dismissed and re-opened (e.g., scroll trigger
  // fires while the user is mid-dismiss, or the ad resolves after unmount).
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  const [phase, setPhase]       = useState<Phase>(isRapidEntry ? 'sarcasm' : 'calm');
  const [selectedGame, setSelectedGame] = useState<GameId | null>(null);
  // Each rapid return shows the NEXT sarcasm slide in the cycle (not all 10 at once).
  // rapidEntryCount is 1-indexed, so subtract 1 to get 0-indexed page number.
  const [sarcasmPage, setSarcasmPage]   = useState(
    Math.max(0, (rapidEntryCount - 1) % SARCASM_PAGES.length)
  );
  const [overrideText, setOverrideText] = useState('');
  // Calm screen countdown (5 → 0 then button appears)
  const [calmCountdown, setCalmCountdown] = useState(5);
  const [calmReady,     setCalmReady]     = useState(false);
  const calmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Friction phase state
  const [frictionStep,      setFrictionStep]      = useState(0);
  const [frictionCountdown, setFrictionCountdown] = useState(3);
  const [frictionBtnReady,  setFrictionBtnReady]  = useState(false);

  // ── Block schedule check — exit immediately if outside schedule window ────
  useEffect(() => {
    if (blockScheduleEnabled && !isWithinBlockSchedule(blockScheduleStart, blockScheduleEnd, blockScheduleDays)) {
      router.dismissAll();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Increment open count for this domain on first render ─────────────────
  useEffect(() => {
    incrementOpenCount(domain);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Calm phase — pulsing circle animation ────────────────────────────────
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.4)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contextFade    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Only run calm-specific setup when actually on the calm screen.
    // Without this guard the 3s timer would fire mid-sarcasm sequence
    // and jump straight to 'intent', cutting the flow short.
    if (isRapidEntry) return;

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

    // 5-second countdown → shows "I'm ready" button
    setCalmCountdown(5);
    setCalmReady(false);
    calmIntervalRef.current = setInterval(() => {
      setCalmCountdown((prev) => {
        if (prev <= 1) {
          if (calmIntervalRef.current) clearInterval(calmIntervalRef.current);
          setCalmReady(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (calmIntervalRef.current) clearInterval(calmIntervalRef.current);
      pulseScale.stopAnimation();
      pulseOpacity.stopAnimation();
    };
  }, []);

  // ── Context phase — 2 sec bridge, then auto-advance to playing ───────────
  useEffect(() => {
    if (phase !== 'context') return;
    contextFade.setValue(0);
    Animated.timing(contextFade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    const timer = setTimeout(() => setPhase('playing'), 3000);
    return () => clearTimeout(timer);
  }, [phase]);

  // ── Intent selection ──────────────────────────────────────────────────────
  const isWindDown = windDownEnabled && new Date().getHours() >= windDownHour;

  const handleIntent = useCallback(
    (option: IntentOption) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // No-Games mode — skip the game entirely, go to exit screen
      if (noGames) {
        setPhase('nogames');
        return;
      }

      // Wind-down mode — default to breathing game regardless of choice
      if (isWindDown) {
        setSelectedGame('breathing');
        setPhase('context');
        return;
      }

      if (option.action === 'calm-game') {
        // Stressed user — pick low-stimulation game only
        setSelectedGame(pickCalmGame());
        setPhase('context');
        return;
      }

      // habit/boredom — full random pool or picker
      if (gameMode === 'choose') {
        setPhase('pick');
      } else {
        setSelectedGame(pickRandomGame(isPro));
        setPhase('context');
      }
    },
    [isPro, gameMode, isWindDown, noGames]
  );

  // ── Sarcasm page — show ONE slide per rapid return, then go to checkin ──────
  // Which slide is shown is determined by rapidEntryCount (set at mount above).
  // After 2s the user moves on to the check-in. No auto-cycling through all 10.
  useEffect(() => {
    if (phase !== 'sarcasm') return;
    const timer = setTimeout(() => setPhase('checkin'), 2000);
    return () => clearTimeout(timer);
  }, [phase]);

  // ── Friction phase — countdown per button, re-runs when frictionStep changes ──
  useEffect(() => {
    if (phase !== 'friction') return;
    setFrictionCountdown(3);
    setFrictionBtnReady(false);
    const interval = setInterval(() => {
      setFrictionCountdown((prev) => {
        if (prev <= 1) { setFrictionBtnReady(true); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, frictionStep]);

  // ── Intent auto-advance (8s) — defaults to habit path if user doesn't tap ──
  useEffect(() => {
    if (phase !== 'intent') return;
    const timer = setTimeout(() => handleIntent(INTENT_OPTIONS[0]), 8000);
    return () => clearTimeout(timer);
  }, [phase, handleIntent]);

  // ── Game completion ────────────────────────────────────────────────────────
  const handleGameComplete = useCallback(
    async (score: number) => {
      // Show a full-screen interstitial ad every 3rd gate completion (free users only).
      // The ad resolves before navigating so the post-game screen appears cleanly after.
      await maybeShowInterstitial();
      // Guard: component may have unmounted while the ad was showing (rapid back-press,
      // or another gate triggered during the interstitial).
      if (!isMountedRef.current) return;
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
    [selectedGame, isBricked, displayDomain, maybeShowInterstitial]
  );

  // ── Context line shown on calm screen ────────────────────────────────────
  // Priority: daily intention > intentionGoal > streak > walkAway > nothing
  const today = new Date().toISOString().split('T')[0];
  const todayOpenCount = openCountDate === today ? (openCounts[domain] ?? 0) : 0;
  const todayIntention = intentionDate === today && dailyIntention ? dailyIntention : null;

  // Scroll trigger gets its own context line — more specific than the generic streak/goal copy.
  const contextLine = source === 'scroll'
    ? `You've been scrolling ${displayDomain} for 90 seconds straight.`
    : todayIntention
    ? `Today you wanted to: ${todayIntention}`
    : intentionGoal
    ? `You wanted more time for: ${intentionGoal}`
    : streak > 1
    ? `${streak}-day streak 🔥 — don't break it now`
    : walkAwayCount > 0
    ? `You've walked away ${walkAwayCount} time${walkAwayCount === 1 ? '' : 's'} — you've got this`
    : null;

  // Friction buttons to show: 1 per rapid re-entry, max 10
  const frictionTotal = isRapidEntry ? Math.min(rapidEntryCount, 10) : 0;

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: Focus session hard block — no game, no bypass
  // ══════════════════════════════════════════════════════════════════════════
  if (isFocusSession) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: '#0b1217' }]}>
        <View style={[styles.calmContainer, { justifyContent: 'center' }]}>
          <Text style={{ fontSize: 52, textAlign: 'center', marginBottom: SPACING.lg }}>🎯</Text>
          <Text style={[styles.calmTitle, { color: C.textPrimary, textAlign: 'center' }]}>
            Focus session active
          </Text>
          <Text style={[styles.contextLine, { color: C.textSecondary, textAlign: 'center' }]}>
            {focusMinutesLeft} minute{focusMinutesLeft !== 1 ? 's' : ''} remaining.{'\n'}
            You locked this time down. Honor it.
          </Text>
          <View style={[styles.hardLockBanner, { backgroundColor: COLORS.indigoBright + '18', borderColor: COLORS.indigoBright + '44', marginTop: SPACING.xl }]}>
            <Feather name="clock" size={14} color={COLORS.indigoBright} />
            <Text style={[styles.hardLockText, { color: COLORS.indigoBright }]}>
              No bypasses until {new Date(focusSessionEnd!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <Pressable
            style={[styles.skipRow, { marginTop: SPACING.xl }]}
            onPress={() => {
              Alert.alert(
                'End focus session?',
                'You set this time aside intentionally. Are you sure you want to end it early?',
                [
                  { text: 'Keep going', style: 'cancel' },
                  {
                    text: 'End session',
                    style: 'destructive',
                    onPress: () => { endFocusSession(); router.replace('/(tabs)'); },
                  },
                ]
              );
            }}
          >
            <Text style={[styles.skipText, { color: C.textSecondary }]}>End focus session early</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: Sarcasm — 10 colored pages, 1.5s each, auto-advance
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === 'sarcasm') {
    const page = SARCASM_PAGES[sarcasmPage];
    const progress = sarcasmPage + 1;
    return (
      <Pressable
        style={[styles.sarcasmScreen, { backgroundColor: page.bg }]}
        onPress={() => {
          if (sarcasmPage >= SARCASM_PAGES.length - 1) setPhase('checkin');
          else setSarcasmPage((p) => p + 1);
        }}
      >
        <Text style={styles.sarcasmEmoji}>{page.emoji}</Text>
        <Text style={styles.sarcasmMsg}>{page.msg}</Text>
        <View style={styles.sarcasmProgress}>
          {Array.from({ length: SARCASM_PAGES.length }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.sarcasmDot,
                { backgroundColor: i <= sarcasmPage ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)' },
              ]}
            />
          ))}
        </View>
        <Text style={styles.sarcasmCounter}>{progress} / {SARCASM_PAGES.length}</Text>
      </Pressable>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: Check-in — "How did that feel?"
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === 'checkin') {
    const nextPhase = rapidEntryCount >= 5 ? 'lockout' : 'calm';
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: '#0b1217' }]}>
        <View style={styles.checkinContainer}>
          <Text style={styles.checkinTitle}>How did that feel?</Text>
          <Text style={[styles.checkinSub, { color: C.textMuted }]}>
            {rapidEntryCount} quick return{rapidEntryCount === 1 ? '' : 's'} today
          </Text>
          <View style={styles.checkinOptions}>
            {CHECKIN_OPTIONS.map((opt) => (
              <Pressable
                key={opt.id}
                style={({ pressed }) => [
                  styles.checkinCard,
                  { backgroundColor: pressed ? C.surfaceHigh : C.surface, borderColor: C.cardBorder },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setPhase(nextPhase);
                }}
              >
                <Text style={[styles.checkinCardLabel, { color: C.textPrimary }]}>{opt.label}</Text>
                <Text style={[styles.checkinCardSub, { color: C.textSecondary }]}>{opt.sub}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: No-Games — user opted out of games; just pause + let them exit
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === 'nogames') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: '#0b1217' }]}>
        <View style={styles.checkinContainer}>
          <Text style={[styles.sarcasmEmoji, { fontSize: 56 }]}>🌿</Text>
          <Text style={[styles.checkinTitle, { color: C.textPrimary }]}>
            You paused.
          </Text>
          <View style={[styles.checkinCard, { backgroundColor: C.surface, borderColor: C.cardBorder }]}>
            <Text style={[styles.checkinCardLabel, { color: C.textSecondary, fontFamily: FONTS.body, fontSize: 15, lineHeight: 24 }]}>
              That three-second pause is the whole thing. Most urges fade on their own — you just proved it.
            </Text>
          </View>
          <View style={[styles.checkinCard, { backgroundColor: C.surface, borderColor: C.cardBorder }]}>
            <Text style={[styles.checkinCardLabel, { color: C.textMuted, fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 0.4 }]}>
              BLOCKED SITE
            </Text>
            <Text style={[styles.checkinCardSub, { color: C.textPrimary, fontFamily: FONTS.bodyBold, fontSize: 17, marginTop: 2 }]}>
              {displayDomain}
            </Text>
          </View>
          <Pressable
            style={styles.exitTextRow}
            onPress={() => router.dismissAll()}
          >
            <Text style={[styles.exitText, { color: C.textSecondary, fontSize: 16 }]}>
              Close this screen
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: Override — user claims genuine need; must type a phrase to unlock
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === 'override') {
    const isMatch = overrideText.trim().toLowerCase() === OVERRIDE_PHRASE.toLowerCase();
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: '#0b1217' }]}>
        <ScrollView contentContainerStyle={styles.overrideContainer} keyboardShouldPersistTaps="handled">
          <Text style={[styles.sarcasmEmoji, { fontSize: 48 }]}>✍️</Text>
          <Text style={[styles.checkinTitle, { color: C.textPrimary, textAlign: 'center' }]}>
            Type this to unlock
          </Text>
          <View style={[styles.overridePhraseBox, { backgroundColor: C.surface, borderColor: C.cardBorder }]}>
            <Text style={[styles.overridePhrase, { color: C.textSecondary }]}>
              "{OVERRIDE_PHRASE}"
            </Text>
          </View>
          <TextInput
            style={[
              styles.overrideInput,
              {
                backgroundColor: C.surface,
                borderColor: isMatch ? C.green : C.cardBorder,
                color: C.textPrimary,
              },
            ]}
            value={overrideText}
            onChangeText={setOverrideText}
            placeholder="Type the phrase above..."
            placeholderTextColor={C.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            multiline={false}
          />
          <Pressable
            style={[
              styles.overrideUnlockBtn,
              {
                backgroundColor: isMatch ? C.green : C.surface,
                borderColor: isMatch ? C.green : C.border,
                opacity: isMatch ? 1 : 0.5,
              },
            ]}
            onPress={() => {
              if (isMatch) {
                notifyPartner(displayDomain, 'bypass');
                router.dismissAll();
              }
            }}
            disabled={!isMatch}
          >
            <Feather name="unlock" size={16} color={isMatch ? '#0b1217' : C.textMuted} />
            <Text style={[styles.overrideUnlockText, { color: isMatch ? '#0b1217' : C.textMuted }]}>
              Unlock
            </Text>
          </Pressable>
          <Pressable onPress={() => setPhase('intent')} style={styles.exitTextRow}>
            <Text style={[styles.exitText, { color: C.textMuted }]}>← Back</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: Friction — escalating confirmation buttons for rapid re-entries
  // Each re-entry within 5 min adds one 3-second locked button (up to 10).
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === 'friction') {
    const isLast = frictionStep + 1 >= frictionTotal;
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: '#0b1217' }]}>
        <View style={styles.frictionContainer}>
          <Text style={styles.frictionEmoji}>🔐</Text>
          <Text style={[styles.frictionTitle, { color: C.textPrimary }]}>
            One more moment.
          </Text>
          <View style={[styles.frictionCard, { backgroundColor: C.surface, borderColor: C.cardBorder }]}>
            <Text style={[styles.frictionSub, { color: C.textSecondary }]}>
              {frictionStep + 1} of {frictionTotal} — each return adds a pause.
            </Text>
          </View>
          <Pressable
            disabled={!frictionBtnReady}
            style={[
              styles.frictionBtn,
              {
                backgroundColor: frictionBtnReady ? '#4ecdc4' + '18' : C.surface,
                borderColor:     frictionBtnReady ? '#4ecdc4' + '88' : C.cardBorder,
                opacity:         frictionBtnReady ? 1 : 0.6,
              },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              if (isLast) {
                setPhase('intent');
              } else {
                setFrictionStep((s) => s + 1);
              }
            }}
          >
            {frictionBtnReady ? (
              <>
                <Feather name="check" size={18} color="#4ecdc4" />
                <Text style={[styles.frictionBtnText, { color: '#4ecdc4' }]}>
                  {isLast ? 'Continue' : 'Next'}
                </Text>
              </>
            ) : (
              <>
                <Feather name="lock" size={16} color={C.textMuted} />
                <Text style={[styles.frictionBtnText, { color: C.textMuted }]}>
                  {frictionCountdown}s
                </Text>
              </>
            )}
          </Pressable>
          <Pressable onPress={() => router.dismissAll()} style={styles.exitTextRow}>
            <Text style={[styles.exitText, { color: C.textMuted }]}>Close this screen</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: Lockout — triggered after 5+ rapid returns (10-min cool-down)
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === 'lockout') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: '#0b1217' }]}>
        <View style={styles.checkinContainer}>
          <Text style={[styles.sarcasmEmoji, { fontSize: 56 }]}>🔒</Text>
          <Text style={[styles.checkinTitle, { color: C.textPrimary }]}>
            10-minute breather
          </Text>
          <View style={[styles.checkinCard, { backgroundColor: C.surface, borderColor: C.cardBorder }]}>
            <Text style={[styles.checkinCardLabel, { color: C.textSecondary, fontFamily: FONTS.body, fontSize: 15, lineHeight: 24 }]}>
              You've come back {rapidEntryCount} times in a row. NoGoon is giving you a 10-minute
              break — not as punishment, but because you asked it to.
            </Text>
          </View>
          <Pressable
            style={[styles.exitTextRow, { marginTop: 8 }]}
            onPress={() => router.dismissAll()}
          >
            <Text style={[styles.exitText, { color: C.textMuted }]}>
              Close this screen
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: Playing
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === 'playing' && selectedGame) {
    if (selectedGame === 'breathing')  return <BreathRhythm    onComplete={handleGameComplete} />;
    if (selectedGame === 'grounding')  return <GroundingExercise onComplete={handleGameComplete} />;
    if (selectedGame === 'oddone')     return <OddOneOut        onComplete={handleGameComplete} />;
    if (selectedGame === 'colorsort')  return <ColorSort        onComplete={handleGameComplete} />;
    if (selectedGame === 'ballsort')   return <BallSort         onComplete={handleGameComplete} />;
    if (selectedGame === 'twentyfortyeight') return <TwentyFortyEight onComplete={handleGameComplete} />;
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
      <SafeAreaView style={[styles.safe, { backgroundColor: '#0b1217' }]}>
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
                    setPhase('context');
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
  // RENDER: Context — 2-second bridge before the game starts
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === 'context' && selectedGame) {
    const meta = getGameById(selectedGame);
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: '#0b1217' }]}>
        <Pressable style={{ flex: 1 }} onPress={() => setPhase('playing')}>
          <Animated.View style={[styles.calmContainer, { opacity: contextFade }]}>
            <Text style={styles.contextEmoji}>{meta?.emoji ?? '🎮'}</Text>
            <Text style={[styles.contextGameName, { color: C.textPrimary }]}>
              {meta?.name ?? 'Mini-game'}
            </Text>
            <View style={[styles.contextCard, { backgroundColor: C.surface, borderColor: C.cardBorder }]}>
              <Text style={[styles.contextMessage, { color: C.textSecondary }]}>
                Urges fade in 90 seconds. Playing interrupts the loop — you're almost through it.
              </Text>
            </View>
            <Text style={[styles.contextSkipHint, { color: C.textMuted }]}>
              Tap anywhere to skip
            </Text>
          </Animated.View>
        </Pressable>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: Intent — "Why are you here?"
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === 'intent') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: '#0b1217' }]}>
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
            What's pulling{'\n'}you in right now?
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

          {/* Override — requires typing a sentence before unlocking */}
          <Pressable onPress={() => setPhase('override')} style={styles.exitTextRow}>
            <Text style={[styles.exitText, { color: C.textSecondary }]}>
              I actually need this right now
            </Text>
          </Pressable>

        </Animated.View>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: Calm — initial 5-second pause
  // ══════════════════════════════════════════════════════════════════════════
  const TEAL = '#4ecdc4';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: '#0b1217' }]}>
      <Animated.View style={[styles.calmContainer, { opacity: contentOpacity }]}>

        {/* Domain — large and unmissable so addicted-brain registers it at a glance */}
        <View style={styles.calmDomainBlock}>
          <Text style={[styles.calmDomainBig, { color: COLORS.indigoBright }]} numberOfLines={1} adjustsFontSizeToFit>
            {displayDomain}
          </Text>
          <View style={styles.calmDomainSub}>
            <Feather name={isAppBlock ? 'smartphone' : 'globe'} size={11} color={C.textMuted} />
            <Text style={[styles.calmDomainSubText, { color: C.textMuted }]}>
              {isAppBlock ? 'app' : 'site'} you were opening
            </Text>
          </View>
          {todayOpenCount > 1 && (
            <View style={[styles.openCountBadge, { backgroundColor: C.warning + '18', borderColor: C.warning + '44' }]}>
              <Text style={[styles.openCountText, { color: C.warning }]}>
                {todayOpenCount}× today
              </Text>
            </View>
          )}
          {isWindDown && (
            <View style={[styles.openCountBadge, { backgroundColor: '#4ecdc4' + '18', borderColor: '#4ecdc4' + '44' }]}>
              <Text style={[styles.openCountText, { color: '#4ecdc4' }]}>
                🌙 wind-down mode
              </Text>
            </View>
          )}
        </View>

        {/* Pulsing circle + breath anchor */}
        <View style={styles.circleSection}>
          <View style={styles.circleWrapper}>
            <Animated.View
              style={[
                styles.pulseOuter,
                {
                  backgroundColor: TEAL + '14',
                  borderColor: TEAL + '28',
                  transform: [{ scale: pulseScale }],
                  opacity: pulseOpacity,
                },
              ]}
            />
            <View style={[styles.pulseInner, { backgroundColor: TEAL + '20', borderColor: TEAL + '45' }]}>
              <Feather name="wind" size={34} color={TEAL} />
            </View>
          </View>
          <Text style={[styles.breathInstruction, { color: C.textMuted }]}>
            Follow the circle — breathe in... breathe out.
          </Text>
        </View>

        {/* Main message */}
        <Text style={[styles.calmTitle, { color: C.textPrimary }]}>
          Take a breath.
        </Text>

        {/* Context line — personal, not punishing */}
        {contextLine ? (
          <Text style={[styles.contextLine, { color: C.textSecondary }]}>
            {contextLine}
          </Text>
        ) : (
          <Text style={[styles.contextLine, { color: C.textSecondary }]}>
            The urge passes. Give it a moment.
          </Text>
        )}

        {/* Quick-add: one tap to permanently block this site */}
        {showQuickAdd && (
          <Pressable
            style={[styles.quickAddBtn, { borderColor: C.border }]}
            onPress={() => {
              addSite(domain);
              setQuickAdded(true);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }}
          >
            <Feather name="plus-circle" size={13} color={C.textMuted} />
            <Text style={[styles.quickAddText, { color: C.textMuted }]}>
              Block {domain} permanently
            </Text>
          </Pressable>
        )}
        {quickAdded && (
          <View style={[styles.quickAddBtn, { borderColor: C.green + '55' }]}>
            <Feather name="check" size={13} color={C.green} />
            <Text style={[styles.quickAddText, { color: C.green }]}>
              {domain} added to blocklist
            </Text>
          </View>
        )}

        {/* Hard lock — no exit, but offer a calm path */}
        {isBricked ? (
          <>
            <View style={[styles.hardLockBanner, { backgroundColor: C.warning + '18', borderColor: C.warning + '55' }]}>
              <Feather name="lock" size={14} color={C.warning} />
              <Text style={[styles.hardLockText, { color: C.warning }]}>Hard lock is on</Text>
            </View>
            <Pressable
              style={styles.calmBreathButton}
              onPress={() => { setSelectedGame('breathing'); setPhase('context'); }}
            >
              <Feather name="wind" size={14} color={TEAL} />
              <Text style={[styles.calmBreathText, { color: TEAL }]}>Try a breathing exercise</Text>
            </Pressable>
          </>
        ) : (
          <Pressable style={styles.skipRow} onPress={() => setPhase('override')}>
            <Text style={[styles.skipText, { color: C.textSecondary }]}>
              I actually need this right now
            </Text>
          </Pressable>
        )}

        {/* Countdown then "I'm ready" button */}
        {!calmReady ? (
          <View style={styles.calmCountdownRow}>
            <Text style={[styles.calmCountdownNum, { color: TEAL }]}>{calmCountdown}</Text>
            <Text style={[styles.calmCountdownLabel, { color: C.textMuted }]}>seconds</Text>
          </View>
        ) : (
          <Pressable
            style={[styles.calmContinueBtn, { borderColor: TEAL + '88', backgroundColor: TEAL + '18' }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setPhase(frictionTotal > 0 ? 'friction' : 'intent');
            }}
          >
            <Text style={[styles.calmContinueText, { color: TEAL }]}>I'm ready</Text>
            <Feather name="arrow-right" size={16} color={TEAL} />
          </Pressable>
        )}

      </Animated.View>
    </SafeAreaView>
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
    gap: SPACING.xxxl,
  },

  circleWrapper: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },

  pulseOuter: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1.5,
  },

  pulseInner: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  calmTitle: {
    fontFamily: FONTS.displayRegular,
    fontSize: 46,
    textAlign: 'center',
    lineHeight: 54,
    letterSpacing: 0.5,
  },

  contextLine: {
    fontFamily: FONTS.body,
    fontSize: 17,
    textAlign: 'center',
    lineHeight: 26,
    letterSpacing: 0.15,
    paddingHorizontal: SPACING.xl,
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
    fontSize: 15,
    letterSpacing: 0.1,
  },

  // ── Calm screen domain block (large, unmissable) ─────────────────────────
  calmDomainBlock: {
    alignItems: 'center',
    gap: SPACING.xs,
    width: '100%',
  },
  calmDomainBig: {
    fontFamily: FONTS.display,
    fontSize: 30,
    letterSpacing: 0.3,
    textAlign: 'center',
    width: '100%',
  },
  calmDomainSub: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  calmDomainSubText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 0.3,
  },

  // ── Hard lock calm breath option ──────────────────────────────────────────
  calmBreathButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  calmBreathText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    letterSpacing: 0.1,
  },

  // ── Calm screen circle + breath anchor ───────────────────────────────────
  circleSection: {
    alignItems: 'center',
    gap: SPACING.md,
  },
  breathInstruction: {
    fontFamily: FONTS.body,
    fontSize: 13,
    textAlign: 'center',
    letterSpacing: 0.15,
  },

  // ── Context phase ─────────────────────────────────────────────────────────────────
  contextEmoji: {
    fontSize: 56,
    lineHeight: 68,
    textAlign: 'center',
  },
  contextGameName: {
    fontFamily: FONTS.displayRegular,
    fontSize: 28,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  contextCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.xl,
    width: '100%',
  },
  contextMessage: {
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  contextSkipHint: {
    fontFamily: FONTS.body,
    fontSize: 12,
    letterSpacing: 0.2,
  },

  // ── Sarcasm sequence ─────────────────────────────────────────────────────────────────
  sarcasmScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
    gap: SPACING.xxxl,
  },
  sarcasmEmoji: {
    fontSize: 72,
    lineHeight: 84,
    textAlign: 'center',
  },
  sarcasmMsg: {
    fontFamily: FONTS.displayRegular,
    fontSize: 32,
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 42,
    letterSpacing: 0.3,
  },
  sarcasmProgress: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  sarcasmDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sarcasmCounter: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
  },

  // ── Check-in ────────────────────────────────────────────────────────────────────────
  checkinContainer: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xxxl,
    gap: SPACING.xl,
    alignItems: 'stretch',
  },
  checkinTitle: {
    fontFamily: FONTS.displayRegular,
    fontSize: 28,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  checkinSub: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  checkinOptions: {
    gap: SPACING.sm,
  },
  checkinCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    gap: 4,
  },
  checkinCardLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  checkinCardSub: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },

  // ── Exit rows ────────────────────────────────────────────────────────────────────────
  exitTextRow: {
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  exitText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    textAlign: 'center',
  },

  // ── Intent screen ───────────────────────────────────────────────────────────────────────
  intentContainer: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xxl,
    gap: SPACING.xl,
    alignItems: 'stretch',
  },
  domainPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },
  domainText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    letterSpacing: 0.3,
  },
  intentTitle: {
    fontFamily: FONTS.display,
    fontSize: 30,
    color: COLORS.textPrimary,
    lineHeight: 38,
  },
  intentOptions: {
    gap: SPACING.sm,
  },
  intentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
  },
  intentEmoji: {
    fontSize: 28,
    width: 36,
    textAlign: 'center',
  },
  intentCardText: { flex: 1 },
  intentCardLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
  },
  intentCardSub: {
    fontFamily: FONTS.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  proTag: {
    fontFamily: FONTS.mono,
    fontSize: 12,
  },

  // ── Quick-add button ─────────────────────────────────────────────────────────────────
  quickAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    marginTop: SPACING.sm,
  },
  quickAddText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    letterSpacing: 0.2,
  },

  // ── Open-count badge ──────────────────────────────────────────────────────────────────
  openCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    marginTop: SPACING.xs,
  },
  openCountText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 0.3,
  },

  // ── Friction screen ──────────────────────────────────────────────────────────────────
  frictionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.xl,
  },
  frictionEmoji: {
    fontSize: 56,
    lineHeight: 68,
    textAlign: 'center',
  },
  frictionTitle: {
    fontFamily: FONTS.displayRegular,
    fontSize: 28,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  frictionCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    width: '100%',
    alignItems: 'center',
  },
  frictionSub: {
    fontFamily: FONTS.body,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  frictionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xxxl,
    minWidth: 180,
  },
  frictionBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 20,
    letterSpacing: 0.2,
  },

  // ── Calm screen countdown + continue button ───────────────────────────────────────────
  calmCountdownRow: {
    alignItems: 'center',
    gap: 2,
    marginTop: SPACING.sm,
  },
  calmCountdownNum: {
    fontFamily: FONTS.displayRegular,
    fontSize: 52,
    lineHeight: 60,
    letterSpacing: 0.5,
  },
  calmCountdownLabel: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  calmContinueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
  },
  calmContinueText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    letterSpacing: 0.2,
  },

  // ── Override screen ─────────────────────────────────────────────────────────────────
  overrideContainer: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xxxl,
    paddingBottom: SPACING.xxxl,
    gap: SPACING.xl,
    alignItems: 'stretch',
  },
  overridePhraseBox: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
  },
  overridePhrase: {
    fontFamily: FONTS.body,
    fontSize: 16,
    lineHeight: 26,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  overrideInput: {
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontFamily: FONTS.body,
    fontSize: 15,
  },
  overrideUnlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    paddingVertical: SPACING.lg,
  },
  overrideUnlockText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    letterSpacing: 0.2,
  },
});
