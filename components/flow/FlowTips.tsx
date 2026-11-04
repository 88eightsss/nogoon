// ─── One-time tips, at the moment they matter ─────────────────────────────────
// Lives inside the tabs layout (like TabCoach). Each tip shows once, the first time its screen is the
// one in front, sits above the tab bar, and goes away with one tap. Never shown on the gate or any
// other full screen (people in an urge cannot take in instructions), never while the spotlight tour
// runs, and never once someone chose "Show me everything".
// It also notes that Briefing and Step Out have been visited, which the next-step card uses.

import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useUserStore } from '@/stores/useUserStore';
import { useTourStore } from '@/stores/useTourStore';
import { useFlowStore } from '@/stores/useFlowStore';
import { FONTS } from '@/constants/Colors';

type Tip = { id: string; title: string; body: string };

const TIPS: Record<string, Tip> = {
  first_walkaway: {
    id: 'first_walkaway',
    title: 'That pause is the whole app',
    body: 'Each time you stop and walk away, your pal grows. A slip does not undo that. Just keep coming back.',
  },
  first_feed: {
    id: 'first_feed',
    title: 'It ends. That is the point.',
    body: 'A short read, then you are done. Nothing to scroll, nothing waiting below.',
  },
  first_local: {
    id: 'first_local',
    title: 'Go, then tap "I went"',
    body: 'Pick a place, do something real, and tap "I went". Your pal gets a treat for it.',
  },
};

export function FlowTips() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const walkAways = useUserStore((s) => s.walkAwayCount);
  const hasOnboarded = useUserStore((s) => s.hasOnboarded);
  const coachRequested = useTourStore((s) => s.coachRequested);
  const { tipsSeen, showEverything, markTipSeen, markBriefingOpened, markLocalVisited } = useFlowStore();
  const [flowReady, setFlowReady] = useState(() => useFlowStore.persist.hasHydrated());
  const [active, setActive] = useState<Tip | null>(null);

  useEffect(() => {
    if (flowReady) return;
    return useFlowStore.persist.onFinishHydration(() => setFlowReady(true));
  }, [flowReady]);

  const onTabs = segments[0] === '(tabs)';
  const tab = onTabs ? (segments[1] as string | undefined) ?? 'index' : null;

  // Which tip (if any) belongs on this screen right now.
  const wanted: Tip | null =
    tab === 'index' && walkAways >= 1 ? TIPS.first_walkaway :
    tab === 'feed' ? TIPS.first_feed :
    tab === 'local' ? TIPS.first_local : null;

  // Visit flags for the next-step card. Set once the screen has been in front for a moment.
  useEffect(() => {
    if (!flowReady || !hasOnboarded || (tab !== 'feed' && tab !== 'local')) return;
    const t = setTimeout(() => (tab === 'feed' ? markBriefingOpened() : markLocalVisited()), 1500);
    return () => clearTimeout(t);
  }, [flowReady, hasOnboarded, tab, markBriefingOpened, markLocalVisited]);

  useEffect(() => {
    if (!flowReady || !hasOnboarded || showEverything || coachRequested || !wanted || tipsSeen[wanted.id]) {
      setActive(null);
      return;
    }
    const t = setTimeout(() => setActive(wanted), 900);
    return () => clearTimeout(t);
  }, [flowReady, hasOnboarded, showEverything, coachRequested, wanted?.id, tipsSeen]);

  if (!active) return null;

  const barH = 60 + insets.bottom;
  const dismiss = () => { markTipSeen(active.id); setActive(null); };

  return (
    <View pointerEvents="box-none" style={[s.root, { bottom: barH + 12 }]}>
      <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]} accessibilityLiveRegion="polite">
        <Text style={[s.title, { color: colors.text }]}>{active.title}</Text>
        <Text style={[s.body, { color: colors.textSecondary }]}>{active.body}</Text>
        <Pressable onPress={dismiss} hitSlop={8} style={s.btn} accessibilityRole="button" accessibilityLabel="Got it, close this tip">
          <Text style={[s.btnText, { color: colors.accent }]}>Got it</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { position: 'absolute', left: 16, right: 16, zIndex: 50, elevation: 50 },
  card: {
    borderWidth: 1, borderRadius: 16, padding: 14, gap: 4,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  title: { fontFamily: FONTS.bodyBold, fontSize: 15 },
  body: { fontFamily: FONTS.body, fontSize: 14, lineHeight: 20 },
  btn: { alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 4 },
  btnText: { fontFamily: FONTS.bodyBold, fontSize: 14.5 },
});
