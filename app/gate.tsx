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
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { readableOn, isLightColor } from '@/utils/colorLuminance';
import { getLocalDateKey } from '@/utils/date';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { BreathRhythm }     from '@/components/games/BreathRhythm';
import { GroundingExercise } from '@/components/games/GroundingExercise';
import { OddOneOut }         from '@/components/games/OddOneOut';
// BallSort removed
import { TwentyFortyEight } from '@/components/games/TwentyFortyEight';
// SandToy removed
import { PixelDodge }       from '@/components/games/PixelDodge';
// FlashTap removed
import { BrickBreak }       from '@/components/games/BrickBreak';
import { EndlessRunner }    from '@/components/games/EndlessRunner';
import { FlappyBird }       from '@/components/games/FlappyBird';
import { Minesweeper }      from '@/components/games/Minesweeper';
import { WordWeave }        from '@/components/games/WordWeave';
import GoonWord             from '@/components/games/GoonWord';
import { StackGame }         from '@/components/games/StackGame';
import { PatternMemory }     from '@/components/games/PatternMemory';
import { Defrag }            from '@/components/games/Defrag';
import { TypingChallenge }   from '@/components/games/TypingChallenge';
import { PACKAGE_TO_NAME } from '@/hooks/useAppBlocker';
import { grantTemporaryUnlock, launchBlockedApp, DEFAULT_UNLOCK_MINUTES } from '@/utils/tempUnlock';
import { exitGate } from '@/utils/exitGate';
import { useUserStore } from '@/stores/useUserStore';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { resolveOffers, type OfferDef } from '@/constants/offers';
import { useOfferStore } from '@/stores/useOfferStore';
import { useWalkStore } from '@/stores/useWalkStore';
import { GATE_GAMES, CALM_GAMES as CALM_CATEGORY_GAMES, pickRandomGame, getGameById, type GameId } from '@/constants/games';
import { useThemeStore } from '@/stores/useThemeStore';
import { useAdInterstitial } from '@/components/ads/AdInterstitial';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoonSprite } from '@/components/home/GoonMascot';
import { useMascotStore, stageOf } from '@/stores/useMascotStore';
import { PackGateCard } from '@/components/page/PackGateCard';
import { getTodaysBriefing } from '@/lib/dailyGood';
import type { CharacterId } from '@/stores/usePetStore';
import { moodOf, daysSinceWalkAway, gateLine } from '@/constants/mascot';
import { CHARACTER_NAMES } from '@/constants/sprites';

// ─── Rapid re-entry options ────────────────────────────────────────────────────
// Single empathy question on rapid re-entry. No mocking, no multi-slide cycle.
// Research: shame → "screw it" thinking. Curiosity → pause + self-awareness.

const RAPID_OPTIONS = [
  { id: 'avoiding', label: 'Avoiding something',  icon: 'eye-off'    },
  { id: 'bored',    label: 'Bored',               icon: 'minus-circle'},
  { id: 'stressed', label: 'Stressed',            icon: 'zap'        },
  { id: 'habit',    label: 'Just habit',          icon: 'refresh-cw' },
] as const;

// ─── Intent options ────────────────────────────────────────────────────────────

type IntentOption = {
  id: 'habit' | 'stress';
  label: string;
  sublabel: string;
  icon: string;
  action: 'random-game' | 'calm-game';
};

const INTENT_OPTIONS: IntentOption[] = [
  {
    id: 'habit',
    label: 'Habit or boredom',
    sublabel: "You don't really need it right now",
    icon: 'eye',
    action: 'random-game',
  },
  {
    id: 'stress',
    label: 'Feeling stressed',
    sublabel: "Something's got you on edge",
    icon: 'wind',
    action: 'calm-game',
  },
];

// Low-stimulation games for stressed users. Excludes reflex/skill games (stack, typing, pixeldodge, etc.).
const CALM_GAMES: GameId[] = ['breathing', 'grounding', 'wordweave', 'memory'];

// Accent color per companion character — matches CHAR_COLORS dominant hues
const COMPANION_ACCENT: Record<CharacterId, string> = {
  0: '#7c3aed', // purple
  1: '#0277BD', // blue
  2: '#2E7D32', // green
  3: '#D6457E', // pink
  4: '#1F9D55', // leaf green
  5: '#C9402B', // morel red
  6: '#2B6FD6', // pixel blue
  7: '#D9822B', // amber
  8: '#1F9E7A', // Timmy teal
  9: '#9A6E44', // Ocky brown
  10: '#B8783A', // Jambo shell
};

// ─── Constants ────────────────────────────────────────────────────────────────

const OVERRIDE_PHRASE = 'I am choosing to open this intentionally';
const TWO_HOURS         = 2  * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
const THIRTY_SIX_HOURS  = 36 * 60 * 60 * 1000;

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

type Phase = 'intro' | 'followthrough' | 'rapid' | 'lockout' | 'offer' | 'calm' | 'friction' | 'intent' | 'nogames' | 'context' | 'pick' | 'playing' | 'override' | 'curfew';

// The blocker can re-launch this screen for a different app while it's already
// open (single-top). Keying on the target remounts it so the new app gets a fresh
// gate — not the previous app's phase, countdown and typed override text.
export default function GateRoute() {
  const { domain, source } = useLocalSearchParams<{ domain?: string; source?: string }>();
  return <NoGoonScreen key={`${domain ?? ''}|${source ?? ''}`} />;
}

