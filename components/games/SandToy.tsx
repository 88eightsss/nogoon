// ─── SandToy — Falling-sand particle sandbox ─────────────────────────────────
//
// A zen, no-pressure cellular automaton sandbox. Draw sand, water, or fire and
// watch the particles interact through simple physics rules.
//
// SIMULATION:
//   Sand  — falls down, slides diagonally if blocked below.
//   Water — falls down, spreads left/right if blocked.
//   Fire  — rises up, spreads diagonally, expires after a short lifetime.
//
// RENDER: react-native-svg — grid cells as <Rect> elements. Only non-empty
//         cells are rendered, so performance scales with how much the user draws.
//
// TIMING: A 90-second gentle timer. After it expires, a soft overlay appears
//         ("Take that moment with you") with a Done button. The user can dismiss
//         the overlay and keep playing, or tap Done to complete.

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  GestureResponderEvent,
} from 'react-native';
import Svg, { Rect as SvgRect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

// ─── Grid dimensions ──────────────────────────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get('window');
const CANVAS_W  = Math.min(SCREEN_W - 32, 360);
const CANVAS_H  = 440;
const CELL      = 8; // px per cell
const COLS      = Math.floor(CANVAS_W / CELL);
const ROWS      = Math.floor(CANVAS_H / CELL);
const GRID_SIZE = COLS * ROWS;

// ─── Cell types ───────────────────────────────────────────────────────────────
const EMPTY  = 0;
const SAND   = 1;
const WATER  = 2;
const FIRE   = 3;
type BrushType = 0 | 1 | 2 | 3; // 0 = erase

const CELL_COLORS: Record<number, string> = {
  [SAND]:  '#d4a06a',
  [WATER]: '#3b82f6',
  [FIRE]:  '#f97316',
};

const BRUSH_OPTIONS: Array<{ type: BrushType; label: string; color: string; emoji: string }> = [
  { type: SAND,  label: 'Sand',  color: '#d4a06a', emoji: '🏜️' },
  { type: WATER, label: 'Water', color: '#3b82f6', emoji: '💧' },
  { type: FIRE,  label: 'Fire',  color: '#f97316', emoji: '🔥' },
  { type: EMPTY, label: 'Erase', color: COLORS.textMuted, emoji: '◻' },
];

const BRUSH_RADIUS = 1; // cells painted in a small square around tap

// ─── Grid helpers ─────────────────────────────────────────────────────────────
function idx(col: number, row: number): number { return row * COLS + col; }
function inBounds(col: number, row: number): boolean {
  return col >= 0 && col < COLS && row >= 0 && row < ROWS;
}

// ─── Simulation step ─────────────────────────────────────────────────────────
// Process in reverse row order (bottom to top for sand/water, top to bottom for fire).
function simulate(grid: Uint8Array): Uint8Array {
  const next = new Uint8Array(grid);
  // Process bottom-to-top for sand/water
  for (let row = ROWS - 1; row >= 0; row--) {
    // Randomly alternate left-to-right / right-to-left per row
    const leftward = Math.random() < 0.5;
    for (let ci = 0; ci < COLS; ci++) {
      const col = leftward ? ci : COLS - 1 - ci;
      const cell = grid[idx(col, row)];
      if (cell === EMPTY) continue;

      if (cell === SAND) {
        // Try fall down
        if (row < ROWS - 1 && grid[idx(col, row + 1)] === EMPTY) {
          next[idx(col, row + 1)] = SAND;
          next[idx(col, row)] = EMPTY;
        } else {
          // Try slide diagonally down
          const dirs = Math.random() < 0.5 ? [-1, 1] : [1, -1];
          for (const d of dirs) {
            const nc = col + d;
            if (inBounds(nc, row + 1) && grid[idx(nc, row + 1)] === EMPTY) {
              next[idx(nc, row + 1)] = SAND;
              next[idx(col, row)] = EMPTY;
              break;
            }
          }
          // If not moved, stays — already in next from grid copy
        }
        continue;
      }

      if (cell === WATER) {
        // Try fall down
        if (row < ROWS - 1 && grid[idx(col, row + 1)] === EMPTY) {
          next[idx(col, row + 1)] = WATER;
          next[idx(col, row)] = EMPTY;
        } else {
          // Try spread left/right
          const dirs = Math.random() < 0.5 ? [-1, 1] : [1, -1];
          for (const d of dirs) {
            const nc = col + d;
            if (inBounds(nc, row) && grid[idx(nc, row)] === EMPTY) {
              next[idx(nc, row)] = WATER;
              next[idx(col, row)] = EMPTY;
              break;
            }
          }
        }
        continue;
      }

      if (cell === FIRE) {
        // Fire always vacates its current cell — it either rises or burns out.
        next[idx(col, row)] = EMPTY;

        // 85% chance to rise straight up; 15% the flame just dies at this cell.
        if (Math.random() > 0.15) {
          if (row > 0 && grid[idx(col, row - 1)] === EMPTY) {
            next[idx(col, row - 1)] = FIRE;
          } else {
            // Can't rise straight — try diagonals
            const dirs = Math.random() < 0.5 ? [-1, 1] : [1, -1];
            for (const d of dirs) {
              const nc = col + d;
              if (inBounds(nc, row - 1) && grid[idx(nc, row - 1)] === EMPTY) {
                next[idx(nc, row - 1)] = FIRE;
                break;
              }
            }
            // If both diagonals blocked, flame just dies (already cleared above)
          }
        }
        continue;
      }
    }
  }
  return next;
}

// ─── Component ────────────────────────────────────────────────────────────────
type Props = { onComplete: (score: number) => void };

export function SandToy({ onComplete }: Props) {
  const [brush,     setBrush]     = useState<BrushType>(SAND);
  const [timeLeft,  setTimeLeft]  = useState(90);
  const [timeUp,    setTimeUp]    = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [, forceRender] = useState(0);

  const gridRef   = useRef<Uint8Array>(new Uint8Array(GRID_SIZE));
  const drawRef   = useRef(false);  // currently touch-drawing?
  const simTimer  = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockTimer= useRef<ReturnType<typeof setInterval> | null>(null);
  const brushRef  = useRef<BrushType>(SAND);

  // Keep brushRef in sync (avoid stale closure in touch handlers)
  useEffect(() => { brushRef.current = brush; }, [brush]);

  // ── Simulation loop (15fps) ───────────────────────────────────────────────
  const step = useCallback(() => {
    gridRef.current = simulate(gridRef.current);
    forceRender(n => n + 1);
  }, []);

  // ── Mount ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    simTimer.current  = setInterval(step, 66); // ~15fps
    clockTimer.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { setTimeUp(true); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (simTimer.current)  clearInterval(simTimer.current);
      if (clockTimer.current) clearInterval(clockTimer.current);
    };
  }, [step]);

  // ── Paint cells ───────────────────────────────────────────────────────────
  function paint(ex: number, ey: number) {
    const col = Math.floor(ex / CELL);
    const row = Math.floor(ey / CELL);
    const g   = gridRef.current;
    let changed = false;

    for (let dc = -BRUSH_RADIUS; dc <= BRUSH_RADIUS; dc++) {
      for (let dr = -BRUSH_RADIUS; dr <= BRUSH_RADIUS; dr++) {
        const c = col + dc, r = row + dr;
        if (!inBounds(c, r)) continue;
        const i = idx(c, r);
        if (g[i] !== brushRef.current) {
          g[i] = brushRef.current;
          changed = true;
        }
      }
    }
    if (changed) forceRender(n => n + 1);
  }

  // ── Touch handlers ────────────────────────────────────────────────────────
  function handleStart(e: GestureResponderEvent) {
    drawRef.current = true;
    paint(e.nativeEvent.locationX, e.nativeEvent.locationY);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
  function handleMove(e: GestureResponderEvent) {
    if (!drawRef.current) return;
    paint(e.nativeEvent.locationX, e.nativeEvent.locationY);
  }
  function handleEnd() { drawRef.current = false; }

  // ── Build SVG rects from grid ─────────────────────────────────────────────
  const grid   = gridRef.current;
  const rects: React.ReactElement[] = [];
  for (let i = 0; i < GRID_SIZE; i++) {
    const cell = grid[i];
    if (cell === EMPTY) continue;
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    rects.push(
      <SvgRect
        key={i}
        x={col * CELL}
        y={row * CELL}
        width={CELL}
        height={CELL}
        fill={CELL_COLORS[cell] ?? '#fff'}
        opacity={cell === FIRE ? 0.75 + Math.random() * 0.25 : 0.9}
      />
    );
  }

  const showOverlay = timeUp && !dismissed;

  return (
    <View style={styles.root}>
      {/* ── Brush selector ───────────────────────────────────────────────── */}
      <View style={styles.brushRow}>
        {BRUSH_OPTIONS.map(opt => (
          <Pressable
            key={opt.type}
            style={[
              styles.brushBtn,
              brush === opt.type && { borderColor: opt.color, backgroundColor: opt.color + '22' },
            ]}
            onPress={() => setBrush(opt.type)}
          >
            <Text style={styles.brushEmoji}>{opt.emoji}</Text>
            <Text style={[styles.brushLabel, { color: brush === opt.type ? opt.color : COLORS.textMuted }]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── Canvas ───────────────────────────────────────────────────────── */}
      <View
        style={[styles.canvas, { width: CANVAS_W, height: CANVAS_H }]}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handleStart}
        onResponderMove={handleMove}
        onResponderRelease={handleEnd}
      >
        <Svg width={CANVAS_W} height={CANVAS_H} style={StyleSheet.absoluteFill}>
          {rects}
        </Svg>

        {/* Time-up overlay */}
        {showOverlay && (
          <View style={styles.overlay}>
            <Text style={styles.overlayEmoji}>🌿</Text>
            <Text style={styles.overlayTitle}>Take that moment{'\n'}with you.</Text>
            <Text style={styles.overlaySub}>
              You just gave yourself 90 seconds of calm.
            </Text>
            <Pressable
              style={styles.overlayDone}
              onPress={() => onComplete(0)}
            >
              <Text style={styles.overlayDoneText}>Done</Text>
            </Pressable>
            <Pressable
              style={styles.overlayKeep}
              onPress={() => setDismissed(true)}
            >
              <Text style={styles.overlayKeepText}>Keep playing</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <View style={styles.footer}>
        <Text style={styles.hint}>Draw on the canvas · watch it fall</Text>
        {!timeUp && (
          <Text style={[styles.timer, timeLeft <= 10 && { color: COLORS.warning }]}>
            {timeLeft}s
          </Text>
        )}
        {dismissed && (
          <Pressable onPress={() => onComplete(0)}>
            <Text style={styles.doneLink}>Done</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    paddingTop: SPACING.md,
    gap: SPACING.sm,
  },

  // Brush selector
  brushRow: {
    flexDirection: 'row',
    width: CANVAS_W,
    gap: SPACING.xs,
    paddingHorizontal: SPACING.xs,
  },
  brushBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    gap: 2,
  },
  brushEmoji: { fontSize: 18 },
  brushLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 0.3,
  },

  // Canvas
  canvas: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: '#0a0a12',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },

  // Overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,18,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.lg,
  },
  overlayEmoji: { fontSize: 52 },
  overlayTitle: {
    fontFamily: FONTS.displayRegular,
    fontSize: 28,
    color: COLORS.textPrimary,
    textAlign: 'center',
    lineHeight: 36,
    letterSpacing: 0.2,
  },
  overlaySub: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: SPACING.sm,
  },
  overlayDone: {
    backgroundColor: COLORS.green + '22',
    borderWidth: 1.5,
    borderColor: COLORS.green + '88',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
  },
  overlayDoneText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    color: COLORS.green,
    letterSpacing: 0.2,
  },
  overlayKeep: { padding: SPACING.sm },
  overlayKeepText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: CANVAS_W,
    paddingHorizontal: SPACING.xs,
  },
  hint: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  timer: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  doneLink: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: COLORS.green,
  },
});
