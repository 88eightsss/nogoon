// ═══════════════════════════════════════════════════════════════════════════
//  DEFRAG
//  ──────
//  A retro disk-defragmenter puzzle. The drive map is full of scattered file
//  blocks. Tap one block, then another, to swap them. Pack every file together
//  in the order shown (top-left first), free space last.
//
//  3 rounds, each a bigger drive. No timer, no lives, no failing: it always
//  ends, and the ending is a tidy drive. That makes it a calm game that is
//  safe at the gate (finite, quiet, satisfying) and not another endless loop.
//
//  Each round starts from a solved drive and is scrambled with a fixed number
//  of swaps, so every board is solvable in at most that many moves.
//
//  SCORING (the arcade ignores it, but it is returned like every other game):
//    100 per round, minus 5 per move beyond the scramble count (floor 20).
//
//  Props:
//    onComplete(score) — called when the player taps Continue
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';
import { ProceedButton } from '@/components/ui/ProceedButton';
import { useSafeTimeout } from '@/hooks/useSafeTimeout';

// ─── Round setup ─────────────────────────────────────────────────────────────

type RoundCfg = {
  cols: number;
  rows: number;
  files: number[];   // block count per file, in the order they must end up
  scrambles: number; // swaps used to mix the drive (upper bound on moves needed)
};

const ROUNDS: RoundCfg[] = [
  { cols: 5, rows: 4, files: [5, 5],       scrambles: 5 },
  { cols: 6, rows: 5, files: [6, 6, 5],    scrambles: 9 },
  { cols: 7, rows: 6, files: [7, 7, 6, 6], scrambles: 13 },
];

const FREE = -1;
const CLEAR_PAUSE_MS = 1100;
const POINTS_PER_ROUND = 100;
const MOVE_PENALTY = 5;
const MIN_ROUND_POINTS = 20;

// ─── Retro desktop palette ───────────────────────────────────────────────────

const WIN = {
  desktop: '#008080',
  face:    '#c0c0c0',
  light:   '#ffffff',
  shadow:  '#404040',
  title:   '#000080',
  titleTx: '#ffffff',
  ink:     '#000000',
  well:    '#000000',
  free:    '#0b0b0b',
  freeEdge:'#222222',
  select:  '#ffff00',
  muted:   '#555555',
};

const FILE_COLORS = ['#2f6bff', '#ff5ad1', '#2fe0a0', '#ffb02e'];
const letterOf = (f: number) => String.fromCharCode(65 + f);

// ─── Pure helpers ────────────────────────────────────────────────────────────

function buildTarget(cfg: RoundCfg): number[] {
  const total = cfg.cols * cfg.rows;
  const out: number[] = [];
  cfg.files.forEach((size, f) => { for (let i = 0; i < size; i++) out.push(f); });
  while (out.length < total) out.push(FREE);
  return out;
}

function countCorrect(cells: number[], target: number[]): number {
  let n = 0;
  for (let i = 0; i < target.length; i++) if (target[i] !== FREE && cells[i] === target[i]) n++;
  return n;
}

function scramble(target: number[], swaps: number): number[] {
  for (let attempt = 0; attempt < 20; attempt++) {
    const arr = target.slice();
    for (let s = 0; s < swaps; s++) {
      // pick two cells holding different things, otherwise the swap is a no-op
      for (let tries = 0; tries < 50; tries++) {
        const a = Math.floor(Math.random() * arr.length);
        const b = Math.floor(Math.random() * arr.length);
        if (arr[a] !== arr[b]) { [arr[a], arr[b]] = [arr[b], arr[a]]; break; }
      }
    }
    const used = target.filter((v) => v !== FREE).length;
    // want a real mess: at least a third of the file blocks out of place
    if (used - countCorrect(arr, target) >= Math.ceil(used / 3)) return arr;
  }
  // fallback: rotate so it is never already solved
  return target.slice(1).concat(target[0]);
}

// ─── Component ───────────────────────────────────────────────────────────────

interface DefragProps {
  onComplete: (score: number) => void;
}

type Phase = 'play' | 'cleared' | 'complete';

