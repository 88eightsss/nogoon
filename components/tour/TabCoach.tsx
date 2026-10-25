// ─── Tab coach marks ──────────────────────────────────────────────────────────
// A spotlight walk along the real tab bar: the screen dims, one tab is lit up, a card says what it
// is for, and the app switches to that tab behind it so you see the real screen. Shown once
// (skippable), and again any time from the tour's topic list. Lives inside the tabs layout.

import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, type LayoutChangeEvent } from 'react-native';
import { router, useSegments, type Href } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useTourStore } from '@/stores/useTourStore';
import { useUserStore } from '@/stores/useUserStore';
import { FONTS } from '@/constants/Colors';

const SEEN_KEY = 'tabs';
const TAB_COUNT = 5;
const DIM = 'rgba(0,0,0,0.72)';

type Stop = { slot: number | 'help'; title: string; body: string; route?: string };
const STOPS: Stop[] = [
  { slot: 0, title: 'Briefing', body: 'A daily dose of good news and curiosity that actually ends.', route: '/(tabs)/feed' },
  { slot: 1, title: 'Step Out', body: 'Pick your place, see what is on near you, and tap "I went" after you go: your pal gets a treat. Five local headlines, the Journal and The Wall live here too.', route: '/(tabs)/local' },
  { slot: 2, title: 'Today', body: 'Home. Your companion lives here, and the big yellow button is for when a craving hits.', route: '/(tabs)' },
  { slot: 3, title: 'Unwind', body: 'One big button for when you need a minute, plus games, a walk, the Journal and more.', route: '/(tabs)/calm' },
  { slot: 4, title: 'Me', body: 'Protection lives here: pick the apps and sites to block, set Modes and schedules, and turn on Hard Mode. Your progress, customizing and settings are here too.', route: '/(tabs)/profile' },
  { slot: 'help', title: 'Stuck? Tap the ?', body: 'Every tab has a question mark up here that explains that screen in a few lines.' },
];