function NoGoonScreen() {
  const {
    domain = 'instagram.com',
    source = 'web',
    rapid = '0',
    rapidCount: rapidCountStr = '0',
    curfew = '0',   // '1' when the native AccessibilityService triggered this gate during curfew hours
  } = useLocalSearchParams<{
    domain: string;
    source: string;
    rapid: string;
    rapidCount: string;
    curfew: string;
  }>();

  const isRapidEntry    = rapid === '1';
  const rapidEntryCount = parseInt(rapidCountStr, 10);
  // Native-triggered curfew: skip all gate logic and go straight to the curfew screen.
  const isCurfewTriggered = curfew === '1' || source === 'curfew';

  const {
    isBricked, isColdTurkey, gameDuration, streak, walkAwayCount, dailyWalkAways: dailyWalkAwaysMap, intentionGoal, gameMode, noGames, preferWaitingRoom,
    openCounts, openCountDate, incrementOpenCount, recordDailyGateFire,
    dailyIntention, intentionDate,
    nightlyCommitment, nightlyCommitmentSetAt,
    windDownEnabled, windDownHour,
    blockScheduleEnabled, blockScheduleStart, blockScheduleEnd, blockScheduleDays,
    curfewEnabled, curfewStart, curfewEnd,
    blocklist, addSite,
    focusSessionEnd, endFocusSession,
    urgeJournal,
    pendingCommitment,
    clearCommitment,
    hasSeenGateIntro,
    markGateIntroSeen,
    logFollowThrough,
    recordWalkAway,
  } = useUserStore();
  const { maybeShowInterstitial } = useAdInterstitial();
  const { disabledGateGames, enabledCalmGateGames } = useThemeStore();
  const bundleIds = useOfferStore((st) => st.bundleIds);
  const customOffersList = useOfferStore((st) => st.custom);
  const gateWalk = useWalkStore((st) => st.gateWalk);
  const gateGoal = useWalkStore((st) => st.gateGoal);

  // Theme-reactive palette — matches whatever theme/accent the user picked on
  // their home screen, instead of a fixed standalone palette. `textPrimary`,
  // `green`, `indigo`/`indigoBright` are compatibility aliases onto the real
  // ThemePalette fields (`text`, `success`, `accent`/`accentBright`) so the
  // rest of this file's `C.xxx` references below don't all need renaming.
  const { colors: themeColors } = useTheme();
  const C = {
    ...themeColors,
    textPrimary:  themeColors.text,
    green:        themeColors.success,
    indigo:       themeColors.accent,
    indigoBright: themeColors.accentBright,
  };
  // Text on a solid success-green button: dark on light greens, white on deep ones.
  const onGreen = isLightColor(C.green) ? '#0b1217' : '#ffffff';

  // ── Companion ─────────────────────────────────────────────────────────────
  const [gateCharacter, setGateCharacter] = useState<CharacterId | null>(null);
  const fedMap = useMascotStore((s) => s.fed);
  const [gatePetName,   setGatePetName]   = useState('Buddy');

  const isAppBlock = source === 'app';
  const displayDomain = isAppBlock || source === 'curfew'
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
  const gameCompletedRef = useRef(false);   // see handleGameComplete
  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  // Commitment follow-through: commitment for same domain that's 2h–24h old.
  // We waited long enough that the user should have acted on it — ask if they did.
  const pendingFollowThroughCommitment =
    pendingCommitment &&
    pendingCommitment.domain === displayDomain &&
    now - pendingCommitment.timestamp >= TWO_HOURS &&
    now - pendingCommitment.timestamp < TWENTY_FOUR_HOURS
      ? pendingCommitment
      : null;

  const [phase, setPhase] = useState<Phase>(
    !hasSeenGateIntro
      ? 'intro'
      : isCurfewTriggered          // native hard-block during curfew window
      ? 'curfew'
      : isRapidEntry
      ? 'rapid'
      : pendingFollowThroughCommitment
      ? 'followthrough'
      : 'offer'
  );
  const [selectedGame, setSelectedGame] = useState<GameId | null>(null);
  const [overrideText, setOverrideText] = useState('');
  // Calm screen countdown (5 → 0 then button appears)
  const [calmCountdown, setCalmCountdown] = useState(5);
  const [calmReady,     setCalmReady]     = useState(false);
  const calmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Friction phase state
  const [frictionStep,      setFrictionStep]      = useState(0);
  const [frictionCountdown, setFrictionCountdown] = useState(3);
  const [frictionBtnReady,  setFrictionBtnReady]  = useState(false);
  // Offer phase: today's top good-news headline (cached per day; null until loaded)
  const [offerHeadline, setOfferHeadline] = useState<string | null>(null);
  useEffect(() => {
    if (phase !== 'offer') return;
    let live = true;
    getTodaysBriefing()
      .then((b) => { if (live) setOfferHeadline(b.good[0]?.headline ?? null); })
      .catch(() => {});
    return () => { live = false; };
  }, [phase]);

  // ── Block schedule check — exit immediately if outside schedule window ────
  useEffect(() => {
    if (blockScheduleEnabled && !isWithinBlockSchedule(blockScheduleStart, blockScheduleEnd, blockScheduleDays)) {
      // Outside the schedule nothing should be blocked. Just closing the gate left the user
      // on NoGoon's home (and the next open fired the gate again), so let the app through
      // briefly and open it. Not a give-in: the user did nothing wrong.
      (async () => {
        const ok = await grantTemporaryUnlock(domain, DEFAULT_UNLOCK_MINUTES, false);
        exitGate({ keepApp: true });
        if (ok && isAppBlock) launchBlockedApp(domain);
      })();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Curfew check — hard block with zero unlock path ───────────────────────
  // Unlike blockSchedule (which exits the gate when outside window), curfew
  // stays on screen during the active window and shows a dead-end. No game,
  // no points, no override. The only action is closing the gate.
  useEffect(() => {
    if (curfewEnabled && isWithinBlockSchedule(curfewStart, curfewEnd)) {
      setPhase('curfew');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Increment open count for this domain on first render ─────────────────
  useEffect(() => {
    // A gate that's about to dismiss itself (outside the block schedule) never
    // really fired — don't count it toward open counts or the consistency score.
    if (blockScheduleEnabled && !isWithinBlockSchedule(blockScheduleStart, blockScheduleEnd, blockScheduleDays)) return;
    // Same for gates that are a dead end by design (curfew, focus session, rapid-return
    // lockout): the user can't win those, so counting them as "fired, not resisted"
    // dragged the consistency score down for nothing.
    const deadEnd =
      isCurfewTriggered || isFocusSession || Number(rapidCountStr) >= 5 ||
      (curfewEnabled && isWithinBlockSchedule(curfewStart, curfewEnd));
    incrementOpenCount(domain);
    if (deadEnd) return;
    recordDailyGateFire();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load companion character from AsyncStorage ───────────────────────────
  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem('@nogoon_goon_character');
      if (stored !== null) {
        const id = parseInt(stored, 10) as CharacterId;
        setGateCharacter(id);
        const petName = await AsyncStorage.getItem(`@nogoon_pet_name_${id}`);
        setGatePetName(petName ?? CHARACTER_NAMES[id] ?? 'Buddy');
      }
    })();
  }, []);

  // ── Calm phase — pulsing circle animation ────────────────────────────────
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.4)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contextFade    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Only run calm-specific setup when actually on the calm screen.
    // Keyed on `phase` so it fires when intro users transition to 'calm'
    // after tapping "Got it", not just on mount.
    if (phase !== 'calm') return;

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
      // `finished` is false when cleanup calls stopAnimation() — without this check,
      // that stop fired the callback and restarted the loop, so the pulse (and its
      // timers) kept running after the user left the calm screen.
      ]).start(({ finished }) => { if (finished) doPulse(); });
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
  }, [phase]);

  // ── Context phase — 2 sec bridge, then auto-advance to playing ───────────
  useEffect(() => {
    if (phase !== 'context') return;
    contextFade.setValue(0);
    Animated.timing(contextFade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    const timer = setTimeout(() => setPhase('playing'), 3000);
    return () => clearTimeout(timer);
  }, [phase]);

  // ── Intent selection ──────────────────────────────────────────────────────
  // Wind-down runs from the chosen hour through to ~5am — a plain `>=` check switched
  // it off at midnight, exactly when it is needed most.
  const nowHour = new Date().getHours();
  const WIND_DOWN_END = 5;
  const isWindDown =
    windDownEnabled &&
    (windDownHour >= WIND_DOWN_END
      ? nowHour >= windDownHour || nowHour < WIND_DOWN_END
      : nowHour >= windDownHour && nowHour < WIND_DOWN_END);

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
        setSelectedGame(pickRandomGame(disabledGateGames, enabledCalmGateGames));
        setPhase('context');
      }
    },
    [gameMode, isWindDown, noGames, disabledGateGames, enabledCalmGateGames]
  );

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
      // A game can report completion twice (e.g. a state updater re-running, or a
      // late timer). Only the first one may continue — otherwise the user gets a
      // second ad and a second navigation.
      if (gameCompletedRef.current) return;
      gameCompletedRef.current = true;
      // Show a full-screen interstitial ad every 3rd gate completion (free users only).
      // The ad resolves before navigating so the post-game screen appears cleanly after.
      await maybeShowInterstitial();
      // Guard: component may have unmounted while the ad was showing (rapid back-press,
      // or another gate triggered during the interstitial).
      if (!isMountedRef.current) return;
      // Route through The Waiting Room — a 5-second psychological pause before
      // the unlock decision. The waiting room forwards to /post-game after the countdown.
      router.replace({
        pathname: '/waiting-room',
        params: {
          app: domain,
          // Pass post-game params through so waiting-room can forward them
          pointsEarned: String(score),
          gameName: selectedGame ?? 'Mini-Game',
          domain: displayDomain,
          isBricked: (isBricked || isColdTurkey || gateWalk) ? '1' : '0',
          isColdTurkey: isColdTurkey ? '1' : '0',
        },
      });
    },
    [selectedGame, isBricked, isColdTurkey, gateWalk, displayDomain, maybeShowInterstitial]
  );

  // ── Context line shown on calm screen ────────────────────────────────────
  // Priority: daily intention > intentionGoal > streak > walkAway > nothing
  const today = getLocalDateKey();
  const todayOpenCount = openCountDate === today ? (openCounts[domain] ?? 0) : 0;
  const todayIntention = intentionDate === today && dailyIntention ? dailyIntention : null;

  // Nightly pre-commitment: show if set on a *different* calendar day (i.e. set last night)
  // and not expired (within 36h — covers late risers)
  const nightlySetDate = nightlyCommitmentSetAt
    ? getLocalDateKey(new Date(nightlyCommitmentSetAt))
    : null;
  const hasYesterdayCommitment =
    nightlyCommitment.trim().length > 0 &&
    nightlySetDate !== null &&
    nightlySetDate !== today &&
    Date.now() - nightlyCommitmentSetAt < THIRTY_SIX_HOURS
      ? nightlyCommitment
      : null;

  // Scroll trigger gets its own context line — more specific than the generic streak/goal copy.
  const currentHour = new Date().getHours();
  const isLateNight = isWindDown || currentHour >= 22 || currentHour < 4;

  const contextLine = source === 'scroll'
    ? `You've been scrolling ${displayDomain} for 90 seconds straight.`
    : todayIntention
    ? `Today you wanted to: ${todayIntention}`
    : isLateNight
    ? currentHour >= 22 || currentHour < 4
      ? `It's late — your brain is tired. Walk away and rest.`
      : `Wind-down is on. Protect your sleep.`
    : intentionGoal
    ? `You wanted more time for: ${intentionGoal}`
    : streak > 1
    ? `${streak}-day streak — don't break it now`
    : walkAwayCount > 0
    ? `You've walked away ${walkAwayCount} time${walkAwayCount === 1 ? '' : 's'} — you've got this`
    : null;

  // ── Commitment reminder — surface if within 2 hours and same domain ──────────
  const activeCommitment =
    pendingCommitment &&
    pendingCommitment.domain === displayDomain &&
    Date.now() - pendingCommitment.timestamp < TWO_HOURS
      ? pendingCommitment.text
      : null;

  // ── Urge pattern for this domain (last 4 entries from urge journal) ─────────
  // Shown on calm screen: "Last 3 times: Bored, Stressed, Bored"
  // Makes the pattern visible at the exact moment it's being repeated.
  // Filter by displayDomain — journal entries are stored with the pretty display
  // name (e.g. "Instagram"), not the raw package name ("com.instagram.android"),
  // because post-game receives displayDomain as its `domain` param from gate.
  const domainUrgePattern = urgeJournal
    .filter((e) => e.domain === displayDomain)
    .slice(0, 4)
    .map((e) => e.tag);

  // Friction buttons to show: 1 per rapid re-entry, max 10
  const frictionTotal = isRapidEntry ? Math.min(rapidEntryCount, 10) : 0;

  // ── Companion derived values (used in rapid + calm phases) ───────────────
  const gateStage  = stageOf(gateCharacter !== null ? (fedMap[gateCharacter] ?? 0) : 0);
  const gateMood   = moodOf({
    hour: nowHour,
    walkAwaysToday: dailyWalkAwaysMap?.[getLocalDateKey()] ?? 0,
    daysSinceWalkAway: daysSinceWalkAway(dailyWalkAwaysMap ?? {}, getLocalDateKey()),
    protectionOff: false,   // the gate only appears because blocking is working
    pets: 0,
  });
  const gateSpeech = gateLine(gateMood, gatePetName);
  const gateAccent = gateCharacter !== null ? COMPANION_ACCENT[gateCharacter] : '#7c3aed';

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: Focus session hard block — no game, no bypass
  // ══════════════════════════════════════════════════════════════════════════
  if (isFocusSession) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
        <View style={[styles.calmContainer, { justifyContent: 'center' }]}>
          <Feather name="crosshair" size={52} color={C.textMuted} style={{ marginBottom: SPACING.lg }} />
          <Text style={[styles.calmTitle, { color: C.textPrimary, textAlign: 'center' }]}>
            Focus session active
          </Text>
          <Text style={[styles.contextLine, { color: C.textSecondary, textAlign: 'center' }]}>
            {focusMinutesLeft} minute{focusMinutesLeft !== 1 ? 's' : ''} remaining.{'\n'}
            You locked this time down. Honor it.
          </Text>
          <View style={[styles.hardLockBanner, { backgroundColor: C.indigoBright + '18', borderColor: C.indigoBright + '44', marginTop: SPACING.xl }]}>
            <Feather name="clock" size={14} color={C.indigoBright} />
            <Text style={[styles.hardLockText, { color: C.indigoBright }]}>
              No bypasses until {new Date(focusSessionEnd!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <Pressable
            style={[styles.calmContinueBtn, { borderColor: C.indigoBright + '88', backgroundColor: C.indigoBright + '18', alignSelf: 'stretch', justifyContent: 'center', marginTop: SPACING.xl }]}
            onPress={() => exitGate()}
          >
            <Text style={[styles.calmContinueText, { color: C.indigoBright }]}>Back to my focus</Text>
          </Pressable>
          <Pressable
            style={[styles.skipRow, { marginTop: SPACING.md }]}
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
  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: Curfew — dead-end screen, no unlock path
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === 'curfew') {
    const [endHour, endMin] = curfewEnd.split(':').map(Number);
    const endFormatted = new Date(
      new Date().setHours(endHour ?? 0, endMin ?? 0, 0, 0)
    ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
        <View style={styles.curfewContainer}>
          <Feather name="moon" size={72} color={C.textMuted} />
          <Text style={[styles.curfewTitle, { color: C.textPrimary }]}>Digital Curfew Active</Text>
          <Text style={[styles.curfewSub, { color: C.textMuted }]}>
            Your screen time window is closed.{'\n'}
            Come back at {endFormatted}.
          </Text>
          <Text style={[styles.curfewDomain, { color: C.textMuted }]}>
            {displayDomain}
          </Text>
          <Pressable
            style={[styles.curfewBtn, { backgroundColor: C.surface, borderColor: C.border }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              exitGate();
            }}
          >
            <Text style={[styles.curfewBtnText, { color: C.textSecondary }]}>Close</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: Intro — one-time explainer for new users (shown on first gate fire)
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === 'intro') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
        <View style={styles.checkinContainer}>
          <Feather name="shield" size={56} color={C.textMuted} />
          <Text style={[styles.checkinTitle, { color: C.textPrimary }]}>
            You just hit a block
          </Text>
          <View style={[styles.checkinCard, { backgroundColor: C.surface, borderColor: C.cardBorder }]}>
            <Text style={[styles.checkinCardLabel, { color: C.textSecondary, fontFamily: FONTS.body, fontSize: 15, lineHeight: 24 }]}>
              NoGoon intercepts blocked apps with a short pause, then a quick game, then a choice — walk away or unlock.{'\n\n'}No judgment. Just a moment to decide.
            </Text>
          </View>
          <View style={[styles.checkinCard, { backgroundColor: C.surface, borderColor: C.cardBorder }]}>
            <Text style={[styles.checkinCardLabel, { color: C.textMuted, fontFamily: FONTS.mono, fontSize: 13, letterSpacing: 0.4 }]}>
              BLOCKED
            </Text>
            <Text style={[styles.checkinCardSub, { color: C.indigoBright, fontFamily: FONTS.bodyBold, fontSize: 17, marginTop: 4 }]}>
              {displayDomain}
            </Text>
          </View>
          <Pressable
            style={[styles.calmContinueBtn, { borderColor: C.indigoBright + '88', backgroundColor: C.indigoBright + '18', width: '100%', justifyContent: 'center' }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              markGateIntroSeen();
              setPhase('offer');
            }}
          >
            <Text style={[styles.calmContinueText, { color: C.indigoBright }]}>Got it</Text>
            <Feather name="arrow-right" size={16} color="#4ecdc4" />
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: Follow-through — "Did you do what you committed to?"
  // Fires on gate re-entry for same domain 2–24h after a commitment was made.
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === 'followthrough' && pendingFollowThroughCommitment) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
        <View style={styles.checkinContainer}>
          <Text style={[styles.checkinTitle, { color: C.textPrimary }]}>
            Did you do it?
          </Text>
          <View style={[styles.checkinCard, { backgroundColor: C.surface, borderColor: C.cardBorder }]}>
            <Text style={[styles.checkinCardLabel, { color: C.textMuted, fontFamily: FONTS.mono, fontSize: 13, letterSpacing: 0.4 }]}>
              YOU SAID YOU'D
            </Text>
            <Text style={[styles.checkinCardSub, { color: C.textPrimary, fontFamily: FONTS.bodyBold, fontSize: 17, marginTop: 4 }]}>
              {pendingFollowThroughCommitment.text}
            </Text>
          </View>
          <View style={{ gap: SPACING.sm, width: '100%' }}>
            <Pressable
              style={[styles.calmContinueBtn, { borderColor: C.green + '88', backgroundColor: C.green + '18', justifyContent: 'center' }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                logFollowThrough(pendingFollowThroughCommitment.text, displayDomain, true);
                clearCommitment();
                setPhase('offer');
              }}
            >
              <Feather name="check" size={16} color={C.green} />
              <Text style={[styles.calmContinueText, { color: C.green }]}>Yes, I did</Text>
            </Pressable>
            <Pressable
              style={styles.exitTextRow}
              onPress={() => {
                logFollowThrough(pendingFollowThroughCommitment.text, displayDomain, false);
                clearCommitment();
                setPhase('offer');
              }}
            >
              <Text style={[styles.exitText, { color: C.textMuted }]}>Not this time</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: Rapid re-entry — single empathy question, no mocking
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === 'rapid') {
    const nextPhase = rapidEntryCount >= 5 ? 'lockout' : 'calm';
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
        <View style={styles.checkinContainer}>
          <Text style={[styles.checkinTitle, { color: C.textPrimary }]}>
            What's pulling you back?
          </Text>
          <Text style={[styles.rapidSub, { color: C.textMuted }]}>
            {rapidEntryCount > 1
              ? `You've opened ${displayDomain} ${rapidEntryCount} times in a short window.`
              : `Back again on ${displayDomain}.`}
          </Text>

          {/* Companion — concerned look when user returns quickly */}
          {gateCharacter !== null && (
            <View style={styles.gateCompanionRow}>
              <GoonSprite char={gateCharacter} stage={gateStage} size={0.35} />
              <Text style={[styles.gateCompanionText, { color: C.textMuted, flex: 1 }]}>
                {gatePetName} noticed you're back...
              </Text>
            </View>
          )}

          <View style={styles.rapidOptions}>
            {RAPID_OPTIONS.map((opt) => (
              <Pressable
                key={opt.id}
                style={({ pressed }) => [
                  styles.rapidCard,
                  { backgroundColor: pressed ? C.surfaceHigh : C.surface, borderColor: C.border },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setPhase(nextPhase);
                }}
              >
                <Feather name={opt.icon as any} size={22} color={C.textMuted} />
                <Text style={[styles.rapidCardLabel, { color: C.textPrimary }]}>{opt.label}</Text>
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
      <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
        <View style={styles.checkinContainer}>
          <Feather name="feather" size={56} color={C.textMuted} />
          <Text style={[styles.checkinTitle, { color: C.textPrimary }]}>
            You paused.
          </Text>
          <View style={[styles.checkinCard, { backgroundColor: C.surface, borderColor: C.cardBorder }]}>
            <Text style={[styles.checkinCardLabel, { color: C.textSecondary, fontFamily: FONTS.body, fontSize: 15, lineHeight: 24 }]}>
              That short pause is the whole thing. Most urges fade on their own — you just proved it.
            </Text>
          </View>
          <View style={[styles.checkinCard, { backgroundColor: C.surface, borderColor: C.cardBorder }]}>
            <Text style={[styles.checkinCardLabel, { color: C.textMuted, fontFamily: FONTS.mono, fontSize: 13, letterSpacing: 0.4 }]}>
              BLOCKED SITE
            </Text>
            <Text style={[styles.checkinCardSub, { color: C.textPrimary, fontFamily: FONTS.bodyBold, fontSize: 17, marginTop: 2 }]}>
              {displayDomain}
            </Text>
          </View>
          <Pressable
            style={styles.exitTextRow}
            onPress={() => exitGate()}
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
      <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <ScrollView contentContainerStyle={styles.overrideContainer} keyboardShouldPersistTaps="handled">
          <Feather name="edit-3" size={48} color={C.textMuted} />
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
            onPress={async () => {
              if (!isMatch) return;
              // Actually grant the unlock. Before, this only dismissed the screen,
              // so the gate fired again within seconds.
              const granted = await grantTemporaryUnlock(domain);
              exitGate({ keepApp: true });
              if (granted && isAppBlock) launchBlockedApp(domain);
            }}
            disabled={!isMatch}
          >
            <Feather name="unlock" size={16} color={isMatch ? onGreen : C.textMuted} />
            <Text style={[styles.overrideUnlockText, { color: isMatch ? onGreen : C.textMuted }]}>
              Unlock
            </Text>
          </Pressable>
          <Pressable onPress={() => setPhase('intent')} style={styles.exitTextRow}>
            <Text style={[styles.exitText, { color: C.textMuted }]}>Back</Text>
          </Pressable>
        </ScrollView>
        </KeyboardAvoidingView>
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
      <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
        <View style={styles.frictionContainer}>
          <Feather name="lock" size={56} color={C.textMuted} />
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
                backgroundColor: frictionBtnReady ? C.indigoBright + '18' : C.surface,
                borderColor:     frictionBtnReady ? C.indigoBright + '88' : C.cardBorder,
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
                <Text style={[styles.frictionBtnText, { color: C.indigoBright }]}>
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
          <Pressable onPress={() => exitGate()} style={styles.exitTextRow}>
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
      <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
        <View style={styles.checkinContainer}>
          <Feather name="lock" size={56} color={C.textMuted} />
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
            onPress={() => exitGate()}
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
    if (selectedGame === 'twentyfortyeight') return <TwentyFortyEight onComplete={handleGameComplete} />;
    if (selectedGame === 'wordweave')      return <WordWeave        onComplete={handleGameComplete} />;
    if (selectedGame === 'stack')          return <StackGame        onComplete={handleGameComplete} />;
    if (selectedGame === 'memory')         return <PatternMemory    onComplete={handleGameComplete} />;
    if (selectedGame === 'defrag')         return <Defrag           onComplete={handleGameComplete} />;
    if (selectedGame === 'typing')         return <TypingChallenge  onComplete={handleGameComplete} duration={gameDuration} />;
    if (selectedGame === 'pixeldodge')     return <PixelDodge       onComplete={handleGameComplete} />;
    if (selectedGame === 'brickbreak')     return <BrickBreak       onComplete={handleGameComplete} />;
    if (selectedGame === 'runner')         return <EndlessRunner    onComplete={handleGameComplete} />;
    if (selectedGame === 'flappy')         return <FlappyBird       onComplete={handleGameComplete} />;
    if (selectedGame === 'minesweeper')    return <Minesweeper      onComplete={handleGameComplete} />;
    if (selectedGame === 'goon')           return <GoonWord         onComplete={(won) => handleGameComplete(won ? 100 : 0)} />;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: Pick — game chooser (when gameMode === 'choose')
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === 'pick') {
    // Respect the Arcade's "turn off games you don't enjoy" switches here too.
    const enabledGate = GATE_GAMES.filter((g) => !disabledGateGames.includes(g.id));
    const pool = [
      ...(enabledGate.length > 0 ? enabledGate : GATE_GAMES),
      ...CALM_CATEGORY_GAMES.filter((g) => enabledCalmGateGames.includes(g.id)),
    ];

    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
        <View style={[styles.intentContainer, { paddingTop: 48 }]}>
          <Text style={[styles.intentTitle, { color: C.textPrimary }]}>
            Pick a game
          </Text>
          <View style={styles.intentOptions}>
            {pool.map((g) => {
              const meta = getGameById(g.id)!;
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
                  <Feather name={((meta as any).icon) ?? 'play'} size={28} color={C.textMuted} style={{ width: 36, textAlign: 'center' }} />
                  <Text style={[styles.intentCardLabel, { color: C.textPrimary }]}>
                    {meta.name}
                  </Text>
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
      <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
        <Pressable style={{ flex: 1 }} onPress={() => setPhase('playing')}>
          <Animated.View style={[styles.calmContainer, { opacity: contextFade }]}>
            <Feather name={((meta as any)?.icon) ?? 'play'} size={56} color={C.textMuted} />
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
                <Feather name={option.icon as any} size={26} color={C.textMuted} style={{ width: 36, textAlign: 'center' }} />
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

          {/* Override — requires typing a sentence before unlocking. Hidden when
              Hard Mode / Cold Turkey is on: those promise no unlock path. */}
          {!isBricked && !isColdTurkey && !gateWalk && (
            <Pressable onPress={() => setPhase('override')} style={styles.exitTextRow}>
              <Text style={[styles.exitText, { color: C.textSecondary }]}>
                I actually need this right now
              </Text>
            </Pressable>
          )}

          <Pressable onPress={() => exitGate()} style={styles.exitTextRow}>
            <Text style={[styles.exitText, { color: C.textMuted }]}>Never mind</Text>
          </Pressable>

        </Animated.View>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: Offer — the first thing people see. Give them something better to do
  // instead of holding them up. "Keep going" still leads to the old pause, the
  // friction steps, the game and the walk-away choice, so nothing is easier to
  // get past than before.
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === 'offer') {
    const baseOffers = resolveOffers({
      bundleIds, custom: customOffersList, windDown: isWindDown, hour: nowHour,
      day: Math.floor(Date.now() / 86400000), noGames,
    });
    // Opt-in: when walking is switched on as a blocking step, it leads the list and is the way in.
    const palOffer: OfferDef = {
      id: 'pal', icon: 'activity', label: 'Take your pal for a walk',
      sub: `Walk ${gateGoal} steps together${isBricked || isColdTurkey ? '' : ' and you can go in'}`, kind: 'pal',
    };
    const offers = gateWalk ? [palOffer, ...baseOffers.slice(0, 3)] : baseOffers;
    const runOffer = (o: OfferDef) => {
      switch (o.kind) {
        case 'game': {
          const g = o.game && o.game !== 'random' ? (o.game as GameId) : pickRandomGame(disabledGateGames, enabledCalmGateGames);
          setSelectedGame(g);
          setPhase('context');
          break;
        }
        case 'route':
          if (o.counts !== false) recordWalkAway();
          router.replace(o.path as any);
          break;
        case 'wait':
          router.replace({
            pathname: '/waiting-room',
            params: {
              app: domain, pointsEarned: '0', gameName: 'Waiting Room', domain: displayDomain,
              isBricked: (isBricked || isColdTurkey || gateWalk) ? '1' : '0',
              isColdTurkey: isColdTurkey ? '1' : '0',
            },
          });
          break;
        case 'timer':
          router.replace({
            pathname: '/offer-timer',
            params: { label: o.label, seconds: String(o.seconds ?? 60), note: o.note ?? '' },
          } as any);
          break;
        case 'pal':
          router.replace({
            pathname: '/walk',
            params: {
              gate: '1', app: domain, domain: displayDomain,
              isBricked: (isBricked || isColdTurkey) ? '1' : '0',
              isColdTurkey: isColdTurkey ? '1' : '0',
            },
          } as any);
          break;
        case 'sms':
          recordWalkAway();
          Linking.openURL('sms:').catch(() => {});
          exitGate({ keepApp: true });
          break;
        case 'custom':
          recordWalkAway();
          exitGate();
          break;
      }
    };

    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
        <ScrollView contentContainerStyle={[styles.intentContainer, { flexGrow: 1 }]} showsVerticalScrollIndicator={false}>
          <View style={[styles.domainPill, { backgroundColor: C.surface, borderColor: C.cardBorder }]}>
            <Feather name={isAppBlock ? 'smartphone' : 'globe'} size={13} color={C.textMuted} />
            <Text style={[styles.domainText, { color: C.textMuted }]}>{displayDomain}</Text>
          </View>

          <Text style={[styles.intentTitle, { color: C.textPrimary }]}>
            How about this{'\n'}instead?
          </Text>

          {gateCharacter !== null && (
            <View style={styles.gateCompanionRow}>
              <GoonSprite char={gateCharacter} stage={gateStage} size={0.4} />
              <View style={[styles.gateCompanionBubble, { borderColor: gateAccent + '55' }]}>
                <Text style={[styles.gateCompanionText, { color: C.textSecondary }]}>{gateSpeech}</Text>
              </View>
            </View>
          )}

          <PackGateCard />

          <View style={styles.intentOptions}>
            {offers.map((o) => (
              <Pressable
                key={o.id}
                style={({ pressed }) => [
                  styles.intentCard,
                  { backgroundColor: pressed ? C.surfaceHigh : C.surface, borderColor: C.cardBorder },
                ]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); runOffer(o); }}
                accessibilityRole="button"
                accessibilityLabel={o.label}
              >
                <Feather name={o.icon} size={26} color={C.indigoBright} style={{ width: 36, textAlign: 'center' }} />
                <View style={styles.intentCardText}>
                  <Text style={[styles.intentCardLabel, { color: C.textPrimary }]}>{o.label}</Text>
                  <Text style={[styles.intentCardSub, { color: C.textSecondary }]} numberOfLines={2}>{o.id === 'news' && offerHeadline ? offerHeadline : o.sub}</Text>
                </View>
                <Feather name="chevron-right" size={18} color={C.textMuted} />
              </Pressable>
            ))}
          </View>

          {!isBricked && !isColdTurkey && !gateWalk && (
            <Pressable onPress={() => setPhase('calm')} style={styles.exitTextRow}>
              <Text style={[styles.exitText, { color: C.textSecondary }]}>Keep going to {displayDomain}</Text>
            </Pressable>
          )}
          <Pressable onPress={() => exitGate()} style={styles.exitTextRow}>
            <Text style={[styles.exitText, { color: C.textMuted }]}>Never mind</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: Calm — initial 5-second pause
  // ══════════════════════════════════════════════════════════════════════════
  const TEAL = C.indigoBright;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false} bounces={false}>
      <Animated.View style={[styles.calmContainer, { flex: undefined, flexGrow: 1, paddingVertical: SPACING.lg, opacity: contentOpacity }]}>

        {/* Domain — large and unmissable so addicted-brain registers it at a glance */}
        <View style={styles.calmDomainBlock}>
          <Text style={[styles.calmDomainBig, { color: C.indigoBright }]} numberOfLines={1} adjustsFontSizeToFit>
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
            <View style={[styles.openCountBadge, { backgroundColor: C.indigoBright + '18', borderColor: C.indigoBright + '44' }]}>
              <Feather name="moon" size={11} color="#4ecdc4" />
              <Text style={[styles.openCountText, { color: C.indigoBright }]}>
                wind-down mode
              </Text>
            </View>
          )}
        </View>

        {/* Companion — encouraging presence during breathing pause */}
        {gateCharacter !== null && (
          <View style={styles.gateCompanionRow}>
            <GoonSprite char={gateCharacter} stage={gateStage} size={0.4} />
            <View style={[styles.gateCompanionBubble, { borderColor: gateAccent + '55' }]}>
              <Text style={[styles.gateCompanionText, { color: C.textSecondary }]}>
                {gateSpeech}
              </Text>
            </View>
          </View>
        )}

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

        {/* Your pack's note / fortune (renders nothing for Core with no note) */}
        <PackGateCard />

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

        {/* Nightly pre-commitment — "Last night you said: No doomscrolling after 10pm" */}
        {hasYesterdayCommitment && (
          <View style={[styles.urgePatternRow, { backgroundColor: '#7c3aed14', borderColor: '#7c3aed33', borderWidth: 1 }]}>
            <Feather name="moon" size={12} color={readableOn('#a78bfa', C.surface, 4.5)} />
            <Text style={[styles.urgePatternText, { color: readableOn('#a78bfa', C.surface, 4.5) }]}>
              Last night you said:{' '}
              <Text style={{ color: C.textPrimary }}>{hasYesterdayCommitment}</Text>
            </Text>
          </View>
        )}

        {/* Commitment reminder — "You said you were going to: Read / write / create" */}
        {activeCommitment && (
          <View style={[styles.urgePatternRow, { backgroundColor: C.green + '14', borderColor: C.green + '33', borderWidth: 1 }]}>
            <Feather name="check-circle" size={12} color={C.green} />
            <Text style={[styles.urgePatternText, { color: C.green }]}>
              You said you'd:{' '}
              <Text style={{ color: C.textPrimary }}>{activeCommitment}</Text>
            </Text>
            <Pressable onPress={clearCommitment} hitSlop={8}>
              <Feather name="x" size={12} color={C.textMuted} />
            </Pressable>
          </View>
        )}

        {/* Urge pattern — "Last X times: Bored, Bored, Stressed" */}
        {domainUrgePattern.length >= 2 && (
          <View style={styles.urgePatternRow}>
            <Feather name="repeat" size={11} color={C.textMuted} />
            <Text style={[styles.urgePatternText, { color: C.textMuted }]}>
              Last {domainUrgePattern.length}×:{' '}
              <Text style={{ color: C.textSecondary }}>
                {domainUrgePattern.join(', ')}
              </Text>
            </Text>
          </View>
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
        ) : gateWalk ? null : (
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
              if (preferWaitingRoom) {
                router.replace({
                  pathname: '/waiting-room',
                  params: {
                    app: domain,
                    pointsEarned: '0',
                    gameName: 'Waiting Room',
                    domain: displayDomain,
                    isBricked: (isBricked || isColdTurkey || gateWalk) ? '1' : '0',
                    isColdTurkey: isColdTurkey ? '1' : '0',
                  },
                });
              } else {
                setPhase(frictionTotal > 0 ? 'friction' : 'intent');
              }
            }}
          >
            <Text style={[styles.calmContinueText, { color: TEAL }]}>I'm ready</Text>
            <Feather name="arrow-right" size={16} color={TEAL} />
          </Pressable>
        )}

      </Animated.View>
      </ScrollView>
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
    fontSize: 13,
    letterSpacing: 0.3,
  },

  // ── Urge pattern strip ────────────────────────────────────────────────────
  urgePatternRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  urgePatternText: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    letterSpacing: 0.2,
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
    fontSize: 14,
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
    fontSize: 13,
    letterSpacing: 0.2,
  },

  // ── Curfew dead-end screen ────────────────────────────────────────────────
  curfewContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
    gap: SPACING.lg,
  },
  curfewMoon: {
    fontSize: 72,
    lineHeight: 84,
    textAlign: 'center',
  },
  curfewTitle: {
    fontFamily: FONTS.displayRegular,
    fontSize: 28,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  curfewSub: {
    fontFamily: FONTS.body,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  curfewDomain: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  curfewBtn: {
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  curfewBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
  },

  // ── Rapid re-entry — single empathy question ──────────────────────────────────────────
  sarcasmEmoji: {
    // kept: reused by nogames, override, lockout phases
    fontSize: 72,
    lineHeight: 84,
    textAlign: 'center',
  },
  rapidSub: {
    fontFamily: FONTS.body,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  rapidOptions: {
    gap: SPACING.sm,
  },
  rapidCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  rapidCardEmoji: {
    fontSize: 24,
    lineHeight: 28,
  },
  rapidCardLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    flex: 1,
  },

  // ── Check-in / shared layout ─────────────────────────────────────────────────────────
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
    fontSize: 13,
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
    fontSize: 14,
    lineHeight: 18,
    marginTop: 2,
  },
  proTag: {
    fontFamily: FONTS.mono,
    fontSize: 13,
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
    fontSize: 13,
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
    fontSize: 13,
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
    fontSize: 12,
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

  // ── Companion ─────────────────────────────────────────────────────────────
  gateCompanionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    width: '100%',
  },
  gateCompanionBubble: {
    flex: 1,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  gateCompanionText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 18,
  },
});
