// ─── StackGame — Challenge Mode (Pro) ────────────────────────────────────────
//
// A block-stacking game. A platform slides left and right automatically.
// Tap to drop it — the overlap with the block below becomes your next platform.
// Forgiving: even small overlaps continue the game. Only a complete miss ends it.
//
// WIN: Stack 10 blocks successfully.
//
// SCORING:
//   10 blocks, perfect stacks (>90% overlap each): 120 pts
//   10 blocks completed:                             85 pts
//   Stopped by miss (≥5 stacks completed):           45 pts

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Pressable,
  Animated,
  Dimensions,
  AppState,
  type AppStateStatus,
} from 'react-native';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

// ─── Config ───────────────────────────────────────────────────────────────────

const { width: W } = Dimensions.get('window');

const PLATFORM_AREA  = W - 48;  // usable width
const INITIAL_WIDTH  = 200;     // starting block width
const BLOCK_HEIGHT   = 44;
const TARGET_STACKS  = 10;
const STACK_GAP      = BLOCK_HEIGHT + 6;

// Block colors per level
const BLOCK_COLORS = [
  '#7c3aed', '#6d28d9', '#5b21b6', '#4c1d95',
  '#0e7490', '#0891b2', '#06b6d4',
  '#be185d', '#9d174d', '#831843', '#6b21a8',
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Block {
  x:     number; // left edge, relative to PLATFORM_AREA origin
  width: number;
  color: string;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onComplete: (score: number) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function StackGame({ onComplete }: Props) {
  const [phase, setPhase]       = useState<'ready' | 'playing' | 'done'>('ready');
  const [stacks, setStacks]     = useState<Block[]>([]);
  const [current, setCurrent]   = useState<Block | null>(null);
  const [stackCount, setStackCount] = useState(0);
  const [perfectCount, setPerfectCount] = useState(0);
  const [failed, setFailed]     = useState(false);

  // Slider animation for the moving block
  const sliderX    = useRef(new Animated.Value(0)).current;
  const sliderAnim = useRef<Animated.CompositeAnimation | null>(null);
  const currentX   = useRef(0);
  const currentW   = useRef(INITIAL_WIDTH);

  // Track latest current block via ref for the tap handler
  const latestCurrent = useRef<Block | null>(null);
  const latestStacks  = useRef<Block[]>([]);
  const latestCount   = useRef(0);
  const latestPerfect = useRef(0);

  // Subscribe to slider position
  useEffect(() => {
    const id = sliderX.addListener(({ value }) => { currentX.current = value; });
    return () => sliderX.removeListener(id);
  }, []);

  // AppState
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s !== 'active') sliderAnim.current?.stop();
      else if (phase === 'playing') startSliding(currentW.current, latestStacks.current);
    });
    return () => sub.remove();
  }, [phase]);

  useEffect(() => {
    return () => { sliderAnim.current?.stop(); };
  }, []);

  // ── Start the slider for a new block ──────────────────────────────────────

  const startSliding = (blockWidth: number, existingStacks: Block[]) => {
    const maxX    = PLATFORM_AREA - blockWidth;
    const speed   = 1800 - existingStacks.length * 80; // speeds up with each stack
    const safeSpd = Math.max(speed, 800);

    sliderX.setValue(0);
    currentX.current = 0;
    currentW.current = blockWidth;

    const color = BLOCK_COLORS[existingStacks.length % BLOCK_COLORS.length];
    const newBlock: Block = { x: 0, width: blockWidth, color };
    latestCurrent.current = newBlock;
    setCurrent(newBlock);

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sliderX, { toValue: maxX, duration: safeSpd, useNativeDriver: true }),
        Animated.timing(sliderX, { toValue: 0,    duration: safeSpd, useNativeDriver: true }),
      ])
    );
    sliderAnim.current = loop;
    loop.start();
  };

  // ── Tap to drop ───────────────────────────────────────────────────────────

  const handleTap = useCallback(() => {
    if (phase !== 'playing') return;
    sliderAnim.current?.stop();

    const dropX = currentX.current;
    const dropW = currentW.current;
    const stk   = latestStacks.current;
    const cnt   = latestCount.current;
    const pfct  = latestPerfect.current;

    // If no stacks yet, the base is the full platform
    const baseX = stk.length === 0 ? 0 : stk[stk.length - 1].x;
    const baseW = stk.length === 0 ? PLATFORM_AREA : stk[stk.length - 1].width;

    // Calculate overlap
    const overlapStart = Math.max(dropX, baseX);
    const overlapEnd   = Math.min(dropX + dropW, baseX + baseW);
    const overlap      = overlapEnd - overlapStart;

    if (overlap <= 0) {
      // Missed completely
      setFailed(true);
      setPhase('done');
      const pts = cnt >= 5 ? 45 : 20;
      setTimeout(() => onComplete(pts), 700);
      return;
    }

    const newBlock: Block = {
      x:     overlapStart,
      width: overlap,
      color: BLOCK_COLORS[stk.length % BLOCK_COLORS.length],
    };
    const isPerfect = overlap / dropW > 0.9;
    const newStacks  = [...stk, newBlock];
    const newCount   = cnt + 1;
    const newPerfect = pfct + (isPerfect ? 1 : 0);

    latestStacks.current  = newStacks;
    latestCount.current   = newCount;
    latestPerfect.current = newPerfect;

    setStacks(newStacks);
    setStackCount(newCount);
    setPerfectCount(newPerfect);

    if (newCount >= TARGET_STACKS) {
      setPhase('done');
      const pts = newPerfect >= TARGET_STACKS - 1 ? 120 : 85;
      setTimeout(() => onComplete(pts), 500);
      return;
    }

    // Next block: same width as the overlap (shrinks on imperfect drops)
    setTimeout(() => startSliding(overlap, newStacks), 200);
  }, [phase]);

  // ── Start game ────────────────────────────────────────────────────────────

  const startGame = () => {
    latestStacks.current  = [];
    latestCount.current   = 0;
    latestPerfect.current = 0;
    setStacks([]);
    setStackCount(0);
    setPerfectCount(0);
    setFailed(false);
    setPhase('playing');
    startSliding(INITIAL_WIDTH, []);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE: READY
  // ─────────────────────────────────────────────────────────────────────────

  if (phase === 'ready') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.readyContainer}>
          <Text style={styles.readyEmoji}>🏗️</Text>
          <Text style={styles.readyTitle}>Stack</Text>
          <View style={styles.readyCard}>
            <Text style={styles.readyRule}>
              A block slides back and forth. Tap to drop it.{'\n\n'}
              Only the overlapping section becomes your next block — aim well. Miss
              completely and the game ends. Stack {TARGET_STACKS} blocks to win.
            </Text>
          </View>
          <Text style={styles.challengeTag}>⚡ CHALLENGE MODE</Text>
          <Pressable style={styles.startButton} onPress={startGame}>
            <Text style={styles.startButtonText}>Drop it →</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE: PLAYING / DONE
  // ─────────────────────────────────────────────────────────────────────────

  // Show last 6 stacks from the bottom
  const visibleStacks = stacks.slice(-6);
  const baseY = 80; // bottom of visible area in the game zone

  return (
    <SafeAreaView style={styles.safe}>
      <Pressable style={styles.gameArea} onPress={handleTap} activeOpacity={1}>

        {/* ── Header ── */}
        <View style={styles.hud}>
          <Text style={styles.hudTitle}>Stack</Text>
          <View style={styles.hudRight}>
            <Text style={styles.hudCount}>{stackCount} / {TARGET_STACKS}</Text>
            {perfectCount > 0 && (
              <Text style={styles.hudPerfect}>✦ {perfectCount} perfect</Text>
            )}
          </View>
        </View>

        {/* ── Stack display area ── */}
        <View style={styles.stackArea}>

          {/* Base platform */}
          <View style={[styles.basePlatform, { bottom: baseY }]} />

          {/* Stacked blocks (bottom to top) */}
          {visibleStacks.map((block, i) => (
            <View
              key={i}
              style={[
                styles.block,
                {
                  left:   (PLATFORM_AREA - INITIAL_WIDTH) / 2 + block.x,
                  bottom: baseY + (i + 1) * STACK_GAP,
                  width:  block.width,
                  backgroundColor: block.color,
                },
              ]}
            />
          ))}

          {/* Moving block */}
          {phase === 'playing' && current && (
            <Animated.View
              style={[
                styles.block,
                {
                  bottom: baseY + (visibleStacks.length + 1) * STACK_GAP,
                  width:  current.width,
                  backgroundColor: current.color,
                  transform: [{ translateX: sliderX }],
                  left: (PLATFORM_AREA - INITIAL_WIDTH) / 2,
                },
              ]}
            />
          )}

        </View>

        {/* ── Tap hint ── */}
        {stackCount === 0 && phase === 'playing' && (
          <Text style={styles.tapHint}>Tap anywhere to drop</Text>
        )}

        {/* ── Done overlay ── */}
        {phase === 'done' && (
          <View style={styles.doneOverlay}>
            <Text style={styles.doneEmoji}>{failed ? '💥' : '🏗️'}</Text>
            <Text style={styles.doneTitle}>
              {failed ? 'Missed!' : `${stackCount} stacked!`}
            </Text>
            {perfectCount > 0 && (
              <Text style={styles.doneSub}>{perfectCount} perfect drops</Text>
            )}
          </View>
        )}

      </Pressable>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── Ready ─────────────────────────────────────────────────────────────────
  readyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.xl,
  },

  readyEmoji: { fontSize: 72, lineHeight: 84 },

  readyTitle: {
    fontFamily: FONTS.display,
    fontSize:   34,
    color:      COLORS.textPrimary,
  },

  readyCard: {
    backgroundColor: COLORS.surface,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     COLORS.cardBorder,
    padding:         SPACING.xl,
    width:           '100%',
  },

  readyRule: {
    fontFamily: FONTS.body,
    fontSize:   15,
    color:      COLORS.textSecondary,
    lineHeight: 22,
    textAlign:  'center',
  },

  challengeTag: {
    fontFamily:    FONTS.mono,
    fontSize:      11,
    color:         COLORS.warning,
    letterSpacing: 1,
  },

  startButton: {
    backgroundColor: COLORS.purple,
    borderRadius:    RADIUS.md,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xxxl,
  },

  startButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize:   17,
    color:      COLORS.background,
  },

  // ── Playing ───────────────────────────────────────────────────────────────
  gameArea: {
    flex: 1,
    alignItems: 'center',
  },

  hud: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    width:          '100%',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },

  hudTitle: {
    fontFamily: FONTS.display,
    fontSize:   28,
    color:      COLORS.textPrimary,
  },

  hudRight: {
    alignItems: 'flex-end',
    gap: 2,
  },

  hudCount: {
    fontFamily: FONTS.bodyBold,
    fontSize:   18,
    color:      COLORS.textPrimary,
  },

  hudPerfect: {
    fontFamily: FONTS.mono,
    fontSize:   11,
    color:      COLORS.warning,
    letterSpacing: 0.5,
  },

  stackArea: {
    flex:            1,
    width:           PLATFORM_AREA,
    position:        'relative',
  },

  basePlatform: {
    position:        'absolute',
    left:            (PLATFORM_AREA - INITIAL_WIDTH) / 2,
    width:           INITIAL_WIDTH,
    height:          BLOCK_HEIGHT,
    backgroundColor: COLORS.surface,
    borderRadius:    RADIUS.sm,
    borderWidth:     1,
    borderColor:     COLORS.cardBorder,
  },

  block: {
    position:     'absolute',
    height:       BLOCK_HEIGHT,
    borderRadius: RADIUS.sm,
    opacity:      0.92,
  },

  tapHint: {
    position:   'absolute',
    bottom:     SPACING.xxxl,
    fontFamily: FONTS.body,
    fontSize:   13,
    color:      COLORS.textMuted,
    textAlign:  'center',
  },

  // ── Done overlay ──────────────────────────────────────────────────────────
  doneOverlay: {
    position:        'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(13,12,20,0.85)',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             SPACING.md,
  },

  doneEmoji: { fontSize: 56, lineHeight: 68 },

  doneTitle: {
    fontFamily: FONTS.display,
    fontSize:   34,
    color:      COLORS.textPrimary,
    textAlign:  'center',
  },

  doneSub: {
    fontFamily: FONTS.mono,
    fontSize:   15,
    color:      COLORS.warning,
  },
});
