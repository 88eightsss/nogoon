// ═══════════════════════════════════════════════════════════════════════════
//  ARCADE TAB — NoGoon
//  ────────────────────
//  Free play for everyone. No points earned, no streaks, no pressure.
//  This is the free value prop of the app — you don't need to pay to play.
//
//  ALL 8 GAMES are available here to EVERY user, including free users.
//  Pro-only games are marked with a ⭐ badge but are still fully playable.
//
//  The key difference from the intercept screen:
//    - No points awarded
//    - No unlock button after the game
//    - No streak tracking
//    - Just the game, then back to Arcade
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  SafeAreaView,
  Animated,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { StroopChallenge } from '@/components/games/StroopChallenge';
import { PatternMemory } from '@/components/games/PatternMemory';
import { TypingChallenge } from '@/components/games/TypingChallenge';
import { AnimalFacts } from '@/components/games/AnimalFacts';
import { BreathingGame } from '@/components/games/BreathingGame';
import { FlappyGame } from '@/components/games/FlappyGame';
import { ReactionGame } from '@/components/games/ReactionGame';
import { OddOneOut } from '@/components/games/OddOneOut';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

// ─── Full game catalogue ───────────────────────────────────────────────────────
// All 8 games. Standard = included with $2.88/mo intercept. Pro = $4.22/mo intercept.
// In Arcade, ALL are free to play — the tier only affects the intercept flow + points.

const ALL_GAMES = [
  // ── Standard tier games ──
  {
    id: 'stroop',
    name: 'Stroop Challenge',
    description: 'Name the ink color, not the word',
    emoji: '🎨',
    color: COLORS.purple,
    tier: 'standard' as const,
    tagline: 'Trains attention + focus',
  },
  {
    id: 'memory',
    name: 'Pattern Memory',
    description: 'Watch the sequence, repeat it back',
    emoji: '🧩',
    color: COLORS.cyan,
    tier: 'standard' as const,
    tagline: 'Trains working memory',
  },
  {
    id: 'typing',
    name: 'Typing Challenge',
    description: 'Type the phrase perfectly before time runs out',
    emoji: '⌨️',
    color: COLORS.green,
    tier: 'standard' as const,
    tagline: 'Trains precision + focus',
  },
  {
    id: 'animals',
    name: 'Animal Facts',
    description: 'Read a cool fact, answer a trivia question',
    emoji: '🦦',
    color: COLORS.cyan,
    tier: 'standard' as const,
    tagline: 'Calming + curious',
  },
  {
    id: 'breathing',
    name: 'Breathing Reset',
    description: 'Follow the circle — box breathing technique',
    emoji: '🌬️',
    color: '#4d8bff',
    tier: 'standard' as const,
    tagline: 'Calms the nervous system',
  },

  // ── Pro tier games — still free to play in Arcade ──
  {
    id: 'flappy',
    name: 'Flappy NoGoon',
    description: 'Dodge the pipes — how far can you go?',
    emoji: '🐦',
    color: COLORS.purple,
    tier: 'pro' as const,
    tagline: 'Fast-paced coordination',
  },
  {
    id: 'reaction',
    name: 'Reaction Speed',
    description: 'Tap the target the instant it appears',
    emoji: '⚡',
    color: COLORS.green,
    tier: 'pro' as const,
    tagline: 'Train pure reflexes',
  },
  {
    id: 'oddone',
    name: 'Odd One Out',
    description: 'Spot the different ad — learn their tricks',
    emoji: '🕵️',
    color: COLORS.warning,
    tier: 'pro' as const,
    tagline: 'Teaches ad literacy',
  },
] as const;

type GameEntry = (typeof ALL_GAMES)[number];
type GameId    = GameEntry['id'];

// ─── Post-game result screen ───────────────────────────────────────────────────
// Shows after finishing any game in Arcade. No points — just encouragement.

interface PostGameProps {
  gameName: string;
  onBack: () => void;
  onPlayAgain: () => void;
}

