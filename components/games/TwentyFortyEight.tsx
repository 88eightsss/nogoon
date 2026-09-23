// ─── TwentyFortyEight — 2048 Puzzle Game with Smooth Tile Animations ───────────
//
// Classic 2048 with per-tile Animated.Value tracking so tiles glide to their
// new positions instead of snapping. Ghost tiles animate into merge targets,
// merged tiles pulse on arrival, new tiles pop in.
//
// CONTROLS: Swipe (PanResponder) — left, right, up, down.
// WIN:      Tile reaches 2048 → onComplete(score) after 1.5 s.
// LOSE:     No valid moves → onComplete(score).

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  Dimensions,
  Pressable,
  Animated,
} from 'react-native';
import { FONTS } from '@/constants/Colors';
import { useThemedColors, type ArcadeColors } from '@/hooks/useThemedColors';
import { SPACING, RADIUS } from '@/constants/Spacing';

// ─── Layout ───────────────────────────────────────────────────────────────────

const GRID      = 4;
const { width: W } = Dimensions.get('window');
const BOARD_SIZE = Math.min(W - 48, 360);
const BOARD_PAD  = 8;
const CELL_GAP   = 8;
const CELL_SIZE  = (BOARD_SIZE - BOARD_PAD * 2 - CELL_GAP * (GRID - 1)) / GRID;
const STRIDE     = CELL_SIZE + CELL_GAP;
const ANIM_MS    = 110;
const SWIPE_MIN  = 30;

// pixel helpers
function px(col: number): number { return BOARD_PAD + col * STRIDE; }
function py(row: number): number { return BOARD_PAD + row * STRIDE; }

// ─── Tile colors ──────────────────────────────────────────────────────────────

