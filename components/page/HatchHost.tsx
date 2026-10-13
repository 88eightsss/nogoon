// The hatch ceremony. When a hidden skin unlocks (7-day streak, code, or secret tap)
// an egg appears: tap it three times, it wobbles, cracks, and hatches your companion
// and the new skin. "Try it" switches skins; "Later" keeps it in Customize.

import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, Pressable, Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/hooks/useTheme';
import { usePackStore } from '@/stores/usePackStore';
import { useUserStore } from '@/stores/useUserStore';
import { getGoonStage } from '@/components/home/GoonMascot';
import { getPack } from '@/constants/packs';
import { FONTS } from '@/constants/Colors';
import { PackSprite } from './PackSprite';
import { GlyphIcon } from './GlyphIcon';
import { useCharacter } from './useCharacter';

const EGG = 'M118 3 C186 3 233 112 233 172 C233 236 183 269 118 269 C53 269 3 236 3 172 C3 112 50 3 118 3 Z';
const SPARKS = [0, 60, 120, 180, 240, 300];

export function HatchHost() {
  const unlocked = usePackStore((s) => s.unlockedIds);
  const seen = usePackStore((s) => s.seenUnlockIds);
  const pendingId = unlocked.find((id) => !seen.includes(id));
  const pack = pendingId ? getPack(pendingId) : null;
  if (!pack || pack.id === 'core') return null;
  return <Ceremony key={pack.id} packId={pack.id} />;
}

function Ceremony({ packId }: { packId: string }) {
  const pack = getPack(packId);
  const { colors } = useTheme();
  const char = useCharacter();
  const walkAways = useUserStore((s) => s.walkAwayCount);
  const markSeen = usePackStore((s) => s.markUnlockSeen);
  const setActivePack = usePackStore((s) => s.setActivePack);

  const [taps, setTaps] = useState(0);
  const hatched = taps >= 3;
  const rot = useRef(new Animated.Value(0)).current;
  const eggScale = useRef(new Animated.Value(1)).current;
  const eggOpacity = useRef(new Animated.Value(1)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const reveal = useRef(new Animated.Value(0)).current;
  const spark = useRef(new Animated.Value(0)).current;
  const hint = useRef(new Animated.Value(0.5)).current;

  const shell = pack.parts.page.look.shell ?? colors.accent;

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(hint, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(hint, { toValue: 0.45, duration: 800, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [hint]);

  const wobble = (amp: number) => {
    Animated.sequence([
      Animated.timing(rot, { toValue: amp, duration: 70, useNativeDriver: true }),
      Animated.timing(rot, { toValue: -amp, duration: 110, useNativeDriver: true }),
      Animated.timing(rot, { toValue: amp / 2, duration: 90, useNativeDriver: true }),
      Animated.timing(rot, { toValue: 0, duration: 80, useNativeDriver: true }),
    ]).start();
  };

  const onTap = () => {
    if (hatched) return;
    const n = taps + 1;
    setTaps(n);
    if (n < 3) {
      Haptics.impactAsync(n === 1 ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
      wobble(n === 1 ? 6 : 11);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.sequence([
      Animated.timing(eggScale, { toValue: 1.12, duration: 160, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(flash, { toValue: 1, duration: 140, useNativeDriver: true }),
        Animated.timing(eggOpacity, { toValue: 0, duration: 140, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(flash, { toValue: 0, duration: 380, useNativeDriver: true }),
        Animated.spring(reveal, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
        Animated.timing(spark, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
    ]).start();
  };

  const finish = (activate: boolean) => {
    if (activate) setActivePack(packId);
    markSeen(packId);
  };

  const spin = rot.interpolate({ inputRange: [-12, 12], outputRange: ['-12deg', '12deg'] });
  const stage = getGoonStage(walkAways);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => finish(false)}>
      <View style={styles.backdrop}>
        {!hatched && (
          <>
            <Text style={styles.title}>Something is moving in there…</Text>
            <Pressable onPress={onTap} accessibilityLabel="Tap the egg" hitSlop={20}>
              <Animated.View style={{ transform: [{ rotate: spin }, { scale: eggScale }], opacity: eggOpacity }}>
                <Svg width={200} height={230} viewBox="0 0 236 272">
                  <Path d={EGG} fill={shell} stroke="rgba(0,0,0,0.18)" strokeWidth={3} />
                  <Circle cx={80} cy={190} r={9} fill="#ffffff" opacity={0.35} />
                  <Circle cx={150} cy={210} r={6} fill="#ffffff" opacity={0.35} />
                  <Circle cx={168} cy={150} r={8} fill="#ffffff" opacity={0.3} />
                  {taps >= 1 && <Path d="M118 70 L104 100 L126 122 L108 150" stroke="#2b2b33" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />}
                  {taps >= 2 && <Path d="M118 70 L138 92 L122 116 L144 140 M108 150 L88 172" stroke="#2b2b33" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />}
                </Svg>
              </Animated.View>
            </Pressable>
            <Animated.Text style={[styles.hint, { opacity: hint }]}>
              {taps === 0 ? 'Tap the egg' : taps === 1 ? 'Again' : 'One more'}
            </Animated.Text>
            <Pressable onPress={() => finish(false)} hitSlop={12}>
              <Text style={styles.later}>Not now</Text>
            </Pressable>
          </>
        )}

        {hatched && (
          <Animated.View style={[styles.reveal, { opacity: reveal, transform: [{ scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}>
            <View>
              {SPARKS.map((a) => {
                const r = (a * Math.PI) / 180;
                return (
                  <Animated.View
                    key={a}
                    style={{
                      position: 'absolute', left: 60, top: 70,
                      opacity: spark.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
                      transform: [
                        { translateX: spark.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(r) * 90] }) },
                        { translateY: spark.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(r) * 90] }) },
                      ],
                    }}
                  >
                    <GlyphIcon name="star" size={18} color={shell} weight={4} />
                  </Animated.View>
                );
              })}
              <PackSprite char={char} stage={stage} cell={10} />
            </View>
            <Text style={styles.name}>{pack.name} skin unlocked</Text>
            <Text style={styles.tag}>{pack.tagline}</Text>
            <View style={styles.row}>
              <Pressable onPress={() => finish(true)} style={[styles.btn, { backgroundColor: colors.accent }]}>
                <Text style={[styles.btnText, { color: colors.background }]}>Try it now</Text>
              </Pressable>
              <Pressable onPress={() => finish(false)} style={[styles.btn, styles.btnGhost]}>
                <Text style={[styles.btnText, { color: '#fff' }]}>Later</Text>
              </Pressable>
            </View>
          </Animated.View>
        )}

        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#ffffff', opacity: flash }]} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(8,8,16,0.88)', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24 },
  title:  { fontFamily: FONTS.bodyBold, fontSize: 18, color: '#ffffff', textAlign: 'center' },
  hint:   { fontFamily: FONTS.body, fontSize: 14, color: '#d8d8e4' },
  later:  { fontFamily: FONTS.body, fontSize: 13, color: '#9a9ab0', marginTop: 8 },
  reveal: { alignItems: 'center', gap: 10 },
  name:   { fontFamily: FONTS.display, fontSize: 24, color: '#ffffff', textAlign: 'center', marginTop: 8 },
  tag:    { fontFamily: FONTS.body, fontSize: 14, color: '#d8d8e4', textAlign: 'center' },
  row:    { flexDirection: 'row', gap: 12, marginTop: 14 },
  btn:    { paddingVertical: 11, paddingHorizontal: 22, borderRadius: 999 },
  btnGhost: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  btnText:{ fontFamily: FONTS.bodyBold, fontSize: 14 },
});
