// ─── Become a supporter ───────────────────────────────────────────────────────
// Pick one empty tile on the Wall, choose a picture, pass the automatic safety check, then pay through
// Google Play. The tile is reviewed before it appears and shows for a year. Opened from the Wall, and only
// when SUPPORTERS_ENABLED (constants/wall.ts) is on.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Image, type GestureResponderEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Line } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/useAuthStore';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';
import { SUPPORTERS_ENABLED, SUPPORTER_PRODUCT_ID, SUPPORTER_PRODUCT_LOCAL_ID, SUPPORTER_PRICE_FALLBACK, SUPPORTER_PRICE_LOCAL_FALLBACK, SUPPORTER_MONTHS, GLOBAL_BOARD, cellSize } from '@/constants/wall';
import { getWall, getBoardStats, type WallTile, type WallStats } from '@/lib/wall';
import { reserveTile, cancelTile, uploadTileImage, pickTileImage } from '@/lib/supporter';
import { getOneTimeProduct, buyOneTimeProduct, isPurchasesAvailable } from '@/lib/purchases';
import type { RCProduct } from '@/types/purchases';

type Step = 'pick' | 'image' | 'checking' | 'pay' | 'paying' | 'done';

export default function SupporterScreen() {
  const { colors, cardStyle } = useTheme();
  const session = useAuthStore((s) => s.session);
  const params = useLocalSearchParams<{ board?: string }>();
  const board = (typeof params.board === 'string' && params.board) || GLOBAL_BOARD;   // which wall (global or a place)
  const isLocal = board !== GLOBAL_BOARD;
  const CELL = Math.round(cellSize(board) * 0.85);
  const productId = isLocal ? SUPPORTER_PRODUCT_LOCAL_ID : SUPPORTER_PRODUCT_ID;
  const [tiles, setTiles] = useState<WallTile[]>([]);
  const [stats, setStats] = useState<WallStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<{ x: number; y: number } | null>(null);
  const [step, setStep] = useState<Step>('pick');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [tileId, setTileId] = useState<string | null>(null);
  const [img, setImg] = useState<{ uri: string; base64: string } | null>(null);
  const [product, setProduct] = useState<RCProduct | null>(null);
  const paid = useRef(false);
  const idRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [w, st] = await Promise.all([getWall(true), getBoardStats(board)]);
    setTiles(w.tiles.filter((t) => (t.board ?? GLOBAL_BOARD) === board)); setStats(st); setLoading(false);
  }, [board]);
  useEffect(() => { load(); getOneTimeProduct(productId).then(setProduct).catch(() => {}); }, [load, productId]);

  // Let go of an unpaid hold when leaving.
  useEffect(() => () => { if (idRef.current && !paid.current) cancelTile(idRef.current); }, []);

  const cols = stats?.cols ?? (isLocal ? 25 : 100), rows = stats?.rows ?? (isLocal ? 25 : 100);
  const W = cols * CELL, H = rows * CELL;
  const fallbackPrice = stats?.supporter_cents ? `$${(stats.supporter_cents / 100).toFixed(2)}` : (isLocal ? SUPPORTER_PRICE_LOCAL_FALLBACK : SUPPORTER_PRICE_FALLBACK);
  const price = product?.priceString ?? fallbackPrice;

  const taken = useMemo(() => {
    const s = new Set<string>();
    for (const t of tiles) for (let dx = 0; dx < t.w; dx++) for (let dy = 0; dy < t.h; dy++) s.add(`${t.x + dx},${t.y + dy}`);
    return s;
  }, [tiles]);

  if (!SUPPORTERS_ENABLED) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <Header title="Become a supporter" colors={colors} />
        <Text style={[styles.body, { color: colors.textSecondary, padding: SPACING.lg }]}>Supporter tiles are not open yet.</Text>
      </SafeAreaView>
    );
  }
  if (!session) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <Header title="Become a supporter" colors={colors} />
        <View style={{ padding: SPACING.lg, gap: SPACING.md }}>
          <Text style={[styles.body, { color: colors.textSecondary }]}>Sign in first, so your tile is tied to your account and you can get it back on a new phone.</Text>
          <Pressable onPress={() => router.push('/auth' as any)} style={[styles.primary, { backgroundColor: colors.accent }]} accessibilityRole="button">
            <Text style={[styles.primaryText, { color: colors.background }]}>Sign in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const onBoardPress = (e: GestureResponderEvent) => {
    if (step !== 'pick') return;
    const x = Math.floor(e.nativeEvent.locationX / CELL), y = Math.floor(e.nativeEvent.locationY / CELL);
    if (x < 0 || y < 0 || x >= cols || y >= rows) return;
    if (taken.has(`${x},${y}`)) { setMsg('That tile is taken. Pick an empty one.'); setSel(null); return; }
    setMsg(''); setSel({ x, y });
  };

  const confirmTile = async () => {
    if (!sel || busy) return;
    setBusy(true); setMsg('');
    const r = await reserveTile(board, sel.x, sel.y);
    setBusy(false);
    if (!r.ok) { setMsg(r.message); load(); setSel(null); return; }
    idRef.current = r.id; setTileId(r.id); setStep('image');
  };

  const choose = async () => {
    setMsg('');
    try {
      const p = await pickTileImage();
      if (p) setImg(p);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Could not open your pictures.');
    }
  };

  const check = async () => {
    if (!tileId || !img) return;
    setStep('checking'); setMsg('');
    const r = await uploadTileImage(tileId, img.base64);
    if (!r.ok) { setMsg(r.message); setStep('image'); return; }
    setStep('pay');
  };

  const pay = async () => {
    if (!product) { setMsg('Payments are not available right now. Try again in a minute.'); return; }
    setStep('paying'); setMsg('');
    try {
      const res = await buyOneTimeProduct(product);
      if (res === 'paid') { paid.current = true; setStep('done'); } else setStep('pay');
    } catch {
      setMsg('The payment did not go through. You have not been charged. Try again.');
      setStep('pay');
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <Header title="Become a supporter" colors={colors} />

      {step === 'pick' && (
        <>
          <Text style={[styles.body, { color: colors.textSecondary, paddingHorizontal: SPACING.lg }]}>
            One tile on the {isLocal ? `${board} wall (bigger tiles, a local showcase)` : 'global wall'}, {price}, with a picture of your choice for {SUPPORTER_MONTHS} months. Tap an empty tile.
          </Text>
          {msg ? <Text style={[styles.note, { color: colors.danger, paddingHorizontal: SPACING.lg }]}>{msg}</Text> : null}
          {loading ? <ActivityIndicator style={{ marginTop: SPACING.xl }} color={colors.accent} /> : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: SPACING.md }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Pressable onPress={onBoardPress} accessibilityLabel="The wall. Tap an empty tile to choose it." style={{ width: W, height: H, backgroundColor: colors.surfaceHigh, borderRadius: 12, overflow: 'hidden' }}>
                  <Svg width={W} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
                    {Array.from({ length: cols + 1 }, (_, i) => <Line key={`c${i}`} x1={i * CELL} y1={0} x2={i * CELL} y2={H} stroke={colors.cardBorder} strokeWidth={0.5} />)}
                    {Array.from({ length: rows + 1 }, (_, j) => <Line key={`r${j}`} x1={0} y1={j * CELL} x2={W} y2={j * CELL} stroke={colors.cardBorder} strokeWidth={0.5} />)}
                  </Svg>
                  {tiles.map((t) => (
                    <View key={t.id} pointerEvents="none" style={{ position: 'absolute', left: t.x * CELL + 1, top: t.y * CELL + 1, width: t.w * CELL - 2, height: t.h * CELL - 2, backgroundColor: t.color, opacity: 0.55, borderRadius: 3 }} />
                  ))}
                  {sel ? (
                    <View pointerEvents="none" style={{ position: 'absolute', left: sel.x * CELL, top: sel.y * CELL, width: CELL, height: CELL, borderWidth: 3, borderColor: colors.accent, backgroundColor: colors.accentDim, borderRadius: 4 }} />
                  ) : null}
                </Pressable>
              </ScrollView>
            </ScrollView>
          )}
          <View style={[styles.bar, { borderTopColor: colors.cardBorder, backgroundColor: colors.background }]}>
            <Text style={[styles.body, { color: colors.text, flex: 1 }]}>
              {sel ? `Row ${sel.y + 1}, column ${sel.x + 1}` : 'No tile chosen yet'}
            </Text>
            <Pressable onPress={confirmTile} disabled={!sel || busy} accessibilityRole="button" style={[styles.primary, { backgroundColor: colors.accent, opacity: !sel || busy ? 0.4 : 1 }]}>
              {busy ? <ActivityIndicator color={colors.background} /> : <Text style={[styles.primaryText, { color: colors.background }]}>Choose this tile</Text>}
            </Pressable>
          </View>
        </>
      )}

      {(step === 'image' || step === 'checking') && (
        <ScrollView contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.md }}>
          <Text style={[styles.h2, { color: colors.text }]}>Choose your picture</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            It is cropped square and shrunk to fit. Everyone who opens the Wall will see it, with no name and no link. Please keep it kind and family friendly.
          </Text>
          <Pressable onPress={choose} disabled={step === 'checking'} accessibilityRole="button" accessibilityLabel="Choose a picture" style={[styles.preview, cardStyle, { borderColor: colors.cardBorder, backgroundColor: colors.surface }]}>
            {img ? <Image source={{ uri: img.uri }} style={styles.previewImg} accessibilityIgnoresInvertColors /> : (
              <View style={{ alignItems: 'center', gap: 6 }}>
                <Feather name="image" size={34} color={colors.textMuted} />
                <Text style={[styles.note, { color: colors.textMuted }]}>Tap to choose</Text>
              </View>
            )}
          </Pressable>
          <Text style={[styles.note, { color: colors.textMuted }]}>
            Before it can go up, an automatic safety tool looks at your picture. Anything that is not allowed (nudity, violence, hate, web addresses, phone numbers) is turned away, and you are not charged. Then we look at it ourselves.
          </Text>
          {msg ? <Text style={[styles.note, { color: colors.danger }]}>{msg}</Text> : null}
          <Pressable onPress={check} disabled={!img || step === 'checking'} accessibilityRole="button" style={[styles.primary, { backgroundColor: colors.accent, opacity: !img || step === 'checking' ? 0.4 : 1 }]}>
            {step === 'checking' ? <ActivityIndicator color={colors.background} /> : <Text style={[styles.primaryText, { color: colors.background }]}>Check my picture</Text>}
          </Pressable>
        </ScrollView>
      )}

      {(step === 'pay' || step === 'paying') && (
        <ScrollView contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.md }}>
          <Text style={[styles.h2, { color: colors.text }]}>Looks good</Text>
          {img ? <Image source={{ uri: img.uri }} style={[styles.previewImg, { alignSelf: 'center' }]} accessibilityIgnoresInvertColors /> : null}
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Your picture passed the check. Pay {price} with Google Play to send it for review. Your tile is held for you for 30 minutes.
            If we cannot approve it, you are refunded. It stays up for {SUPPORTER_MONTHS} months.
          </Text>
          {msg ? <Text style={[styles.note, { color: colors.danger }]}>{msg}</Text> : null}
          {!isPurchasesAvailable ? <Text style={[styles.note, { color: colors.danger }]}>Payments are not available in this build.</Text> : null}
          <Pressable onPress={pay} disabled={step === 'paying' || !isPurchasesAvailable} accessibilityRole="button" style={[styles.primary, { backgroundColor: colors.accent, opacity: step === 'paying' || !isPurchasesAvailable ? 0.4 : 1 }]}>
            {step === 'paying' ? <ActivityIndicator color={colors.background} /> : <Text style={[styles.primaryText, { color: colors.background }]}>Pay {price} with Google Play</Text>}
          </Pressable>
          <Pressable onPress={() => { if (tileId) cancelTile(tileId); idRef.current = null; setStep('pick'); setSel(null); setImg(null); setTileId(null); load(); }} hitSlop={8} style={{ alignSelf: 'center' }}>
            <Text style={[styles.note, { color: colors.textMuted, textDecorationLine: 'underline' }]}>Not now</Text>
          </Pressable>
        </ScrollView>
      )}

      {step === 'done' && (
        <View style={{ padding: SPACING.lg, gap: SPACING.md, alignItems: 'center' }}>
          <Feather name="heart" size={40} color={colors.accent} />
          <Text style={[styles.h2, { color: colors.text }]}>Thank you</Text>
          <Text style={[styles.body, { color: colors.textSecondary, textAlign: 'center' }]}>
            Your tile is with us. We look at every picture before it goes up, usually within a day. If we cannot approve it, Google Play refunds you.
          </Text>
          <Pressable onPress={() => router.back()} style={[styles.primary, { backgroundColor: colors.accent }]} accessibilityRole="button">
            <Text style={[styles.primaryText, { color: colors.background }]}>Back to the Wall</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

function Header({ title, colors }: { title: string; colors: { text: string; textSecondary: string } }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back">
        <Feather name="arrow-left" size={22} color={colors.textSecondary} />
      </Pressable>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <View style={{ width: 22 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  title: { fontFamily: FONTS.display, fontSize: 22 },
  h2: { fontFamily: FONTS.display, fontSize: 24 },
  body: { fontFamily: FONTS.body, fontSize: 14, lineHeight: 20 },
  note: { fontFamily: FONTS.body, fontSize: 12.5, lineHeight: 18 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, borderTopWidth: 1 },
  primary: { minHeight: 48, borderRadius: 999, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: FONTS.bodyBold, fontSize: 15 },
  preview: { alignSelf: 'center', width: 200, height: 200, borderWidth: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  previewImg: { width: 200, height: 200, borderRadius: 16 },
});
