// ─── Feed your pal ────────────────────────────────────────────────────────────
// Walk-aways and walks earn treats. This card is where they get spent: one tap feeds the
// companion you picked as your favorite and moves it toward its next evolution.

import { useRef, useState } from 'react';
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
  const { colors, cardStyle } = useTheme();
  const { char, fed, stage, next } = useMascot();
  const treats = useMascotStore((s) => s.treats);
  const name = petName || CHARACTER_LABELS[char];
  const [note, setNote] = useState('');

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
  const progress = next === null ? 'Fully evolved' : `${next - fed} more to the next evolution`;

  return (
    <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
      <View style={styles.row}>
        <View style={styles.spriteWrap}>
          <Animated.View style={{ transform: [{ translateY: hop.interpolate({ inputRange: [0, 1], outputRange: [0, -14] }) }] }}>
            <PackSprite char={char} stage={stage} cell={5} />
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[styles.heart, {
              opacity: heart.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
              transform: [{ translateY: heart.interpolate({ inputRange: [0, 1], outputRange: [0, -34] }) }],
            }]}
          >
            <Feather name="heart" size={20} color={colors.accent} />
          </Animated.View>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.title, { color: colors.text }]}>{note || `Feed ${name}`}</Text>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>{progress}</Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {can ? `${treats} treat${treats === 1 ? '' : 's'} ready` : 'Walk away from a scroll or take them for a walk to earn a treat.'}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={feed}
        disabled={!can}
        accessibilityRole="button"
        accessibilityState={{ disabled: !can }}
        accessibilityLabel={can ? `Feed ${name}. ${treats} treats ready.` : `Feed ${name}. No treats yet.`}
        style={[styles.btn, { backgroundColor: can ? colors.accent : colors.surfaceHigh, borderColor: can ? colors.accent : colors.border }]}
      >
        <Feather name="gift" size={17} color={can ? colors.background : colors.textMuted} />
        <Text style={[styles.btnText, { color: can ? colors.background : colors.textMuted }]}>{can ? `Feed ${name}` : 'No treats yet'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: SPACING.md, gap: SPACING.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  spriteWrap: { width: 56, height: 64, alignItems: 'center', justifyContent: 'flex-end' },
  heart: { position: 'absolute', top: 2 },
  title: { fontFamily: FONTS.bodyBold, fontSize: 16 },
  meta: { fontFamily: FONTS.body, fontSize: 12.5, lineHeight: 18 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, borderRadius: 999, borderWidth: 1 },
  btnText: { fontFamily: FONTS.bodyBold, fontSize: 15 },
});
