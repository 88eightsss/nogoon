// ═══════════════════════════════════════════════════════════════════════════
//  ARCADE TAB — NoGoon
//  ────────────────────
//  13 games. Standard is open to all paid plans. Pro is Pro-only.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  SafeAreaView,
  Animated,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';

// ── Standard games ──────────────────────────────────────────────────────────
import { GroundingExercise } from '@/components/games/GroundingExercise';
import { BreathRhythm }     from '@/components/games/BreathRhythm';
import { OddOneOut }        from '@/components/games/OddOneOut';
import { ColorSort }        from '@/components/games/ColorSort';
import { BallSort }         from '@/components/games/BallSort';
import { NumberFlow }       from '@/components/games/NumberFlow';
import { GemMatch }         from '@/components/games/GemMatch';
import { WordWeave }        from '@/components/games/WordWeave';
import { StackGame }        from '@/components/games/StackGame';
import { PatternMemory }    from '@/components/games/PatternMemory';
// ── Pro games ───────────────────────────────────────────────────────────────
import { WarpGame }         from '@/components/games/WarpGame';
import { IntentionCheck }   from '@/components/games/IntentionCheck';
import { TypingChallenge }  from '@/components/games/TypingChallenge';

import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { ALL_GAMES, type GameMeta, type GameId } from '@/constants/games';

type GameEntry = GameMeta;

// ─── Post-game screen ─────────────────────────────────────────────────────────

