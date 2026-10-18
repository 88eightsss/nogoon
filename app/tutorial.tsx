// ─── Interactive tour ─────────────────────────────────────────────────────────
//
// A hub of short chapters, each with things to try right inside the tour (open a blocked app,
// hold the orb, drag a sticker, spin the clock wheels) and a button that opens the real screen.
// "The basics" is the recommended first stop; the rest are optional and can be done in any order,
// any time. Finished chapters get a tick. Deep link: /tutorial?topic=modes.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';
import { useTheme } from '@/hooks/useTheme';
import { useUserStore } from '@/stores/useUserStore';
import { useTourStore } from '@/stores/useTourStore';
import { DEMOS, type DemoKey } from '@/components/tour/Demos';

type FeatherName = React.ComponentProps<typeof Feather>['name'];
type TourStep = { title: string; body: string; demo?: DemoKey; cta?: { label: string; route: string } };
type Chapter = {
  id: string; title: string; blurb: string; icon: FeatherName;
  tone: 'accent' | 'calm' | 'me' | 'protect' | 'arcade';
  steps: TourStep[];
};

export const CHAPTERS: Chapter[] = [
  {
    id: 'basics', title: 'The basics', blurb: 'What happens when you open a blocked app', icon: 'compass', tone: 'accent',
    steps: [
      { title: 'A pause before the scroll', body: 'When you open an app you blocked, NoGoon steps in first. Try it: open the pretend app below.', demo: 'gate' },
      { title: 'Walking away feeds your companion', body: 'Every walk-away makes your companion grow. Feed this one and watch it change shape.', demo: 'feed' },
      { title: 'Need a minute', body: 'The big yellow button on Today is for when a craving shows up. Breathing is hands-on: hold to breathe in, let go to breathe out.', demo: 'hold', cta: { label: 'Try the real breathing', route: '/breathe' } },
      { title: 'Unlock more as you go', body: 'Keep walking away and NoGoon opens up: the full Arcade, Insights and Journal unlock at walk-away milestones. Anything locked is waiting for you to earn it.', cta: { label: "See what's locked", route: '/(tabs)/arcade' } },
    ],
  },
  {
    id: 'calm', title: 'Calm and urges', blurb: 'Ride out a craving instead of fighting it', icon: 'wind', tone: 'calm',
    steps: [
      { title: 'Urges rise, peak and pass', body: 'A craving feels endless, but it crests and fades, usually in minutes. Watch one do it.', demo: 'wave' },
      { title: 'Breathe with your thumb', body: 'Hold to breathe in, release to breathe out. Five slow breaths. Can\'t hold? There is a follow-along mode too.', demo: 'hold', cta: { label: 'Open Breathe', route: '/breathe' } },
      { title: 'More ways to settle', body: 'The Calm tab also has Grounding (notice five things around you) and the Waiting Room, a five second pause with a truth card and the urge wave.', cta: { label: 'Open the Waiting Room', route: '/waiting-room' } },
    ],
  },
  {
    id: 'companions', title: 'Companions', blurb: 'Pick who grows with you', icon: 'smile', tone: 'me',
    steps: [
      { title: 'Choose who to feed', body: 'You can switch companion whenever you like, but only the one you feed evolves. Each keeps its own progress.', demo: 'picker' },
      { title: 'Five stages each', body: 'Walk-aways feed your active companion. Stages arrive at 5, 15, 30 and 60. Tap any companion in Customize to see all five stages and how far along you are.', demo: 'feed', cta: { label: 'Open Customize', route: '/customize' } },
    ],
  },
  {
    id: 'journal', title: 'Journal', blurb: 'Pages, a thought canvas and quick moments', icon: 'edit-3', tone: 'me',
    steps: [
      { title: 'Make a page yours', body: 'Pick paper, add stickers (even your companions), doodle, use a template or a prompt. Try dragging a sticker.', demo: 'sticker' },
      { title: 'Canvas and Moments', body: 'Canvas is Brain Bubbles, a big space for emptying your head. Moments keeps the quick notes from urge moments. Text size and easy-read spacing live in the Style tab. Everything stays on your phone.', cta: { label: 'Open Journal', route: '/journal' } },
    ],
  },
  {
    id: 'modes', title: 'Modes and schedules', blurb: 'Different blocklists for work, study, sleep', icon: 'clock', tone: 'protect',
    steps: [
      { title: 'Set it like an alarm', body: 'Each mode is a saved blocklist with its own time window. Spin the wheels below and watch the "next change" line update.', demo: 'clock' },
      { title: 'Switches, days and curfew', body: 'Flip a mode\'s switch to turn its schedule on, tap the card to choose days and times. The Digital Curfew in Me uses the same clock wheels.', cta: { label: 'Open Modes', route: '/modes' } },
    ],
  },
  {
    id: 'briefing', title: 'Briefing and near you', blurb: 'Good news with an ending, and real things to do', icon: 'sun', tone: 'accent',
    steps: [
      { title: 'A feed that ends', body: 'The Briefing is good news and what the world is curious about. Choose Up to 20 stories (then it ends) or Endless.', demo: 'briefing', cta: { label: 'Open the Briefing', route: '/(tabs)/feed' } },
      { title: 'Happening near you', body: 'Farmers markets, volunteering and community events, checked by hand, each linking to the organiser. A reason to go outside.', demo: 'nearby', cta: { label: 'Happening near you', route: '/events' } },
    ],
  },
  {
    id: 'protect', title: 'Stronger focus', blurb: 'Intentions, focus sessions, wind-down, insights', icon: 'shield', tone: 'protect',
    steps: [
      { title: 'Set an intention', body: 'A line in your own words that shows on the gate. Not a rule, just a nudge from past-you to present-you.', demo: 'intention' },
      { title: 'Focus Session and Wind-down', body: 'A Focus Session pause-proofs your blocklist for a set time. Wind-down adds friction after your cutoff each night. Both are in Me, under Blocking strength.', cta: { label: 'Open Me', route: '/(tabs)/profile' } },
      { title: 'Find your patterns', body: 'Insights shows your walk-aways this week, your peak distraction hour and how you felt afterwards. Most people find a two hour window behind most of their scrolling.', cta: { label: 'View Insights', route: '/insights' } },
    ],
  },
  {
    id: 'extras', title: 'Little extras', blurb: 'A nudge to reach out, and a phone trick', icon: 'gift', tone: 'arcade',
    steps: [
      { title: 'A nudge to reach out', body: 'After a long scroll your companion may leave a card on Today with a ready-made hello. It is never a notification, and nothing is sent unless you send it.', demo: 'reach' },
      { title: 'Make the phone duller', body: 'Your phone\'s own grayscale makes scrolling less sticky. The Tips page shows where to find it on your phone.', cta: { label: 'See Tips', route: '/tips' } },
    ],
  },
];

