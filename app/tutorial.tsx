// ─── Interactive tour ─────────────────────────────────────────────────────────
//
// A hub of short chapters, each with things to try right inside the tour (open a blocked app,
// hold the orb, drag a sticker, spin the clock wheels) and a button that opens the real screen.
// "The basics" is the recommended first stop; the rest are optional and can be done in any order,
// any time. Finished chapters get a tick. Deep link: /tutorial?topic=modes.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { isLightColor } from '@/utils/colorLuminance';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';
import { useTheme } from '@/hooks/useTheme';
import { useUserStore } from '@/stores/useUserStore';
import { useTourStore } from '@/stores/useTourStore';
import { DEMOS, type DemoKey } from '@/components/tour/Demos';
import { useFlowStore } from '@/stores/useFlowStore';
import { UNDER_CONSTRUCTION } from '@/constants/construction';

type FeatherName = React.ComponentProps<typeof Feather>['name'];
type TourStep = {
  title: string; body: string; demo?: DemoKey;
  /** A topic's first screen: why it is here and the best of it, instead of a body paragraph. */
  why?: string; best?: string;
  /** Only shown when this part of the app is live, or Show me everything is on (constants/construction.ts). */
  needs?: keyof typeof UNDER_CONSTRUCTION;
};
type Chapter = {
  id: string; title: string; blurb: string; icon: FeatherName;
  tone: 'accent' | 'calm' | 'me' | 'protect' | 'arcade';
  group: 'start' | 'further';
  needs?: keyof typeof UNDER_CONSTRUCTION;
  steps: TourStep[];
};

