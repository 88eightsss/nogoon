// ─── The Wall ─────────────────────────────────────────────────────────────────
//
// A finite board of sponsor tiles (3,000 of them). Opt-in: reached from the Briefing, never from
// the gate. Everything is labelled Sponsored; tapping a tile shows who it is and offers a link that
// opens in the browser. Nothing about the viewer is tracked or sent.

import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, Linking, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Line } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';
import { ADVERTISE_URL, WALL_CATEGORY_LABELS } from '@/constants/wall';
import { getWall, reportTile, inkOn, type WallTile, type WallStats } from '@/lib/wall';

const CELL = 28;

export default function WallScreen() {
  const { colors, cardStyle } = useTheme();
  const [tiles, setTiles] = useState<WallTile[]>([]);
  const [stats, setStats] = useState<WallStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<WallTile | null>(null);
  const [reported, setReported] = useState(false);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    const w = await getWall(force);
    setTiles(w.tiles);
    setStats(w.stats);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const cols = stats?.cols ?? 60;
  const rows = stats?.rows ?? 50;
  const W = cols * CELL, H = rows * CELL;
  const left = stats ? stats.total - stats.sold : 3000;

  const visit = async (t: WallTile) => {
    try { await Linking.openURL(t.url); } catch { /* no browser available */ }
  };
  const report = async (t: WallTile) => {
    setReported(await reportTile(t.id, 'Reported from the app'));
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

      <View style={styles.intro}>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          Sponsored. Local businesses and makers who paid for a tile. It never shows up when you are tempted, and nothing here follows you.
        </Text>
        {stats ? (
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {stats.sold.toLocaleString()} of {stats.total.toLocaleString()} tiles taken
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
                    accessibilityLabel={`Sponsored: ${t.company}`}
                    style={[styles.tile, { left: t.x * CELL + 1, top: t.y * CELL + 1, width: t.w * CELL - 2, height: t.h * CELL - 2, backgroundColor: t.color }]}
                  >
                    <Text style={[styles.tileText, { color: inkOn(t.color) }]} numberOfLines={t.h > 1 ? 3 : 1}>
                      {t.w * t.h === 1 ? t.company.charAt(0).toUpperCase() : t.company}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </ScrollView>

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
                    Sponsored · {WALL_CATEGORY_LABELS[open.category] ?? 'Sponsor'}
                  </Text>
                </View>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>{open.company}</Text>
                {open.headline ? <Text style={[styles.sub, { color: colors.textSecondary }]}>{open.headline}</Text> : null}
                <Pressable onPress={() => visit(open)} style={[styles.visit, { backgroundColor: colors.accent }]} accessibilityRole="link">
                  <Text style={[styles.visitText, { color: colors.background }]}>Visit site</Text>
                </Pressable>
                <Text style={[styles.meta, { color: colors.textMuted }]}>Opens in your browser. NoGoon has no say in what is on the other side.</Text>
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
