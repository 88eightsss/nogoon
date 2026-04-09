// ═══════════════════════════════════════════════════════════════════════════
//  NoGoon INTERCEPT SCREEN
//  ───────────────────────
//  Fires when a blocked site or app is detected.
//  Two game modes (set by user in Profile → Settings):
//
//    'choose' — shows all game options, user picks one (default)
//    'random' — skips the picker entirely, jumps straight into a random game
//
//  Route params:
//    domain      — blocked site or app package name, e.g. "instagram.com"
//    confidence  — detection confidence %, e.g. "97"
//    source      — 'web' (browser extension) or 'app' (Accessibility Service)
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';
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
import { StroopChallenge } from '@/components/games/StroopChallenge';
import { PatternMemory } from '@/components/games/PatternMemory';
import { TypingChallenge } from '@/components/games/TypingChallenge';
import { AnimalFacts } from '@/components/games/AnimalFacts';
import { FlappyGame } from '@/components/games/FlappyGame';
import { BreathingGame } from '@/components/games/BreathingGame';
import { ReactionGame } from '@/components/games/ReactionGame';
import { OddOneOut } from '@/components/games/OddOneOut';
import { PlaceholderGame } from '@/components/games/PlaceholderGame';
import { Badge } from '@/components/ui/Badge';
import { PACKAGE_TO_NAME } from '@/hooks/useAppBlocker';
import { useUserStore } from '@/stores/useUserStore';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { TYPE } from '@/constants/Typography';

// ─── Game catalogue builders ───────────────────────────────────────────────────
//
// STANDARD games — available to all paid subscribers ($2.88+/mo)
// PRO games — only available to Pro subscribers ($4.22+/mo)
//
// Note: ALL games are playable for free in Arcade mode (no points earned).
// Points are only earned here, in the intercept flow.
//
// isLive = true  → fully playable right now
// isLive = false → "SOON" placeholder (not tappable)

const STANDARD_GAMES = [
  {
    id: 'stroop',
    name: 'Stroop Challenge',
    description: 'Name the ink color, not the word',
    emoji: '🎨',
    color: COLORS.purple,
    isLive: true,
    isPro: false,
  },
  {
    id: 'memory',
    name: 'Pattern Memory',
    description: 'Watch the sequence, repeat it back',
    emoji: '🧩',
    color: COLORS.cyan,
    isLive: true,
    isPro: false,
  },
  {
    id: 'typing',
    name: 'Typing Challenge',
    description: 'Type the phrase perfectly before time runs out',
    emoji: '⌨️',
    color: COLORS.green,
    isLive: true,
    isPro: false,
  },
  {
    id: 'animals',
    name: 'Animal Facts',
    description: 'Read a cool animal fact, answer a trivia question',
    emoji: '🦦',
    color: COLORS.cyan,
    isLive: true,
    isPro: false,
  },
  {
    id: 'breathing',
    name: 'Breathing Reset',
    description: 'Follow the circle — box breathing technique',
    emoji: '🌬️',
    color: '#4d8bff',
    isLive: true,
    isPro: false,
  },
] as const;

// Pro-only games — 3 additional games unlocked with a Pro subscription ($4.22+/mo)
// They appear as a reward for upgrading, not advertised separately.
const PRO_GAMES = [
  {
    id: 'flappy',
    name: 'Flappy NoGoon',
    description: 'Dodge the pipes — how far can you go?',
    emoji: '🐦',
    color: COLORS.purple,
    isLive: true,
    isPro: true,
  },
  {
    id: 'reaction',
    name: 'Reaction Speed',
    description: 'Tap the target the instant it appears',
    emoji: '⚡',
    color: COLORS.green,
    isLive: true,
    isPro: true,
  },
  {
    id: 'oddone',
    name: 'Odd One Out',
    description: 'Spot the different ad — learn their tricks',
    emoji: '🕵️',
    color: COLORS.warning,
    isLive: true,
    isPro: true,
  },
] as const;

