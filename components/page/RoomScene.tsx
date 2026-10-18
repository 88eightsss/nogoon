// ─── RoomScene ────────────────────────────────────────────────────────────────
//
// Today as one small pixel room with a companion who lives in it.
//
//   Tap an object  → the companion walks over and says something about it, in the mood it is in.
//   Hold an object → a ring fills, then that tab opens. (Screen readers open it with one tap.)
//   Tap the companion → you pet it. A few pets lift a low mood.
//
// The mood comes from your day (see constants/mascot.ts): sleepy at night and lying on the bed,
// worried by the door when protection is off, proud after a walk-away, lonely at the window after
// a few quiet days, otherwise happy or calm and wandering the rug. The bottom tab bar still works,
// so nothing depends on finding an object.
//
// Day or night follows the clock. The room fills in as lifetime walk-aways grow and never shrinks.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing, AccessibilityInfo, useWindowDimensions } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { FONTS } from '@/constants/Colors';
import { ROOM_W, ROOM_H, ROOM_HOTSPOTS, roomRects, roomLevel, buildPalette } from '@/constants/room';
import {
  moodOf, daysSinceWalkAway, isNight, objectLine, petLine, MOOD_HOME, MOOD_WANDER, MOOD_LABEL,
  type Mood, type SpotKey, type StandKey,
} from '@/constants/mascot';
import { useRoomStore } from '@/stores/useRoomStore';
import { useUserStore } from '@/stores/useUserStore';
import { getLocalDateKey } from '@/utils/date';
import { useTheme } from '@/hooks/useTheme';
import { Feather } from '@expo/vector-icons';
import type { GoonStage } from '@/constants/sprites';
import type { CharacterId } from '@/stores/usePetStore';
import { PackSprite } from './PackSprite';
import { Marquee } from './Marquee';

const HOLD_MS = 600;
const BUSY_MS = 7000;

/** Where the companion stands (centre x, feet y) in room units. */
const STAND: Record<StandKey, { cx: number; feet: number }> = {
  rug:    { cx: 45, feet: 86 },
  door:   { cx: 31, feet: 80 },
  window: { cx: 45, feet: 72 },
  board:  { cx: 62, feet: 72 },
  bed:    { cx: 77, feet: 88 },
  dresser:{ cx: 32, feet: 91 },
};

type Spot = { key: SpotKey; label: string; a11y: string; box: { x: number; y: number; w: number; h: number }; chip: { x: number; y: number }; go: () => void };

/** The name line above the room, with a way into decorating it. */
export function RoomTitle() {
  const { colors } = useTheme();
  const name = useRoomStore((s) => s.roomName);
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync().catch(() => {}); router.push({ pathname: '/customize', params: { section: 'room' } } as any); }}
      accessibilityRole="button"
      accessibilityLabel={`${name || 'Your room'}. Decorate your room.`}
      style={styles.title}
      hitSlop={6}
    >
      <Text style={[styles.titleText, { color: colors.text }]} numberOfLines={1}>{name.trim() || 'Your room'}</Text>
      <Feather name="edit-2" size={13} color={colors.textMuted} />
      <Text style={[styles.titleLink, { color: colors.textMuted }]}>Decorate</Text>
    </Pressable>
  );
}

/** One touchable object. Tap = visit, hold = open (with a filling ring). */
function Hotspot({ box, k, label, a11y, direct, onTap, onHold }: {
  box: Spot['box']; k: number; label: string; a11y: string; direct: boolean; onTap: () => void; onHold: () => void;
}) {
  const fill = useRef(new Animated.Value(0)).current;
  const start = () => { fill.stopAnimation(); Animated.timing(fill, { toValue: 1, duration: HOLD_MS, easing: Easing.linear, useNativeDriver: false }).start(); };
  const stop = () => { fill.stopAnimation(); Animated.timing(fill, { toValue: 0, duration: 140, useNativeDriver: false }).start(); };
  return (
    <Pressable
      onPress={direct ? onHold : onTap}
      onLongPress={direct ? undefined : () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); onHold(); }}
      delayLongPress={HOLD_MS}
      onPressIn={direct ? undefined : start}
      onPressOut={direct ? undefined : stop}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint={direct ? undefined : `Tap to visit ${label}. Hold to open it.`}
      style={{ position: 'absolute', left: box.x * k, top: box.y * k, width: box.w * k, height: box.h * k }}
    >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.ring, { opacity: fill.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }), borderRadius: 4 }]}
      />
    </Pressable>
  );
}