// Authentic 2048 warm tile palette
const TILE_COLORS: Record<number, { bg: string; fg: string }> = {
  2:    { bg: '#eee4da', fg: '#776e65' },
  4:    { bg: '#ede0c8', fg: '#776e65' },
  8:    { bg: '#f2b179', fg: '#ffffff' },
  16:   { bg: '#f59563', fg: '#ffffff' },
  32:   { bg: '#f67c5f', fg: '#ffffff' },
  64:   { bg: '#f65e3b', fg: '#ffffff' },
  128:  { bg: '#edcf72', fg: '#ffffff' },
  256:  { bg: '#edcc61', fg: '#ffffff' },
  512:  { bg: '#edc850', fg: '#ffffff' },
  1024: { bg: '#edc53f', fg: '#ffffff' },
  2048: { bg: '#edc22e', fg: '#ffffff' },
};
function tileColors(val: number) { return TILE_COLORS[val] ?? { bg: '#5b52f0', fg: '#fff' }; }
function tileFontSize(val: number): number {
  if (val >= 1024) return 18;
  if (val >= 128) return 22;
  return 26;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Tile = {
  id: number;
  value: number;
  row: number;
  col: number;
  fromRow: number;   // position before this move (animation start)
  fromCol: number;
  isNew: boolean;    // just spawned → scale-in
  isMerged: boolean; // just merged → pop
  isDead: boolean;   // consumed by a merge → slide to deadRow/deadCol then vanish
  deadRow: number;
  deadCol: number;
};

type AnimEntry = {
  tx:    Animated.Value;
  ty:    Animated.Value;
  scale: Animated.Value;
};

type Direction = 'left' | 'right' | 'up' | 'down';

// ─── Unique tile ID ───────────────────────────────────────────────────────────

let _uid = 1;
function uid(): number { return _uid++; }

// ─── Game logic ───────────────────────────────────────────────────────────────

function makeTile(value: number, row: number, col: number, isNew = true): Tile {
  return { id: uid(), value, row, col, fromRow: row, fromCol: col,
           isNew, isMerged: false, isDead: false, deadRow: row, deadCol: col };
}

function addRandom(tiles: Tile[]): Tile | null {
  const occupied = new Set(tiles.filter(t => !t.isDead).map(t => t.row * GRID + t.col));
  const empty: number[] = [];
  for (let i = 0; i < GRID * GRID; i++) if (!occupied.has(i)) empty.push(i);
  if (!empty.length) return null;
  const pos = empty[Math.floor(Math.random() * empty.length)];
  return makeTile(Math.random() < 0.9 ? 2 : 4, Math.floor(pos / GRID), pos % GRID, true);
}

function processLine(items: Tile[]): { out: Tile[]; ghosts: { tile: Tile; mergerIdx: number }[] } {
  const out: Tile[] = [];
  const ghosts: { tile: Tile; mergerIdx: number }[] = [];
  let i = 0;
  while (i < items.length) {
    const cur = items[i];
    const nxt = items[i + 1];
    if (nxt && cur.value === nxt.value) {
      const mergerIdx = out.length;
      out.push({ ...cur, id: uid(), value: cur.value * 2,
                 fromRow: cur.row, fromCol: cur.col,
                 isMerged: true, isNew: false, isDead: false });
      ghosts.push({ tile: { ...nxt, isDead: true, fromRow: nxt.row, fromCol: nxt.col }, mergerIdx });
      i += 2;
    } else {
      out.push({ ...cur, fromRow: cur.row, fromCol: cur.col, isMerged: false, isNew: false });
      i++;
    }
  }
  return { out, ghosts };
}

function applyMove(
  tiles: Tile[],
  dir: Direction,
): { liveTiles: Tile[]; deadTiles: Tile[]; score: number; moved: boolean } {
  const live = tiles.filter(t => !t.isDead);
  const newLive: Tile[] = [];
  const dead:    Tile[] = [];
  let score  = 0;
  let moved  = false;

  if (dir === 'left' || dir === 'right') {
    const positions = dir === 'left' ? [0, 1, 2, 3] : [3, 2, 1, 0];
    for (let r = 0; r < GRID; r++) {
      const row = live.filter(t => t.row === r)
                      .sort((a, b) => dir === 'left' ? a.col - b.col : b.col - a.col);
      const { out, ghosts } = processLine(row);
      out.forEach((t, idx) => {
        const nc = positions[idx];
        if (t.col !== nc || t.isMerged) moved = true;
        score += t.isMerged ? t.value : 0;
        newLive.push({ ...t, row: r, col: nc });
      });
      ghosts.forEach(({ tile, mergerIdx }) =>
        dead.push({ ...tile, deadRow: r, deadCol: positions[mergerIdx] })
      );
    }
  } else {
    const positions = dir === 'up' ? [0, 1, 2, 3] : [3, 2, 1, 0];
    for (let c = 0; c < GRID; c++) {
      const col = live.filter(t => t.col === c)
                      .sort((a, b) => dir === 'up' ? a.row - b.row : b.row - a.row);
      const { out, ghosts } = processLine(col);
      out.forEach((t, idx) => {
        const nr = positions[idx];
        if (t.row !== nr || t.isMerged) moved = true;
        score += t.isMerged ? t.value : 0;
        newLive.push({ ...t, row: nr, col: c });
      });
      ghosts.forEach(({ tile, mergerIdx }) =>
        dead.push({ ...tile, deadRow: positions[mergerIdx], deadCol: c })
      );
    }
  }

  if (dead.length > 0) moved = true;
  return { liveTiles: newLive, deadTiles: dead, score, moved };
}

function hasValidMoves(tiles: Tile[]): boolean {
  const live = tiles.filter(t => !t.isDead);
  if (live.length < GRID * GRID) return true;
  for (const t of live) {
    if (live.find(o => o.row === t.row && o.col === t.col + 1 && o.value === t.value)) return true;
    if (live.find(o => o.row === t.row + 1 && o.col === t.col && o.value === t.value)) return true;
  }
  return false;
}
function hasWon(tiles: Tile[]): boolean { return tiles.some(t => !t.isDead && t.value >= 2048); }

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props { onComplete: (score: number) => void; }

// ─── Component ────────────────────────────────────────────────────────────────

export function TwentyFortyEight({ onComplete }: Props) {
  const COLORS = useThemedColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [tiles, setTiles] = useState<Tile[]>(() => {
    const t1 = addRandom([]);
    if (!t1) return [];
    const t1s = { ...t1, isNew: false };
    const t2 = addRandom([t1s]);
    return t2 ? [t1s, { ...t2, isNew: false }] : [t1s];
  });
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<'playing' | 'won' | 'over'>('playing');

  const tilesRef  = useRef(tiles);
  const scoreRef  = useRef(score);
  const phaseRef  = useRef(phase);
  tilesRef.current = tiles;
  scoreRef.current = score;
  phaseRef.current = phase;

  const isAnimating = useRef(false);
  const animMap     = useRef<Map<number, AnimEntry>>(new Map());

  function getAnim(id: number, initX: number, initY: number): AnimEntry {
    if (!animMap.current.has(id)) {
      animMap.current.set(id, {
        tx:    new Animated.Value(initX),
        ty:    new Animated.Value(initY),
        scale: new Animated.Value(1),
      });
    }
    return animMap.current.get(id)!;
  }

  // Ensure anim entries exist for all current tiles (runs each render)
  for (const tile of tiles) {
    if (!animMap.current.has(tile.id)) {
      animMap.current.set(tile.id, {
        tx:    new Animated.Value(px(tile.col)),
        ty:    new Animated.Value(py(tile.row)),
        scale: new Animated.Value(tile.isNew ? 0.4 : 1),
      });
    }
  }

  // Trigger scale-in for new tiles
  useEffect(() => {
    for (const tile of tiles) {
      if (tile.isNew) {
        const a = animMap.current.get(tile.id);
        if (a) Animated.spring(a.scale, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }).start();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiles]);

  // ── Move handler ──────────────────────────────────────────────────────────
  const handleMove = useCallback((dir: Direction) => {
    if (phaseRef.current !== 'playing' || isAnimating.current) return;
    const { liveTiles, deadTiles, score: gained, moved } = applyMove(tilesRef.current, dir);
    if (!moved) return;

    isAnimating.current = true;
    const anims: Animated.CompositeAnimation[] = [];

    for (const tile of liveTiles) {
      const a = getAnim(tile.id, px(tile.fromCol), py(tile.fromRow));
      a.tx.setValue(px(tile.fromCol));
      a.ty.setValue(py(tile.fromRow));
      anims.push(Animated.timing(a.tx, { toValue: px(tile.col), duration: ANIM_MS, useNativeDriver: true }));
      anims.push(Animated.timing(a.ty, { toValue: py(tile.row), duration: ANIM_MS, useNativeDriver: true }));
    }
    for (const tile of deadTiles) {
      const a = getAnim(tile.id, px(tile.fromCol), py(tile.fromRow));
      a.tx.setValue(px(tile.fromCol));
      a.ty.setValue(py(tile.fromRow));
      a.scale.setValue(1);
      anims.push(Animated.timing(a.tx, { toValue: px(tile.deadCol), duration: ANIM_MS, useNativeDriver: true }));
      anims.push(Animated.timing(a.ty, { toValue: py(tile.deadRow), duration: ANIM_MS, useNativeDriver: true }));
    }

    setTiles([...liveTiles, ...deadTiles]);

    Animated.parallel(anims).start(() => {
      for (const tile of deadTiles) animMap.current.delete(tile.id);

      // Pop merged tiles
      for (const tile of liveTiles) {
        if (tile.isMerged) {
          const a = animMap.current.get(tile.id);
          if (a) {
            a.scale.setValue(1);
            Animated.sequence([
              Animated.timing(a.scale, { toValue: 1.18, duration: 75, useNativeDriver: true }),
              Animated.timing(a.scale, { toValue: 1,    duration: 75, useNativeDriver: true }),
            ]).start();
          }
        }
      }

      const newT = addRandom(liveTiles);
      const finalTiles = newT ? [...liveTiles, newT] : liveTiles;
      setTiles(finalTiles);

      const ns = scoreRef.current + gained;
      setScore(ns);

      if (hasWon(finalTiles))           { setPhase('won');  setTimeout(() => onComplete(ns), 1500); }
      else if (!hasValidMoves(finalTiles)) { setPhase('over'); setTimeout(() => onComplete(ns), 1000); }

      isAnimating.current = false;
    });
  }, [onComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── PanResponder ──────────────────────────────────────────────────────────
  const panStart = useRef({ x: 0, y: 0 });
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e) => {
        panStart.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
      },
      onPanResponderRelease: (e) => {
        const dx = e.nativeEvent.pageX - panStart.current.x;
        const dy = e.nativeEvent.pageY - panStart.current.y;
        if (Math.abs(dx) < SWIPE_MIN && Math.abs(dy) < SWIPE_MIN) return;
        handleMove(Math.abs(dx) > Math.abs(dy)
          ? (dx > 0 ? 'right' : 'left')
          : (dy > 0 ? 'down' : 'up'));
      },
    })
  ).current;

  const restart = useCallback(() => {
    animMap.current.clear();
    isAnimating.current = false;
    const t1 = addRandom([]);
    if (!t1) return;
    const t1s = { ...t1, isNew: false };
    const t2 = addRandom([t1s]);
    setTiles(t2 ? [t1s, { ...t2, isNew: false }] : [t1s]);
    setScore(0);
    setPhase('playing');
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>2048</Text>
          <Text style={styles.subtitle}>Merge tiles to reach 2048</Text>
        </View>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreLabel}>SCORE</Text>
          <Text style={styles.scoreValue}>{score}</Text>
        </View>
      </View>

      {/* Board */}
      <View style={styles.boardWrapper} {...panResponder.panHandlers}>
        <View style={styles.board}>
          {/* Background grid */}
          {Array.from({ length: GRID * GRID }).map((_, i) => (
            <View
              key={`bg${i}`}
              style={[styles.bgCell, {
                left: BOARD_PAD + (i % GRID) * STRIDE,
                top:  BOARD_PAD + Math.floor(i / GRID) * STRIDE,
              }]}
            />
          ))}

          {/* Animated tiles */}
          {tiles.map(tile => {
            const a = animMap.current.get(tile.id);
            if (!a) return null;
            const { bg, fg } = tile.isDead ? { bg: '#1a1a30', fg: 'transparent' } : tileColors(tile.value);
            return (
              <Animated.View
                key={tile.id}
                style={[styles.tile, {
                  backgroundColor: bg,
                  zIndex: tile.isDead ? 0 : tile.isMerged ? 2 : 1,
                  transform: [{ translateX: a.tx }, { translateY: a.ty }, { scale: a.scale }],
                }]}
              >
                {!tile.isDead && (
                  <Text style={[styles.tileText, { color: fg, fontSize: tileFontSize(tile.value) }]}>
                    {tile.value}
                  </Text>
                )}
              </Animated.View>
            );
          })}
        </View>

        {phase === 'won' && (
          <View style={styles.overlay}>
            <Text style={styles.overlayEmoji}>🏆</Text>
            <Text style={styles.overlayTitle}>You reached 2048!</Text>
            <Text style={styles.overlayScore}>{score} pts</Text>
          </View>
        )}
        {phase === 'over' && (
          <View style={styles.overlay}>
            <Text style={styles.overlayEmoji}>💀</Text>
            <Text style={styles.overlayTitle}>No more moves</Text>
            <Text style={styles.overlayScore}>{score} pts</Text>
          </View>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <Text style={styles.hint}>Swipe to merge tiles</Text>
        <Pressable onPress={restart} style={styles.restartBtn}>
          <Text style={styles.restartText}>New Game</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (COLORS: ArcadeColors) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: BOARD_SIZE,
    marginBottom: SPACING.md,
  },
  title:    { fontFamily: FONTS.display, fontSize: 28, color: COLORS.textPrimary },
  subtitle: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  scoreBox: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    minWidth: 72,
  },
  scoreLabel: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textMuted, letterSpacing: 1 },
  scoreValue: { fontFamily: FONTS.display, fontSize: 20, color: COLORS.indigoBright },

  boardWrapper: { width: BOARD_SIZE, height: BOARD_SIZE },
  board: {
    width: BOARD_SIZE,
    height: BOARD_SIZE,
    backgroundColor: '#bbada0',  // authentic 2048 warm board color
    borderRadius: RADIUS.lg,
  },
  bgCell: {
    position: 'absolute',
    width: CELL_SIZE,
    height: CELL_SIZE,
    backgroundColor: '#cdc1b4',  // authentic 2048 empty cell color
    borderRadius: RADIUS.sm,
  },
  tile: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: { fontFamily: FONTS.display, fontWeight: '700' },

  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(8,8,17,0.88)',
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayEmoji: { fontSize: 48, marginBottom: SPACING.sm },
  overlayTitle: { fontFamily: FONTS.display, fontSize: 24, color: COLORS.textPrimary, marginBottom: SPACING.xs },
  overlayScore: { fontFamily: FONTS.mono, fontSize: 16, color: COLORS.indigoBright },

  controls:    { marginTop: SPACING.lg, alignItems: 'center', gap: SPACING.sm },
  hint:        { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted },
  restartBtn:  { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm },
  restartText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textSecondary },
});
