// ─── Walk scene ───────────────────────────────────────────────────────────────
// A little side-on world that moves while you walk: clouds drift, hills and trees slide past at
// different speeds, the path scrolls underneath and your companion bounces along. Stop walking
// and everything slows to a halt and the companion sits down to wait for you.

import { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { PackSprite } from '@/components/page/PackSprite';
import type { CharacterId } from '@/stores/usePetStore';
import type { GoonStage } from '@/constants/sprites';
import { FONTS } from '@/constants/Colors';

const HEIGHT = 210;
const GROUND = 56;

/** Repeats its children across two panels and slides them left forever while `running`. */
function Scroller({ width, seconds, running, children, style }: {
  width: number; seconds: number; running: boolean; children: React.ReactNode; style?: object;
}) {
  const x = useRef(new Animated.Value(0)).current;
  const loop = useRef<Animated.CompositeAnimation | null>(null);
  useEffect(() => {
    loop.current?.stop();
    if (!running || width <= 0) return;
    loop.current = Animated.loop(
      Animated.timing(x, { toValue: 1, duration: seconds * 1000, easing: Easing.linear, useNativeDriver: true }),
    );
    x.setValue(0);
    loop.current.start();
    return () => loop.current?.stop();
  }, [running, width, seconds, x]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: 0, flexDirection: 'row', width: width * 2, transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, -width] }) }] }, style]}
    >
      <View style={{ width }}>{children}</View>
      <View style={{ width }}>{children}</View>
    </Animated.View>
  );
}

export function WalkScene({ char, stage, moving, line }: { char: CharacterId; stage: GoonStage; moving: boolean; line: string }) {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width));

  // Companion bounce (a quick hop per beat while moving, a slow breathing bob when waiting).
  const hop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    hop.setValue(0);
    const dur = moving ? 230 : 1300;
    const lift = moving ? 1 : 0.35;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(hop, { toValue: lift, duration: dur, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(hop, { toValue: 0, duration: dur, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [moving, hop]);

  const sprite = 10 * 6;
  return (
    <View style={s.sky} onLayout={onLayout} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={s.sun} />

      {w > 0 && (
        <>
          {/* clouds: slowest layer */}
          <Scroller width={w} seconds={60} running={moving} style={{ top: 18 }}>
            <View style={[s.cloud, { left: w * 0.12, width: 70 }]} />
            <View style={[s.cloud, { left: w * 0.62, width: 90, top: 22 }]} />
          </Scroller>

          {/* far hills */}
          <Scroller width={w} seconds={26} running={moving} style={{ bottom: GROUND - 6 }}>
            <View style={[s.hill, { left: -30, width: w * 0.7, height: 70 }]} />
            <View style={[s.hill, { left: w * 0.45, width: w * 0.8, height: 56, backgroundColor: '#8DC8A0' }]} />
          </Scroller>

          {/* trees and flowers */}
          <Scroller width={w} seconds={9} running={moving} style={{ bottom: GROUND - 2 }}>
            {[0.15, 0.45, 0.78].map((p, i) => (
              <View key={i} style={{ position: 'absolute', left: w * p, bottom: 0, alignItems: 'center' }}>
                <View style={[s.crown, i === 1 && { width: 26, height: 26, borderRadius: 13 }]} />
                <View style={s.trunk} />
              </View>
            ))}
            {[0.3, 0.6, 0.92].map((p) => <View key={p} style={[s.flower, { left: w * p }]} />)}
          </Scroller>
        </>
      )}

      {/* the path */}
      <View style={s.ground}>
        {w > 0 && (
          <Scroller width={w} seconds={1.4} running={moving} style={{ top: 22 }}>
            {Array.from({ length: Math.ceil(w / 46) + 1 }).map((_, i) => <View key={i} style={[s.dash, { left: i * 46 }]} />)}
          </Scroller>
        )}
      </View>

      {/* companion */}
      <View style={[s.pal, { left: Math.max(16, w * 0.5 - sprite / 2) }]}>
        <Animated.View style={{ transform: [{ translateY: hop.interpolate({ inputRange: [0, 1], outputRange: [0, -14] }) }, { rotate: hop.interpolate({ inputRange: [0, 1], outputRange: ['0deg', moving ? '-4deg' : '0deg'] }) }] }}>
          <PackSprite char={char} stage={stage} cell={6} />
        </Animated.View>
        <Animated.View style={[s.shadow, { transform: [{ scaleX: hop.interpolate({ inputRange: [0, 1], outputRange: [1, 0.72] }) }] }]} />
      </View>

      <View style={s.bubble}><Text style={s.bubbleText} numberOfLines={2}>{line}</Text></View>
    </View>
  );
}

const s = StyleSheet.create({
  sky: { height: HEIGHT, borderRadius: 18, overflow: 'hidden', backgroundColor: '#BFE3FF' },
  sun: { position: 'absolute', right: 26, top: 20, width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFE08A' },
  cloud: { position: 'absolute', top: 0, height: 20, borderRadius: 10, backgroundColor: '#FFFFFFcc' },
  hill: { position: 'absolute', bottom: 0, borderTopLeftRadius: 300, borderTopRightRadius: 300, backgroundColor: '#A6D8B4' },
  crown: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#4E9F68' },
  trunk: { width: 7, height: 16, backgroundColor: '#8A5A35' },
  flower: { position: 'absolute', bottom: 2, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF8FA3' },
  ground: { position: 'absolute', left: 0, right: 0, bottom: 0, height: GROUND, backgroundColor: '#C9B48A' },
  dash: { position: 'absolute', width: 22, height: 5, borderRadius: 3, backgroundColor: '#E8DBB8' },
  pal: { position: 'absolute', bottom: GROUND - 14, alignItems: 'center' },
  shadow: { width: 46, height: 8, borderRadius: 4, backgroundColor: '#00000033', marginTop: -2 },
  bubble: { position: 'absolute', left: 12, top: 12, maxWidth: '58%', backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  bubbleText: { fontFamily: FONTS.bodyMedium, fontSize: 12.5, color: '#12233D' },
});
