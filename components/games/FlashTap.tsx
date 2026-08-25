// ─── FlashTap — 2-bit reflex game ────────────────────────────────────────────
//
// A tile lights up briefly. Tap it before it goes dark.
// Gets faster each round. Miss 3 = game over. Hit 20 = win (100 pts).
// Less than 20 but game over = 50 pts.

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

// ─── Constants ────────────────────────────────────────────────────────────────

const GRID_SIZE   = 3;     // 3×3
const WIN_HITS    = 20;
const MAX_MISSES  = 3;
const FLASH_START = 900;   // ms the tile stays lit initially
const FLASH_MIN   = 280;
const DECAY       = 0.92;  // multiply flash duration each hit

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onComplete: (score: number) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FlashTap({ onComplete }: Props) {
  const [phase, setPhase]   = useState<'ready' | 'playing' | 'done'>('ready');
  const [litCell, setLitCell] = useState<number | null>(null);
  const [hits, setHits]     = useState(0);
  const [misses, setMisses] = useState(0);
  const [result, setResult] = useState<'hit' | 'miss' | null>(null);

  const hitsRef   = useRef(0);
  const missesRef = useRef(0);
  const flashDur  = useRef(FLASH_START);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneRef   = useRef(false);

  const clearFlashTimer = () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  };

  const nextFlash = useCallback(() => {
    if (doneRef.current) return;
    const cell = Math.floor(Math.random() * GRID_SIZE * GRID_SIZE);
    setLitCell(cell);
    setResult(null);

    flashTimer.current = setTimeout(() => {
      if (doneRef.current) return;
      // Timed out without a tap = miss
      setLitCell(null);
      missesRef.current += 1;
      setMisses(missesRef.current);
      setResult('miss');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (missesRef.current >= MAX_MISSES) {
        doneRef.current = true;
        setPhase('done');
        setTimeout(() => {
          const pts = hitsRef.current >= WIN_HITS ? 100 : 50;
          onComplete(pts);
        }, 900);
        return;
      }

      setTimeout(nextFlash, 400);
    }, flashDur.current);
  }, [onComplete]);

  const startGame = useCallback(() => {
    hitsRef.current   = 0;
    missesRef.current = 0;
    flashDur.current  = FLASH_START;
    doneRef.current   = false;
    setHits(0);
    setMisses(0);
    setLitCell(null);
    setResult(null);
    setPhase('playing');
    setTimeout(nextFlash, 500);
  }, [nextFlash]);

  useEffect(() => () => clearFlashTimer(), []);

  const onTapCell = useCallback((cellIdx: number) => {
    if (phase !== 'playing' || doneRef.current) return;

    if (cellIdx === litCell) {
      // Hit!
      clearFlashTimer();
      setLitCell(null);
      setResult('hit');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      hitsRef.current += 1;
      setHits(hitsRef.current);

      // Speed up
      flashDur.current = Math.max(FLASH_MIN, flashDur.current * DECAY);

      if (hitsRef.current >= WIN_HITS) {
        doneRef.current = true;
        setPhase('done');
        setTimeout(() => onComplete(100), 900);
        return;
      }

      setTimeout(nextFlash, 300);
    } else {
      // Wrong cell tapped
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [phase, litCell, nextFlash, onComplete]);

  // ── Ready ──────────────────────────────────────────────────────────────────

  if (phase === 'ready') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.emoji}>⚡</Text>
          <Text style={styles.title}>Flash Tap</Text>
          <View style={styles.ruleCard}>
            <Text style={styles.rule}>
              A tile will light up.{'\n'}
              <Text style={{ color: COLORS.warning, fontFamily: FONTS.bodyBold }}>Tap it</Text> before it goes dark.{'\n\n'}
              Miss <Text style={{ color: COLORS.danger, fontFamily: FONTS.bodyBold }}>3 times</Text> and the game ends.{'\n'}
              Hit <Text style={{ color: COLORS.green, fontFamily: FONTS.bodyBold }}>{WIN_HITS} in a row</Text> to win.{'\n\n'}
              <Text style={{ color: COLORS.textMuted }}>It gets faster.</Text>
            </Text>
          </View>
          <Pressable style={styles.startBtn} onPress={startGame}>
            <Text style={styles.startBtnText}>Go</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Playing / Done ─────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.playContainer}>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <Text style={styles.statNum}>{hits}</Text>
            <Text style={styles.statLabel}>hits</Text>
          </View>
          <Text style={styles.separator}>·</Text>
          <View style={styles.statChip}>
            {Array.from({ length: MAX_MISSES }, (_, i) => (
              <Text key={i} style={{ fontSize: 16, color: i < misses ? COLORS.danger : COLORS.surface }}>
                {i < misses ? '✕' : '○'}
              </Text>
            ))}
          </View>
        </View>

        {/* Result flash */}
        {result && (
          <Text style={[styles.resultText, { color: result === 'hit' ? COLORS.green : COLORS.danger }]}>
            {result === 'hit' ? 'HIT' : 'MISS'}
          </Text>
        )}

        {/* Grid */}
        <View style={styles.grid}>
          {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => (
            <Pressable
              key={i}
              onPress={() => onTapCell(i)}
              style={[
                styles.tile,
                litCell === i && styles.tilelit,
              ]}
            />
          ))}
        </View>

        {/* Done overlay */}
        {phase === 'done' && (
          <View style={styles.overlay}>
            <Text style={styles.overlayText}>
              {hits >= WIN_HITS ? '🎉 ' : ''}
              {hits} hit{hits !== 1 ? 's' : ''}
            </Text>
          </View>
        )}

      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const TILE_SIZE = 96;
const TILE_GAP  = 12;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.xl,
  },
  emoji: { fontSize: 52 },
  title: {
    fontFamily: FONTS.display,
    fontSize: 34,
    color: COLORS.textPrimary,
  },
  ruleCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.xl,
    width: '100%',
  },
  rule: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 26,
    textAlign: 'center',
  },
  startBtn: {
    backgroundColor: COLORS.warning,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xxxl,
  },
  startBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 17,
    color: '#fff',
  },

  playContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xl,
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statNum: {
    fontFamily: FONTS.bodyBold,
    fontSize: 28,
    color: COLORS.green,
  },
  statLabel: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  separator: {
    fontFamily: FONTS.body,
    fontSize: 20,
    color: COLORS.textMuted,
  },
  resultText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 18,
    letterSpacing: 2,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: GRID_SIZE * TILE_SIZE + (GRID_SIZE - 1) * TILE_GAP,
    gap: TILE_GAP,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  tilelit: {
    backgroundColor: COLORS.warning,
    borderColor: COLORS.warning,
  },

  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(13,12,20,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 28,
    color: COLORS.textPrimary,
  },
});
