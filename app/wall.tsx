// ─── The Wall ─────────────────────────────────────────────────────────────────
//
// Finite boards of sponsor and supporter tiles: a big global wall and a smaller local wall per place. Opt-in: reached from the Briefing, never from
// the gate. Everything is labelled Sponsored; tapping a tile shows who it is and offers a link that
// opens in the browser. Nothing about the viewer is tracked or sent.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, Linking, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Line } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/Colors';
import { ConstructionSign } from '@/components/ui/Construction';
import { UNDER_CONSTRUCTION } from '@/constants/construction';
import { SPACING } from '@/constants/Spacing';
import { ADVERTISE_URL, WALL_CATEGORY_LABELS, SUPPORTERS_ENABLED, SUPPORTER_PRICE_FALLBACK, SUPPORTER_PRICE_LOCAL_FALLBACK, GLOBAL_BOARD, cellSize } from '@/constants/wall';
import { usePlaceStore } from '@/stores/usePlaceStore';
import { reportSupporterTile } from '@/lib/supporter';
import { getWall, getBoards, getBoardStats, boardForPlace, reportTile, tapTile, inkOn, type WallTile, type WallStats, type BoardInfo } from '@/lib/wall';

export default function WallScreen() {
  const { colors, cardStyle } = useTheme();
  const regionKey = usePlaceStore((st) => st.place.regionKey);
  const [allTiles, setAllTiles] = useState<WallTile[]>([]);
  const [boards, setBoards] = useState<BoardInfo[]>([]);
  const [board, setBoard] = useState<string | null>(null);
  const [stats, setStats] = useState<WallStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<WallTile | null>(null);
  const [reported, setReported] = useState(false);
  const [badImg, setBadImg] = useState<Set<string>>(new Set());

  const load = useCallback(async (force = false) => {
    setLoading(true);
    const [w, bs] = await Promise.all([getWall(force), getBoards()]);
    setAllTiles(w.tiles);
    setBoards(bs);
    setBoard((cur) => cur ?? boardForPlace(bs, regionKey));   // open on the local wall for the picked place
    setLoading(false);
  }, [regionKey]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!board) return;
    let live = true;
    setStats(null);
    getBoardStats(board).then((st) => { if (live) setStats(st); });
    return () => { live = false; };
  }, [board]);

  const current = board ?? GLOBAL_BOARD;
  const tiles = useMemo(() => allTiles.filter((t) => (t.board ?? GLOBAL_BOARD) === current), [allTiles, current]);
  const CELL = cellSize(current);
  const isLocal = current !== GLOBAL_BOARD;
  const cols = stats?.cols ?? (isLocal ? 25 : 100);
  const rows = stats?.rows ?? (isLocal ? 25 : 100);
  const W = cols * CELL, H = rows * CELL;
  const left = stats ? stats.total - stats.sold : cols * rows;
  const supporterPrice = stats?.supporter_cents ? `$${(stats.supporter_cents / 100).toFixed(2)}` : (isLocal ? SUPPORTER_PRICE_LOCAL_FALLBACK : SUPPORTER_PRICE_FALLBACK);

  const visit = async (t: WallTile) => {
    if (!/^https:\/\//i.test(t.url)) return;
    tapTile(t.id);
    try { await Linking.openURL(t.url); } catch { /* no browser available */ }
  };
  const report = async (t: WallTile) => {
    setReported(t.kind === 'supporter'
      ? await reportSupporterTile(t.id, 'Reported from the app')
      : await reportTile(t.id, 'Reported from the app'));
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back">
          <Feather name="arrow-left" size={22} color={colors.textSecondary} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>The Wall</Text>
        <View style={{ width: 22 }} />
      </View>

      {UNDER_CONSTRUCTION.wall && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <ConstructionSign note="The Wall is built but not open yet. Tiles you see may be examples." />
        </View>
      )}

      {boards.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.boardRow} style={{ flexGrow: 0 }}>
          {boards.map((b) => {
            const on = b.board === current;
            return (
              <Pressable
                key={b.board}
                onPress={() => setBoard(b.board)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={b.board === GLOBAL_BOARD ? 'Global wall' : `${b.board} wall`}
                style={[styles.boardChip, { borderColor: on ? colors.accent : colors.cardBorder, backgroundColor: on ? colors.accentDim : 'transparent' }]}
              >
                <Text style={[styles.boardChipText, { color: on ? colors.accent : colors.textSecondary }]}>{b.board === GLOBAL_BOARD ? 'Global' : b.board}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={styles.intro}>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          {isLocal ? `The ${current} wall: tiles here are bigger, for businesses and supporters in and around ${current}. ` : ''}Sponsored tiles are businesses and makers who paid for a spot. Picture tiles are from supporters who chipped in. It never shows up when you are tempted, and nothing here follows you.
        </Text>
        {stats ? (
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {stats.sold.toLocaleString()} sponsor tiles{stats.supporters ? ` · ${stats.supporters.toLocaleString()} supporters` : ''} · {stats.total.toLocaleString()} tiles in all
          </Text>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: SPACING.xl }} color={colors.accent} />
      ) : (
        <>
          {tiles.length === 0 ? (
            <View style={[styles.empty, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>The wall is new</Text>
              <Text style={[styles.sub, { color: colors.textSecondary }]}>
                {left.toLocaleString()} tiles are open. Early tiles cost the least.
              </Text>
            </View>
          ) : null}

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: SPACING.md }} showsVerticalScrollIndicator={false}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ width: W, height: H, backgroundColor: colors.surfaceHigh, borderRadius: 12, overflow: 'hidden' }}>
                <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
                  {Array.from({ length: cols + 1 }, (_, i) => (
                    <Line key={`c${i}`} x1={i * CELL} y1={0} x2={i * CELL} y2={H} stroke={colors.cardBorder} strokeWidth={0.6} />
                  ))}
                  {Array.from({ length: rows + 1 }, (_, j) => (
                    <Line key={`r${j}`} x1={0} y1={j * CELL} x2={W} y2={j * CELL} stroke={colors.cardBorder} strokeWidth={0.6} />
                  ))}
                </Svg>
                {tiles.map((t) => (
                  <Pressable
                    key={t.id}
                    onPress={() => { setReported(false); setOpen(t); }}
                    accessibilityRole="button"
                    accessibilityLabel={t.kind === 'supporter' ? 'A supporter tile' : `Sponsored: ${t.company}`}
                    style={[styles.tile, { left: t.x * CELL + 1, top: t.y * CELL + 1, width: t.w * CELL - 2, height: t.h * CELL - 2, backgroundColor: t.color }, t.kind === 'supporter' && { padding: 0, overflow: 'hidden', borderRadius: 6 }]}
                  >
                    {t.image_url && !badImg.has(t.id) ? (
                      <Image
                        source={{ uri: t.image_url }}
                        resizeMode={t.kind === 'supporter' ? 'cover' : 'contain'}
                        accessibilityIgnoresInvertColors
                        onError={() => setBadImg((p) => new Set(p).add(t.id))}
                        style={StyleSheet.absoluteFill}
                      />
                    ) : (
                      <Text style={[styles.tileText, { color: inkOn(t.color) }]} numberOfLines={t.h > 1 ? 3 : 1}>
                        {t.w * t.h === 1 ? t.company.charAt(0).toUpperCase() : t.company}
                      </Text>
                    )}
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </ScrollView>

          {SUPPORTERS_ENABLED ? (
            <Pressable
              onPress={() => router.push({ pathname: '/supporter', params: { board: current } } as any)}
              style={[styles.advertise, { borderColor: colors.accent, backgroundColor: colors.accentDim }]}
              accessibilityRole="button"
            >
              <Text style={[styles.advertiseText, { color: colors.accent }]}>Become a supporter · {supporterPrice}</Text>
            </Pressable>
          ) : null}
          {ADVERTISE_URL ? (
            <Pressable
              onPress={() => Linking.openURL(ADVERTISE_URL).catch(() => {})}
              style={[styles.advertise, { borderColor: colors.cardBorder }]}
              accessibilityRole="link"
            >
              <Text style={[styles.advertiseText, { color: colors.accent }]}>Advertise here</Text>
            </Pressable>
          ) : null}
        </>
      )}

      <Modal visible={open !== null} transparent animationType="slide" onRequestClose={() => setOpen(null)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]} onPress={() => {}}>
            {open ? (
              <>
                <View style={[styles.chip, { backgroundColor: colors.surfaceHigh }]}>
                  <Text style={[styles.chipText, { color: colors.textMuted }]}>
                    {open.kind === 'supporter' ? 'Supporter' : `Sponsored · ${WALL_CATEGORY_LABELS[open.category] ?? 'Sponsor'}`}
                  </Text>
                </View>
                {open.kind === 'supporter' ? (
                  <>
                    {open.image_url ? <Image source={{ uri: open.image_url }} style={{ width: 120, height: 120, borderRadius: 14 }} accessibilityIgnoresInvertColors /> : null}
                    <Text style={[styles.sub, { color: colors.textSecondary }]}>Someone who chipped in to help NoGoon grow. Thank you.</Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.sheetTitle, { color: colors.text }]}>{open.company}</Text>
                    {open.headline ? <Text style={[styles.sub, { color: colors.textSecondary }]}>{open.headline}</Text> : null}
                    <Pressable onPress={() => visit(open)} style={[styles.visit, { backgroundColor: colors.accent }]} accessibilityRole="link">
                      <Text style={[styles.visitText, { color: colors.background }]}>Visit site</Text>
                    </Pressable>
                    <Text style={[styles.meta, { color: colors.textMuted }]}>Opens in your browser. NoGoon has no say in what is on the other side.</Text>
                  </>
                )}
                <Pressable onPress={() => report(open)} disabled={reported} hitSlop={8}>
                  <Text style={[styles.meta, { color: colors.textMuted, textDecorationLine: 'underline' }]}>
                    {reported ? 'Thanks. We will take a look.' : 'Report this tile'}
                  </Text>
                </Pressable>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  title:  { fontFamily: FONTS.display, fontSize: 22 },
  intro:  { paddingHorizontal: SPACING.lg, gap: 4, paddingBottom: SPACING.sm },
  sub:    { fontFamily: FONTS.body, fontSize: 13.5, lineHeight: 20 },
  meta:   { fontFamily: FONTS.body, fontSize: 12 },
  empty:  { marginHorizontal: SPACING.lg, padding: SPACING.lg, gap: 4 },
  emptyTitle: { fontFamily: FONTS.bodyBold, fontSize: 16 },
  tile:   { position: 'absolute', borderRadius: 4, padding: 3, justifyContent: 'center' },
  tileText: { fontFamily: FONTS.bodyBold, fontSize: 11 },
  boardRow: { paddingHorizontal: SPACING.lg, gap: 8, paddingBottom: SPACING.sm },
  boardChip: { borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14 },
  boardChipText: { fontFamily: FONTS.bodyBold, fontSize: 13 },
  advertise: { alignSelf: 'center', marginVertical: SPACING.md, paddingVertical: 10, paddingHorizontal: 22, borderWidth: 1, borderRadius: 999 },
  advertiseText: { fontFamily: FONTS.bodyBold, fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: 'rgba(18,35,61,0.45)', justifyContent: 'flex-end' },
  sheet:  { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: SPACING.lg, gap: SPACING.sm, paddingBottom: SPACING.xl },
  chip:   { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 0.4 },
  sheetTitle: { fontFamily: FONTS.display, fontSize: 24 },
  visit:  { alignSelf: 'flex-start', borderRadius: 999, paddingVertical: 12, paddingHorizontal: 24, marginTop: 4 },
  visitText: { fontFamily: FONTS.bodyBold, fontSize: 15 },
});
