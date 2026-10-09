// ═══════════════════════════════════════════════════════════════════════════
//  ARCADE TAB — NoGoon
//  ────────────────────
//  13 exclusive games, all free.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Modal,
  Switch,
  Alert,
  Easing,
  PanResponder,
  AccessibilityInfo,
  useWindowDimensions,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

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

import { FONTS } from '@/constants/Colors';
import { useThemedColors, type ArcadeColors } from '@/hooks/useThemedColors';
import { useTheme } from '@/hooks/useTheme';
import { PageGuide } from '@/components/PageGuide';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { ALL_GAMES, GATE_GAMES, CALM_GAMES, getGamesByCategory, type GameCategory, type GameMeta, type GameId } from '@/constants/games';
import { AdBanner } from '@/components/ads/AdBanner';
import { useThemeStore } from '@/stores/useThemeStore';
import { useUnlockedFeatures, lockHint } from '@/stores/useProgressStore';

// ─── Post-game screen ─────────────────────────────────────────────────────────

function ArcadePostGame({ gameName, onBack, onPlayAgain, styles, COLORS }: {
  gameName: string; onBack: () => void; onPlayAgain: () => void;
  styles: ReturnType<typeof makeStyles>; COLORS: ArcadeColors;
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

function GameInfoModal({ game, onClose, onPlay, styles, COLORS }: {
  game: GameMeta;
  onClose: () => void;
  onPlay: (id: GameId) => void;
  styles: ReturnType<typeof makeStyles>; COLORS: ArcadeColors;
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
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onClose();
              onPlay(game.id as GameId);
            }}
          >
            <Feather name="play" size={18} color={COLORS.background} />
            <Text style={styles.modalPlayText}>Play Now</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Game row ─────────────────────────────────────────────────────────────────
// No play button: the whole row is the tap target. Rows settle in one by one
// when their board becomes the active one.

function ArcadeGameRow({ game, index, active, onPlay, onInfo, locked, lockMessage, accent, styles, COLORS }: {
  game: GameMeta;
  index: number;
  active: boolean;
  onPlay: (id: GameId) => void;
  onInfo: (game: GameMeta) => void;
  locked?: boolean;
  lockMessage?: string;
  accent: string;
  styles: ReturnType<typeof makeStyles>;
  COLORS: ArcadeColors;
}) {
  const scale  = useRef(new Animated.Value(1)).current;
  const reveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(
      reveal,
      active
        ? { toValue: 1, duration: 900, delay: index * 90 + 120, easing: Easing.out(Easing.cubic), useNativeDriver: true }
        : { toValue: 0, duration: 250, useNativeDriver: true },
    ).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <Animated.View
      style={{
        opacity: reveal,
        transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={locked ? `${game.name}, locked` : `Play ${game.name}`}
        onPressIn={() => { if (!locked) Animated.timing(scale, { toValue: 0.97, duration: 70, useNativeDriver: true }).start(); }}
        onPressOut={() => { if (!locked) Animated.spring(scale, { toValue: 1, damping: 12, useNativeDriver: true }).start(); }}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          if (locked) {
            Alert.alert('Still locked', lockMessage ?? 'Keep walking away to unlock this.');
            return;
          }
          onPlay(game.id as GameId);
        }}
      >
        <Animated.View
          style={[
            styles.gameRow,
            { transform: [{ scale }] },
            locked && styles.gameRowLocked,
          ]}
        >
          <View style={[styles.gameChip, { backgroundColor: accent + '22' }]}>
            <Text style={styles.gameChipEmoji}>{locked ? '🔒' : game.emoji}</Text>
          </View>
          <View style={styles.gameInfo}>
            <Text style={styles.gameName} numberOfLines={1}>{game.name}</Text>
            <Text style={styles.gameBlurb} numberOfLines={1}>
              {locked ? (lockMessage ?? 'Locked') : game.tagline}
            </Text>
          </View>
          {!locked && (
            <Pressable
              onPress={() => onInfo(game)}
              hitSlop={10}
              style={styles.infoBtn}
              accessibilityLabel={`How to play ${game.name}`}
            >
              <Feather name="info" size={17} color={COLORS.textMuted} />
            </Pressable>
          )}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Board pager ──────────────────────────────────────────────────────────────
// One category = one board (a whole card with all its games). Swipe the card up
// or down and the next board drifts in while the old one fades out, slowly.
// ▲ ▼ and "n / N" fade in when you touch the card and fade away again; the dot
// rail on the right always shows which board you're on.
//
// A single animated position (pos, in boards) drives the drag, the buttons and
// the settle, so what you see while dragging is exactly what plays on release.
// Only three boards are mounted: previous, current, next.

const BOARD_ICON: Record<GameCategory, string> = {
  calm: '🌬️', puzzle: '🧩', reflex: '👾', skill: '🎯', awareness: '👁️',
};
const SETTLE_MS = 900;   // full-board crossfade; a half-way drag takes half that
const mod = (a: number, n: number) => ((a % n) + n) % n;

type Board = { key: GameCategory; label: string; games: readonly GameMeta[] };

function BoardCard({ board, index, total, active, animStyle, front, navOp, navOn, onStep, onPlay, onInfo, locked, lockMessage, accent, styles, COLORS }: {
  board: Board; index: number; total: number; active: boolean;
  animStyle?: any; front: boolean;
  navOp: Animated.Value; navOn: boolean; onStep: (d: number) => void;
  onPlay: (id: GameId) => void; onInfo: (g: GameMeta) => void;
  locked: boolean; lockMessage?: string; accent: string;
  styles: ReturnType<typeof makeStyles>; COLORS: ArcadeColors;
}) {
  const [viewH, setViewH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const overflow = contentH > viewH + 1 && viewH > 0;
  return (
    <Animated.View
      pointerEvents={front ? 'auto' : 'none'}
      style={[StyleSheet.absoluteFill, styles.boardCard, { zIndex: active ? 3 : 2 }, animStyle]}
    >
      <View style={styles.boardHead}>
        <View style={styles.boardTitle}>
          <View style={[styles.boardIcon, { backgroundColor: accent + '22' }]}>
            <Text style={styles.boardIconEmoji}>{BOARD_ICON[board.key]}</Text>
          </View>
          <View>
            <Text style={styles.boardName}>{board.label}</Text>
            <Text style={styles.boardMeta}>{board.games.length} games</Text>
          </View>
        </View>
        {total > 1 && (
          <Animated.View style={[styles.boardNav, { opacity: navOp }]} pointerEvents={navOn ? 'auto' : 'none'}>
            <Pressable style={styles.deckNavBtn} onPress={() => onStep(-1)} hitSlop={8} accessibilityLabel="Previous board">
              <Feather name="chevron-up" size={18} color={COLORS.textPrimary} />
            </Pressable>
            <Text style={styles.deckCounter}>{index + 1} / {total}</Text>
            <Pressable style={styles.deckNavBtn} onPress={() => onStep(1)} hitSlop={8} accessibilityLabel="Next board">
              <Feather name="chevron-down" size={18} color={COLORS.textPrimary} />
            </Pressable>
          </Animated.View>
        )}
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.boardGames}
        scrollEnabled={overflow}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        onLayout={(e: LayoutChangeEvent) => setViewH(e.nativeEvent.layout.height)}
        onContentSizeChange={(_w, h) => setContentH(h)}
      >
        {board.games.map((g, k) => (
          <ArcadeGameRow
            key={g.id}
            game={g}
            index={k}
            active={active}
            onPlay={onPlay}
            onInfo={onInfo}
            locked={locked}
            lockMessage={lockMessage}
            accent={accent}
            styles={styles}
            COLORS={COLORS}
          />
        ))}
      </ScrollView>
    </Animated.View>
  );
}

function BoardPager({ boards, lockedFor, lockMessage, onPlay, onInfo, accent, styles, COLORS }: {
  boards: Board[];
  lockedFor: (key: GameCategory) => boolean;
  lockMessage?: string;
  onPlay: (id: GameId) => void;
  onInfo: (g: GameMeta) => void;
  accent: string;
  styles: ReturnType<typeof makeStyles>;
  COLORS: ArcadeColors;
}) {
  const n = boards.length;
  const multi = n >= 3;
  const [H, setH]         = useState(0);
  const [base, setBase]   = useState(0);          // settled board (absolute, can go negative)
  const [target, setTarget] = useState(0);        // board that is more than half-way in
  const [navOn, setNavOn] = useState(false);
  const pos     = useRef(new Animated.Value(0)).current;
  const navOp   = useRef(new Animated.Value(0)).current;
  const baseRef = useRef(0);
  const posRef  = useRef(0);
  const tgtRef  = useRef(0);
  const busy    = useRef(false);
  const Hr      = useRef(0);
  const reduce  = useRef(false);
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  Hr.current = H;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { reduce.current = v; }).catch(() => {});
    const id = pos.addListener(({ value }) => {
      posRef.current = value;
      const t = mod(Math.round(value), n);
      if (t !== tgtRef.current) { tgtRef.current = t; setTarget(t); }
    });
    return () => {
      pos.removeListener(id);
      if (navTimer.current) clearTimeout(navTimer.current);
    };
  }, [pos, n]);

  const showNav = () => {
    if (!multi) return;
    setNavOn(true);
    Animated.timing(navOp, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    if (navTimer.current) clearTimeout(navTimer.current);
    navTimer.current = setTimeout(() => {
      Animated.timing(navOp, { toValue: 0, duration: 700, useNativeDriver: true }).start(() => setNavOn(false));
    }, 2400);
  };

  const settle = (goal: number) => {
    if (!multi || busy.current) return;
    busy.current = true;
    const b = baseRef.current;
    const dist = Math.abs(b + goal - posRef.current);
    const dur = reduce.current ? 0 : SETTLE_MS * Math.max(dist, 0.35);
    if (goal !== 0) Haptics.selectionAsync();
    Animated.timing(pos, {
      toValue: b + goal,
      duration: dur,
      easing: Easing.inOut(Easing.sin),
      useNativeDriver: true,
    }).start(() => {
      baseRef.current = b + goal;
      setBase(b + goal);
      busy.current = false;
    });
  };

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_e, g) =>
      multi && !busy.current && Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.2,
    onPanResponderGrant: () => showNav(),
    onPanResponderMove: (_e, g) => {
      const v = Math.max(-1, Math.min(1, -g.dy / (Hr.current * 0.75)));
      pos.setValue(baseRef.current + v * 0.92);
    },
    onPanResponderRelease: (_e, g) => {
      const p = posRef.current - baseRef.current;
      settle(p > 0.22 || g.vy < -0.6 ? 1 : p < -0.22 || g.vy > 0.6 ? -1 : 0);
    },
    onPanResponderTerminate: () => settle(0),
  })).current;

  // previous / current / next, each with its own drift + cross-fade ramp.
  // x = how far a board is from centre, in boards: 0 centred, +1 waiting below, -1 gone above.
  const mounted = useMemo(() => {
    const MID = 0.536;   // (1 - 0.5) ^ 0.9: both boards half-visible mid-way
    const ramp = (slot: -1 | 0 | 1) => {
      if (!multi || H === 0) return undefined;
      const r3 = [base - 1, base, base + 1];
      const r5 = [base - 1, base - 0.5, base, base + 0.5, base + 1];
      const ty = slot === 0 ? [H * 0.34, 0, -H * 0.34] : slot === 1 ? [H * 0.68, H * 0.34, 0] : [0, -H * 0.34, -H * 0.68];
      const op = slot === 0 ? [0, MID, 1, MID, 0] : slot === 1 ? [0, 0, 0, MID, 1] : [1, MID, 0, 0, 0];
      const sc = slot === 0 ? [0.955, 1, 0.955] : slot === 1 ? [0.955, 0.955, 1] : [1, 0.955, 0.955];
      return {
        opacity: pos.interpolate({ inputRange: r5, outputRange: op, extrapolate: 'clamp' }),
        transform: [
          { translateY: pos.interpolate({ inputRange: r3, outputRange: ty, extrapolate: 'clamp' }) },
          { scale: pos.interpolate({ inputRange: r3, outputRange: sc, extrapolate: 'clamp' }) },
        ],
      };
    };
    if (!multi) return [{ i: 0, slot: 0 as const, style: undefined }];
    return ([-1, 0, 1] as const).map((slot) => ({ i: mod(base + slot, n), slot, style: ramp(slot) }));
  }, [base, H, n, multi, pos]);

  const front = mod(base, n);

  return (
    <View
      style={styles.pager}
      onLayout={(e: LayoutChangeEvent) => setH(e.nativeEvent.layout.height)}
      onTouchStart={showNav}
      {...(multi ? pan.panHandlers : {})}
    >
      {H > 0 && mounted.map(({ i, slot, style }) => (
        <BoardCard
          key={boards[i].key}
          board={boards[i]}
          index={i}
          total={n}
          active={multi ? target === i : true}
          animStyle={style}
          front={slot === 0}
          navOp={navOp}
          navOn={navOn && i === front}
          onStep={settle}
          onPlay={onPlay}
          onInfo={onInfo}
          locked={lockedFor(boards[i].key)}
          lockMessage={lockMessage}
          accent={accent}
          styles={styles}
          COLORS={COLORS}
        />
      ))}
      {multi && (
        <View style={styles.dotRail} pointerEvents="none">
          {boards.map((b, i) => (
            <View
              key={b.key}
              style={[styles.dot, i === target && { backgroundColor: accent, height: 15, opacity: 0.9 }]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Main Arcade Screen ───────────────────────────────────────────────────────

export default function ArcadeScreen() {
  const COLORS = useThemedColors();
  const { colors: liveColors } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { game: gameParam, category: categoryParam } = useLocalSearchParams<{ game?: string; category?: string }>();
  const { disabledGateGames, toggleGateGame, enabledCalmGateGames, toggleCalmGateGame } = useThemeStore();
  const { unlocked } = useUnlockedFeatures();
  const fullArcadeUnlocked = unlocked.has('fullArcade');

  const [showAll, setShowAll]           = useState(false);
  const [sheet, setSheet]             = useState<'gate' | 'calm' | null>(null);
  const { height: winH }              = useWindowDimensions();
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

  // Back arrow lives in the header (not floating over the game). The ref keeps
  // the handler fresh without re-registering the header every render.
  const backRef = useRef<() => void>(() => {});

  // Dynamic header color — matches the active game's color identity
  useEffect(() => {
    if (activeGame) {
      const game = ALL_GAMES.find((g) => g.id === activeGame);
      if (game) {
        navigation.setOptions({
          headerTintColor: game.color,
          title: game.name,
          headerLeft: () => (
            <Pressable
              onPress={() => backRef.current()}
              hitSlop={12}
              style={{ paddingHorizontal: SPACING.md }}
              accessibilityRole="button"
              accessibilityLabel="Back to Arcade"
            >
              <Feather name="arrow-left" size={22} color={game.color} />
            </Pressable>
          ),
        });
      }
    } else {
      navigation.setOptions({ headerTintColor: COLORS.arcade, title: 'Arcade', headerLeft: undefined });
    }
  }, [activeGame, navigation, COLORS]);

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
  backRef.current = handleBack;

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
        styles={styles}
        COLORS={COLORS}
      />
    );
  }

  // ── Game list ─────────────────────────────────────────────────────────────

  const LABELS: Record<GameCategory, string> = {
    calm: 'Calm', puzzle: 'Puzzle', reflex: 'Reflex', skill: 'Skill', awareness: 'Awareness',
  };
  const boards: Board[] = ((calmOnly
    ? ['calm']
    : ['calm', 'puzzle', 'reflex', 'skill', 'awareness']) as GameCategory[])
    .map((key) => ({ key, label: LABELS[key], games: getGamesByCategory(key) }))
    .filter((b) => b.games.length > 0);

  const gateOn = GATE_GAMES.length - disabledGateGames.filter((id) => GATE_GAMES.some((g) => g.id === id)).length;
  const calmOn = enabledCalmGateGames.filter((id) => CALM_GAMES.some((g) => g.id === id)).length;

  const renderToggles = (
    list: readonly GameMeta[],
    isOn: (id: string) => boolean,
    toggle: (id: any) => void,
  ) => list.map((game, idx) => {
    const enabled = isOn(game.id);
    return (
      <View key={game.id} style={[styles.gateToggleRow, idx !== list.length - 1 && styles.gateToggleDivider]}>
        <Text style={styles.gateToggleEmoji}>{game.emoji}</Text>
        <Text style={[styles.gateToggleName, !enabled && styles.gateToggleNameOff]}>{game.name}</Text>
        <Switch
          value={enabled}
          onValueChange={() => toggle(game.id)}
          trackColor={{ false: COLORS.surface, true: COLORS.green + '66' }}
          thumbColor={enabled ? COLORS.green : COLORS.textMuted}
        />
      </View>
    );
  });

  return (
    <>
    <SafeAreaView style={styles.safe}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Arcade</Text>
          <Text style={styles.headerSubtitle}>
            {calmOnly ? 'Calm games · low stimulation only' : 'Play for fun · No points earned here'}
          </Text>
        </View>

        {calmOnly && (
          <View>
            <View style={styles.calmBanner}>
              <Feather name="wind" size={16} color={COLORS.warning} />
              <Text style={styles.calmBannerText}>
                Showing calm games only — lower stimulation, easier to step away from.
              </Text>
            </View>
            <Pressable style={styles.seeAllBtn} onPress={() => setShowAll(true)}>
              <Text style={styles.seeAllText}>See all {ALL_GAMES.length} games →</Text>
            </Pressable>
          </View>
        )}

        <BoardPager
          key={calmOnly ? 'calm' : 'all'}
          boards={boards}
          lockedFor={(k) => k !== 'calm' && !fullArcadeUnlocked}
          lockMessage={fullArcadeUnlocked ? undefined : lockHint('fullArcade')}
          onPlay={handlePlay}
          onInfo={setInfoGame}
          accent={liveColors.accent}
          styles={styles}
          COLORS={COLORS}
        />

        {/* Intercept settings stay pinned under the pager; each opens a sheet */}
        {!calmOnly && (
          <View style={styles.pinned}>
            <Pressable style={styles.pinRow} onPress={() => setSheet('gate')} accessibilityRole="button">
              <Text style={styles.pinName}>Intercept games</Text>
              <Text style={styles.pinCount}>{gateOn} on  ›</Text>
            </Pressable>
            <Pressable style={styles.pinRow} onPress={() => setSheet('calm')} accessibilityRole="button">
              <Text style={styles.pinName}>Calm games in intercepts</Text>
              <Text style={styles.pinCount}>{calmOn} on  ›</Text>
            </Pressable>
          </View>
        )}

        {/* Only on taller screens, so the boards keep their room */}
        {winH >= 760 && <AdBanner size="banner" style={{ marginTop: SPACING.xs }} />}
      </View>
    </SafeAreaView>

    {/* Game info modal */}
    {infoGame && (
      <GameInfoModal
        game={infoGame}
        onClose={() => setInfoGame(null)}
        onPlay={handlePlay}
        styles={styles}
        COLORS={COLORS}
      />
    )}

    {/* Intercept toggles sheet */}
    <Modal transparent visible={sheet !== null} animationType="slide" onRequestClose={() => setSheet(null)}>
      <Pressable style={styles.modalBackdrop} onPress={() => setSheet(null)}>
        <Pressable style={[styles.modalSheet, { borderColor: COLORS.cardBorder, maxHeight: '82%' }]} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalName, { flex: 1, fontSize: 20 }]}>
              {sheet === 'calm' ? 'Calm games in intercepts' : 'Intercept games'}  ·  {sheet === 'calm' ? calmOn : gateOn} on
            </Text>
            <Pressable onPress={() => setSheet(null)} hitSlop={12} accessibilityLabel="Close">
              <Feather name="x" size={20} color={COLORS.textMuted} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.gateToggleCard}>
              <Text style={styles.gateToggleHint}>
                {sheet === 'calm'
                  ? "Calm games sit out of blocker intercepts by default. Flip one on here if you'd like it to be able to pop up there too."
                  : "Choose which games can pop up when you hit a blocker. Turn off games you don't enjoy."}
              </Text>
              {sheet === 'calm'
                ? renderToggles(CALM_GAMES, (id) => enabledCalmGateGames.includes(id as any), toggleCalmGateGame)
                : renderToggles(GATE_GAMES, (id) => !disabledGateGames.includes(id as any), toggleGateGame)}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>

    <PageGuide
      page="arcade"
      icon="zap"
      accent={liveColors.arcade}
      title="Arcade"
      hint="Your game library"
      subtitle="Mini-games to do instead of scrolling."
      points={[
        { icon: 'lock',       title: 'Unlocks as you go',  body: 'New games open as you walk away from blocked apps.' },
        { icon: 'wind',       title: 'Calm games',            body: 'Low-stimulation picks for when you just need a distraction.' },
        { icon: 'shield-off', title: 'No pressure',           body: 'No points to chase.' },
      ]}
    />
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const makeStyles = (COLORS: ArcadeColors) => StyleSheet.create({
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

  screen: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop:        SPACING.lg,
    paddingBottom:     SPACING.sm,
    gap:               SPACING.sm,
  },

  // Board pager: one board visible at a time, boards drift + cross-fade
  pager: {
    flex: 1,
    minHeight: 260,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
  },
  boardCard: {
    backgroundColor: COLORS.surface,
    borderRadius:    RADIUS.xl,
    borderWidth:     1,
    borderColor:     COLORS.cardBorder,
    paddingTop:      SPACING.lg,
    paddingHorizontal: SPACING.md,
    paddingBottom:   SPACING.sm,
    gap:             SPACING.md,
  },
  boardHead:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 },
  boardTitle: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  boardIcon:  { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.cardBorder },
  boardIconEmoji: { fontSize: 21 },
  boardName:  { fontFamily: FONTS.display, fontSize: 22, color: COLORS.textPrimary },
  boardMeta:  { fontFamily: FONTS.mono, fontSize: 10.5, letterSpacing: 0.8, color: COLORS.textMuted, textTransform: 'uppercase', marginTop: 4 },
  boardNav:   { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  boardGames: { gap: 7, paddingBottom: SPACING.xs },

  deckNavBtn:  {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  deckCounter: {
    fontFamily: FONTS.mono, fontSize: 12, color: COLORS.textSecondary,
    minWidth: 40, textAlign: 'center', fontVariant: ['tabular-nums'],
  },

  dotRail: {
    position: 'absolute', right: 3, top: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center', gap: 7, zIndex: 10,
  },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.textMuted, opacity: 0.35 },

  // Game rows: the whole row is the button
  gameRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: COLORS.background,
    borderRadius:    16,
    borderWidth:     1,
    borderColor:     COLORS.cardBorder,
    paddingVertical: 8,
    paddingHorizontal: SPACING.md,
    gap:             SPACING.md,
  },
  gameRowLocked: { opacity: 0.55 },
  gameChip:      { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  gameChipEmoji: { fontSize: 18 },
  gameInfo:      { flex: 1, gap: 3 },
  gameName:      { fontFamily: FONTS.bodyBold, fontSize: 14.5, color: COLORS.textPrimary },
  gameBlurb:     { fontFamily: FONTS.body, fontSize: 11.5, color: COLORS.textMuted },
  infoBtn:       { padding: 4 },

  // Pinned intercept rows
  pinned:  { gap: 6 },
  pinRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 11, paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  pinName:  { fontFamily: FONTS.bodyBold, fontSize: 12.5, color: COLORS.textPrimary },
  pinCount: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.textMuted },

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
});