export default function TutorialScreen() {
  const { colors, cardStyle } = useTheme();
  const { topic } = useLocalSearchParams<{ topic?: string }>();
  const markTutorialSeen = useUserStore((s) => s.markTutorialSeen);
  const done = useTourStore((s) => s.done);
  const markDone = useTourStore((s) => s.markDone);

  const start = CHAPTERS.findIndex((c) => c.id === topic);
  const [chapterIdx, setChapterIdx] = useState<number | null>(start >= 0 ? start : null);
  const [stepIdx, setStepIdx] = useState(0);
  const [finished, setFinished] = useState(false);
  const [tried, setTried] = useState<Record<string, true>>({});
  const scroller = useRef<ScrollView>(null);

  const chapter = chapterIdx !== null ? CHAPTERS[chapterIdx] : null;
  const doneCount = CHAPTERS.filter((c) => done[c.id]).length;
  const toneColor = (t: Chapter['tone']) => colors[t];

  const toHub = useCallback(() => { setChapterIdx(null); setStepIdx(0); setFinished(false); }, []);
  const open = (i: number) => { Haptics.selectionAsync().catch(() => {}); markTutorialSeen(); setChapterIdx(i); setStepIdx(0); setFinished(false); };

  // Hardware back goes up one level (chapter -> topics -> out).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (chapterIdx !== null) { toHub(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [chapterIdx, toHub]);

  useEffect(() => { scroller.current?.scrollTo({ y: 0, animated: false }); }, [chapterIdx, stepIdx, finished]);

  const next = () => {
    if (!chapter) return;
    if (stepIdx < chapter.steps.length - 1) { setStepIdx(stepIdx + 1); return; }
    markDone(chapter.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setFinished(true);
  };
  const nextUndone = chapter ? CHAPTERS.findIndex((c, i) => i !== chapterIdx && !done[c.id] && c.id !== chapter.id) : -1;

  const tone = chapter ? toneColor(chapter.tone) : colors.accent;
  const step = chapter ? chapter.steps[stepIdx] : null;
  const Demo = step?.demo ? DEMOS[step.demo] : null;
  const triedKey = chapter && step ? `${chapter.id}:${stepIdx}` : '';
  const hasTried = !!tried[triedKey];

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <Pressable style={s.navBtn} onPress={() => (chapter ? toHub() : router.back())} hitSlop={8} accessibilityRole="button" accessibilityLabel={chapter ? 'Back to topics' : 'Close tour'}>
          <Feather name={chapter ? 'arrow-left' : 'x'} size={21} color={colors.text} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.text }]}>{chapter ? chapter.title : 'Interactive tour'}</Text>
        <View style={s.navBtn} />
      </View>

      {/* ── Hub ── */}
      {!chapter && (
        <ScrollView contentContainerStyle={s.hubScroll} showsVerticalScrollIndicator={false}>
          <Text style={[s.lead, { color: colors.textSecondary }]}>
            Pick what you want to learn. Each topic is a minute or two and you get to try things as you go. Come back any time.
          </Text>
          <View style={s.progressRow} accessibilityLabel={`${doneCount} of ${CHAPTERS.length} topics done`}>
            <View style={[s.progressTrack, { backgroundColor: colors.border }]}>
              <View style={[s.progressFill, { backgroundColor: colors.accent, width: `${(doneCount / CHAPTERS.length) * 100}%` }]} />
            </View>
            <Text style={[s.progressText, { color: colors.textMuted }]}>{doneCount} of {CHAPTERS.length}</Text>
          </View>

          {CHAPTERS.map((c, i) => {
            const c1 = toneColor(c.tone);
            const isDone = !!done[c.id];
            const recommended = i === 0 && !isDone;
            return (
              <Pressable
                key={c.id}
                onPress={() => open(i)}
                accessibilityRole="button"
                accessibilityLabel={`${c.title}. ${c.blurb}. ${c.steps.length} steps.${isDone ? ' Done.' : ''}`}
                style={[s.topic, cardStyle, { backgroundColor: colors.surface, borderColor: recommended ? c1 : colors.cardBorder }]}
              >
                <View style={[s.topicIcon, { backgroundColor: c1 + '22' }]}>
                  <Feather name={c.icon} size={20} color={c1} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={s.topicTitleRow}>
                    <Text style={[s.topicTitle, { color: colors.text }]}>{c.title}</Text>
                    {recommended && <Text style={[s.rec, { color: c1, backgroundColor: c1 + '22' }]}>Start here</Text>}
                  </View>
                  <Text style={[s.topicBlurb, { color: colors.textSecondary }]}>{c.blurb}</Text>
                </View>
                {isDone
                  ? <Feather name="check-circle" size={20} color={colors.success} />
                  : <Feather name="chevron-right" size={20} color={colors.textMuted} />}
              </Pressable>
            );
          })}
          <Text style={[s.foot, { color: colors.textMuted }]}>
            Prefer pointers on the real screens? Each tab also has a small "?" at the top.
          </Text>
        </ScrollView>
      )}

      {/* ── Chapter step ── */}
      {chapter && step && !finished && (
        <>
          <View style={s.stepBar} accessibilityLabel={`Step ${stepIdx + 1} of ${chapter.steps.length}`}>
            {chapter.steps.map((_, i) => (
              <View key={i} style={[s.stepSeg, { backgroundColor: i <= stepIdx ? tone : colors.border }]} />
            ))}
          </View>
          <ScrollView ref={scroller} contentContainerStyle={s.stepScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={[s.stepKicker, { color: tone }]}>Step {stepIdx + 1} of {chapter.steps.length}</Text>
            <Text style={[s.stepTitle, { color: colors.text }]} accessibilityRole="header">{step.title}</Text>
            <Text style={[s.stepBody, { color: colors.textSecondary }]}>{step.body}</Text>

            {Demo && (
              <Demo colors={colors} onTried={() => setTried((t) => (t[triedKey] ? t : { ...t, [triedKey]: true }))} />
            )}
            {Demo && hasTried && (
              <View style={s.nice} accessibilityLiveRegion="polite">
                <Feather name="check" size={15} color={colors.success} />
                <Text style={[s.niceText, { color: colors.success }]}>Nice, that is how it works.</Text>
              </View>
            )}

            {step.cta && (
              <Pressable
                style={[s.cta, { borderColor: tone + '66', backgroundColor: tone + '14' }]}
                onPress={() => { markTutorialSeen(); router.push(step.cta!.route as Href); }}
                accessibilityRole="button"
              >
                <Text style={[s.ctaText, { color: tone }]}>{step.cta.label}</Text>
                <Feather name="arrow-right" size={14} color={tone} />
              </Pressable>
            )}
          </ScrollView>

          <View style={s.footer}>
            {stepIdx > 0 && (
              <Pressable style={[s.backBtn, { borderColor: colors.cardBorder }]} onPress={() => setStepIdx(stepIdx - 1)} accessibilityRole="button" accessibilityLabel="Previous step">
                <Feather name="arrow-left" size={18} color={colors.textSecondary} />
              </Pressable>
            )}
            <Pressable style={[s.nextBtn, { backgroundColor: tone }]} onPress={next} accessibilityRole="button">
              <Text style={s.nextText}>
                {stepIdx < chapter.steps.length - 1 ? (Demo && !hasTried ? 'Skip' : 'Next') : 'Finish topic'}
              </Text>
              <Feather name="arrow-right" size={17} color="#fff" />
            </Pressable>
          </View>
        </>
      )}

      {/* ── Chapter finished ── */}
      {chapter && finished && (
        <View style={s.doneWrap}>
          <View style={[s.doneBadge, { backgroundColor: colors.successDim }]}>
            <Feather name="check" size={34} color={colors.success} />
          </View>
          <Text style={[s.stepTitle, { color: colors.text, textAlign: 'center' }]}>{chapter.title} done</Text>
          <Text style={[s.stepBody, { color: colors.textSecondary, textAlign: 'center' }]}>
            {doneCount >= CHAPTERS.length ? 'You have done the whole tour. Nicely done.' : `${doneCount} of ${CHAPTERS.length} topics done.`}
          </Text>
          <View style={{ gap: 10, alignSelf: 'stretch', marginTop: SPACING.md }}>
            {nextUndone >= 0 && (
              <Pressable style={[s.nextBtn, { backgroundColor: tone }]} onPress={() => open(nextUndone)} accessibilityRole="button">
                <Text style={s.nextText}>Next: {CHAPTERS[nextUndone].title}</Text>
                <Feather name="arrow-right" size={17} color="#fff" />
              </Pressable>
            )}
            <Pressable style={[s.nextBtn, { borderWidth: 1, borderColor: colors.cardBorder }]} onPress={toHub} accessibilityRole="button">
              <Text style={[s.nextText, { color: colors.text }]}>All topics</Text>
            </Pressable>
            <Pressable style={s.leave} onPress={() => router.back()} accessibilityRole="button">
              <Text style={[s.ctaText, { color: colors.textMuted }]}>Leave the tour</Text>
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
  navBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: FONTS.display, fontSize: 20, letterSpacing: -0.2 },

  hubScroll: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl, gap: 10 },
  lead: { fontFamily: FONTS.body, fontSize: 15, lineHeight: 22, marginBottom: 4 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  progressText: { fontFamily: FONTS.bodyMedium, fontSize: 12 },
  topic: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  topicIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  topicTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  topicTitle: { fontFamily: FONTS.bodyBold, fontSize: 16 },
  topicBlurb: { fontFamily: FONTS.body, fontSize: 13, lineHeight: 18 },
  rec: { fontFamily: FONTS.bodyBold, fontSize: 10.5, letterSpacing: 0.5, textTransform: 'uppercase', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  foot: { fontFamily: FONTS.body, fontSize: 12.5, textAlign: 'center', marginTop: 8 },

  stepBar: { flexDirection: 'row', gap: 6, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.sm },
  stepSeg: { flex: 1, height: 4, borderRadius: 2 },
  stepScroll: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg, gap: 14 },
  stepKicker: { fontFamily: FONTS.bodyBold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase' },
  stepTitle: { fontFamily: FONTS.display, fontSize: 26, letterSpacing: -0.4 },
  stepBody: { fontFamily: FONTS.body, fontSize: 15.5, lineHeight: 23 },
  nice: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  niceText: { fontFamily: FONTS.bodyMedium, fontSize: 13.5 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 999, borderWidth: 1 },
  ctaText: { fontFamily: FONTS.bodyMedium, fontSize: 14 },

  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md, paddingTop: SPACING.sm },
  backBtn: { width: 52, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  nextBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, borderRadius: 999 },
  nextText: { fontFamily: FONTS.bodyBold, fontSize: 16, color: '#fff' },

  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl, gap: 12 },
  doneBadge: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  leave: { alignItems: 'center', paddingVertical: 10 },
});