/** A heart that floats up and fades, then removes itself. */
function Heart({ x, y, delay, onDone }: { x: number; y: number; delay: number; onDone: () => void }) {
  const t = useRef(new Animated.Value(0)).current;
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 900, delay, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(({ finished }) => { if (finished) done.current(); });
  }, [t, delay]);
  return (
    <Animated.Text
      pointerEvents="none"
      style={[styles.heart, {
        left: x, top: y,
        opacity: t.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
        transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -26] }) }],
      }]}
    >{'♥'}</Animated.Text>
  );
}

export function RoomScene({
  char, stage, streak, walkAways, headline, showSponsors, petName,
  protectionOff = false,
  interactive = true, forceNight, showTicker = true, maxWidth = 460, outerPad = 32,
}: {
  char: CharacterId; stage: GoonStage; streak: number; walkAways: number;
  headline: string | null; showSponsors: boolean; petName: string;
  protectionOff?: boolean;
  interactive?: boolean; forceNight?: boolean; showTicker?: boolean; maxWidth?: number; outerPad?: number;
}) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const border = 4;
  const W = Math.min(width - outerPad, maxWidth) - border * 2;
  const k = W / ROOM_W;
  const H = Math.round(ROOM_H * k);
  const name = petName.trim() || 'Your companion';

  // Day or night follows the clock, and is checked again whenever Today comes back into view.
  const [hour, setHour] = useState(() => new Date().getHours());
  const focused = useRef(true);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    setHour(new Date().getHours());
    return () => { focused.current = false; };
  }, []));
  const night = forceNight ?? isNight(hour);
  const look = useRoomStore((st) => st.look);
  const decor = useRoomStore((st) => st.decor);
  const p = buildPalette(look, night);
  const level = roomLevel(walkAways);
  const rects = roomRects(p, level, decor);

  // ── How the companion feels ──────────────────────────────────────────────
  const dailyWalkAways = useUserStore((s) => s.dailyWalkAways);
  const [pets, setPets] = useState(0);
  const [awake, setAwake] = useState(false);          // a sleepy companion you have woken
  const todayKey = getLocalDateKey();
  const mood: Mood = useMemo(() => moodOf({
    hour,
    walkAwaysToday: dailyWalkAways?.[todayKey] ?? 0,
    daysSinceWalkAway: daysSinceWalkAway(dailyWalkAways ?? {}, todayKey),
    protectionOff,
    pets,
  }), [hour, dailyWalkAways, todayKey, protectionOff, pets]);
  const sleeping = interactive && mood === 'sleepy' && !awake;

  // ── Movement ─────────────────────────────────────────────────────────────
  const home = STAND[interactive ? MOOD_HOME[mood] : 'rug'];
  const cx = useRef(new Animated.Value(home.cx)).current;
  const feet = useRef(new Animated.Value(home.feet)).current;
  const hop = useRef(new Animated.Value(0)).current;
  const lie = useRef(new Animated.Value(sleeping ? 1 : 0)).current;
  const at = useRef<StandKey>(interactive ? MOOD_HOME[mood] : 'rug');
  const busyUntil = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => { const t = setTimeout(fn, ms); timers.current.push(t); return t; };
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const hopOnce = useCallback((height = 6) => {
    Animated.sequence([
      Animated.timing(hop, { toValue: -height, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.timing(hop, { toValue: 0, duration: 130, easing: Easing.in(Easing.quad), useNativeDriver: false }),
    ]).start();
  }, [hop]);

  const walkTo = useCallback((key: StandKey) => {
    if (at.current === key) { hopOnce(4); return; }
    at.current = key;
    const to = STAND[key];
    Animated.parallel([
      Animated.timing(cx, { toValue: to.cx, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      Animated.timing(feet, { toValue: to.feet, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      Animated.sequence([0, 1, 2].map(() => Animated.sequence([
        Animated.timing(hop, { toValue: -4, duration: 110, useNativeDriver: false }),
        Animated.timing(hop, { toValue: 0, duration: 120, useNativeDriver: false }),
      ]))),
    ]).start();
  }, [cx, feet, hop, hopOnce]);

  // Lie down on the bed to sleep, sit up when woken.
  useEffect(() => {
    Animated.timing(lie, { toValue: sleeping ? 1 : 0, duration: 450, easing: Easing.inOut(Easing.quad), useNativeDriver: false }).start();
  }, [sleeping, lie]);

  // Go to the place this mood calls home whenever the mood (or sleep state) changes.
  useEffect(() => {
    if (!interactive) return;
    const t = later(() => walkTo(MOOD_HOME[mood]), 250);
    return () => clearTimeout(t);
  }, [mood, awake, interactive, walkTo]);

  // Wander a little while idle, according to the mood.
  useEffect(() => {
    if (!interactive || sleeping) return;
    let live = true;
    const tick = () => {
      if (!live) return;
      if (focused.current && Date.now() >= busyUntil.current) {
        const options = MOOD_WANDER[mood].filter((s) => s !== at.current);
        if (options.length) walkTo(options[Math.floor(Math.random() * options.length)]);
        if (mood === 'proud' || mood === 'happy') later(() => hopOnce(7), 900);
      }
      later(tick, 5000 + Math.random() * 4000);
    };
    const t = later(tick, 4000 + Math.random() * 3000);
    return () => { live = false; clearTimeout(t); };
  }, [mood, sleeping, interactive, walkTo, hopOnce]);

  // ── Speech, hearts, petting ──────────────────────────────────────────────
  const [say, setSay] = useState<string | null>(null);
  const sayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (sayTimer.current) clearTimeout(sayTimer.current); }, []);
  const speak = (text: string) => {
    setSay(text);
    busyUntil.current = Date.now() + BUSY_MS;
    if (sayTimer.current) clearTimeout(sayTimer.current);
    sayTimer.current = setTimeout(() => setSay(null), 3800);
  };
  const [hearts, setHearts] = useState<number[]>([]);
  const heartId = useRef(0);
  const dropHeart = useCallback((id: number) => setHearts((h) => h.filter((x) => x !== id)), []);

  // Every tap gets a hop and a tick, but the pal does not chatter or shower hearts each time:
  // a word every few taps, and a little burst of hearts only after a good run of them.
  const sinceSay = useRef(0);
  const sinceHeart = useRef(0);
  const sayAfter = useRef(3 + Math.floor(Math.random() * 3));      // 3 to 5 taps
  const heartAfter = useRef(6 + Math.floor(Math.random() * 4));    // 6 to 9 taps
  const petIt = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const n = pets + 1;
    setPets(n);
    hopOnce(8);
    sinceSay.current += 1;
    sinceHeart.current += 1;
    if (sinceSay.current >= sayAfter.current) {
      sinceSay.current = 0;
      sayAfter.current = 3 + Math.floor(Math.random() * 3);
      speak(petLine(mood, n));
    }
    if (sinceHeart.current >= heartAfter.current) {
      sinceHeart.current = 0;
      heartAfter.current = 6 + Math.floor(Math.random() * 4);
      setHearts((h) => [...h, heartId.current++, heartId.current++, heartId.current++]);
    }
    if (mood === 'sleepy') {
      setAwake(true);
      later(() => setAwake(false), 9000);
    }
  };

  const visit = (key: SpotKey) => {
    Haptics.selectionAsync().catch(() => {});
    speak(objectLine(mood, key));
    if (!sleeping) walkTo(key);
  };
  const open = (path: string) => router.navigate(path as any);

  // Screen readers can't hold, so for them one tap opens.
  const [screenReader, setScreenReader] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then(setScreenReader).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => sub.remove();
  }, []);

  const H_ = ROOM_HOTSPOTS;
  const spots: Spot[] = [
    { key: 'door',    label: 'Protect',  a11y: 'Protect. The door. Opens your blocking settings.', box: H_.door,    chip: { x: 5,  y: 65 },   go: () => open('/(tabs)/blocklist') },
    { key: 'window',  label: 'Briefing', a11y: 'Briefing. The window. Opens today\'s good news.',   box: H_.window,  chip: { x: 36, y: 36.5 }, go: () => open('/(tabs)/feed') },
    { key: 'board',   label: showSponsors ? 'The Wall' : 'Milestones', a11y: showSponsors ? 'The Wall. The corkboard. Opens the sponsor board.' : 'Milestones. The corkboard. Opens your milestones.', box: H_.board, chip: { x: 66, y: 33 }, go: () => open(showSponsors ? '/wall' : '/milestones') },
    { key: 'bed',     label: 'Unwind',   a11y: 'Unwind. The bed. Opens breathing, games and journaling.', box: H_.bed, chip: { x: 68, y: 93 }, go: () => open('/(tabs)/calm') },
    { key: 'dresser', label: 'Me',       a11y: 'Me. The dresser. Opens your settings and progress.',  box: H_.dresser, chip: { x: 5,  y: 93 },   go: () => open('/(tabs)/profile') },
  ];

  const cell = Math.max(2, Math.round(2 * k));
  const spriteW = 10 * cell, spriteH = 12 * cell;
  const left = Animated.subtract(Animated.multiply(cx, k), spriteW / 2);
  const top = Animated.subtract(Animated.multiply(feet, k), spriteH);
  const spriteStyle = {
    position: 'absolute' as const, left, top, width: spriteW, height: spriteH,
    transform: [
      { translateY: Animated.add(hop, lie.interpolate({ inputRange: [0, 1], outputRange: [0, (spriteH - spriteW) / 2] })) },
      { rotate: lie.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) },
    ],
  };
  // Speech bubble and Zzz follow the standing spot, not the animation, so they stay readable.
  const bubbleLeft = (c: number) => Math.max(6, Math.min(W - 186, c * k - 90));
  const heartBase = { x: STAND[at.current].cx * k - 4, y: STAND[at.current].feet * k - spriteH };

  const lcd = p.lcdBg;
  const news = headline ? headline.toUpperCase() : 'GOOD NEWS IS ON ITS WAY';

  return (
    <View>
    <View style={[styles.box, { borderColor: p.boxInk, shadowColor: p.boxInk, backgroundColor: p.wall }]} accessibilityLabel={`Your room. Day ${Math.max(1, streak)}.`}>
      <View style={{ width: W, height: H }}>
        <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
          {rects.map((q, i) => {
            // Snap to whole pixels so neighbouring rectangles meet without seams.
            const x0 = Math.round(q.x * k), y0 = Math.round(q.y * k);
            return <Rect key={i} x={x0} y={y0} width={Math.round((q.x + q.w) * k) - x0} height={Math.round((q.y + q.h) * k) - y0} fill={q.c} opacity={q.o} />;
          })}
        </Svg>

        {interactive && spots.map((s) => (
          <Hotspot
            key={s.key} box={s.box} k={k} label={s.label} a11y={s.a11y} direct={screenReader}
            onTap={() => visit(s.key)} onHold={s.go}
          />
        ))}

        <Animated.View style={spriteStyle} pointerEvents={interactive ? 'box-none' : 'none'}>
          {interactive ? (
            <Pressable
              onPress={petIt}
              accessibilityRole="button"
              accessibilityLabel={`${name}, your companion, feeling ${MOOD_LABEL[mood]}. Tap to pet.`}
              style={{ width: spriteW, height: spriteH }}
            >
              <PackSprite char={char} stage={stage} cell={cell} />
            </Pressable>
          ) : (
            <PackSprite char={char} stage={stage} cell={cell} />
          )}
        </Animated.View>

        {sleeping ? <Text style={[styles.zzz, { left: STAND.bed.cx * k - 6, top: STAND.bed.feet * k - spriteW - 18, color: '#EAF2FF' }]} accessibilityElementsHidden>z Z</Text> : null}
        {hearts.map((id, i) => <Heart key={id} x={heartBase.x + (i % 2 ? 10 : -6)} y={heartBase.y} delay={(i % 2) * 120} onDone={() => dropHeart(id)} />)}
        {say ? (
          <View style={[styles.bubble, { left: bubbleLeft(STAND[at.current].cx), top: Math.max(4, STAND[at.current].feet * k - spriteH - 46) }]} pointerEvents="none">
            <Text style={styles.bubbleText}>{say}</Text>
          </View>
        ) : null}

        {interactive && <View style={styles.dayRow} pointerEvents="none">
          <View style={[styles.chip, { position: 'relative', borderColor: p.boxInk }]}>
            <Text style={[styles.chipText, { color: '#12233D', fontSize: 11 }]}>DAY {Math.max(1, streak)}</Text>
          </View>
        </View>}

        {interactive && spots.map((s) => (
          <View key={`c${s.key}`} style={[styles.chip, { left: s.chip.x * k, top: s.chip.y * k, borderColor: p.boxInk }]} pointerEvents="none">
            <Text style={[styles.chipText, { color: '#12233D' }]}>{s.label.toUpperCase()}</Text>
          </View>
        ))}
      </View>

      {showTicker ? (
        <View style={{ backgroundColor: lcd, paddingHorizontal: 6, paddingVertical: 4 }}>
          <Marquee text={`NEWS ▸ ${news}`} color={p.lcdInk} bg={lcd} font={FONTS.mono} />
        </View>
      ) : null}
    </View>
    {interactive ? (
      <View style={styles.caption} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={[styles.captionMood, { color: colors.text }]}>{name} is feeling {MOOD_LABEL[mood]}</Text>
        <Text style={[styles.captionHint, { color: colors.textMuted }]}>Tap to visit. Hold to open.</Text>
      </View>
    ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  title:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  titleText: { fontFamily: FONTS.display, fontSize: 18, flexShrink: 1 },
  titleLink: { fontFamily: FONTS.body, fontSize: 12, marginLeft: 'auto' },
  box:    { borderWidth: 4, borderRadius: 10, overflow: 'hidden', alignSelf: 'center', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  ring:   { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#FFFFFF' },
  chip:   { position: 'absolute', backgroundColor: '#FFFFFF', borderWidth: 2, borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2 },
  chipText: { fontFamily: FONTS.monoBold, fontSize: 9, letterSpacing: 0.4 },
  dayRow: { position: 'absolute', left: 0, right: 0, top: 4, alignItems: 'center' },
  zzz:    { position: 'absolute', fontFamily: FONTS.monoBold, fontSize: 11, opacity: 0.85 },
  heart:  { position: 'absolute', fontSize: 14, color: '#FF6B8B' },
  bubble: { position: 'absolute', width: 180, backgroundColor: '#FFFFFF', borderColor: '#12233D', borderWidth: 2, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  bubbleText: { fontFamily: FONTS.bodyMedium, fontSize: 12, color: '#12233D', textAlign: 'center' },
  caption: { alignItems: 'center', gap: 2, marginTop: 10 },
  captionMood: { fontFamily: FONTS.bodyMedium, fontSize: 13 },
  captionHint: { fontFamily: FONTS.body, fontSize: 12 },
});
