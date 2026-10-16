// The companion as a small widget that floats over the whole app. Drag it anywhere,
// tap it to hear from it. On "corner" skins (Notebook) it is on by default; any other
// skin can turn it on in Customize. Size, snap-to-corners and position are saved.

import { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, PanResponder, StyleSheet, useWindowDimensions } from 'react-native';
import { useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useActivePack } from '@/hooks/usePack';
import { usePackStore, type CompanionSize } from '@/stores/usePackStore';
import { useRoomStore } from '@/stores/useRoomStore';
import { useUserStore } from '@/stores/useUserStore';
import { getGoonStage } from '@/components/home/GoonMascot';
import { FONTS } from '@/constants/Colors';
import { PackSprite } from './PackSprite';
import { useCharacter, CHARACTER_LABELS } from './useCharacter';

const CELL: Record<CompanionSize, number> = { sm: 3, md: 4, lg: 6 };
const PAD = 8;
const HEADER = 56;
const TABBAR = 60;
const SAY = [
  'Resting. I will keep watch.',
  'Thanks for walking away.',
  'Proud of you.',
  'Nothing gets past us.',
  'Look how far we have come.',
];

export function useFloatVisible(): boolean {
  const pack = useActivePack();
  const mode = usePackStore((s) => s.floatMode);
  return mode === 'on' || (mode === 'auto' && pack.parts.page.frame === 'corner');
}

export function FloatingCompanion() {
  const { colors } = useTheme();
  const wanted = useFloatVisible();
  // Today's room already has the companion standing in it, so don't float a second one there.
  const roomView = useRoomStore((s) => s.roomView);
  const segments = useSegments() as string[];
  const onToday = segments[0] === '(tabs)' && (segments.length === 1 || segments[1] === 'index');
  const visible = wanted && !(roomView && onToday);
  const char = useCharacter();
  const walkAways = useUserStore((s) => s.walkAwayCount);
  const size = usePackStore((s) => s.companionSize);
  const snap = usePackStore((s) => s.companionSnap);
  const pos = usePackStore((s) => s.companionPos);
  const setPos = usePackStore((s) => s.setCompanionPos);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const cell = CELL[size];
  const tw = 10 * cell + PAD * 2;
  const th = 12 * cell + PAD * 2;
  const left = 8, right = Math.max(left, width - tw - 8);
  const top = insets.top + HEADER + 8;
  const bottom = Math.max(top, height - (TABBAR + insets.bottom) - th - 8);
  const areaW = Math.max(1, right - left), areaH = Math.max(1, bottom - top);

  const xy = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const cur = useRef({ x: 0, y: 0 });
  const hop = useRef(new Animated.Value(0)).current;
  const [line, setLine] = useState<string | null>(null);
  const lineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const id = xy.addListener((v) => { cur.current = v; });
    return () => xy.removeListener(id);
  }, [xy]);

  // Place from saved fractions whenever size or screen changes.
  useEffect(() => {
    xy.setValue({ x: left + pos.x * areaW, y: top + pos.y * areaH });
  }, [xy, left, top, areaW, areaH, pos.x, pos.y]);

  const geo = useRef({ left, right, top, bottom, areaW, areaH, snap });
  geo.current = { left, right, top, bottom, areaW, areaH, snap };

  const talk = () => {
    Animated.sequence([
      Animated.timing(hop, { toValue: -10, duration: 120, useNativeDriver: true }),
      Animated.timing(hop, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start();
    setLine(SAY[getGoonStage(walkAways)]);
    if (lineTimer.current) clearTimeout(lineTimer.current);
    lineTimer.current = setTimeout(() => setLine(null), 2600);
  };
  useEffect(() => () => { if (lineTimer.current) clearTimeout(lineTimer.current); }, []);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        xy.setOffset({ x: cur.current.x, y: cur.current.y });
        xy.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: xy.x, dy: xy.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_e, g) => {
        xy.flattenOffset();
        const gm = geo.current;
        if (Math.abs(g.dx) < 6 && Math.abs(g.dy) < 6) { talk(); return; }
        let x = Math.max(gm.left, Math.min(gm.right, cur.current.x));
        let y = Math.max(gm.top, Math.min(gm.bottom, cur.current.y));
        if (gm.snap) {
          x = x + 0 < (gm.left + gm.right) / 2 ? gm.left : gm.right;
          y = y < (gm.top + gm.bottom) / 2 ? gm.top : gm.bottom;
        }
        Animated.spring(xy, { toValue: { x, y }, useNativeDriver: false, friction: 7 }).start();
        setPos({ x: (x - gm.left) / gm.areaW, y: (y - gm.top) / gm.areaH });
      },
    })
  ).current;

  if (!visible) return null;

  const inkColor = colors.text;
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View
        {...pan.panHandlers}
        accessibilityLabel={`${CHARACTER_LABELS[char]}, your companion. Drag to move, tap to hear from it.`}
        style={[
          styles.tile,
          { width: tw, height: th, backgroundColor: colors.surface, borderColor: colors.cardBorder, transform: xy.getTranslateTransform() },
        ]}
      >
        {line ? (
          <View style={[styles.bubble, { backgroundColor: colors.surfaceHigh, borderColor: colors.cardBorder, bottom: th + 6 }]}>
            <Text style={[styles.bubbleText, { color: inkColor }]}>{line}</Text>
          </View>
        ) : null}
        <Animated.View style={{ transform: [{ translateY: hop }] }}>
          <PackSprite char={char} stage={getGoonStage(walkAways)} cell={cell} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    position: 'absolute', left: 0, top: 0, borderWidth: 1.5, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 6,
  },
  bubble: { position: 'absolute', minWidth: 120, maxWidth: 180, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, right: 0 },
  bubbleText: { fontFamily: FONTS.body, fontSize: 12.5, textAlign: 'center' },
});