// A union type across both catalogues so TypeScript knows all possible game IDs
type StandardGame = (typeof STANDARD_GAMES)[number];
type ProGame      = (typeof PRO_GAMES)[number];
type AnyGame      = StandardGame | ProGame;

// Build the intercept game list — Pro games appended only for Pro subscribers
function buildGameOptions(isPro: boolean): AnyGame[] {
  return isPro
    ? ([...STANDARD_GAMES, ...PRO_GAMES] as AnyGame[])
    : ([...STANDARD_GAMES] as AnyGame[]);
}

// ─── GameCard sub-component ────────────────────────────────────────────────────

function GameCard({
  game,
  onPress,
}: {
  game: AnyGame;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      onPressIn={() =>
        Animated.timing(scale, { toValue: 0.97, duration: 70, useNativeDriver: true }).start()
      }
      onPressOut={() =>
        Animated.spring(scale, { toValue: 1, damping: 12, useNativeDriver: true }).start()
      }
      onPress={onPress}
    >
      <Animated.View
        style={[
          styles.gameCard,
          { borderColor: game.color + '44' },
          { transform: [{ scale }] },
          !game.isLive && styles.gameCardComingSoon,
        ]}
      >
        <Text style={styles.gameEmoji}>{game.emoji}</Text>
        <View style={styles.gameTextGroup}>
          <View style={styles.gameNameRow}>
            <Text style={[styles.gameName, { color: game.color }]}>{game.name}</Text>
            {!game.isLive && (
              <Text style={styles.comingSoonLabel}>SOON</Text>
            )}
          </View>
          <Text style={styles.gameDesc}>{game.description}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={game.color + 'aa'} />
      </Animated.View>

    </Pressable>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

type Phase = 'selecting' | 'playing';

export default function NoGoonScreen() {
  const {
    domain     = 'instagram.com',
    confidence = '97',
    source     = 'web',
  } = useLocalSearchParams<{ domain: string; confidence: string; source: string }>();

  // Read user preferences and BRICKED status from the store
  const { gameMode, isBricked, gameDuration } = useUserStore();

  // Check Pro subscription status — unlocks hidden games
  const { isPro } = useSubscriptionStore();

  // Build the game list dynamically based on subscription status
  const GAME_OPTIONS = buildGameOptions(isPro);

  // Only live games are eligible for random selection
  const LIVE_GAMES = GAME_OPTIONS.filter((g) => g.isLive);

  const isAppBlock    = source === 'app';
  const displayDomain = isAppBlock
    ? (PACKAGE_TO_NAME[domain] ?? domain)
    : domain;

  const [phase, setPhase]               = useState<Phase>('selecting');
  const [selectedGame, setSelectedGame] = useState<AnyGame | null>(null);

  // ── Alert animations ──────────────────────────────────────────────────────

  const alertShakeX = useRef(new Animated.Value(0)).current;
  const alertScale  = useRef(new Animated.Value(0.85)).current;

  const doShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(alertShakeX, { toValue: -11, duration: 55, useNativeDriver: true }),
      Animated.timing(alertShakeX, { toValue:  11, duration: 55, useNativeDriver: true }),
      Animated.timing(alertShakeX, { toValue:  -8, duration: 55, useNativeDriver: true }),
      Animated.timing(alertShakeX, { toValue:   8, duration: 55, useNativeDriver: true }),
      Animated.timing(alertShakeX, { toValue:  -4, duration: 55, useNativeDriver: true }),
      Animated.timing(alertShakeX, { toValue:   0, duration: 55, useNativeDriver: true }),
    ]).start();
  }, [alertShakeX]);

  useEffect(() => {
    Animated.spring(alertScale, {
      toValue: 1, damping: 10, stiffness: 180, useNativeDriver: true,
    }).start();

    doShake();
    const interval = setInterval(doShake, 2500);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    // ── RANDOM MODE: skip the picker, auto-launch a random live game ──────
    // A short delay gives the alert animation time to show before jumping in
    if (gameMode === 'random') {
      const randomGame = LIVE_GAMES[Math.floor(Math.random() * LIVE_GAMES.length)];
      const timer = setTimeout(() => {
        setSelectedGame(randomGame);
        setPhase('playing');
      }, 1200); // 1.2s — user sees the alert flash before the game loads
      return () => {
        clearInterval(interval);
        clearTimeout(timer);
      };
    }

    return () => clearInterval(interval);
  }, [doShake, alertScale, gameMode]);

  // ── Game selection (manual choose mode) ───────────────────────────────────

  const handleSelectGame = (game: (typeof GAME_OPTIONS)[number]) => {
    if (!game.isLive) {
      // Don't navigate — just give a gentle haptic to signal it's not available yet
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedGame(game);
    setPhase('playing');
  };

  // ── Game completion ────────────────────────────────────────────────────────

  const handleGameComplete = useCallback((score: number) => {
    router.replace({
      pathname: '/post-game',
      params: {
        pointsEarned: String(score),
        gameName: selectedGame?.name ?? 'Mini-Game',
        // Pass whether BRICKED is on so post-game can hide the unlock button
        isBricked: isBricked ? '1' : '0',
      },
    });
  }, [selectedGame, isBricked]);

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER: Playing
  // ══════════════════════════════════════════════════════════════════════════

  if (phase === 'playing' && selectedGame) {
    // ── Route to the correct game component ──────────────────────────────────
    // gameDuration is set in Profile → Settings (Pro: 30/60/90s, Free: always 30s)
    if (selectedGame.id === 'stroop')   return <StroopChallenge onComplete={handleGameComplete} />;
    if (selectedGame.id === 'memory')   return <PatternMemory   onComplete={handleGameComplete} />;
    if (selectedGame.id === 'typing')   return <TypingChallenge onComplete={handleGameComplete} duration={gameDuration} />;
    if (selectedGame.id === 'animals')  return <AnimalFacts     onComplete={handleGameComplete} />;
    if (selectedGame.id === 'breathing')return <BreathingGame   onComplete={handleGameComplete} />;
    if (selectedGame.id === 'flappy')   return <FlappyGame      onComplete={handleGameComplete} />;
    if (selectedGame.id === 'reaction') return <ReactionGame    onComplete={handleGameComplete} />;
    if (selectedGame.id === 'oddone')   return <OddOneOut       onComplete={handleGameComplete} />;
    // Fallback for any "SOON" games that somehow get triggered
    return (
      <PlaceholderGame
        gameName={selectedGame.name}
        accentColor={selectedGame.color}
        emoji={selectedGame.emoji}
        onComplete={handleGameComplete}
      />
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER: Selecting (or brief flash before random mode kicks in)
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        <View style={styles.dangerGlow} pointerEvents="none" />

        {/* ── BRICKED banner — shown when the user has Hard Mode active ── */}
        {/* When BRICKED, the unlock option is hidden on the post-game screen.
            This banner makes it clear up front that there's no escape route. */}
        {isBricked && (
          <View style={styles.brickedBanner}>
            <Text style={styles.brickedEmoji}>🧱</Text>
            <View style={styles.brickedTextGroup}>
              <Text style={styles.brickedTitle}>BRICKED MODE ON</Text>
              <Text style={styles.brickedSub}>Unlock button is disabled — play the game.</Text>
            </View>
          </View>
        )}

        {/* ── Alert section ── */}
        <View style={styles.alertSection}>
          <Animated.View
            style={{ transform: [{ translateX: alertShakeX }, { scale: alertScale }] }}
          >
            <View style={[styles.iconRing, isBricked && { borderColor: COLORS.warning + '55', backgroundColor: COLORS.warning + '18' }]}>
              <Ionicons name={isBricked ? 'lock-closed' : 'warning'} size={52} color={isBricked ? COLORS.warning : COLORS.danger} />
            </View>
          </Animated.View>

          <Text style={[styles.aiDetectedLabel, isBricked && { color: COLORS.warning }]}>
            NOGOON INTERCEPTED
          </Text>
          <Text style={styles.flaggedHeadline}>BLOCKED{'\n'}CONTENT</Text>

          <Badge
            label={`${confidence}% confidence`}
            color={COLORS.danger}
            size="md"
            style={styles.confidenceBadge}
          />

          <View style={styles.domainChip}>
            <Ionicons
              name={isAppBlock ? 'phone-portrait-outline' : 'globe-outline'}
              size={13}
              color={COLORS.textMuted}
            />
            <Text style={styles.domainText}>{displayDomain}</Text>
          </View>
        </View>

        {/* ── Game mode label ── */}
        <View style={styles.divider} />
        <Text style={styles.choosePrompt}>
          {gameMode === 'random'
            ? 'Loading your game…'
            : 'Choose a game to interrupt the pattern'}
        </Text>

        {/* ── Game list (only shown in 'choose' mode) ── */}
        {gameMode === 'choose' && (
          <View style={styles.gameList}>
            {GAME_OPTIONS.map((game) => (
              <GameCard key={game.id} game={game} onPress={() => handleSelectGame(game)} />
            ))}
          </View>
        )}

        {/* ── Random mode: show a spinner/pulse while the 1.2s delay runs ── */}
        {gameMode === 'random' && (
          <View style={styles.randomLoadingBox}>
            <Text style={styles.randomEmoji}>🎲</Text>
            <Text style={styles.randomLabel}>Picking a random game…</Text>
          </View>
        )}

        {/* ── Escape hatch — always visible ── */}
        <Pressable style={styles.dismissRow} onPress={() => router.dismissAll()}>
          <Text style={styles.dismissText}>I'll handle this myself</Text>
        </Pressable>

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.lg },

  // ── BRICKED banner ──
  // Sits at the very top of the scroll content, above the alert icon,
  // so the user sees it immediately before anything else.
  brickedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.warning + '18',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.warning + '55',
    padding: SPACING.md,
    marginTop: SPACING.lg,
  },
  brickedEmoji: { fontSize: 24 },
  brickedTextGroup: { flex: 1, gap: 2 },
  brickedTitle: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.warning,
    letterSpacing: 2,
  },
  brickedSub: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  dangerGlow: {
    position: 'absolute',
    top: -60, left: -80, right: -80, height: 320,
    backgroundColor: COLORS.danger,
    opacity: 0.07,
    borderBottomLeftRadius: 999,
    borderBottomRightRadius: 999,
    transform: [{ scaleX: 1.2 }],
  },

  alertSection: {
    alignItems: 'center',
    paddingTop: SPACING.xxxl,
    paddingBottom: SPACING.xl,
  },
  iconRing: {
    width: 96, height: 96,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.danger + '18',
    borderWidth: 1.5,
    borderColor: COLORS.danger + '55',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  aiDetectedLabel: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.danger,
    letterSpacing: 3,
    marginBottom: SPACING.sm,
  },
  flaggedHeadline: {
    fontFamily: FONTS.display,
    fontSize: 44,
    color: COLORS.textPrimary,
    textAlign: 'center',
    lineHeight: 50,
    letterSpacing: -0.5,
    marginBottom: SPACING.lg,
  },
  confidenceBadge: { marginBottom: SPACING.md },
  domainChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  domainText: { fontFamily: FONTS.mono, fontSize: 13, color: COLORS.textMuted },

  divider: { height: 1, backgroundColor: COLORS.border, marginBottom: SPACING.lg },
  choosePrompt: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.lg,
  },

  gameList: { gap: SPACING.sm, marginBottom: SPACING.lg },
  gameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  gameCardComingSoon: { opacity: 0.45 },
  gameEmoji: { fontSize: 30, width: 40, textAlign: 'center' },
  gameTextGroup: { flex: 1 },
  gameNameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  gameName: { fontFamily: FONTS.bodyBold, fontSize: 16, marginBottom: 2 },
  comingSoonLabel: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.textMuted,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    letterSpacing: 0.5,
  },
  gameDesc: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textSecondary },

  randomLoadingBox: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    gap: SPACING.md,
  },
  randomEmoji: { fontSize: 48 },
  randomLabel: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },

  dismissRow: { alignItems: 'center', paddingVertical: SPACING.md },
  dismissText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
    textDecorationLine: 'underline',
  },
});
