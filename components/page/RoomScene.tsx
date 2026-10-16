// ─── RoomScene ────────────────────────────────────────────────────────────────
//
// Today as one small pixel room. Tap the window for the Briefing, the door for Protect, the
// corkboard for The Wall, the bed for Unwind, the dresser for Me. Tap your companion to hear
// from them. The bottom tab bar still works, so nothing depends on finding an object.
//
// Day or night follows the clock. The room fills in as lifetime walk-aways grow and never
// shrinks if a streak breaks.

import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { FONTS } from '@/constants/Colors';
import { ROOM_W, ROOM_H, ROOM_DAY, ROOM_NIGHT, ROOM_HOTSPOTS, ROOM_COMPANION, roomRects, roomLevel } from '@/constants/room';
import type { GoonStage } from '@/constants/sprites';
import type { CharacterId } from '@/stores/usePetStore';
import { PackSprite } from './PackSprite';
import { Marquee } from './Marquee';

const SAY = [
  'Rest up. I will keep watch.',
  'I am waking up. Thanks for walking away.',
  'You walked away a lot. Proud of you.',
  'Nothing gets past us today.',
  'Look how far we have come.',
];

type Spot = { key: string; label: string; a11y: string; box: { x: number; y: number; w: number; h: number }; chip: { x: number; y: number }; go: () => void };