// Nine topics in two groups. Every topic opens the same way: why it is here, then the best of it,
// then things to try. Chapter ids are kept from the old tour so finished ticks carry over.
const ALL_CHAPTERS: Chapter[] = [
  {
    id: 'basics', group: 'start', title: 'The pause', blurb: 'What happens when you open a paused app', icon: 'compass', tone: 'accent',
    steps: [
      { title: 'The pause', body: '', why: 'Opening an app on autopilot is how a scroll starts. NoGoon steps in first, so there is a gap where you get to choose.', best: 'It is a pause, not a lock. You can always go on. Each time you walk away, your companion grows.' },
      { title: 'A pause before the scroll', body: 'When you open an app you paused, NoGoon steps in first. Try it: open the pretend app below.', demo: 'gate' },
      { title: 'Walking away earns a treat', body: 'Every walk-away earns a treat. Tap Feed on Home to give it to your favorite and watch it change shape.', demo: 'feed' },
      { title: 'Need a minute', body: 'The Need a minute button on Home is for when a craving shows up. Breathing is hands-on: hold to breathe in, let go to breathe out.', demo: 'hold' },
    ],
  },
  {
    id: 'calm', group: 'start', title: 'Ride out an urge', blurb: 'Watch it rise and fade. Try it once', icon: 'wind', tone: 'calm',
    steps: [
      { title: 'Ride out an urge', body: '', why: 'An urge feels like it will never stop. It rises, peaks and fades, usually within minutes. Giving in is one way out. Waiting is another.', best: 'You watch it pass on a timer instead of fighting it. After a few, Home shows how long yours actually last.' },
      { title: 'Urges rise, peak and pass', body: 'A craving feels endless, but it crests and fades, usually in minutes. Watch one do it.', demo: 'wave' },
      { title: 'Ride it out at the gate', body: 'When the pause appears, tap Ride it out. A timer runs while the urge fades, and afterwards the choice is still yours.' },
      { title: 'Breathe with your thumb', body: 'Hold to breathe in, release to breathe out. Five slow breaths. Can\'t hold? There is a follow-along mode too.', demo: 'hold' },
      { title: 'More ways to settle', body: 'There is also Grounding (notice five things around you) and the Waiting Room, a five second pause with a truth card and the urge wave.' },
    ],
  },
  {
    id: 'companions', group: 'start', title: 'Your companion', blurb: 'It grows as your days add up', icon: 'smile', tone: 'me',
    steps: [
      { title: 'Your companion', body: '', why: 'Something small to look after makes walking away feel like a win, not a loss.', best: 'It grows when you walk away, and a slip never undoes that.' },
      { title: 'Choose who to feed', body: 'You can switch companion whenever you like, but only the one you feed evolves. Each keeps its own progress.', demo: 'picker' },
      { title: 'Five stages each', body: 'Treats feed your active companion from Home. New forms arrive at 5, 15, 30 and 60 feedings, and stay a surprise until you reach them. Customize shows how far along each one is.', demo: 'feed' },
      { title: 'Take your pal for a walk', body: '"Take your pal for a walk" counts your steps with the phone\'s sensors while your companion trots along. Walk 500 steps or more and they get fed. No location needed.' },
      { title: 'A nudge to reach out', body: 'After a long scroll your companion may leave a card on Home with a ready-made hello. It is never a notification, and nothing is sent unless you send it.', demo: 'reach' },
    ],
  },
  {
    id: 'briefing', group: 'further', title: 'Briefing', blurb: 'A short read, then you are done', icon: 'sun', tone: 'accent',
    steps: [
      { title: 'Briefing', body: '', why: 'Scrolling never ends. The Briefing does: good news and something to be curious about, then you are done.', best: 'You choose how long it is. Nothing is waiting below.' },
      { title: 'Choose how long', body: 'Choose Up to 20 stories (then it ends) or Endless. Try the switch below.', demo: 'briefing' },
    ],
  },
  {
    id: 'stepout', group: 'further', title: 'Step Out and doors', blurb: 'Real things to do, and invites with no pressure', icon: 'map-pin', tone: 'accent',
    steps: [
      { title: 'Step Out and doors', body: '', why: 'Pausing an app leaves a gap in your evening. Step Out fills it with real things to do near you.', best: 'Pick your place, go, and tap I went. Your companion gets a treat. No likes, no counts, nothing to scroll.' },
      { title: 'Happening near you', body: 'In the Step Out tab, pick your place and see farmers markets, volunteering and community events, each linking to its source. They are gathered automatically, so check the link before you go.', demo: 'nearby' },
      { title: 'Open the door', body: 'A door is a private invite to a friend. They can tell you they are coming, or just not reply. You only ever see who said yes, never who looked or who passed.', needs: 'stepOutFeed' },
    ],
  },
  {
    id: 'postonce', group: 'further', title: 'Post once (for hosts)', blurb: 'Share your event in one go', icon: 'send', tone: 'accent', needs: 'postOnce',
    steps: [
      { title: 'Post once (for hosts)', body: '', why: 'Running an event means writing the same details for Facebook, Instagram, X, neighbors and a bulletin board. Post once does that in one go.', best: 'You fill in one form and get words for each place, plus a QR flyer to print. You check every word, and nothing is posted for you.' },
      { title: 'One form, every place', body: 'Fill in what, when and where once. Facts you lock stay exactly as you typed them in every caption.' },
      { title: 'Write with AI, then check', body: 'Verified hosts can ask for help with the words, or start from a photo of a flyer. AI-written words are marked, and you read them before you share.' },
    ],
  },
  {
    id: 'modes', group: 'further', title: 'Modes and schedules', blurb: 'Different rules for work, nights and weekends', icon: 'clock', tone: 'protect',
    steps: [
      { title: 'Modes and schedules', body: '', why: 'You do not need the same rules at ten in the morning and ten at night.', best: 'A mode is a saved list with its own time window, switched on like an alarm.' },
      { title: 'Set it like an alarm', body: 'Each mode is a saved blocklist with its own time window. Spin the wheels below and watch the "next change" line update.', demo: 'clock' },
      { title: 'Switches, days and curfew', body: 'Flip a mode\'s switch to turn its schedule on, tap the card to choose days and times. The Digital Curfew in Me uses the same clock wheels.' },
    ],
  },
  {
    id: 'protect', group: 'further', title: 'Protection and Hard Mode', blurb: 'Make it harder to switch blocking off', icon: 'shield', tone: 'protect',
    steps: [
      { title: 'Protection and Hard Mode', body: '', why: 'Some moments are weaker than others. Protection puts a little friction in front of those moments.', best: 'Nothing is locked unless you ask. Hard Mode is for when you really mean it: nothing can be removed, and ending it takes a wait and a typed phrase.' },
      { title: 'Set an intention', body: 'A line in your own words that shows on the gate. Not a rule, just a nudge from past-you to present-you.', demo: 'intention' },
      { title: 'Focus Session and Wind-down', body: 'A Focus Session pause-proofs your blocklist for a set time. Wind-down adds friction after your cutoff each night. Both are in Me, under Protection.' },
    ],
  },
  {
    id: 'journal', group: 'further', title: 'Journal and Insights', blurb: 'Notes to yourself, and what your days show', icon: 'edit-3', tone: 'me',
    steps: [
      { title: 'Journal and Insights', body: '', why: 'Writing it down gets it out of your head. Insights shows patterns you would not notice on your own.', best: 'Your journal pages stay on your phone.' },
      { title: 'Make a page yours', body: 'Pick paper, add stickers (even your companions), doodle, use a template or a prompt. Try dragging a sticker.', demo: 'sticker' },
      { title: 'Thought bubbles and Moments', body: 'Thought bubbles are a big space for emptying your head: add a bubble, type what is on your mind, drag it around. Moments keeps the quick notes from urge moments. Text size and easy-read spacing live in the Style tab.' },
      { title: 'Find your patterns', body: 'Insights shows your walk-aways this week, your peak distraction hour and how you felt afterwards. Most people find a two hour window behind most of their scrolling.' },
    ],
  },
];

