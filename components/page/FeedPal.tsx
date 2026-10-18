// ─── Feed your pal ────────────────────────────────────────────────────────────
// Walk-aways and walks earn treats. This card is where they get spent: one tap feeds the
// companion you picked as your favorite and moves it toward its next evolution.

import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';
import { PackSprite } from './PackSprite';
import { CHARACTER_LABELS, useMascot } from './useCharacter';
import { stageOf, useMascotStore } from '@/stores/useMascotStore';

export function FeedPal({ petName }: { petName?: string }) {
  const { colors } = useTheme();
  const { char, fed, stage, next } = useMascot();
  const treats = useMascotStore((s) => s.treats);
  const name = petName || CHARACTER_LABELS[char];
  const [note, setNote] = useState('');

  // The thank-you line clears itself, and never outlives a change of favorite.
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(''), 3500);
    return () => clearTimeout(t);
  }, [note]);
  useEffect(() => { setNote(''); }, [char]);

  const hop = useRef(new Animated.Value(0)).current;
  const heart = useRef(new Animated.Value(0)).current;

  const feed = () => {
    const before = stageOf(useMascotStore.getState().fed[char] ?? 0);
    if (!useMascotStore.getState().feedWithTreat()) return;
    const after = stageOf(useMascotStore.getState().fed[char] ?? 0);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setNote(after > before ? `${name} evolved!` : `${name} loved that.`);
    hop.setValue(0);
    heart.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(hop, { toValue: 1, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(hop, { toValue: 0, duration: 180, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.timing(hop, { toValue: 0.6, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(hop, { toValue: 0, duration: 140, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.timing(heart, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  };

  const can = treats > 0;
  const meta = can
    ? `${treats} treat${treats === 1 ? '' : 's'} ready${next === null ? '' : ` · ${next - fed} to evolve`}`
    : 'No treats yet. Walk away or take a walk.';

  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
      <View style={styles.spriteWrap}>
        <Animated.View style={{ transform: [{ translateY: hop.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }] }}>
          <PackSprite char={char} stage={stage} cell={3} />
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[styles.heart, {
            opacity: heart.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
            transform: [{ translateY: heart.interpolate({ inputRange: [0, 1], outputRange: [0, -22] }) }],
          }]}
        >
          <Feather name="heart" size={14} color={colors.accent} />
        </Animated.View>
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>{note || name}</Text>
        <Text numberOfLines={1} style={[styles.meta, { color: colors.textMuted }]}>{meta}</Text>
      </View>
      <Pressable
        onPress={feed}
        disabled={!can}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityState={{ disabled: !can }}
        accessibilityLabel={can ? `Feed ${name}. ${treats} treats ready.` : `Feed ${name}. No treats yet.`}
        style={[styles.btn, { backgroundColor: can ? colors.accent : colors.surfaceHigh, borderColor: can ? colors.accent : colors.border }]}
      >
        <Feather name="gift" size={14} color={can ? colors.background : colors.textMuted} />
        <Text style={[styles.btnText, { color: can ? colors.background : colors.textMuted }]}>Feed</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 8, paddingHorizontal: SPACING.md, borderRadius: 16, borderWidth: 1 },
  spriteWrap: { width: 34, height: 40, alignItems: 'center', justifyContent: 'flex-end' },
  heart: { position: 'absolute', top: 0 },
  title: { fontFamily: FONTS.bodyBold, fontSize: 14 },
  meta: { fontFamily: FONTS.body, fontSize: 12 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1 },
  btnText: { fontFamily: FONTS.bodyBold, fontSize: 13 },
});
