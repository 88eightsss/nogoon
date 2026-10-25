// ─── Gate demo ───────────────────────────────────────────────────────────────
// A 20-second preview of the pause, shown inside onboarding BEFORE we ask for any
// permission. It is a pretend "Instagram" being opened, then the same three beats
// the real gate uses (breathe, choose, walk away or wait). It touches no real
// settings, counters or streaks: nothing here is saved.

import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, Easing, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import type { ThemePalette } from '@/constants/Themes';

type Props = {
  c: ThemePalette;
  btn: { bg: string; fg: string };
  /** Called when the person leaves the demo, either to carry on with setup or to go back. */
  onDone: () => void;
};

type Phase = 'open' | 'breathe' | 'choose' | 'result';
type Choice = 'bored' | 'stressed' | 'need';

const BREATHE_SECONDS = 5;

const RESULT: Record<Choice, { title: string; body: string }> = {
  bored: {
    title: 'A quick game, then you decide',
    body: 'Bored is the most common answer. The gate hands you a one-minute game instead of the feed. Most people finish it and walk away.',
  },
  stressed: {
    title: 'A breath first',
    body: 'If you are tense, the gate walks you through a short breathing exercise. The urge usually drops before the minute is up.',
  },
  need: {
    title: 'Okay, you are an adult',
    body: 'If you truly need it, you wait a short while and it opens. No lecture, no streak punishment. The wait is the whole trick.',
  },
};

export function GateDemo({ c, btn, onDone }: Props) {
  const [phase, setPhase] = useState<Phase>('open');
  const [left, setLeft] = useState(BREATHE_SECONDS);
  const [choice, setChoice] = useState<Choice | null>(null);
  const orb = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (phase !== 'breathe') return;
    setLeft(BREATHE_SECONDS);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(orb, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(orb, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    const id = setInterval(() => {
      setLeft((n) => {
        if (n <= 1) {
          clearInterval(id);
          setPhase('choose');
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => { loop.stop(); clearInterval(id); };
  }, [phase, orb]);

  const s = makeStyles(c, btn);
  const scale = orb.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.15] });

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.badge}>
        <Text style={s.badgeText}>Preview. Nothing here is saved.</Text>
      </View>

      <View style={s.body}>
        {phase === 'open' && (
          <>
            <View style={s.fakeApp}>
              <Feather name="camera" size={40} color={c.textMuted} />
              <Text style={s.fakeName}>Instagram</Text>
            </View>
            <Text style={s.title}>Here is the moment{'\n'}that matters</Text>
            <Text style={s.sub}>Pretend you just tapped Instagram. This is what NoGoon puts in front of it.</Text>
            <Pressable style={s.primary} onPress={() => setPhase('breathe')} accessibilityRole="button">
              <Text style={s.primaryText}>Open Instagram</Text>
            </Pressable>
          </>
        )}

        {phase === 'breathe' && (
          <>
            <Animated.View style={[s.orb, { transform: [{ scale }] }]} />
            <Text style={s.title}>Just breathe</Text>
            <Text style={s.sub}>In through the nose, out slowly. {left} second{left === 1 ? '' : 's'}.</Text>
          </>
        )}

        {phase === 'choose' && (
          <>
            <Text style={s.title}>Why are you here?</Text>
            <Text style={s.sub}>No wrong answer. Pick the honest one.</Text>
            {([
              ['bored', 'Bored or on autopilot'],
              ['stressed', 'Stressed or anxious'],
              ['need', 'I actually need this'],
            ] as [Choice, string][]).map(([id, label]) => (
              <Pressable key={id} style={s.option} onPress={() => { setChoice(id); setPhase('result'); }} accessibilityRole="button">
                <Text style={s.optionText}>{label}</Text>
              </Pressable>
            ))}
          </>
        )}

        {phase === 'result' && choice && (
          <>
            <View style={s.checkBubble}><Feather name="check" size={32} color={btn.fg} /></View>
            <Text style={s.title}>{RESULT[choice].title}</Text>
            <Text style={s.sub}>{RESULT[choice].body}</Text>
            <Text style={s.note}>
              That is the whole idea. To make it appear over your real apps, Android needs one switch turned on. Next screen, we guide every tap.
            </Text>
            <Pressable style={s.primary} onPress={onDone} accessibilityRole="button">
              <Text style={s.primaryText}>Set it up</Text>
            </Pressable>
          </>
        )}
      </View>

      {phase !== 'result' && (
        <Pressable onPress={onDone} style={s.back} accessibilityRole="button" hitSlop={8}>
          <Text style={s.backText}>Skip the preview</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemePalette, btn: { bg: string; fg: string }) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  badge: { alignSelf: 'center', marginTop: SPACING.md, paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: c.accentDim },
  badgeText: { fontFamily: FONTS.bodyMedium, fontSize: 12, color: c.text },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl, gap: SPACING.md },
  fakeApp: { width: 120, height: 120, borderRadius: 28, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: SPACING.md },
  fakeName: { fontFamily: FONTS.bodyMedium, fontSize: 14, color: c.textSecondary },
  orb: { width: 140, height: 140, borderRadius: 70, backgroundColor: c.accent, opacity: 0.85, marginBottom: SPACING.lg },
  title: { fontFamily: FONTS.display, fontSize: 30, color: c.text, textAlign: 'center', lineHeight: 38 },
  sub: { fontFamily: FONTS.body, fontSize: 16, color: c.textSecondary, textAlign: 'center', lineHeight: 24 },
  note: { fontFamily: FONTS.body, fontSize: 14, color: c.textMuted, textAlign: 'center', lineHeight: 21, marginTop: SPACING.sm },
  primary: { width: '100%', minHeight: 52, backgroundColor: btn.bg, borderRadius: 999, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.md },
  primaryText: { fontFamily: FONTS.bodyBold, fontSize: 16, color: btn.fg },
  option: { width: '100%', minHeight: 52, borderRadius: RADIUS.lg, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.lg },
  optionText: { fontFamily: FONTS.bodyMedium, fontSize: 16, color: c.text },
  checkBubble: { width: 64, height: 64, borderRadius: 32, backgroundColor: btn.bg, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm },
  back: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', marginBottom: SPACING.lg },
  backText: { fontFamily: FONTS.bodyMedium, fontSize: 14, color: c.textMuted },
});