function ArcadePostGame({ gameName, onBack, onPlayAgain }: PostGameProps) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.postGameContainer}>

        <Text style={styles.postGameEmoji}>🎮</Text>
        <Text style={styles.postGameTitle}>Nice work!</Text>
        <Text style={styles.postGameGame}>{gameName}</Text>

        {/* Arcade mode zero-points callout */}
        <View style={styles.arcadeNote}>
          <Feather name="info" size={16} color={COLORS.textMuted} />
          <Text style={styles.arcadeNoteText}>
            Arcade mode — 0 pts earned{'\n'}
            Blocking intercepts earn real points
          </Text>
        </View>

        <View style={styles.postGameActions}>
          <Pressable style={styles.playAgainButton} onPress={onPlayAgain}>
            <Text style={styles.playAgainText}>Play Again</Text>
          </Pressable>

          <Pressable style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← Back to Arcade</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ─── Game card component ────────────────────────────────────────────────────────

interface GameCardProps {
  game: GameEntry;
  onPlay: (id: GameId) => void;
}

function ArcadeGameCard({ game, onPlay }: GameCardProps) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      onPressIn={() =>
        Animated.timing(scale, { toValue: 0.96, duration: 70, useNativeDriver: true }).start()
      }
      onPressOut={() =>
        Animated.spring(scale, { toValue: 1, damping: 12, useNativeDriver: true }).start()
      }
      onPress={() => onPlay(game.id)}
      style={styles.cardPressable}
    >
      <Animated.View
        style={[
          styles.gameCard,
          { borderColor: game.color + '40' },
          { transform: [{ scale }] },
        ]}
      >
        {/* Pro badge — marks which games are Pro-tier, but still playable in Arcade */}
        {game.tier === 'pro' && (
          <View style={styles.proBadge}>
            <Text style={styles.proBadgeText}>⭐ PRO</Text>
          </View>
        )}

        {/* Game emoji */}
        <Text style={styles.gameEmoji}>{game.emoji}</Text>

        {/* Game info */}
        <View style={styles.gameInfo}>
          <Text style={styles.gameName}>{game.name}</Text>
          <Text style={styles.gameDescription}>{game.description}</Text>
          <Text style={[styles.gameTagline, { color: game.color }]}>{game.tagline}</Text>
        </View>

        {/* Play arrow */}
        <Feather name="play-circle" size={28} color={game.color} />
      </Animated.View>
    </Pressable>
  );
}

// ─── Main Arcade Screen ────────────────────────────────────────────────────────

