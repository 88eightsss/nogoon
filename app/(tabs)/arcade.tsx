// ═══════════════════════════════════════════════════════════════════════════
//  ARCADE TAB — NoGoon
//  ────────────────────
//  13 exclusive games, all free.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Modal,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { Feather } from '@expo/vector-icons';

// ── Standard games ──────────────────────────────────────────────────────────
import { GroundingExercise } from '@/components/games/GroundingExercise';
import { BreathRhythm }     from '@/components/games/BreathRhythm';
import { OddOneOut }        from '@/components/games/OddOneOut';
import { ColorSort }        from '@/components/games/ColorSort';
// BallSort removed
import { TwentyFortyEight } from '@/components/games/TwentyFortyEight';
import { WordWeave }        from '@/components/games/WordWeave';
import { StackGame }        from '@/components/games/StackGame';
import { PatternMemory }    from '@/components/games/PatternMemory';
// ── Pro games ───────────────────────────────────────────────────────────────
import { WarpGame }         from '@/components/games/WarpGame';
import { IntentionCheck }   from '@/components/games/IntentionCheck';
import { TypingChallenge }  from '@/components/games/TypingChallenge';
// SandToy removed
import { SpotTheSponsored } from '@/components/games/SpotTheSponsored';
// ── Retro 2-bit games ────────────────────────────────────────────────────────
import { PixelDodge }       from '@/components/games/PixelDodge';
// FlashTap removed
import { SnakeGame }        from '@/components/games/SnakeGame';
import { BrickBreak }       from '@/components/games/BrickBreak';
import { EndlessRunner }    from '@/components/games/EndlessRunner';
import { FlappyBird }       from '@/components/games/FlappyBird';
import { Minesweeper }      from '@/components/games/Minesweeper';
import GoonWord             from '@/components/games/GoonWord';

import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { ALL_GAMES, GATE_GAMES, getGamesByCategory, type GameCategory, type GameMeta, type GameId } from '@/constants/games';
import { AdBanner } from '@/components/ads/AdBanner';
import { useThemeStore } from '@/stores/useThemeStore';

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

// ─── Game info modal ──────────────────────────────────────────────────────────

function GameInfoModal({ game, onClose, onPlay }: {
  game: GameMeta;
  onClose: () => void;
  onPlay: (id: GameId) => void;
}) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={[styles.modalSheet, { borderColor: game.color + '40' }]} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalEmoji}>{game.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalName}>{game.name}</Text>
              <Text style={[styles.modalTagline, { color: game.color }]}>{game.tagline}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Feather name="x" size={20} color={COLORS.textMuted} />
            </Pressable>
          </View>
          <Text style={styles.modalSectionLabel}>HOW TO PLAY</Text>
          <Text style={styles.modalHowTo}>{game.howToPlay}</Text>
          <Pressable
            style={[styles.modalPlayBtn, { backgroundColor: game.color }]}
            onPress={() => { onClose(); onPlay(game.id as GameId); }}
          >
            <Feather name="play" size={18} color={COLORS.background} />
            <Text style={styles.modalPlayText}>Play Now</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Game card ────────────────────────────────────────────────────────────────