export default function TutorialScreen() {
  const { colors, cardStyle } = useTheme();
  const { topic, all } = useLocalSearchParams<{ topic?: string; all?: string }>();
  const markTutorialSeen = useUserStore((s) => s.markTutorialSeen);
  const showEverything = useFlowStore((s) => s.showEverything);
  // Parts of the app still under construction stay out of the guide until they are live (or Show me everything is on).
  const CHAPTERS = useMemo(() => {
    const live = (n?: keyof typeof UNDER_CONSTRUCTION) => !n || !UNDER_CONSTRUCTION[n] || showEverything;
    return ALL_CHAPTERS.filter((c) => live(c.needs)).map((c) => ({ ...c, steps: c.steps.filter((st) => live(st.needs)) }));
  }, [showEverything]);
  const done = useTourStore((s) => s.done);
  const markDone = useTourStore((s) => s.markDone);
  const requestCoach = useTourStore((s) => s.requestCoach);

  const start = CHAPTERS.findIndex((c) => c.id === topic);
  const [chapterIdx, setChapterIdx] = useState<number | null>(start >= 0 ? start : all === '1' ? 0 : null);
  const [stepIdx, setStepIdx] = useState(0);
  // "Full tour" plays every topic in order with one Next button; topics are still open from the list.
  const [allMode, setAllMode] = useState(all === '1');
  const [finished, setFinished] = useState(false);
  const [tried, setTried] = useState<Record<string, true>>({});
  const scroller = useRef<ScrollView>(null);

  const chapter = chapterIdx !== null ? CHAPTERS[chapterIdx] : null;
  const doneCount = CHAPTERS.filter((c) => done[c.id]).length;
  const toneColor = (t: Chapter['tone']) => colors[t];

  const toHub = useCallback(() => { setChapterIdx(null); setStepIdx(0); setFinished(false); setAllMode(false); }, []);
  const open = (i: number) => { Haptics.selectionAsync().catch(() => {}); markTutorialSeen(); setChapterIdx(i); setStepIdx(0); setFinished(false); };
  const playAll = () => { Haptics.selectionAsync().catch(() => {}); markTutorialSeen(); setAllMode(true); setChapterIdx(0); setStepIdx(0); setFinished(false); };

  // Hardware back goes up one level (chapter -> topics -> out).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (chapterIdx !== null) { toHub(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [chapterIdx, toHub]);

  useEffect(() => { if (all === '1') markTutorialSeen(); }, [all, markTutorialSeen]);
  useEffect(() => { scroller.current?.scrollTo({ y: 0, animated: false }); }, [chapterIdx, stepIdx, finished]);

  const next = () => {
    if (!chapter) return;
    if (stepIdx < chapter.steps.length - 1) { setStepIdx(stepIdx + 1); return; }
    markDone(chapter.id);
    if (allMode && chapterIdx !== null && chapterIdx < CHAPTERS.length - 1) {
      Haptics.selectionAsync().catch(() => {});
      setChapterIdx(chapterIdx + 1);
      setStepIdx(0);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setFinished(true);
  };
  const prev = () => {
    if (stepIdx > 0) { setStepIdx(stepIdx - 1); return; }
    if (allMode && chapterIdx !== null && chapterIdx > 0) {
      setChapterIdx(chapterIdx - 1);
      setStepIdx(CHAPTERS[chapterIdx - 1].steps.length - 1);
    }
  };
  const canPrev = stepIdx > 0 || (allMode && (chapterIdx ?? 0) > 0);
  const nextUndone = chapter ? CHAPTERS.findIndex((c, i) => i !== chapterIdx && !done[c.id] && c.id !== chapter.id) : -1;

  const startDone = CHAPTERS.filter((c) => c.group === 'start').every((c) => done[c.id]);
  const [furtherOpen, setFurtherOpen] = useState(false);
  const showFurther = furtherOpen || startDone;
  const furtherCount = CHAPTERS.filter((c) => c.group === 'further').length;

  const renderTopic = (c: Chapter, i: number) => {
    const c1 = toneColor(c.tone);
    const isDone = !!done[c.id];
    return (
      <Pressable
        key={c.id}
        onPress={() => open(i)}
        accessibilityRole="button"
        accessibilityLabel={`${c.title}. ${c.blurb}.${isDone ? ' Done.' : ''}`}
        style={[s.topic, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
      >
        <View style={[s.topicIcon, { backgroundColor: c1 + '22' }]}>
          <Feather name={c.icon} size={20} color={c1} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[s.topicTitle, { color: colors.text }]}>{c.title}</Text>
          <Text style={[s.topicBlurb, { color: colors.textSecondary }]}>{c.blurb}</Text>
        </View>
        {isDone
          ? <Feather name="check-circle" size={20} color={colors.success} />
          : <Feather name="chevron-right" size={20} color={colors.textMuted} />}
      </Pressable>
    );
  };

  const tone = chapter ? toneColor(chapter.tone) : colors.accent;
  const step = chapter ? chapter.steps[stepIdx] : null;
  const Demo = step?.demo ? DEMOS[step.demo] : null;
  const triedKey = chapter && step ? `${chapter.id}:${stepIdx}` : '';
  const hasTried = !!tried[triedKey];

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <Pressable style={s.navBtn} onPress={() => (chapter ? toHub() : router.back())} hitSlop={8} accessibilityRole="button" accessibilityLabel={chapter ? 'Back to topics' : 'Close the guide'}>
          <Feather name={chapter ? 'list' : 'x'} size={21} color={colors.text} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.text }]}>{chapter ? chapter.title : 'How NoGoon works'}</Text>
        {chapter && allMode ? (
          <Pressable style={s.navBtn} onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close tour">
            <Feather name="x" size={21} color={colors.text} />
          </Pressable>
        ) : <View style={s.navBtn} />}
      </View>

      {/* ── Hub ── */}
      {!chapter && (
        <ScrollView contentContainerStyle={s.hubScroll} showsVerticalScrollIndicator={false}>
          <Text style={[s.lead, { color: colors.textSecondary }]}>
            One topic at a time. Each one says why it is here and what is best about it, then lets you try it. Come back any time.
          </Text>
          <View style={s.progressRow} accessibilityLabel={`${doneCount} of ${CHAPTERS.length} topics done`}>
            <View style={[s.progressTrack, { backgroundColor: colors.border }]}>
              <View style={[s.progressFill, { backgroundColor: colors.accent, width: `${(doneCount / CHAPTERS.length) * 100}%` }]} />
            </View>
            <Text style={[s.progressText, { color: colors.textMuted }]}>{doneCount} of {CHAPTERS.length}</Text>
          </View>

          <Pressable
            onPress={playAll}
            accessibilityRole="button"
            accessibilityLabel={`Play the full tour. ${CHAPTERS.length} topics, click through at your own pace.`}
            style={[s.topic, cardStyle, { backgroundColor: colors.accentDim, borderColor: colors.accent }]}
          >
            <View style={[s.topicIcon, { backgroundColor: colors.accent + '33' }]}>
              <Feather name="play" size={20} color={colors.accent} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[s.topicTitle, { color: colors.text }]}>Play the full tour</Text>
              <Text style={[s.topicBlurb, { color: colors.textSecondary }]}>All {CHAPTERS.length} topics in order. Tap Next to click through.</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.accent} />
          </Pressable>

          <Text style={[s.group, { color: colors.accentBright }]}>Start here</Text>
          {CHAPTERS.map((c, i) => (c.group === 'start' ? renderTopic(c, i) : null))}
          {showFurther ? (
            <>
              <Text style={[s.group, { color: colors.accentBright }]}>Go further</Text>
              {CHAPTERS.map((c, i) => (c.group === 'further' ? renderTopic(c, i) : null))}
            </>
          ) : (
            <Pressable
              onPress={() => { Haptics.selectionAsync().catch(() => {}); setFurtherOpen(true); }}
              accessibilityRole="button"
              accessibilityLabel={`Show ${furtherCount} more topics`}
              style={[s.topic, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[s.topicTitle, { color: colors.text }]}>{furtherCount} more when you are ready</Text>
                <Text style={[s.topicBlurb, { color: colors.textSecondary }]}>Briefing, Step Out, modes, protection, journal and more.</Text>
              </View>
              <Feather name="chevron-down" size={20} color={colors.textMuted} />
            </Pressable>
          )}
          <Pressable
            onPress={() => { Haptics.selectionAsync().catch(() => {}); requestCoach(); router.back(); }}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Text style={[s.foot, { color: colors.textMuted, textDecorationLine: 'underline' }]}>
              Or spotlight the tabs on the real screens
            </Text>
          </Pressable>
          <Text style={[s.foot, { color: colors.textMuted }]}>Each tab also has a small "?" at the top.</Text>
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
            <Text style={[s.stepKicker, { color: tone }]}>{allMode ? `Topic ${(chapterIdx ?? 0) + 1} of ${CHAPTERS.length}  ·  ` : ''}Step {stepIdx + 1} of {chapter.steps.length}</Text>
            <Text style={[s.stepTitle, { color: colors.text }]} accessibilityRole="header">{step.title}</Text>
            {step.why ? (
              <>
                <View style={[s.introCard, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
                  <Text style={[s.introLabel, { color: tone }]}>Why it is here</Text>
                  <Text style={[s.introText, { color: colors.text }]}>{step.why}</Text>
                </View>
                <View style={[s.introCard, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
                  <Text style={[s.introLabel, { color: tone }]}>The best of it</Text>
                  <Text style={[s.introText, { color: colors.text }]}>{step.best}</Text>
                </View>
              </>
            ) : (
              <Text style={[s.stepBody, { color: colors.textSecondary }]}>{step.body}</Text>
            )}

            {Demo && (
              <Demo colors={colors} onTried={() => setTried((t) => (t[triedKey] ? t : { ...t, [triedKey]: true }))} />
            )}
            {Demo && hasTried && (
              <View style={s.nice} accessibilityLiveRegion="polite">
                <Feather name="check" size={15} color={colors.success} />
                <Text style={[s.niceText, { color: colors.success }]}>Nice, that is how it works.</Text>
              </View>
            )}

          </ScrollView>

          <View style={s.footer}>
            {canPrev && (
              <Pressable style={[s.backBtn, { borderColor: colors.cardBorder }]} onPress={prev} accessibilityRole="button" accessibilityLabel="Previous step">
                <Feather name="arrow-left" size={18} color={colors.textSecondary} />
              </Pressable>
            )}
            <Pressable style={[s.nextBtn, { backgroundColor: tone }]} onPress={next} accessibilityRole="button">
              <Text style={[s.nextText, { color: isLightColor(tone) ? '#111111' : '#FFFFFF' }]}>
                {stepIdx < chapter.steps.length - 1 ? (step.why ? 'Try it' : Demo && !hasTried ? 'Skip' : 'Next') : allMode ? (chapterIdx === CHAPTERS.length - 1 ? 'Finish tour' : 'Next topic') : 'Finish topic'}
              </Text>
              <Feather name="arrow-right" size={17} color={isLightColor(tone) ? '#111111' : '#FFFFFF'} />
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
              <Pressable style={[s.nextBtn, s.doneBtn, { backgroundColor: tone }]} onPress={() => open(nextUndone)} accessibilityRole="button">
                <Text style={[s.nextText, { color: isLightColor(tone) ? '#111111' : '#FFFFFF' }]}>Next: {CHAPTERS[nextUndone].title}</Text>
                <Feather name="arrow-right" size={17} color={isLightColor(tone) ? '#111111' : '#FFFFFF'} />
              </Pressable>
            )}
            <Pressable style={[s.nextBtn, s.doneBtn, { borderWidth: 1, borderColor: colors.cardBorder }]} onPress={toHub} accessibilityRole="button">
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
  group: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 8 },
  introCard: { padding: 16, gap: 6 },
  introLabel: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' },
  introText: { fontFamily: FONTS.body, fontSize: 15.5, lineHeight: 23 },
  foot: { fontFamily: FONTS.body, fontSize: 12.5, textAlign: 'center', marginTop: 8 },

  stepBar: { flexDirection: 'row', gap: 6, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.sm },
  stepSeg: { flex: 1, height: 4, borderRadius: 2 },
  stepScroll: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg, gap: 14 },
  stepKicker: { fontFamily: FONTS.bodyBold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase' },
  stepTitle: { fontFamily: FONTS.display, fontSize: 26, letterSpacing: -0.4 },
  stepBody: { fontFamily: FONTS.body, fontSize: 15.5, lineHeight: 23 },
  nice: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  niceText: { fontFamily: FONTS.bodyMedium, fontSize: 13.5 },
  ctaText: { fontFamily: FONTS.bodyMedium, fontSize: 14 },

  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md, paddingTop: SPACING.sm },
  backBtn: { width: 52, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  nextBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, borderRadius: 999 },
  // On the finished screen the buttons sit in an auto-height column, where flex:1 collapses them to nothing.
  doneBtn: { flex: 0, minHeight: 52, alignSelf: 'stretch' },
  nextText: { fontFamily: FONTS.bodyBold, fontSize: 16, color: '#fff' },

  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl, gap: 12 },
  doneBadge: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  leave: { alignItems: 'center', paddingVertical: 10 },
});