function ArcadePostGame({ gameName, onBack, onPlayAgain }: {
  gameName: string; onBack: () => void; onPlayAgain: () => void;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.postGameContainer}>
        <Text style={styles.postGameEmoji}>🎮</Text>
        <Text style={styles.postGameTitle}>Nice work!</Text>
        <Text style={styles.postGameGame}>{gameName}</Text>
        <View style={styles.arcadeNote}>
          <Feather name="info" size={16} color={COLORS.textMuted} />
          <Text style={styles.arcadeNoteText}>
            Arcade mode — 0 pts earned{'\n'}Blocking intercepts earn real points
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

// ─── Game card ────────────────────────────────────────────────────────────────

function ArcadeGameCard({ game, onPlay }: { game: GameEntry; onPlay: (id: GameId) => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPressIn={() => Animated.timing(scale, { toValue: 0.96, duration: 70, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, damping: 12, useNativeDriver: true }).start()}
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
        {game.tier === 'pro' && (
          <View style={[styles.proBadge, { backgroundColor: game.color + '18', borderColor: game.color + '45' }]}>
            <Text style={[styles.proBadgeText, { color: game.color }]}>✦ PRO</Text>
          </View>
        )}
        <Text style={styles.gameEmoji}>{game.emoji}</Text>
        <View style={styles.gameInfo}>
          <Text style={styles.gameName}>{game.name}</Text>
          <Text style={styles.gameDescription}>{game.description}</Text>
          <Text style={[styles.gameTagline, { color: game.color }]}>{game.tagline}</Text>
        </View>
        <Feather name="play-circle" size={28} color={game.color} />
      </Animated.View>
    </Pressable>
  );
}

// ─── Main Arcade Screen ───────────────────────────────────────────────────────

export default function ArcadeScreen() {
  const { game: gameParam } = useLocalSearchParams<{ game?: string }>();
  const [activeGame, setActiveGame]     = useState<GameId | null>(null);
  const [finishedGame, setFinishedGame] = useState<GameEntry | null>(null);

  // Auto-launch if navigated here with a specific game (e.g. from Daily Challenge)
  useEffect(() => {
    if (gameParam && ALL_GAMES.some((g) => g.id === gameParam)) {
      setActiveGame(gameParam as GameId);
    }
  }, [gameParam]);

  const handleGameComplete = (_score: number) => {
    const game = ALL_GAMES.find((g) => g.id === activeGame) ?? null;
    setFinishedGame(game);
    setActiveGame(null);
  };

  const handlePlay = (id: GameId) => {
    setFinishedGame(null);
    setActiveGame(id);
  };

  const handleBack      = () => { setFinishedGame(null); setActiveGame(null); };
  const handlePlayAgain = () => { if (finishedGame) handlePlay(finishedGame.id); };

  // ── Active game renders ───────────────────────────────────────────────────
  if (activeGame === 'breathing')  return <BreathRhythm    onComplete={handleGameComplete} />;
  if (activeGame === 'grounding')  return <GroundingExercise onComplete={handleGameComplete} />;
  if (activeGame === 'oddone')     return <OddOneOut        onComplete={handleGameComplete} />;
  if (activeGame === 'colorsort')  return <ColorSort        onComplete={handleGameComplete} />;
  if (activeGame === 'ballsort')   return <BallSort         onComplete={handleGameComplete} />;
  if (activeGame === 'numberflow') return <NumberFlow       onComplete={handleGameComplete} />;
  if (activeGame === 'gemmatch')   return <GemMatch         onComplete={handleGameComplete} />;
  if (activeGame === 'wordweave')  return <WordWeave        onComplete={handleGameComplete} />;
  if (activeGame === 'warp')       return <WarpGame         onComplete={handleGameComplete} />;
  if (activeGame === 'stack')      return <StackGame        onComplete={handleGameComplete} />;
  if (activeGame === 'intention')  return <IntentionCheck   onComplete={handleGameComplete} />;
  if (activeGame === 'typing')     return <TypingChallenge  onComplete={handleGameComplete} duration={30} />;
  if (activeGame === 'memory')     return <PatternMemory    onComplete={handleGameComplete} />;

  if (finishedGame) {
    return (
      <ArcadePostGame
        gameName={finishedGame.name}
        onBack={handleBack}
        onPlayAgain={handlePlayAgain}
      />
    );
  }

  // ── Game list ─────────────────────────────────────────────────────────────

  const standardGames = ALL_GAMES.filter((g) => g.tier === 'standard');
  const proGames      = ALL_GAMES.filter((g) => g.tier === 'pro');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Arcade</Text>
          <Text style={styles.headerSubtitle}>Play for fun · No points earned</Text>
        </View>

        <View style={styles.freeCallout}>
          <Feather name="zap" size={18} color={COLORS.purple} />
          <Text style={styles.freeCalloutText}>
            All games are <Text style={styles.freeHighlight}>always free</Text> to play here.{'\n'}
            Upgrade to earn points when you're intercepted.
          </Text>
        </View>

        {/* Standard */}
        <Text style={styles.sectionLabel}>Standard  ·  {standardGames.length} games</Text>
        {standardGames.map((game) => (
          <ArcadeGameCard key={game.id} game={game} onPlay={handlePlay} />
        ))}

        {/* Pro */}
        <Text style={styles.sectionLabel}>
          {'Pro  ·  '}
          <Text style={styles.proNote}>✦ Free to play in Arcade</Text>
        </Text>
        {proGames.map((game) => (
          <ArcadeGameCard key={game.id} game={game} onPlay={handlePlay} />
        ))}

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },

  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop:        SPACING.xl,
    paddingBottom:     SPACING.lg,
    gap:               SPACING.sm,
  },

  header:         { marginBottom: SPACING.md },
  headerTitle:    { fontFamily: FONTS.display, fontSize: 36, color: COLORS.textPrimary, letterSpacing: -0.5 },
  headerSubtitle: { fontFamily: FONTS.body,    fontSize: 14, color: COLORS.textMuted,   marginTop: 2 },

  freeCallout: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    gap:             SPACING.sm,
    backgroundColor: COLORS.purple + '15',
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     COLORS.purple + '30',
    padding:         SPACING.md,
    marginBottom:    SPACING.md,
  },

  freeCalloutText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textSecondary, lineHeight: 20, flex: 1 },
  freeHighlight:   { fontFamily: FONTS.bodyBold, color: COLORS.purple },

  sectionLabel: {
    fontFamily:    FONTS.mono,
    fontSize:      11,
    color:         COLORS.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop:     SPACING.md,
    marginBottom:  SPACING.xs,
  },

  proNote: {
    fontFamily:    FONTS.mono,
    fontSize:      10,
    color:         '#7dd3fc',
    letterSpacing: 0.5,
    textTransform: 'none',
  },

  cardPressable: { width: '100%' },

  gameCard: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: COLORS.surface,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    padding:         SPACING.md,
    gap:             SPACING.md,
    position:        'relative',
  },

  proBadge: {
    position:          'absolute',
    top:               SPACING.sm,
    right:             SPACING.sm,
    borderRadius:      RADIUS.xs,
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderWidth:       1,
  },

  proBadgeText: { fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 0.5 },

  gameEmoji:       { fontSize: 36, width: 46, textAlign: 'center' },
  gameInfo:        { flex: 1, gap: 2 },
  gameName:        { fontFamily: FONTS.bodyBold, fontSize: 16, color: COLORS.textPrimary },
  gameDescription: { fontFamily: FONTS.body,     fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  gameTagline:     { fontFamily: FONTS.mono,     fontSize: 10, letterSpacing: 0.5, marginTop: 2 },

  // ── Post-game ─────────────────────────────────────────────────────────────
  postGameContainer: {
    flex: 1,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: SPACING.lg,
    gap:               SPACING.lg,
  },

  postGameEmoji: { fontSize: 72, lineHeight: 88 },
  postGameTitle: { fontFamily: FONTS.display, fontSize: 36, color: COLORS.textPrimary },
  postGameGame:  { fontFamily: FONTS.body,    fontSize: 16, color: COLORS.textMuted },

  arcadeNote: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    gap:             SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     COLORS.cardBorder,
    padding:         SPACING.md,
    width:           '100%',
  },

  arcadeNoteText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted, lineHeight: 20, flex: 1 },

  postGameActions: { width: '100%', gap: SPACING.sm },

  playAgainButton: {
    backgroundColor: COLORS.purple,
    borderRadius:    RADIUS.md,
    paddingVertical: SPACING.lg,
    alignItems:      'center',
  },

  playAgainText: { fontFamily: FONTS.bodyBold, fontSize: 17, color: COLORS.background },

  backButton:     { paddingVertical: SPACING.md, alignItems: 'center' },
  backButtonText: { fontFamily: FONTS.body, fontSize: 15, color: COLORS.textMuted },
});
