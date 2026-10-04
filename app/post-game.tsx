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
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useUserStore } from '@/stores/useUserStore';
import { PositiveNewsCard } from '@/components/PositiveNewsCard';
import { useAppBlocker } from '@/hooks/useAppBlocker';
import { AdBanner } from '@/components/ads/AdBanner';
import { AdRewarded } from '@/components/ads/AdRewarded';
import { COLORS, FONTS } from '@/constants/Colors';
import { MOOD_TAGS } from '@/constants/moods';
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

// ─── "Now what?" bridge hints ─────────────────────────────────────────────────
// Context-aware: adapts suggestions to time-of-day, blocked domain, and label.
function getNowWhatHints(label: string, domain: string): string[] {
  const hour = new Date().getHours();
  const isNight   = hour >= 22 || hour < 5;
  const isEvening = hour >= 18 && hour < 22;
  const isMorning = hour >= 5  && hour < 12;

  const d = domain.toLowerCase();
  const isShortVideo = ['tiktok', 'youtube', 'reels', 'twitch'].some(k => d.includes(k));
  const isNews       = ['reddit', 'twitter', 'x.com', 'hacker', 'news', 'threads'].some(k => d.includes(k));
  const isSocial     = ['instagram', 'facebook', 'snapchat', 'linkedin'].some(k => d.includes(k));
  const domainName   = domain.length > 0 ? domain : 'that app';

  switch (label) {
    case 'Read / write / create':
      return [
        isNight
          ? 'Late night is actually great for writing. No distractions.'
          : isMorning
          ? 'Morning pages. Even three sentences. Just start.'
          : 'You just freed up the time. Open something and go.',
        isShortVideo
          ? `${domainName} is designed to eat hours. A page of a book won't do that.`
          : isSocial
          ? `You were checking lives. Now go build yours — even 10 minutes of creating counts.`
          : 'Even 5 minutes of real writing beats an hour of consuming.',
        'Phone face-down, screen off. The cursor is less scary than the feed.',
      ];

    case 'Go outside':
      return [
        isNight
          ? 'A short walk at night is underrated. 10 minutes.'
          : isEvening
          ? 'Evening air. Shoes on — that\'s the whole task.'
          : 'No destination needed. Just move.',
        isShortVideo
          ? `${domainName} is designed to keep you horizontal. This is the antidote.`
          : 'The urge fades faster when your body is moving.',
        'Leave the phone in your pocket. Eyes up.',
      ];

    case 'Make food':
      return [
        isNight
          ? 'Late snack is fine. The act of making it is grounding.'
          : isMorning
          ? 'Real breakfast takes 10 minutes and actually fills you up.'
          : 'You\'re probably hungry. Real food, not a scroll.',
        'Check what\'s in the fridge. One thing. Make it.',
        isNews
          ? `${domainName} is anxiety on a loop. Cooking is the opposite — present and real.`
          : 'The act is the reward. Start with one ingredient.',
      ];

    case 'Call or text someone':
      return [
        isSocial
          ? `You were watching their posts. Just text them directly.`
          : 'An actual message beats passive feed-watching every time.',
        isNight
          ? 'Even a "thinking of you" text lands well at night.'
          : 'Pick one person. Send the message you\'ve been meaning to.',
        'It doesn\'t have to be deep. Connection is the point.',
      ];

    case 'Exercise / stretch':
      return [
        isNight
          ? '5 minutes of stretching before bed beats doomscrolling it.'
          : isMorning
          ? 'Morning movement sets the day. Even 10 push-ups.'
          : 'Your body has been waiting. Any movement counts.',
        isShortVideo
          ? `${domainName} keeps you still. This undoes that.`
          : 'Floor stretch, walk, push-ups — anything that isn\'t sitting.',
        'Start small. One set. The rest follows.',
      ];

    case 'Work on something':
      return [
        isMorning
          ? 'You just blocked the biggest distraction. Now is prime time.'
          : isNight
          ? 'Even 20 minutes of real work at night feels better than none.'
          : 'The tab is closed. Open what you were actually supposed to be doing.',
        isNews
          ? 'You were reading about the world. This is your chance to affect it slightly.'
          : 'You already won — now stack another win on top.',
        'Pick the smallest next step. Just that one thing.',
      ];

    case 'Nothing specific':
    default:
      return [
        isNight
          ? 'It\'s late. Phone down, lights low. The feed will still be there — you won\'t miss anything real.'
          : isEvening
          ? 'Evening urges are habit, not need. Sit with it — 90 seconds and it softens.'
          : 'Phone face-down for a few minutes. The urge is already fading.',
        d.length > 0
          ? `${domainName} is designed to pull you back. You just didn\'t let it.`
          : 'The discomfort is normal. It peaks, then passes.',
        'Nothing needs to happen right now. That\'s fine.',
      ];
  }
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function PostGameScreen() {
  // ── Route params ───────────────────────────────────────────────────────────
  // isBricked = '1' means BRICKED (Hard Mode) is active — unlock button is hidden
  // isColdTurkey passed separately — superset of BRICKED with zero unlock path
  const {
    pointsEarned: rawPoints = '0',
    gameName = 'Mini-Game',
    // 'app' = raw package name / site domain forwarded from gate (e.g. 'com.instagram.android').
    // Used for unlockTemporarily() so the native module gets the right identifier.
    // 'domain' = pretty display name (e.g. 'Instagram') — used for UI and partner notify only.
    app = '',
    domain = '',
    isBricked: brickedParam = '0',
    isColdTurkey: coldTurkeyParam = '0',
  } = useLocalSearchParams<{ pointsEarned: string; gameName: string; app: string; domain: string; isBricked: string; isColdTurkey: string }>();

  // Format domain for display — "instagram.com" or "Instagram" depending on what was blocked
  const domainDisplay = domain || 'this site';

  const pointsEarned = parseInt(rawPoints, 10);
  const xpEarned     = pointsToXP(pointsEarned);

  // Whether BRICKED or Cold Turkey mode is active
  const isBrickedMode    = brickedParam === '1' || coldTurkeyParam === '1';
  const isColdTurkeyMode = coldTurkeyParam === '1';

  // ── Store ──────────────────────────────────────────────────────────────────
  const {
    streak,
    walkAwayCount,
    addPoints,
    addXP,
    incrementStreak,
    recordGamePlayed,
    streakRestoresLeft,
    useStreakRestore,
    incrementWalkAway,
    recordDailyWalkAway,
    setCommitment,
    intentionGoal,
    logTrigger,
    logReflection,
    addUrgeEntry,
    addJournalEntry,
    notifyPartner,
  } = useUserStore();
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

  // ── Walk-away flow ────────────────────────────────────────────────────────
  const [celebrating, setCelebrating]       = useState(false);
  const [showCommitment, setShowCommitment] = useState(false);
  const [showNowWhat, setShowNowWhat]       = useState(false);
  const [nowWhatLabel, setNowWhatLabel]     = useState('');
  const [celebrationCount, setCelebrationCount] = useState(0);
  const [reflectionDone, setReflectionDone] = useState(false);
  const [showNews, setShowNews] = useState(false);
  // Optional note, offered right after a walk-away — this is the "in the
  // moment" journal entry point the app was originally supposed to have.
  // addJournalEntry existed with no call site anywhere before this; the tag
  // pills above write to urgeJournal (structured), this writes to
  // journalEntries (free text) — same moment, either or both.
  const [addingNote, setAddingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const continueToNews = (tag?: string) => {
    const text = noteDraft.trim();
    if (text) addJournalEntry(text, domainDisplay, tag);
    setReflectionDone(true);
    setShowNews(true);
  };

  const COMMITMENT_OPTIONS = [
    { id: 'read',     label: 'Read / write / create', emoji: '📖' },
    { id: 'outside',  label: 'Go outside',            emoji: '🌿' },
    { id: 'food',     label: 'Make food',             emoji: '🍳' },
    { id: 'call',     label: 'Call or text someone',  emoji: '💬' },
    { id: 'exercise', label: 'Exercise / stretch',    emoji: '🏃' },
    { id: 'work',     label: 'Work on something',     emoji: '💼' },
    { id: 'nothing',  label: 'Nothing specific',      emoji: '✌️' },
  ] as const;

  // ── Unlock countdown — replaces token-based friction ──────────────────────
  // Free users must wait 10s before the unlock button becomes active.
  // null = not started, N = counting down, 0 = ready to confirm.
  const [unlockCountdown, setUnlockCountdown] = useState<number | null>(null);
  const [bonusEarned, setBonusEarned] = useState(false);
  const bonusPoints = 50;
  const [selectedTrigger, setSelectedTrigger] = useState<string | null>(null);
  const unlockMinutes = 20; // Fixed at 20 min — no shorter options

  useEffect(() => {
    if (unlockCountdown === null || unlockCountdown === 0) return;
    const t = setTimeout(() => setUnlockCountdown(c => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [unlockCountdown]);

  const canRestoreStreak = streakRestoresLeft > 0;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleWalkAway = () => {
    const newCount = walkAwayCount + 1;
    setCelebrationCount(newCount);
    incrementStreak();
    if (selectedTrigger) logTrigger(selectedTrigger);
    incrementWalkAway();
    recordDailyWalkAway();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Show commitment step first — ask what they'll do instead
    setShowCommitment(true);
  };

  const handleCommitment = (label: string) => {
    setCommitment(label, domainDisplay);
    Haptics.selectionAsync();
    setShowCommitment(false);
    setNowWhatLabel(label);
    setShowNowWhat(true);
  };

  const handleUnlock = () => {
    // Use 'app' (raw) for native unlock — it carries the package name for app blocks.
    // Fall back to 'domain' for web-only sessions where 'app' isn't present.
    if (app || domain) unlockTemporarily(app || domain, unlockMinutes);
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
      if (app || domain) unlockTemporarily(app || domain, unlockMinutes);
      notifyPartner(domainDisplay, 'unlock');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.dismissAll();
    }
  };

  const startUnlockCountdown = () => {
    // 60-second real delay — not skip-able, not point-buyable.
    // The game was a pattern interrupt, not payment for access.
    setUnlockCountdown(60);
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════════════════

  // ── Walk-away celebration + reflection screen ─────────────────────────────
  // Two phases: first show the walk-away count (celebrationCount), then
  // show a one-tap reflection question. No auto-dismiss — user controls pacing.
  const REFLECTION_OPTIONS = MOOD_TAGS;

  // ── Commitment screen ────────────────────────────────────────────────────
  if (showCommitment) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.celebrationContainer}>
          <Text style={[styles.celebrationLabel, { marginBottom: SPACING.xs }]}>
            Good call.
          </Text>
          <Text style={[styles.celebrationSub, { fontSize: 20, marginBottom: SPACING.xl }]}>
            What are you going to do instead?
          </Text>

          <View style={{ width: '100%', gap: SPACING.sm }}>
            {COMMITMENT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.id}
                style={[styles.commitmentCard, { borderColor: COLORS.cardBorder, backgroundColor: COLORS.surface }]}
                onPress={() => handleCommitment(opt.label)}
              >
                <Text style={styles.commitmentEmoji}>{opt.emoji}</Text>
                <Text style={[styles.commitmentLabel, { color: COLORS.textPrimary }]}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={{ marginTop: SPACING.lg }}
            onPress={() => { setShowCommitment(false); setCelebrating(true); }}
          >
            <Text style={[styles.reflectionSkipText, { color: COLORS.textMuted }]}>Skip</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── "Now what?" bridge ───────────────────────────────────────────────────────
  if (showNowWhat) {
    const hints = getNowWhatHints(nowWhatLabel, domain);
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.celebrationContainer}>
          <Text style={[styles.celebrationSub, { color: COLORS.textMuted, fontSize: 13, letterSpacing: 1.5, marginBottom: SPACING.xs }]}>
            YOU CHOSE
          </Text>
          <Text style={[styles.celebrationSub, { fontSize: 24, marginBottom: SPACING.xl }]}>
            {nowWhatLabel}
          </Text>
          <View style={{ gap: SPACING.lg, width: '100%' }}>
            {hints.map((hint, i) => (
              <View key={i} style={styles.nowWhatRow}>
                <Text style={styles.nowWhatDot}>·</Text>
                <Text style={styles.nowWhatHint}>{hint}</Text>
              </View>
            ))}
          </View>
          <Pressable
            style={styles.nowWhatBtn}
            onPress={() => { setShowNowWhat(false); setCelebrating(true); }}
          >
            <Text style={styles.nowWhatBtnText}>I'm ready →</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (celebrating) {
    // Positive news reward phase — shown after reflection (or skip)
    if (showNews) {
      return (
        <SafeAreaView style={styles.safe}>
          <PositiveNewsCard onDone={() => router.dismissAll()} />
        </SafeAreaView>
      );
    }

    if (reflectionDone) {
      // Fallback flash (showNews and reflectionDone are normally set together)
      return (
        <SafeAreaView style={styles.safe}>
          <View style={styles.celebrationContainer}>
            <Text style={{ fontSize: 52 }}>✓</Text>
            <Text style={[styles.celebrationSub, { color: COLORS.green }]}>Logged.</Text>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.celebrationContainer}>
          {/* Walk-away count */}
          <Text style={styles.celebrationNumber}>{celebrationCount}</Text>
          <Text style={styles.celebrationLabel}>
            walk-away{celebrationCount === 1 ? '' : 's'}
          </Text>
          <Text style={styles.celebrationSub}>You made it.</Text>

          {/* Reflection question */}
          <View style={styles.reflectionBlock}>
            <Text style={styles.reflectionLabel}>What were you feeling?</Text>
            <View style={styles.reflectionPills}>
              {REFLECTION_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.id}
                  style={[styles.reflectionPill, { borderColor: COLORS.cardBorder, backgroundColor: COLORS.surface }]}
                  onPress={() => {
                    logReflection(opt.id);
                    addUrgeEntry(opt.id, domainDisplay); // timestamped urge journal entry
                    Haptics.selectionAsync();
                    continueToNews(opt.id); // also saves the note draft below, tagged with this mood
                  }}
                >
                  <Text style={styles.reflectionEmoji}>{opt.emoji}</Text>
                  <Text style={[styles.reflectionPillText, { color: COLORS.textSecondary }]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Optional free-text note — same moment as the tag pills above,
                either/both/neither. Collapsed by default so the fast "tap a
                pill and move on" path (most people, most of the time) gets
                zero added friction. */}
            {addingNote ? (
              <View style={styles.noteBox}>
                <TextInput
                  style={styles.noteInput}
                  value={noteDraft}
                  onChangeText={setNoteDraft}
                  placeholder="What was pulling you in?"
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  autoFocus
                />
                <Pressable style={styles.noteSaveBtn} onPress={() => continueToNews()}>
                  <Text style={styles.noteSaveBtnText}>Save & continue</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => setAddingNote(true)} hitSlop={8}>
                <Text style={[styles.reflectionSkipText, { color: COLORS.green }]}>+ Add a note</Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => {
                setReflectionDone(true);
                setShowNews(true);
              }}
              style={styles.reflectionSkip}
            >
              <Text style={[styles.reflectionSkipText, { color: COLORS.textMuted }]}>Skip</Text>
            </Pressable>
          </View>
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
          <Text style={styles.completeLabel}>WELL PLAYED</Text>
          <Text style={styles.gameNameText}>{gameName}</Text>
          <Text style={styles.praiseText}>
            You interrupted the loop. Now choose what happens next.
          </Text>
        </View>

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

          {/* BRICKED / Cold Turkey: locked out message */}
          {isBrickedMode ? (
            <View style={styles.brickedLockout}>
              <Text style={styles.brickedLockEmoji}>{isColdTurkeyMode ? '🦃' : '🧱'}</Text>
              <View style={styles.brickedLockText}>
                <Text style={styles.brickedLockTitle}>
                  {isColdTurkeyMode ? 'Cold Turkey Active' : 'BRICKED Mode Active'}
                </Text>
                <Text style={styles.brickedLockSub}>
                  {isColdTurkeyMode
                    ? 'Zero unlock path. There is no way through. Walk away.'
                    : 'You disabled unlocking. Well done — walk away.'}
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
                    {unlockCountdown}s — are you sure?
                  </Text>
                  <View style={styles.unlockCountdownTrack}>
                    <View
                      style={[
                        styles.unlockCountdownFill,
                        { width: `${((60 - unlockCountdown) / 60) * 100}%` },
                      ]}
                    />
                  </View>
                </View>
              )}

              {unlockCountdown === 0 && (
                <View style={styles.unlockConfirmBox}>
                  <Pressable style={styles.unlockConfirmButton} onPress={handleUnlock}>
                    <Text style={styles.unlockConfirmText}>
                      Open {domainDisplay} — 20 min
                    </Text>
                  </Pressable>
                  {canRestoreStreak && (
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
    paddingHorizontal: SPACING.xl,
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

  // ── Reflection block ──
  reflectionBlock: {
    marginTop: SPACING.xxxl,
    alignItems: 'center',
    gap: SPACING.md,
    width: '100%',
  },
  reflectionLabel: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  reflectionPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    justifyContent: 'center',
  },
  reflectionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  reflectionEmoji: { fontSize: 16 },
  reflectionPillText: {
    fontFamily: FONTS.body,
    fontSize: 14,
  },

  // ── Optional post-walk-away note ──
  noteBox: {
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  noteInput: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textPrimary,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  noteSaveBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.green + '22',
  },
  noteSaveBtnText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.green,
  },

  // ── Commitment cards ────────────────────────────────────────────────────
  commitmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  commitmentEmoji: { fontSize: 22 },
  commitmentLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 16,
  },
  reflectionSkip: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  reflectionSkipText: {
    fontFamily: FONTS.body,
    fontSize: 13,
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

  // ── Now what? bridge ──────────────────────────────────────────────────────
  nowWhatRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    width: '100%',
  },
  nowWhatDot: {
    fontFamily: FONTS.display,
    fontSize: 28,
    color: COLORS.indigoBright,
    lineHeight: 28,
    marginTop: -2,
  },
  nowWhatHint: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 17,
    color: COLORS.textSecondary,
    lineHeight: 26,
  },
  nowWhatBtn: {
    marginTop: SPACING.xxxl,
    backgroundColor: COLORS.indigo,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xxl,
    alignItems: 'center',
  },
  nowWhatBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: COLORS.background,
  },

});