export function RoomScene({
  char, stage, streak, walkAways, headline, showSponsors, petName,
}: {
  char: CharacterId; stage: GoonStage; streak: number; walkAways: number;
  headline: string | null; showSponsors: boolean; petName: string;
}) {
  const { width } = useWindowDimensions();
  const border = 4;
  const W = Math.min(width - 32, 460) - border * 2;
  const k = W / ROOM_W;
  const H = Math.round(ROOM_H * k);

  // Day or night follows the clock, and is checked again whenever Today comes back into view.
  const [hour, setHour] = useState(() => new Date().getHours());
  useFocusEffect(useCallback(() => { setHour(new Date().getHours()); }, []));
  const night = hour >= 20 || hour < 6;
  const p = night ? ROOM_NIGHT : ROOM_DAY;
  const level = roomLevel(walkAways);
  const rects = roomRects(p, level);

  const [say, setSay] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const talk = () => {
    Haptics.selectionAsync().catch(() => {});
    setSay(night ? 'Zzz. Sleep well.' : SAY[stage]);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSay(null), 3500);
  };

  const open = (path: string) => { Haptics.selectionAsync().catch(() => {}); router.navigate(path as any); };
  const H_ = ROOM_HOTSPOTS;
  const spots: Spot[] = [
    { key: 'door',    label: 'Protect',  a11y: 'Protect. The door. Opens your blocking settings.', box: H_.door,    chip: { x: 5,  y: 65 },   go: () => open('/(tabs)/blocklist') },
    { key: 'window',  label: 'Briefing', a11y: 'Briefing. The window. Opens today\'s good news.',   box: H_.window,  chip: { x: 36, y: 36.5 }, go: () => open('/(tabs)/feed') },
    { key: 'board',   label: showSponsors ? 'The Wall' : 'Milestones', a11y: showSponsors ? 'The Wall. The corkboard. Opens the sponsor board.' : 'Milestones. The corkboard. Opens your milestones.', box: H_.board, chip: { x: 66, y: 33 }, go: () => open(showSponsors ? '/wall' : '/milestones') },
    { key: 'bed',     label: 'Unwind',   a11y: 'Unwind. The bed. Opens breathing, games and journaling.', box: H_.bed, chip: { x: 68, y: 93 }, go: () => open('/(tabs)/calm') },
    { key: 'dresser', label: 'Me',       a11y: 'Me. The dresser. Opens your settings and progress.',  box: H_.dresser, chip: { x: 5,  y: 93 },   go: () => open('/(tabs)/profile') },
  ];

  const cell = Math.max(2, Math.round(ROOM_COMPANION.cells * k));
  const spriteW = 10 * cell, spriteH = 12 * cell;
  // Centre the sprite on its slot, with its feet on the rug.
  const sx = (ROOM_COMPANION.x + 10) * k - spriteW / 2;
  const sy = (ROOM_COMPANION.y + 24) * k - spriteH;

  const lcd = p.lcdBg;
  const news = headline ? headline.toUpperCase() : 'GOOD NEWS IS ON ITS WAY';

  return (
    <View style={[styles.box, { borderColor: p.boxInk, shadowColor: p.boxInk, backgroundColor: p.wall }]} accessibilityLabel={`Your room. Day ${Math.max(1, streak)}.`}>
      <View style={{ width: W, height: H }}>
        <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
          {rects.map((q, i) => {
            // Snap to whole pixels so neighbouring rectangles meet without seams.
            const x0 = Math.round(q.x * k), y0 = Math.round(q.y * k);
            return <Rect key={i} x={x0} y={y0} width={Math.round((q.x + q.w) * k) - x0} height={Math.round((q.y + q.h) * k) - y0} fill={q.c} opacity={q.o} />;
          })}
        </Svg>

        {spots.map((s) => (
          <Pressable
            key={s.key}
            onPress={s.go}
            accessibilityRole="button"
            accessibilityLabel={s.a11y}
            style={{ position: 'absolute', left: s.box.x * k, top: s.box.y * k, width: s.box.w * k, height: s.box.h * k }}
          />
        ))}

        <Pressable
          onPress={talk}
          accessibilityRole="button"
          accessibilityLabel={`${petName}, your companion. Tap to hear from them.`}
          style={{ position: 'absolute', left: sx, top: sy, width: spriteW, height: spriteH }}
        >
          <PackSprite char={char} stage={stage} cell={cell} />
        </Pressable>

        {night && !say ? <Text style={[styles.zzz, { left: sx + spriteW - 4, top: sy - 8, color: '#EAF2FF' }]} accessibilityElementsHidden>z Z</Text> : null}
        {say ? (
          <View style={[styles.bubble, { left: Math.max(6, Math.min(W - 186, sx + spriteW / 2 - 90)), top: Math.max(4, sy - 40) }]} pointerEvents="none">
            <Text style={styles.bubbleText}>{say}</Text>
          </View>
        ) : null}

        <View style={styles.dayRow} pointerEvents="none">
          <View style={[styles.chip, { position: 'relative', borderColor: p.boxInk }]}>
            <Text style={[styles.chipText, { color: '#12233D', fontSize: 11 }]}>DAY {Math.max(1, streak)}</Text>
          </View>
        </View>

        {spots.map((s) => (
          <View key={`c${s.key}`} style={[styles.chip, { left: s.chip.x * k, top: s.chip.y * k, borderColor: p.boxInk }]} pointerEvents="none">
            <Text style={[styles.chipText, { color: '#12233D' }]}>{s.label.toUpperCase()}</Text>
          </View>
        ))}
      </View>

      <View style={{ backgroundColor: lcd, paddingHorizontal: 6, paddingVertical: 4 }}>
        <Marquee text={`NEWS ▸ ${news}`} color={p.lcdInk} bg={lcd} font={FONTS.mono} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box:    { borderWidth: 4, borderRadius: 10, overflow: 'hidden', alignSelf: 'center', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  chip:   { position: 'absolute', backgroundColor: '#FFFFFF', borderWidth: 2, borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2 },
  chipText: { fontFamily: FONTS.monoBold, fontSize: 9, letterSpacing: 0.4 },
  dayRow: { position: 'absolute', left: 0, right: 0, top: 4, alignItems: 'center' },
  zzz:    { position: 'absolute', fontFamily: FONTS.monoBold, fontSize: 11, opacity: 0.85 },
  bubble: { position: 'absolute', width: 180, backgroundColor: '#FFFFFF', borderColor: '#12233D', borderWidth: 2, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  bubbleText: { fontFamily: FONTS.bodyMedium, fontSize: 12, color: '#12233D', textAlign: 'center' },
});