function ArcadeGameCard({ game, onPlay, onInfo }: {
  game: GameMeta;
  onPlay: (id: GameId) => void;
  onInfo: (game: GameMeta) => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPressIn={() => Animated.timing(scale, { toValue: 0.96, duration: 70, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, damping: 12, useNativeDriver: true }).start()}
      onPress={() => onPlay(game.id as GameId)}
      style={styles.cardPressable}
    >
      <Animated.View
        style={[
          styles.gameCard,
          { borderColor: game.color + '40' },
          { transform: [{ scale }] },
        ]}
      >
        <Text style={styles.gameEmoji}>{game.emoji}</Text>
        <View style={styles.gameInfo}>
          <View style={styles.gameNameRow}>
            <Text style={styles.gameName}>{game.name}</Text>
            {game.category === 'awareness' && (
              <View style={[styles.experienceBadge, { backgroundColor: game.color + '22', borderColor: game.color + '55' }]}>
                <Text style={[styles.experienceBadgeText, { color: game.color }]}>Awareness</Text>
              </View>
            )}
          </View>
          <Text style={styles.gameDescription}>{game.description}</Text>
          <Text style={[styles.gameTagline, { color: game.color }]}>{game.tagline}</Text>
        </View>
        <Pressable
          onPress={(e) => { e.stopPropagation(); onInfo(game); }}
          hitSlop={10}
          style={styles.infoBtn}
        >
          <Feather name="info" size={20} color={game.color + 'aa'} />
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}

// ─── Main Arcade Screen ───────────────────────────────────────────────────────

export default function ArcadeScreen() {
  const { game: gameParam, category: categoryParam } = useLocalSearchParams<{ game?: string; category?: string }>();
  const { disabledGateGames, toggleGateGame } = useThemeStore();

  const [showAll, setShowAll]           = useState(false);
  const calmOnly = categoryParam === 'calm' && !showAll;
  const [activeGame, setActiveGame]     = useState<GameId | null>(null);
  const [finishedGame, setFinishedGame] = useState<GameMeta | null>(null);
  const [infoGame, setInfoGame]         = useState<GameMeta | null>(null);
  const navigation = useNavigation();

  // Auto-launch if navigated here with a specific game (e.g. from Daily Challenge)
  useEffect(() => {
    if (gameParam && ALL_GAMES.some((g) => g.id === gameParam)) {
      setActiveGame(gameParam as GameId);
    }
  }, [gameParam]);

  // Dynamic header color — matches the active game's color identity
  useEffect(() => {
    if (activeGame) {
      const game = ALL_GAMES.find((g) => g.id === activeGame);
      if (game) {
        navigation.setOptions({ headerTintColor: game.color, title: game.name });
      }
    } else {
      navigation.setOptions({ headerTintColor: COLORS.arcade, title: 'Arcade' });
    }
  }, [activeGame, navigation]);

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
  const handlePlayAgain = () => { if (finishedGame) handlePlay(finishedGame.id as GameId); };

  // ── Active game renders ───────────────────────────────────────────────────
  if (activeGame) {
    let gameNode: React.ReactNode = null;
    if (activeGame === 'breathing')  gameNode = <BreathRhythm    onComplete={handleGameComplete} />;
    if (activeGame === 'grounding')  gameNode = <GroundingExercise onComplete={handleGameComplete} />;
    if (activeGame === 'oddone')     gameNode = <OddOneOut        onComplete={handleGameComplete} />;
    if (activeGame === 'colorsort')  gameNode = <ColorSort        onComplete={handleGameComplete} />;
    if (activeGame === 'twentyfortyeight') gameNode = <TwentyFortyEight onComplete={handleGameComplete} />;
    if (activeGame === 'wordweave')      gameNode = <WordWeave        onComplete={handleGameComplete} />;
    if (activeGame === 'warp')           gameNode = <WarpGame         onComplete={handleGameComplete} />;
    if (activeGame === 'stack')          gameNode = <StackGame        onComplete={handleGameComplete} />;
    if (activeGame === 'intention')      gameNode = <IntentionCheck   onComplete={handleGameComplete} />;
    if (activeGame === 'typing')         gameNode = <TypingChallenge  onComplete={handleGameComplete} duration={30} />;
    if (activeGame === 'memory')         gameNode = <PatternMemory    onComplete={handleGameComplete} />;
    if (activeGame === 'spotsponsored')  gameNode = <SpotTheSponsored onComplete={handleGameComplete} />;
    if (activeGame === 'pixeldodge')     gameNode = <PixelDodge       onComplete={handleGameComplete} />;
    if (activeGame === 'snakegame')      gameNode = <SnakeGame        onComplete={handleGameComplete} />;
    if (activeGame === 'brickbreak')     gameNode = <BrickBreak       onComplete={handleGameComplete} />;
    if (activeGame === 'runner')         gameNode = <EndlessRunner    onComplete={handleGameComplete} />;
    if (activeGame === 'flappy')         gameNode = <FlappyBird       onComplete={handleGameComplete} />;
    if (activeGame === 'minesweeper')    gameNode = <Minesweeper      onComplete={handleGameComplete} />;
    if (activeGame === 'goon')           gameNode = <GoonWord         onComplete={(won) => handleGameComplete(won ? 100 : 0)} />;

    if (gameNode) {
      return (
        <View style={{ flex: 1 }}>
          {gameNode}
          {/* Back button — arcade only, never shown during gate/blocking flow */}
          <Pressable style={styles.arcadeBackBtn} onPress={handleBack} hitSlop={12}>
            <Feather name="arrow-left" size={20} color="rgba(255,255,255,0.85)" />
          </Pressable>
        </View>
      );
    }
  }

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

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Arcade</Text>
          <Text style={styles.headerSubtitle}>
            {calmOnly ? 'Calm games · low stimulation only' : 'Play for fun · No points earned here'}
          </Text>
        </View>

        {calmOnly ? (
          <View>
            <View style={styles.calmBanner}>
              <Feather name="wind" size={16} color={COLORS.warning} />
              <Text style={styles.calmBannerText}>
                Showing calm games only — lower stimulation, easier to step away from.
              </Text>
            </View>
            <Pressable
              style={styles.seeAllBtn}
              onPress={() => setShowAll(true)}
            >
              <Text style={styles.seeAllText}>See all {ALL_GAMES.length} games →</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.freeCallout}>
            <Feather name="zap" size={18} color={COLORS.arcade} />
            <Text style={styles.freeCalloutText}>
              <Text style={styles.freeHighlight}>{ALL_GAMES.length} games</Text>
              {' '}included with NoGoon — all free, forever.
            </Text>
          </View>
        )}

        {/* Categorized game sections */}
        {(
          (calmOnly
            ? [{ key: 'calm' as GameCategory, label: 'Calm' }]
            : [
                { key: 'calm',      label: 'Calm' },
                { key: 'puzzle',    label: 'Puzzle' },
                { key: 'reflex',    label: 'Reflex' },
                { key: 'skill',     label: 'Skill' },
                { key: 'awareness', label: 'Awareness' },
              ]
          ) as { key: GameCategory; label: string }[]
        ).map(({ key, label }) => {
          const games = getGamesByCategory(key);
          if (games.length === 0) return null;
          return (
            <React.Fragment key={key}>
              <Text style={styles.sectionLabel}>{label}  ·  {games.length}</Text>
              {games.map((game) => (
                <ArcadeGameCard key={game.id} game={game} onPlay={handlePlay} onInfo={setInfoGame} />
              ))}
            </React.Fragment>
          );
        })}

        {/* Game info modal */}
        {infoGame && (
          <GameInfoModal
            game={infoGame}
            onClose={() => setInfoGame(null)}
            onPlay={handlePlay}
          />
        )}

        {/* Gate intercept game toggles */}
        {!calmOnly && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: SPACING.xl }]}>
              Intercept games  ·  {GATE_GAMES.length - disabledGateGames.filter(id => GATE_GAMES.some(g => g.id === id)).length} on
            </Text>
            <View style={styles.gateToggleCard}>
              <Text style={styles.gateToggleHint}>
                Choose which games can pop up when you hit a blocker.
                Turn off games you don't enjoy.
              </Text>
              {GATE_GAMES.map((game, idx) => {
                const enabled = !disabledGateGames.includes(game.id);
                const isLast  = idx === GATE_GAMES.length - 1;
                return (
                  <View
                    key={game.id}
                    style={[
                      styles.gateToggleRow,
                      !isLast && styles.gateToggleDivider,
                    ]}
                  >
                    <Text style={styles.gateToggleEmoji}>{game.emoji}</Text>
                    <Text style={[styles.gateToggleName, !enabled && styles.gateToggleNameOff]}>
                      {game.name}
                    </Text>
                    <Switch
                      value={enabled}
                      onValueChange={() => toggleGateGame(game.id)}
                      trackColor={{ false: COLORS.surface, true: COLORS.green + '66' }}
                      thumbColor={enabled ? COLORS.green : COLORS.textMuted}
                    />
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Medium rectangle ad below the game list */}
        <AdBanner size="mediumRectangle" style={{ marginTop: SPACING.md }} />

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

  calmBanner: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    gap:             SPACING.sm,
    backgroundColor: COLORS.warning + '12',
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     COLORS.warning + '30',
    padding:         SPACING.md,
    marginBottom:    SPACING.md,
  },
  calmBannerText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textSecondary, lineHeight: 20, flex: 1 },

  seeAllBtn: {
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  seeAllText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.arcade,
  },

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
  freeHighlight:   { fontFamily: FONTS.bodyBold, color: COLORS.arcade },

  sectionLabel: {
    fontFamily:    FONTS.mono,
    fontSize:      11,
    color:         COLORS.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop:     SPACING.md,
    marginBottom:  SPACING.xs,
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

  gameEmoji:       { fontSize: 36, width: 46, textAlign: 'center' },
  gameInfo:        { flex: 1, gap: 2 },
  gameNameRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  gameName:        { fontFamily: FONTS.bodyBold, fontSize: 16, color: COLORS.textPrimary },
  experienceBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  experienceBadgeText: { fontFamily: FONTS.bodyMedium, fontSize: 10, letterSpacing: 0.3 },
  gameDescription: { fontFamily: FONTS.body,     fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  gameTagline:     { fontFamily: FONTS.mono,     fontSize: 10, letterSpacing: 0.5, marginTop: 2 },
  infoBtn:         { padding: 4 },

  // ── Gate toggle section ───────────────────────────────────────────────────
  gateToggleCard: {
    backgroundColor:  COLORS.surface,
    borderRadius:     RADIUS.lg,
    borderWidth:      1,
    borderColor:      COLORS.cardBorder,
    overflow:         'hidden',
    marginBottom:     SPACING.sm,
  },
  gateToggleHint: {
    fontFamily:  FONTS.body,
    fontSize:    12,
    color:       COLORS.textMuted,
    lineHeight:  18,
    paddingHorizontal: SPACING.md,
    paddingTop:  SPACING.md,
    paddingBottom: SPACING.sm,
  },
  gateToggleRow: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap:            SPACING.sm,
  },
  gateToggleDivider: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  gateToggleEmoji: { fontSize: 18, width: 28 },
  gateToggleName: {
    fontFamily: FONTS.bodyMedium,
    fontSize:   14,
    color:      COLORS.textPrimary,
    flex:       1,
  },
  gateToggleNameOff: { color: COLORS.textMuted },

  // ── Game info modal ───────────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: SPACING.xl,
    gap: SPACING.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  modalEmoji: { fontSize: 40, width: 48, textAlign: 'center' },
  modalName: {
    fontFamily: FONTS.display,
    fontSize: 22,
    color: COLORS.textPrimary,
  },
  modalTagline: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  modalSectionLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 1.2,
  },
  modalHowTo: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 24,
  },
  modalPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    marginTop: SPACING.sm,
  },
  modalPlayText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 17,
    color: COLORS.background,
  },

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

  // ── In-game back button (arcade only) ─────────────────────────────────────
  arcadeBackBtn: {
    position:        'absolute',
    top:             52,
    left:            SPACING.lg,
    width:           40,
    height:          40,
    borderRadius:    RADIUS.full,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:             999,
  },
});