export default function ArcadeScreen() {
  // Which game is currently active (null = showing the game list)
  const [activeGame, setActiveGame] = useState<GameId | null>(null);

  // Which game just finished (for the post-game screen)
  const [finishedGame, setFinishedGame] = useState<GameEntry | null>(null);

  // ── Handle game completion ──────────────────────────────────────────────────
  // Score is ignored in arcade mode — no points awarded, no tracking.

  const handleGameComplete = (_score: number) => {
    const game = ALL_GAMES.find((g) => g.id === activeGame) ?? null;
    setFinishedGame(game);
    setActiveGame(null);
  };

  // ── Launch a game ───────────────────────────────────────────────────────────

  const handlePlay = (id: GameId) => {
    setFinishedGame(null);
    setActiveGame(id);
  };

  // ── Return to game list ─────────────────────────────────────────────────────

  const handleBack = () => {
    setFinishedGame(null);
    setActiveGame(null);
  };

  // ── Play the same game again ────────────────────────────────────────────────

  const handlePlayAgain = () => {
    if (finishedGame) handlePlay(finishedGame.id);
  };

  // ── Render: active game ────────────────────────────────────────────────────

  if (activeGame === 'stroop')    return <StroopChallenge onComplete={handleGameComplete} />;
  if (activeGame === 'memory')    return <PatternMemory   onComplete={handleGameComplete} />;
  if (activeGame === 'typing')    return <TypingChallenge onComplete={handleGameComplete} duration={30} />;
  if (activeGame === 'animals')   return <AnimalFacts     onComplete={handleGameComplete} />;
  if (activeGame === 'breathing') return <BreathingGame   onComplete={handleGameComplete} />;
  if (activeGame === 'flappy')    return <FlappyGame      onComplete={handleGameComplete} />;
  if (activeGame === 'reaction')  return <ReactionGame    onComplete={handleGameComplete} />;
  if (activeGame === 'oddone')    return <OddOneOut       onComplete={handleGameComplete} />;

  // ── Render: post-game ──────────────────────────────────────────────────────

  if (finishedGame) {
    return (
      <ArcadePostGame
        gameName={finishedGame.name}
        onBack={handleBack}
        onPlayAgain={handlePlayAgain}
      />
    );
  }

  // ── Render: game list ──────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Arcade</Text>
          <Text style={styles.headerSubtitle}>Play for fun · No points earned</Text>
        </View>

        {/* ── Free arcade callout ── */}
        <View style={styles.freeCallout}>
          <Feather name="game-controller" size={18} color={COLORS.purple} />
          <Text style={styles.freeCalloutText}>
            All games are <Text style={styles.freeHighlight}>always free</Text> to play here.{'\n'}
            Upgrade to earn points when you're intercepted.
          </Text>
        </View>

        {/* ── Standard games section ── */}
        <Text style={styles.sectionLabel}>Standard Games</Text>
        {ALL_GAMES.filter((g) => g.tier === 'standard').map((game) => (
          <ArcadeGameCard key={game.id} game={game} onPlay={handlePlay} />
        ))}

        {/* ── Pro games section ── */}
        <Text style={styles.sectionLabel}>
          {'Pro Games  '}
          <Text style={styles.proSectionNote}>⭐ Free to play in Arcade</Text>
        </Text>
        {ALL_GAMES.filter((g) => g.tier === 'pro').map((game) => (
          <ArcadeGameCard key={game.id} game={game} onPlay={handlePlay} />
        ))}

        {/* Bottom spacer so last card isn't hidden by tab bar */}
        <View style={{ height: SPACING.xxl }} />

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  scroll: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
    gap: SPACING.sm,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    marginBottom: SPACING.md,
  },

  headerTitle: {
    fontFamily: FONTS.display,
    fontSize: 36,
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },

  headerSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  // ── Free callout banner ───────────────────────────────────────────────────
  freeCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: COLORS.purple + '15',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.purple + '30',
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },

  freeCalloutText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
    flex: 1,
  },

  freeHighlight: {
    fontFamily: FONTS.bodyBold,
    color: COLORS.purple,
  },

  // ── Section labels ─────────────────────────────────────────────────────────
  sectionLabel: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },

  proSectionNote: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.warning,
    letterSpacing: 0.5,
    textTransform: 'none',
  },

  // ── Game card ─────────────────────────────────────────────────────────────
  cardPressable: {
    width: '100%',
  },

  gameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.md,
    position: 'relative',
  },

  proBadge: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: COLORS.warning + '20',
    borderRadius: RADIUS.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.warning + '50',
  },

  proBadgeText: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.warning,
    letterSpacing: 0.5,
  },

  gameEmoji: {
    fontSize: 36,
    width: 46,
    textAlign: 'center',
  },

  gameInfo: {
    flex: 1,
    gap: 2,
  },

  gameName: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: COLORS.textPrimary,
  },

  gameDescription: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },

  gameTagline: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    marginTop: 2,
  },

  // ── Post-game screen ──────────────────────────────────────────────────────
  postGameContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.lg,
  },

  postGameEmoji: {
    fontSize: 72,
    lineHeight: 88,
  },

  postGameTitle: {
    fontFamily: FONTS.display,
    fontSize: 36,
    color: COLORS.textPrimary,
  },

  postGameGame: {
    fontFamily: FONTS.body,
    fontSize: 16,
    color: COLORS.textMuted,
  },

  arcadeNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.md,
    width: '100%',
  },

  arcadeNoteText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 20,
    flex: 1,
  },

  postGameActions: {
    width: '100%',
    gap: SPACING.sm,
  },

  playAgainButton: {
    backgroundColor: COLORS.purple,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },

  playAgainText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 17,
    color: COLORS.background,
  },

  backButton: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },

  backButtonText: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textMuted,
  },
});
