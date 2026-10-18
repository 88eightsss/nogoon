// ─── Tour demos ───────────────────────────────────────────────────────────────
// Small hands-on versions of real features, shown inside the interactive tour. Nothing here
// touches real data: each demo keeps its own throwaway state and calls onTried() the first time
// the person actually does the thing, so the tour can say "nice" and tick the step.

import { Glyph } from '@/components/ui/Glyph';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing, PanResponder, TextInput } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import type { ThemePalette } from '@/constants/Themes';
import { FONTS } from '@/constants/Colors';
import { PackSprite } from '@/components/page/PackSprite';
import { ClockTimePicker } from '@/components/ClockTimePicker';
import { CHARACTER_NAMES, CHARACTER_TAGS, type GoonStage } from '@/constants/sprites';
import type { CharacterId } from '@/stores/usePetStore';
import { nextChangeLine, format12 } from '@/utils/schedule';

export type DemoProps = { colors: ThemePalette; onTried: () => void };
export type DemoKey =
  | 'gate' | 'feed' | 'hold' | 'wave' | 'picker' | 'sticker' | 'clock' | 'briefing' | 'nearby' | 'intention' | 'reach';

const buzz = () => Haptics.selectionAsync().catch(() => {});

function Box({ colors, children, label }: { colors: ThemePalette; children: React.ReactNode; label?: string }) {
  return (
    <View style={[s.box, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
      {label ? <Text style={[s.tag, { color: colors.accent, backgroundColor: colors.accentDim }]}>{label}</Text> : null}
      {children}
    </View>
  );
}
function Btn({ colors, label, onPress, ghost }: { colors: ThemePalette; label: string; onPress: () => void; ghost?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[s.btn, ghost ? { borderWidth: 1, borderColor: colors.cardBorder } : { backgroundColor: colors.accent }]}
    >
      <Text style={[s.btnText, { color: ghost ? colors.textSecondary : '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

// ── 1. The gate: what happens when you open a blocked app ──────────────────────────────────────
function GateDemo({ colors, onTried }: DemoProps) {
  const [phase, setPhase] = useState<'idle' | 'pause' | 'done'>('idle');
  const pick = () => { buzz(); setPhase('done'); onTried(); };
  return (
    <Box colors={colors} label="Try it">
      {phase === 'idle' && (
        <View style={s.center}>
          <View style={[s.appTile, { backgroundColor: colors.surfaceHigh }]}>
            <Feather name="play-circle" size={30} color={colors.textMuted} />
            <Text style={[s.small, { color: colors.textSecondary }]}>ScrollApp (blocked)</Text>
          </View>
          <Btn colors={colors} label="Open it" onPress={() => { buzz(); setPhase('pause'); }} />
        </View>
      )}
      {phase === 'pause' && (
        <View style={{ gap: 8 }}>
          <Text style={[s.h, { color: colors.text }]}>Hold on. Pick one.</Text>
          <Text style={[s.small, { color: colors.textSecondary }]}>The urge fades in about 90 seconds. Do something small first.</Text>
          <Btn colors={colors} label="Breathe for a minute" onPress={pick} />
          <Btn colors={colors} label="Play a quick game" onPress={pick} ghost />
          <Btn colors={colors} label="Walk away" onPress={pick} ghost />
        </View>
      )}
      {phase === 'done' && (
        <View style={s.center}>
          <Feather name="check-circle" size={34} color={colors.success} />
          <Text style={[s.h, { color: colors.text }]}>You walked away.</Text>
          <Text style={[s.small, { color: colors.textSecondary, textAlign: 'center' }]}>
            That is the whole idea. If you still want in after the pause, a short wait unlocks it for 20 minutes.
          </Text>
          <Btn colors={colors} label="Try again" ghost onPress={() => setPhase('idle')} />
        </View>
      )}
    </Box>
  );
}

// ── 2. Feeding a companion ─────────────────────────────────────────────────────────────────────
function FeedDemo({ colors, onTried }: DemoProps) {
  const [fed, setFed] = useState(0);
  const stage = Math.min(4, Math.floor(fed / 3)) as GoonStage;
  const full = stage === 4;
  return (
    <Box colors={colors} label="Try it">
      <View style={s.center}>
        <PackSprite char={0} stage={stage} cell={8} />
        <Text style={[s.h, { color: colors.text }]}>Buddy · stage {stage + 1} of 5</Text>
        <View style={[s.track, { backgroundColor: colors.border }]}>
          <View style={[s.fill, { backgroundColor: colors.accent, width: `${Math.min(100, (fed / 12) * 100)}%` }]} />
        </View>
        <Btn colors={colors} label={full ? 'Start over' : 'I walked away (+1)'} onPress={() => { buzz(); if (full) setFed(0); else { setFed(fed + 1); onTried(); } }} />
        <Text style={[s.small, { color: colors.textMuted, textAlign: 'center' }]}>
          In the app, growth is slower on purpose: stages come at 5, 15, 30 and 60 walk-aways.
        </Text>
      </View>
    </Box>
  );
}

// ── 3. Hold to breathe ────────────────────────────────────────────────────────────────────────
function HoldDemo({ colors, onTried }: DemoProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const start = useRef(0);
  const [msg, setMsg] = useState('Press and hold the orb');
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  useEffect(() => () => anim.current?.stop(), []);
  const go = (to: number, ms: number) => {
    anim.current?.stop();
    anim.current = Animated.timing(scale, { toValue: to, duration: ms, easing: Easing.inOut(Easing.quad), useNativeDriver: true });
    anim.current.start();
  };
  return (
    <Box colors={colors} label="Try it">
      <View style={s.center}>
        <Pressable
          onPressIn={() => { start.current = Date.now(); setMsg('Breathe in… keep holding'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); go(1.45, 4000); }}
          onPressOut={() => {
            const held = Date.now() - start.current;
            if (held >= 3000) { setMsg('Lovely. Breathe out slowly…'); onTried(); go(1, 5000); }
            else { setMsg('A little longer next time. Hold again'); go(1, 1500); }
          }}
          accessibilityRole="button"
          accessibilityLabel="Press and hold to breathe in, release to breathe out"
          style={{ height: 150, alignItems: 'center', justifyContent: 'center' }}
        >
          <Animated.View style={[s.orb, { backgroundColor: colors.accent, transform: [{ scale }] }]} />
        </Pressable>
        <Text style={[s.h, { color: colors.text, textAlign: 'center' }]}>{msg}</Text>
        <Text style={[s.small, { color: colors.textMuted, textAlign: 'center' }]}>The way out is longer than the way in. That is what calms you down.</Text>
      </View>
    </Box>
  );
}

// ── 4. The urge wave ──────────────────────────────────────────────────────────────────────────
const PROFILE = [0.25, 0.4, 0.6, 0.8, 0.95, 1, 0.95, 0.8, 0.6, 0.4, 0.25];
function WaveDemo({ colors, onTried }: DemoProps) {
  const p = useRef(new Animated.Value(0)).current;
  const [label, setLabel] = useState('Tap start and watch an urge come and go');
  const [running, setRunning] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => clear, []);
  const env = p.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.12, 1, 0.12] });
  const run = () => {
    clear(); setRunning(true); p.setValue(0); setLabel('The urge is rising…');
    Animated.timing(p, { toValue: 1, duration: 7000, easing: Easing.linear, useNativeDriver: true }).start(({ finished }) => {
      if (!finished) return;
      setRunning(false); setLabel('It passed. You rode it out.'); onTried();
    });
    timers.current.push(setTimeout(() => setLabel('This is the peak. It does not last.'), 3000));
    timers.current.push(setTimeout(() => setLabel('Already easing…'), 4800));
  };
  return (
    <Box colors={colors} label="Try it">
      <View style={s.center}>
        <View style={s.bars}>
          {PROFILE.map((h, i) => (
            <Animated.View key={i} style={[s.bar, { height: 90 * h, backgroundColor: colors.accent, transform: [{ scaleY: env }], transformOrigin: 'bottom' }]} />
          ))}
        </View>
        <Text style={[s.h, { color: colors.text, textAlign: 'center' }]}>{label}</Text>
        <Btn colors={colors} label={running ? 'Watching…' : 'Start'} onPress={() => { if (!running) run(); }} />
      </View>
    </Box>
  );
}

// ── 5. Pick who to feed ───────────────────────────────────────────────────────────────────────
const PICKS: CharacterId[] = [0, 1, 2];
function PickerDemo({ colors, onTried }: DemoProps) {
  const [sel, setSel] = useState<CharacterId>(0);
  return (
    <Box colors={colors} label="Try it">
      <View style={s.row}>
        {PICKS.map((id) => (
          <Pressable
            key={id}
            onPress={() => { buzz(); setSel(id); onTried(); }}
            accessibilityRole="button"
            accessibilityState={{ selected: sel === id }}
            style={[s.pick, { borderColor: sel === id ? colors.accent : colors.cardBorder, backgroundColor: sel === id ? colors.accentDim : colors.surfaceHigh }]}
          >
            <PackSprite char={id} stage={2} cell={5} />
            <Text style={[s.small, { color: colors.text, fontFamily: FONTS.bodyBold }]}>{CHARACTER_NAMES[id]}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={[s.small, { color: colors.textSecondary, textAlign: 'center' }]}>
        {CHARACTER_NAMES[sel]} · {CHARACTER_TAGS[sel]}. Only {CHARACTER_NAMES[sel]} grows now; the others keep their stage.
      </Text>
    </Box>
  );
}

// ── 6. Journal page with stickers ─────────────────────────────────────────────────────────────
const PAPER = ['#FFF8E7', '#E8F3EC', '#E9EEFB', '#FBE9F1'];
const GLYPHS = ['feather', 'star', 'sun', 'anchor', 'heart'];
const GLYPH_TINT = ['#30A46C', '#E5A000', '#F76B15', '#0091FF', '#E93D82'];
function Sticker({ glyph, x0, y0, onMoved }: { glyph: string; x0: number; y0: number; onMoved: () => void }) {
  const pos = useRef(new Animated.ValueXY({ x: x0, y: y0 })).current;
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { pos.extractOffset(); },
      onPanResponderMove: Animated.event([null, { dx: pos.x, dy: pos.y }], { useNativeDriver: false }),
      onPanResponderRelease: () => { pos.flattenOffset(); onMoved(); },
      onPanResponderTerminate: () => { pos.flattenOffset(); },
    })
  ).current;
  return (
    <Animated.View {...pan.panHandlers} style={[s.sticker, { transform: pos.getTranslateTransform() }]} accessibilityLabel={`Sticker ${glyph}. Drag to move`}>
      <Glyph name={glyph} size={34} color={GLYPH_TINT[Math.max(0, GLYPHS.indexOf(glyph))]} />
    </Animated.View>
  );
}
function StickerDemo({ colors, onTried }: DemoProps) {
  const [paper, setPaper] = useState(0);
  const [items, setItems] = useState<{ id: number; glyph: string; x: number; y: number }[]>([]);
  const n = useRef(0);
  const add = (glyph: string) => {
    buzz();
    n.current += 1;
    setItems((cur) => [...cur, { id: n.current, glyph, x: 20 + ((cur.length * 52) % 200), y: 20 + ((cur.length * 34) % 90) }]);
    onTried();
  };
  return (
    <Box colors={colors} label="Try it">
      <View style={[s.paper, { backgroundColor: PAPER[paper] }]}>
        <Text style={s.paperText}>Today I walked away and went outside instead.</Text>
        {items.map((it) => <Sticker key={it.id} glyph={it.glyph} x0={it.x} y0={it.y} onMoved={onTried} />)}
      </View>
      <View style={s.row}>
        {GLYPHS.map((g) => (
          <Pressable key={g} onPress={() => add(g)} accessibilityRole="button" accessibilityLabel={`Add ${g} sticker`} style={[s.chip, { backgroundColor: colors.surfaceHigh, borderColor: colors.cardBorder }]}>
            <Glyph name={g} size={22} color={GLYPH_TINT[GLYPHS.indexOf(g)]} />
          </Pressable>
        ))}
      </View>
      <View style={s.row}>
        {PAPER.map((c, i) => (
          <Pressable key={c} onPress={() => { buzz(); setPaper(i); onTried(); }} accessibilityRole="button" accessibilityLabel={`Paper colour ${i + 1}`} accessibilityState={{ selected: paper === i }}
            style={[s.swatch, { backgroundColor: c, borderColor: paper === i ? colors.text : colors.cardBorder, borderWidth: paper === i ? 3 : 1 }]} />
        ))}
      </View>
    </Box>
  );
}

// ── 7. Mode clock wheels ──────────────────────────────────────────────────────────────────────
function ClockDemo({ colors, onTried }: DemoProps) {
  const [edit, setEdit] = useState<'start' | 'end'>('start');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('17:00');
  const line = useMemo(
    () => nextChangeLine([{ id: 'demo', name: 'Work', schedule: { enabled: true, days: [], start, end } } as any]),
    [start, end]
  );
  return (
    <Box colors={colors} label="Try it">
      <View style={s.row}>
        {(['start', 'end'] as const).map((k) => (
          <Pressable key={k} onPress={() => setEdit(k)} accessibilityRole="button" accessibilityState={{ selected: edit === k }}
            style={[s.timeBtn, { borderColor: edit === k ? colors.accent : colors.cardBorder, backgroundColor: edit === k ? colors.accentDim : colors.surfaceHigh }]}>
            <Text style={[s.small, { color: colors.textMuted }]}>{k === 'start' ? 'Starts' : 'Ends'}</Text>
            <Text style={[s.h, { color: colors.text }]}>{format12(k === 'start' ? start : end)}</Text>
          </Pressable>
        ))}
      </View>
      <ClockTimePicker
        key={edit}
        value={edit === 'start' ? start : end}
        onChange={(v) => { if (edit === 'start') setStart(v); else setEnd(v); onTried(); }}
        colors={colors}
      />
      <Text style={[s.h, { color: colors.accent, textAlign: 'center' }]}>{line ?? 'Pick different start and end times'}</Text>
    </Box>
  );
}

// ── 8. Briefing length ────────────────────────────────────────────────────────────────────────
const STORIES = [
  'A neighbourhood turns an empty lot into a garden',
  'Scientists report a clever way to clean water cheaply',
  'A library gives away 5,000 books on its birthday',
];
function BriefingDemo({ colors, onTried }: DemoProps) {
  const [endless, setEndless] = useState(false);
  return (
    <Box colors={colors} label="Try it">
      <View style={[s.seg, { backgroundColor: colors.surfaceHigh, borderColor: colors.cardBorder }]}>
        {([['Up to 20', false], ['Endless', true]] as const).map(([label, v]) => (
          <Pressable key={label} onPress={() => { buzz(); setEndless(v); onTried(); }} accessibilityRole="button" accessibilityState={{ selected: endless === v }}
            style={[s.segBtn, endless === v && { backgroundColor: colors.accent }]}>
            <Text style={[s.small, { color: endless === v ? '#fff' : colors.textSecondary, fontFamily: FONTS.bodyBold }]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {STORIES.map((t) => (
        <View key={t} style={[s.story, { borderColor: colors.cardBorder }]}>
          <Text style={[s.small, { color: colors.text }]}>{t}</Text>
        </View>
      ))}
      <Text style={[s.small, { color: colors.textMuted, textAlign: 'center' }]}>
        {endless ? 'Older stories keep loading as you scroll…' : 'That is everything for today. Go live your day.'}
      </Text>
      <Text style={[s.small, { color: colors.textMuted, textAlign: 'center' }]}>(sample headlines)</Text>
    </Box>
  );
}

// ── 9. Happening near you ─────────────────────────────────────────────────────────────────────
const EVENTS: Record<string, { title: string; when: string }[]> = {
  Markets: [{ title: 'Saturday farmers market', when: 'Saturdays 7:30 to 11 am' }],
  Volunteer: [{ title: 'Beach cleanup', when: 'First Sunday, 9 am' }],
  Outdoors: [{ title: 'Sunrise hike', when: 'Wednesdays 6 am' }],
};
function NearbyDemo({ colors, onTried }: DemoProps) {
  const [kind, setKind] = useState('Markets');
  return (
    <Box colors={colors} label="Try it">
      <View style={s.row}>
        {Object.keys(EVENTS).map((k) => (
          <Pressable key={k} onPress={() => { buzz(); setKind(k); onTried(); }} accessibilityRole="button" accessibilityState={{ selected: kind === k }}
            style={[s.pill, { borderColor: kind === k ? colors.accent : colors.cardBorder, backgroundColor: kind === k ? colors.accentDim : colors.surfaceHigh }]}>
            <Text style={[s.small, { color: kind === k ? colors.accent : colors.textSecondary, fontFamily: FONTS.bodyBold }]}>{k}</Text>
          </Pressable>
        ))}
      </View>
      {EVENTS[kind].map((e) => (
        <View key={e.title} style={[s.story, { borderColor: colors.cardBorder }]}>
          <Text style={[s.h, { color: colors.text }]}>{e.title}</Text>
          <Text style={[s.small, { color: colors.textSecondary }]}>{e.when}</Text>
        </View>
      ))}
      <Text style={[s.small, { color: colors.textMuted, textAlign: 'center' }]}>
        Examples. Real events are checked by hand and each links to the organiser.
      </Text>
    </Box>
  );
}

// ── 10. Today's intention ─────────────────────────────────────────────────────────────────────
function IntentionDemo({ colors, onTried }: DemoProps) {
  const [text, setText] = useState('');
  return (
    <Box colors={colors} label="Try it">
      <TextInput
        value={text}
        onChangeText={(t) => { setText(t); if (t.length > 2) onTried(); }}
        placeholder="e.g. Be present at dinner"
        placeholderTextColor={colors.textMuted}
        maxLength={80}
        accessibilityLabel="Your intention for today"
        style={[s.input, { color: colors.text, borderColor: colors.cardBorder, backgroundColor: colors.background }]}
      />
      <View style={[s.gatePreview, { borderColor: colors.cardBorder, backgroundColor: colors.surfaceHigh }]}>
        <Text style={[s.small, { color: colors.textMuted }]}>Your gate would say</Text>
        <Text style={[s.h, { color: colors.text }]}>“{text.trim() || 'Be present at dinner'}”</Text>
        <Text style={[s.small, { color: colors.textSecondary }]}>Your own words, from earlier today.</Text>
      </View>
    </Box>
  );
}

// ── 11. The reach-out card ────────────────────────────────────────────────────────────────────
function ReachDemo({ colors, onTried }: DemoProps) {
  const [state, setState] = useState<'card' | 'sent' | 'later'>('card');
  return (
    <Box colors={colors} label="Try it">
      {state === 'card' ? (
        <View style={{ gap: 8 }}>
          <Text style={[s.h, { color: colors.text }]}>Buddy brought you a thought</Text>
          <Text style={[s.small, { color: colors.textSecondary }]}>An hour of scrolling today. Someone out there would love a hello more than a feed would.</Text>
          <View style={[s.quote, { borderColor: colors.border }]}>
            <Text style={[s.small, { color: colors.text, fontStyle: 'italic' }]}>“Hey, thinking of you. Free for a catch-up this week?”</Text>
          </View>
          <View style={s.row}>
            <Btn colors={colors} label="Send a hello" onPress={() => { buzz(); setState('sent'); onTried(); }} />
            <Btn colors={colors} label="Not today" ghost onPress={() => { setState('later'); onTried(); }} />
          </View>
        </View>
      ) : (
        <View style={s.center}>
          <Feather name={state === 'sent' ? 'send' : 'moon'} size={28} color={colors.accent} />
          <Text style={[s.small, { color: colors.textSecondary, textAlign: 'center' }]}>
            {state === 'sent' ? 'In the app, your phone’s share sheet opens here. Nothing is sent unless you send it.' : 'Tucked away until tomorrow. It never nags.'}
          </Text>
          <Btn colors={colors} label="Show again" ghost onPress={() => setState('card')} />
        </View>
      )}
    </Box>
  );
}

export const DEMOS: Record<DemoKey, (p: DemoProps) => React.ReactElement> = {
  gate: GateDemo, feed: FeedDemo, hold: HoldDemo, wave: WaveDemo, picker: PickerDemo, sticker: StickerDemo,
  clock: ClockDemo, briefing: BriefingDemo, nearby: NearbyDemo, intention: IntentionDemo, reach: ReachDemo,
};

const s = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 12 },
  tag: { alignSelf: 'flex-start', fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  center: { alignItems: 'center', gap: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'center' },
  h: { fontFamily: FONTS.bodyBold, fontSize: 15 },
  small: { fontFamily: FONTS.body, fontSize: 13, lineHeight: 18 },
  btn: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: 999, alignItems: 'center' },
  btnText: { fontFamily: FONTS.bodyBold, fontSize: 14 },
  appTile: { width: 150, paddingVertical: 18, borderRadius: 20, alignItems: 'center', gap: 6 },
  track: { width: '80%', height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  orb: { width: 90, height: 90, borderRadius: 45 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 92 },
  bar: { width: 16, borderRadius: 6 },
  pick: { alignItems: 'center', gap: 4, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, borderWidth: 2 },
  paper: { height: 170, borderRadius: 12, padding: 14, overflow: 'hidden' },
  paperText: { fontFamily: FONTS.body, fontSize: 15, color: '#3a3a3a' },
  sticker: { position: 'absolute', left: 0, top: 0 },
  chip: { width: 46, height: 46, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 34, height: 34, borderRadius: 17 },
  timeBtn: { flex: 1, minWidth: 120, alignItems: 'center', paddingVertical: 10, borderRadius: 14, borderWidth: 1.5 },
  seg: { flexDirection: 'row', borderRadius: 999, borderWidth: 1, padding: 3 },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 999 },
  story: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 2 },
  pill: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontFamily: FONTS.body, fontSize: 15 },
  gatePreview: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 4 },
  quote: { borderLeftWidth: 3, paddingLeft: 10, paddingVertical: 2 },
});
