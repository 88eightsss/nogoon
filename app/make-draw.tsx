// ─── Make: draw something small ──────────────────────────────────────────────
// A 12 by 12 pixel canvas, eight colours and an eraser. Drag to paint. Saved only to the private gallery.

import { useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Rect } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';
import { useMakeStore, promptOfTheDay, DRAW_PROMPTS, PIXEL_PALETTE, PIXEL_SIZE } from '@/stores/useMakeStore';

export default function MakeDrawScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const side = Math.min(width - SPACING.lg * 2, 360);
  const cell = side / PIXEL_SIZE;
  const prompt = useRef(promptOfTheDay(DRAW_PROMPTS)).current;
  const addPixel = useMakeStore((s) => s.addPixel);
  const [cells, setCells] = useState<number[]>(() => Array(PIXEL_SIZE * PIXEL_SIZE).fill(0));
  const [ink, setInk] = useState(2);
  const [saved, setSaved] = useState(false);
  const last = useRef(-1);

  const paintAt = (x: number, y: number) => {
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    if (cx < 0 || cy < 0 || cx >= PIXEL_SIZE || cy >= PIXEL_SIZE) return;
    const i = cy * PIXEL_SIZE + cx;
    if (i === last.current) return;
    last.current = i;
    setCells((prev) => (prev[i] === ink ? prev : prev.map((v, j) => (j === i ? ink : v))));
  };

  const touched = cells.some((v) => v !== 0);
  const save = () => {
    if (!touched) return;
    addPixel(prompt, cells.join(''));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setSaved(true);
  };

  if (saved) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background, justifyContent: 'center' }]}>
        <Feather name="check-circle" size={44} color={colors.success} />
        <Text style={[styles.title, { color: colors.text, textAlign: 'center' }]}>That's yours.</Text>
        <Text style={[styles.sub, { color: colors.textSecondary, textAlign: 'center' }]}>Saved to Things I made. Only you can see it.</Text>
        <Pressable onPress={() => router.replace('/make' as any)} style={[styles.btn, { backgroundColor: colors.accent }]} accessibilityRole="button">
          <Text style={[styles.btnText, { color: colors.onAccent }]}>See my things</Text>
        </Pressable>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.link} accessibilityRole="button">
          <Text style={[styles.sub, { color: colors.textMuted }]}>Done for now</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Feather name="arrow-left" size={22} color={colors.textSecondary} />
        </Pressable>
        <Pressable onPress={() => { setCells(Array(PIXEL_SIZE * PIXEL_SIZE).fill(0)); last.current = -1; }} hitSlop={10} accessibilityRole="button">
          <Text style={[styles.sub, { color: colors.textMuted }]}>Clear</Text>
        </Pressable>
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{prompt}</Text>

      <View
        style={{ width: side, height: side, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => { last.current = -1; paintAt(e.nativeEvent.locationX, e.nativeEvent.locationY); }}
        onResponderMove={(e) => paintAt(e.nativeEvent.locationX, e.nativeEvent.locationY)}
        accessibilityLabel="Drawing canvas. Drag to paint."
      >
        <Svg width={side} height={side} pointerEvents="none">
          <Rect x={0} y={0} width={side} height={side} fill={colors.surfaceHigh} />
          {cells.map((v, i) =>
            v ? <Rect key={i} x={(i % PIXEL_SIZE) * cell} y={Math.floor(i / PIXEL_SIZE) * cell} width={cell} height={cell} fill={PIXEL_PALETTE[v]} /> : null
          )}
        </Svg>
      </View>

      <View style={styles.palette}>
        {PIXEL_PALETTE.map((col, v) => (
          <Pressable
            key={v}
            onPress={() => setInk(v)}
            style={[styles.swatch, { backgroundColor: col || colors.surface, borderColor: ink === v ? colors.accent : colors.border, borderWidth: ink === v ? 3 : 1 }]}
            accessibilityRole="radio"
            accessibilityState={{ selected: ink === v }}
            accessibilityLabel={v === 0 ? 'Eraser' : `Colour ${v}`}
          >
            {v === 0 && <Feather name="slash" size={16} color={colors.textMuted} />}
          </Pressable>
        ))}
      </View>

      <Pressable onPress={save} disabled={!touched} style={[styles.btn, { backgroundColor: touched ? colors.accent : colors.surface, opacity: touched ? 1 : 0.5 }]} accessibilityRole="button">
        <Text style={[styles.btnText, { color: touched ? colors.background : colors.textMuted }]}>Save it</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, alignItems: 'center', padding: SPACING.lg, gap: SPACING.md },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch' },
  title: { fontFamily: FONTS.display, fontSize: 22, textAlign: 'center' },
  sub: { fontFamily: FONTS.body, fontSize: 14 },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, justifyContent: 'center' },
  swatch: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  btn: { alignSelf: 'stretch', borderRadius: 999, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: FONTS.bodyBold, fontSize: 16 },
  link: { paddingVertical: SPACING.md },
});