export function Defrag({ onComplete }: DefragProps) {
  const { width } = useWindowDimensions();
  const later = useSafeTimeout();

  const [round, setRound]       = useState(0);
  const [target, setTarget]     = useState(() => buildTarget(ROUNDS[0]));
  const [cells, setCells]       = useState(() => scramble(buildTarget(ROUNDS[0]), ROUNDS[0].scrambles));
  const [selected, setSelected] = useState<number | null>(null);
  const [roundMoves, setRoundMoves] = useState(0);
  const [totalMoves, setTotalMoves] = useState(0);
  const [score, setScore]       = useState(0);
  const [phase, setPhase]       = useState<Phase>('play');

  const cfg = ROUNDS[round];
  const used = useMemo(() => target.filter((v) => v !== FREE).length, [target]);
  const correct = countCorrect(cells, target);
  const pct = Math.round((correct / used) * 100);

  // Cell size: fit the grid in the window, capped so it stays tidy on tablets.
  const gridPad = SPACING.sm;
  const windowWidth = Math.min(width - SPACING.lg * 2, 420);
  const cell = Math.min(52, Math.floor((windowWidth - gridPad * 2 - 12) / cfg.cols));

  const startRound = useCallback((r: number) => {
    const c = ROUNDS[r];
    const t = buildTarget(c);
    setRound(r);
    setTarget(t);
    setCells(scramble(t, c.scrambles));
    setSelected(null);
    setRoundMoves(0);
    setPhase('play');
  }, []);

  const handleCell = useCallback((i: number) => {
    if (phase !== 'play') return;

    if (selected === null) {
      // free cells can be picked too: moving a file into free space is a normal move
      setSelected(i);
      Haptics.selectionAsync();
      return;
    }
    if (selected === i) { setSelected(null); return; }

    // swapping two identical blocks changes nothing and costs nothing
    if (cells[selected] === cells[i]) { setSelected(i); Haptics.selectionAsync(); return; }

    const next = cells.slice();
    [next[selected], next[i]] = [next[i], next[selected]];
    const moves = roundMoves + 1;
    setCells(next);
    setSelected(null);
    setRoundMoves(moves);
    setTotalMoves((m) => m + 1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (countCorrect(next, target) === used) {
      const extra = Math.max(0, moves - cfg.scrambles);
      const pts = Math.max(MIN_ROUND_POINTS, POINTS_PER_ROUND - extra * MOVE_PENALTY);
      setScore((s) => s + pts);
      setPhase('cleared');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      later(() => {
        if (round + 1 < ROUNDS.length) startRound(round + 1);
        else setPhase('complete');
      }, CLEAR_PAUSE_MS);
    }
  }, [phase, selected, cells, roundMoves, target, used, cfg.scrambles, round, later, startRound]);

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER: Complete
  // ══════════════════════════════════════════════════════════════════════════

  if (phase === 'complete') {
    return (
      <SafeAreaView style={styles.desktop}>
        <View style={[styles.window, { width: windowWidth }]}>
          <TitleBar label="Disk Defragmenter" />
          <View style={styles.body}>
            <Text style={styles.doneHead}>Defragmentation complete.</Text>
            <Text style={styles.doneSub}>Drive C: is 100% defragmented.</Text>
            <View style={styles.statWell}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{ROUNDS.length}</Text>
                <Text style={styles.statLabel}>DRIVES</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{totalMoves}</Text>
                <Text style={styles.statLabel}>MOVES</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{score}</Text>
                <Text style={styles.statLabel}>SCORE</Text>
              </View>
            </View>
          </View>
        </View>
        <ProceedButton label="Continue" onPress={() => onComplete(score)} />
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER: Play
  // ══════════════════════════════════════════════════════════════════════════

  const SEGMENTS = 20;
  const filled = Math.round((pct / 100) * SEGMENTS);

  const status =
    phase === 'cleared'    ? `Drive ${String.fromCharCode(67 + round)}: defragmented.` :
    selected !== null      ? 'Now tap the block to swap it with.' :
                             'Tap a block, then tap where it should go.';

  return (
    <SafeAreaView style={styles.desktop}>
      <View style={[styles.window, { width: windowWidth }]}>
        <TitleBar label={`Disk Defragmenter — Drive ${String.fromCharCode(67 + round)}:`} />

        <View style={styles.body}>
          {/* Round + moves */}
          <View style={styles.infoRow}>
            <Text style={styles.infoText}>Drive {round + 1} of {ROUNDS.length}</Text>
            <Text style={styles.infoText}>Moves: {roundMoves}</Text>
          </View>

          {/* Drive map */}
          <View style={[styles.well, { padding: gridPad }]}>
            {Array.from({ length: cfg.rows }).map((_, r) => (
              <View key={r} style={styles.gridRow}>
                {Array.from({ length: cfg.cols }).map((__, c) => {
                  const i = r * cfg.cols + c;
                  const v = cells[i];
                  const isFree = v === FREE;
                  const isSelected = selected === i;
                  const settled = !isFree && v === target[i];
                  return (
                    <Pressable
                      key={c}
                      onPress={() => handleCell(i)}
                      accessibilityRole="button"
                      accessibilityLabel={isFree ? 'Free block' : `File ${letterOf(v)} block${settled ? ', in place' : ''}`}
                      style={[
                        styles.cell,
                        {
                          width: cell,
                          height: cell,
                          backgroundColor: isFree ? WIN.free : FILE_COLORS[v],
                          borderColor: isSelected ? WIN.select : isFree ? WIN.freeEdge : settled ? WIN.light : 'transparent',
                          borderWidth: isSelected ? 3 : isFree ? 1 : settled ? 2 : 0,
                        },
                      ]}
                    >
                      {!isFree && <Text style={styles.cellLetter}>{letterOf(v)}</Text>}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Legend: the order the files must end up in */}
          <View style={styles.legend}>
            <Text style={styles.legendLabel}>Order:</Text>
            {cfg.files.map((size, f) => (
              <View key={f} style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: FILE_COLORS[f] }]} />
                <Text style={styles.legendText}>{letterOf(f)}×{size}</Text>
              </View>
            ))}
            <Text style={styles.legendText}>then free</Text>
          </View>

          {/* Progress */}
          <View style={styles.progressTrack}>
            {Array.from({ length: SEGMENTS }).map((_, s) => (
              <View key={s} style={[styles.segment, s < filled && styles.segmentOn]} />
            ))}
          </View>
          <Text style={styles.pctText}>{pct}% defragmented</Text>
        </View>

        <View style={styles.statusBar}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ─── Title bar ───────────────────────────────────────────────────────────────

function TitleBar({ label }: { label: string }) {
  return (
    <View style={styles.titleBar}>
      <Text style={styles.titleText} numberOfLines={1}>{label}</Text>
      <View style={styles.titleButtons}>
        <View style={styles.titleBtn}><Text style={styles.titleBtnText}>_</Text></View>
        <View style={styles.titleBtn}><Text style={styles.titleBtnText}>□</Text></View>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const bevelOut = {
  borderTopWidth: 2, borderLeftWidth: 2, borderRightWidth: 2, borderBottomWidth: 2,
  borderTopColor: WIN.light, borderLeftColor: WIN.light,
  borderRightColor: WIN.shadow, borderBottomColor: WIN.shadow,
} as const;

const bevelIn = {
  borderTopWidth: 2, borderLeftWidth: 2, borderRightWidth: 2, borderBottomWidth: 2,
  borderTopColor: WIN.shadow, borderLeftColor: WIN.shadow,
  borderRightColor: WIN.light, borderBottomColor: WIN.light,
} as const;

const styles = StyleSheet.create({
  desktop: {
    flex: 1,
    backgroundColor: WIN.desktop,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.lg,
  },
  window: {
    backgroundColor: WIN.face,
    ...bevelOut,
  },
  titleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: WIN.title,
    margin: 2,
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
  },
  titleText: {
    flex: 1,
    fontFamily: FONTS.monoBold,
    fontSize: 12,
    color: WIN.titleTx,
  },
  titleButtons: { flexDirection: 'row', gap: 2 },
  titleBtn: {
    width: 18,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WIN.face,
    ...bevelOut,
    borderWidth: 1,
  },
  titleBtnText: { fontFamily: FONTS.monoBold, fontSize: 10, color: WIN.ink, lineHeight: 12 },

  body: { padding: SPACING.sm, gap: SPACING.sm },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoText: { fontFamily: FONTS.mono, fontSize: 12, color: WIN.ink },

  well: {
    backgroundColor: WIN.well,
    alignItems: 'center',
    alignSelf: 'center',
    gap: 2,
    ...bevelIn,
  },
  gridRow: { flexDirection: 'row', gap: 2 },
  cell: { alignItems: 'center', justifyContent: 'center' },
  cellLetter: { fontFamily: FONTS.monoBold, fontSize: 14, color: 'rgba(0,0,0,0.45)' },

  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  legendLabel: { fontFamily: FONTS.monoBold, fontSize: 12, color: WIN.ink },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendSwatch: { width: 12, height: 12, borderWidth: 1, borderColor: WIN.ink },
  legendText: { fontFamily: FONTS.mono, fontSize: 12, color: WIN.ink },

  progressTrack: {
    flexDirection: 'row',
    gap: 2,
    padding: 3,
    backgroundColor: WIN.face,
    ...bevelIn,
  },
  segment: { flex: 1, height: 14, backgroundColor: 'transparent' },
  segmentOn: { backgroundColor: WIN.title },
  pctText: { fontFamily: FONTS.mono, fontSize: 12, color: WIN.ink, textAlign: 'center' },

  statusBar: {
    marginHorizontal: 2,
    marginBottom: 2,
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
    ...bevelIn,
    borderWidth: 1,
  },
  statusText: { fontFamily: FONTS.mono, fontSize: 11, color: WIN.ink },

  doneHead: { fontFamily: FONTS.monoBold, fontSize: 16, color: WIN.ink, textAlign: 'center', marginTop: SPACING.md },
  doneSub: { fontFamily: FONTS.mono, fontSize: 12, color: WIN.muted, textAlign: 'center', marginBottom: SPACING.md },
  statWell: {
    flexDirection: 'row',
    backgroundColor: WIN.well,
    paddingVertical: SPACING.lg,
    ...bevelIn,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: FONTS.monoBold, fontSize: 26, color: '#2fe0a0' },
  statLabel: { fontFamily: FONTS.mono, fontSize: 10, color: '#8a8a8a', letterSpacing: 2, marginTop: 2 },
});