export function TabCoach() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const seen = useTourStore((s) => !!s.coachSeen[SEEN_KEY]);
  const markCoachSeen = useTourStore((s) => s.markCoachSeen);
  const requested = useTourStore((s) => s.coachRequested);
  const offered = useTourStore((s) => s.offered);
  const markOffered = useTourStore((s) => s.markOffered);
  const hasOnboarded = useUserStore((s) => s.hasOnboarded);
  const raised = false; // the raised centre button was retired

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;

  // Right after setup the tour's topic list opens once, so people choose where to start (or play it all).
  // (This spotlight below never starts by itself; it runs when someone asks for it in the tour.)
  // Waits for the saved tour state to load (otherwise someone who already saw it could be shown it
  // again) and for the tabs to actually be the screen on top (not the gate or another page).
  const segments = useSegments();
  const onTabs = segments[0] === '(tabs)';
  const [tourLoaded, setTourLoaded] = useState(() => useTourStore.persist.hasHydrated());
  useEffect(() => {
    if (tourLoaded) return;
    return useTourStore.persist.onFinishHydration(() => setTourLoaded(true));
  }, [tourLoaded]);
  useEffect(() => {
    if (!tourLoaded || !hasOnboarded || offered || !onTabs) return;
    const t = setTimeout(() => {
      markOffered();
      router.push('/tutorial' as Href);
    }, 1200);
    return () => clearTimeout(t);
  }, [tourLoaded, hasOnboarded, offered, onTabs, markOffered]);

  useEffect(() => {
    if (seen || !requested || !hasOnboarded) { setReady(false); return; }
    const t = setTimeout(() => { setStep(0); setReady(true); }, 600);
    return () => clearTimeout(t);
  }, [seen, requested, hasOnboarded]);

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  if (seen || !requested || !ready || !hasOnboarded) return null;

  const stop = STOPS[step];
  const last = step === STOPS.length - 1;
  const barH = (raised ? 76 : 60) + insets.bottom;

  // The hole around the lit element, in this overlay's own coordinates.
  const hole = stop.slot === 'help'
    ? { x: size.w - 64, y: insets.top + 2, w: 58, h: 52 }
    : { x: (size.w / TAB_COUNT) * stop.slot + 4, y: size.h - barH + 2, w: size.w / TAB_COUNT - 8, h: barH - insets.bottom - 2 };
  const tipAbove = stop.slot !== 'help';

  const finish = () => {
    markCoachSeen(SEEN_KEY);
    router.navigate('/(tabs)' as Href);
  };
  const go = (to: number) => {
    Haptics.selectionAsync().catch(() => {});
    setStep(to);
    const r = STOPS[to].route;
    if (r) router.navigate(r as Href);
  };

  return (
    <View style={s.root} onLayout={(e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} pointerEvents="box-none">
      {size.w > 0 && (
        <>
          {/* four dim panels around the hole; touches are swallowed so nothing behind is tapped */}
          <View style={[s.dim, { left: 0, right: 0, top: 0, height: Math.max(0, hole.y) }]} />
          <View style={[s.dim, { left: 0, right: 0, top: hole.y + hole.h, bottom: 0 }]} />
          <View style={[s.dim, { left: 0, width: Math.max(0, hole.x), top: hole.y, height: hole.h }]} />
          <View style={[s.dim, { left: hole.x + hole.w, right: 0, top: hole.y, height: hole.h }]} />
          <Animated.View
            pointerEvents="none"
            style={[s.ring, {
              left: hole.x, top: hole.y, width: hole.w, height: hole.h, borderColor: colors.accentBright,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
            }]}
          />

          <View
            style={[s.card, { backgroundColor: colors.surface, borderColor: colors.cardBorder },
              tipAbove ? { bottom: barH + 14 } : { top: insets.top + 64 }]}
            accessibilityViewIsModal
          >
            <Text style={[s.kicker, { color: colors.accent }]}>{step + 1} of {STOPS.length}</Text>
            <Text style={[s.title, { color: colors.text }]}>{stop.title}</Text>
            <Text style={[s.body, { color: colors.textSecondary }]}>{stop.body}</Text>
            <View style={s.row}>
              <Pressable onPress={finish} hitSlop={8} accessibilityRole="button" accessibilityLabel="Skip the spotlight tour">
                <Text style={[s.skip, { color: colors.textMuted }]}>Skip</Text>
              </Pressable>
              <View style={{ flex: 1 }} />
              {step > 0 && (
                <Pressable onPress={() => go(step - 1)} style={[s.back, { borderColor: colors.cardBorder }]} accessibilityRole="button" accessibilityLabel="Previous">
                  <Feather name="arrow-left" size={16} color={colors.textSecondary} />
                </Pressable>
              )}
              <Pressable
                onPress={() => (last ? finish() : go(step + 1))}
                style={[s.next, { backgroundColor: colors.accent }]}
                accessibilityRole="button"
              >
                <Text style={s.nextText}>{last ? 'Got it' : 'Next'}</Text>
              </Pressable>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 999, elevation: 999 },
  dim: { position: 'absolute', backgroundColor: DIM },
  ring: { position: 'absolute', borderWidth: 2.5, borderRadius: 16 },
  card: { position: 'absolute', left: 16, right: 16, borderWidth: 1, borderRadius: 18, padding: 16, gap: 6 },
  kicker: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontFamily: FONTS.display, fontSize: 20 },
  body: { fontFamily: FONTS.body, fontSize: 14.5, lineHeight: 21 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  skip: { fontFamily: FONTS.bodyMedium, fontSize: 14, paddingVertical: 6 },
  back: { width: 42, height: 40, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  next: { paddingHorizontal: 22, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  nextText: { fontFamily: FONTS.bodyBold, fontSize: 14.5, color: '#fff' },
});
