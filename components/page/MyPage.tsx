// ─── My Page — Today ───────────────────────────────────────────────────────────
//
// The Today tab. Shows the room by default, or this plain page (Me → Customize). Everything on it is real data from the existing stores; the
// active pack only changes how it is dressed (frame, counter, stamps, colors).
// Order: function first (day count, protection, "Need a minute"), flair second (companion,
// stamps). Journal / Bubbles / Insights live in the Feed tab; the pencil opens Customize.

import { useCallback, useRef, useState } from 'react';
import { ScrollView, View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/hooks/useTheme';
import { useActivePack } from '@/hooks/usePack';
import { usePackStore } from '@/stores/usePackStore';
import { useUserStore, getMinutesSaved } from '@/stores/useUserStore';
import { getLocalDateKey } from '@/utils/date';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';
import { Habitat, type HabitatAction } from './Habitat';
import { Counter } from './Counter';
import { MascotCount } from './MascotCount';
import { Stamps } from './Stamps';
import { Marquee } from './Marquee';
import { PaperBackground } from './PaperBackground';
import { useFloatVisible } from './FloatingCompanion';
import { useMascot, CHARACTER_LABELS } from './useCharacter';
import { useFocusEffect } from 'expo-router';
import { useAppBlocker } from '@/hooks/useAppBlocker';
import { describeBlockingStatus } from '@/utils/blockingStatus';
import { TemptedSheet } from './TemptedSheet';
import { getTodaysGood, type GoodItem } from '@/lib/dailyGood';
import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyleCard } from './StyleCard';
import { RoomScene, RoomTitle } from './RoomScene';
import { useRoomStore } from '@/stores/useRoomStore';
import { useOfferStore } from '@/stores/useOfferStore';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

const SUN = '#FFC21A';
const INK = '#12233D';

const REACTIONS: Record<HabitatAction, { face: string; line: string }> = {
  feed: { face: '(｡•́‿•̀｡)', line: 'Yum. Thank you for the walk.' },
  play: { face: 'ヽ(´▽`)/', line: 'Round two of not scrolling?' },
  pet:  { face: '(´∀｀*) ♡', line: 'You are doing the thing.' },
};
const SAY = [
  'Rest up. I will keep watch.',
  'I am waking up. Thanks for walking away.',
  'You walked away a lot. Proud of you.',
  'Nothing gets past us today.',
  'Look how far we have come.',
];

const LINKS: { icon: FeatherName; label: string; go: () => void }[] = [
  { icon: 'award', label: 'Milestones',   go: () => router.push('/milestones' as any) },
  { icon: 'zap',   label: 'Take a break', go: () => router.push('/(tabs)/arcade' as any) },
  { icon: 'moon',  label: 'Calm',         go: () => router.push('/(tabs)/calm' as any) },
];

export function MyPage() {
  const { colors, cardStyle } = useTheme();
  const pack = useActivePack();
  const { char, stage } = useMascot();
  const dayDisplay = usePackStore((s) => s.dayDisplay);
  const roomView = useRoomStore((s) => s.roomView);
  const setRoomView = useRoomStore((s) => s.setRoomView);
  const showSponsors = useOfferStore((s) => s.showSponsors);

  const name          = useUserStore((s) => s.name);
  const streak        = useUserStore((s) => s.streak);
  const longestStreak = useUserStore((s) => s.longestStreak);
  const walkAways     = useUserStore((s) => s.walkAwayCount);
  const blocklist     = useUserStore((s) => s.blocklist);
  const blockedApps   = useUserStore((s) => s.blockedApps);
  const storeIntention    = useUserStore((s) => s.dailyIntention);
  const intentionDate     = useUserStore((s) => s.intentionDate);
  const setDailyIntention = useUserStore((s) => s.setDailyIntention);

  const checkStreakUnlocks = usePackStore((s) => s.checkStreakUnlocks);
  const tapUnlock     = usePackStore((s) => s.tapUnlock);
  const paperOverride = usePackStore((s) => s.paperOverride);
  const floatVisible = useFloatVisible();
  const { blockingStatus, openSettings } = useAppBlocker();
  const status = describeBlockingStatus(blockingStatus, colors);
  const [tempted, setTempted] = useState(false);
  // Today is quiet by default: the tempted button, protection and the companion. The rest
  // folds away behind "More for today", and the choice is remembered.
  const [showMore, setShowMore] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem('nogoon_today_more').then((v) => { if (v === '1') setShowMore(true); }).catch(() => {});
  }, []);
  const toggleMore = () => {
    Haptics.selectionAsync().catch(() => {});
    const next = !showMore;
    setShowMore(next);
    AsyncStorage.setItem('nogoon_today_more', next ? '1' : '0').catch(() => {});
  };
  const [topGood, setTopGood] = useState<GoodItem | null>(null);
  useEffect(() => { getTodaysGood().then((l) => setTopGood(l[0] ?? null)).catch(() => {}); }, []);

  const petName = CHARACTER_LABELS[char];
  const [react, setReact] = useState<{ face: string; line: string } | null>(null);

  // Hatch: a 7-day streak (or the code, or the secret tap) opens hidden packs.
  useFocusEffect(useCallback(() => { checkStreakUnlocks(longestStreak); }, [checkStreakUnlocks, longestStreak]));

  // Secret: tap the greeting 7 times quickly.
  const taps = useRef({ n: 0, t: 0 });
  const onGreeting = () => {
    const now = Date.now();
    taps.current = { n: now - taps.current.t < 1500 ? taps.current.n + 1 : 1, t: now };
    if (taps.current.n >= 7) {
      taps.current.n = 0;
      if (tapUnlock()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const today = getLocalDateKey();
  const intention = intentionDate === today ? storeIntention : '';
  const [draft, setDraft] = useState<string | null>(null);

  const saved = getMinutesSaved(walkAways);
  const savedLabel = saved >= 60 ? `~${Math.round(saved / 60)} hrs` : `~${saved} min`;

  const look = pack.parts.page.look;
  const mono = FONTS.mono;

  const paper = paperOverride !== 'auto' ? paperOverride : (pack.parts.page.paper ?? 'none');
  const paperBase = paper !== 'none' && pack.parts.page.look.paper ? pack.parts.page.look.paper : colors.background;

  return (
    <View style={{ flex: 1, backgroundColor: paperBase }}>
    <PaperBackground paper={paper} line={pack.parts.page.look.rule ?? colors.border} margin={pack.parts.page.look.margin} />
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headRow}>
        <Pressable onPress={onGreeting} style={{ flex: 1 }}>
          <Text style={[styles.hello, { color: colors.text }]}>
            {name ? `Welcome back, ${name}` : 'Welcome back'}
          </Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            {savedLabel} reclaimed so far.
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/customize' as any)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Customize this page"
          style={[styles.pencil, { borderColor: colors.border }]}
        >
          <Feather name="edit-2" size={16} color={colors.textSecondary} />
        </Pressable>
      </View>

      {roomView ? (
        <>
        <RoomTitle />
        <RoomScene
          char={char} stage={stage} streak={streak} walkAways={walkAways}
          headline={topGood?.headline ?? null} showSponsors={showSponsors} petName={petName}
          protectionOff={blockingStatus === 'off' || blockingStatus === 'empty'}
        />
        </>
      ) : (
        <>
        {pack.parts.page.marquee ? (
          <Marquee text={pack.parts.page.marquee} color={look.lcdInk ?? '#33ff66'} bg={look.lcdBg ?? '#000'} font={mono} />
        ) : null}

        {dayDisplay === 'mascot' ? (
          <MascotCount char={char} stage={stage} days={streak} name={CHARACTER_LABELS[char]} />
        ) : dayDisplay === 'number' ? (
          <Counter pack={pack} days={streak} />
        ) : null}
        </>
      )}

      <Pressable
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setTempted(true); }}
        style={({ pressed }) => [styles.tempted, { backgroundColor: SUN, opacity: pressed ? 0.85 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel="Need a minute"
      >
        <Text style={styles.temptedText}>Need a minute</Text>
        <Text style={styles.temptedSub}>Tap here first. We'll get through it.</Text>
      </Pressable>
      <Pressable
        onPress={() => (blockingStatus === 'off' ? openSettings() : router.push('/(tabs)/blocklist' as any))}
        style={[styles.card, cardStyle, styles.row, { backgroundColor: colors.surface, borderColor: colors.cardBorder, alignItems: 'center' }]}
        accessibilityRole="button"
      >
        <Feather name="shield" size={18} color={status.color} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardBody, { color: colors.text }]}>{status.label}</Text>
          <Text style={[styles.cardMeta, { color: colors.textMuted }]}>
            {blocklist.length} site{blocklist.length === 1 ? '' : 's'} · {blockedApps.length} app{blockedApps.length === 1 ? '' : 's'} guarded
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.textMuted} />
      </Pressable>
      {roomView ? null : pack.parts.page.frame === 'corner' ? (
        <Text style={[styles.cornerHint, { color: colors.textMuted }]}>
          {floatVisible ? `${petName} is in the corner. Drag them anywhere, tap to say hi.` : `${petName} is resting. Turn them back on in Customize.`}
        </Text>
      ) : (
        <>
          <Habitat
            pack={pack} char={char} stage={stage} petName={petName}
            streak={streak} walkAways={walkAways}
            onAction={(a) => setReact(REACTIONS[a])}
          />
          <View style={styles.mood}>
            {pack.parts.page.frame === 'egg' && <Text style={[styles.face, { color: colors.text }]}>{react?.face ?? '(´• ω •`)'}</Text>}
            <Text style={[styles.moodLine, { color: colors.textSecondary }]}>{react?.line ?? `${petName}: ${SAY[stage]}`}</Text>
          </View>
        </>
      )}

      <Pressable
        onPress={toggleMore}
        style={[styles.moreBtn, { borderColor: colors.border }]}
        accessibilityRole="button"
        accessibilityState={{ expanded: showMore }}
        accessibilityLabel={showMore ? 'Show less' : 'More for today'}
      >
        <Text style={[styles.moreText, { color: colors.textSecondary }]}>{showMore ? 'Show less' : 'More for today'}</Text>
        <Feather name={showMore ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
      </Pressable>

      {showMore && (
        <>
        <Pressable
          onPress={() => router.push('/(tabs)/feed' as any)}
          style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
          accessibilityRole="button"
          accessibilityLabel="Open today's briefing"
        >
          <Text style={[styles.cardMeta, { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }]}>Today's briefing</Text>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
            {topGood?.headline ?? 'Good news, what the world is curious about, and a prompt to write.'}
          </Text>
          <Text style={[styles.cardMeta, { color: colors.accent }]}>Open briefing</Text>
        </Pressable>
        <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Today's intention</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            value={draft ?? intention}
            onChangeText={setDraft}
            onBlur={() => { if (draft !== null) { setDailyIntention(draft.trim()); setDraft(null); } }}
            placeholder="What are you choosing instead?"
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
            maxLength={120}
          />
        </View>
        <StyleCard />
        <Stamps pack={pack} best={longestStreak} />
        <View style={styles.links}>
          {LINKS.map((l) => (
            <Pressable
              key={l.label}
              onPress={l.go}
              style={({ pressed }) => [styles.link, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder, opacity: pressed ? 0.7 : 1 }]}
            >
              <Feather name={l.icon} size={20} color={colors.accent} />
              <Text style={[styles.linkText, { color: colors.text }]}>{l.label}</Text>
            </Pressable>
          ))}
        </View>
        </>
      )}

      <Pressable onPress={() => { Haptics.selectionAsync().catch(() => {}); setRoomView(!roomView); }} hitSlop={8} style={styles.switchView} accessibilityRole="button">
        <Text style={[styles.switchText, { color: colors.textMuted }]}>{roomView ? 'Switch to the plain page' : 'Switch to the room'}</Text>
      </Pressable>
    </ScrollView>
    <TemptedSheet visible={tempted} onClose={() => setTempted(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.huge },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  pencil:  { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  tempted: { borderRadius: 18, paddingVertical: 18, alignItems: 'center', gap: 2, borderBottomWidth: 3, borderBottomColor: '#D99E00' },
  temptedText: { fontFamily: FONTS.display, fontSize: 22, color: INK },
  temptedSub: { fontFamily: FONTS.body, fontSize: 12.5, color: '#12233Dcc' },
  cardMeta: { fontFamily: FONTS.body, fontSize: 12, marginTop: 1 },
  hello:   { fontFamily: FONTS.display, fontSize: 26 },
  sub:     { fontFamily: FONTS.body, fontSize: 13, marginTop: 2 },
  switchView: { alignSelf: 'center', paddingVertical: 6 },
  switchText: { fontFamily: FONTS.body, fontSize: 12, textDecorationLine: 'underline' },
  moreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 999, borderWidth: 1 },
  moreText:{ fontFamily: FONTS.bodyMedium, fontSize: 13 },
  cornerHint: { fontFamily: FONTS.body, fontSize: 12.5, textAlign: 'center' },
  mood:    { alignItems: 'center', gap: 2 },
  face:    { fontFamily: FONTS.body, fontSize: 22 },
  moodLine:{ fontFamily: FONTS.body, fontSize: 13, textAlign: 'center' },
  card:    { padding: SPACING.md, gap: SPACING.sm },
  cardTitle:{ fontFamily: FONTS.bodyBold, fontSize: 15 },
  cardBody:{ fontFamily: FONTS.body, fontSize: 13.5 },
  row:     { flexDirection: 'row', gap: SPACING.sm },
  btn:     { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999 },
  btnText: { fontFamily: FONTS.bodyBold, fontSize: 13 },
  input:   { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontFamily: FONTS.body, fontSize: 14 },
  links:   { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  link:    { width: '31.5%', flexGrow: 1, alignItems: 'center', paddingVertical: SPACING.md, gap: 6 },
  linkText:{ fontFamily: FONTS.bodyMedium, fontSize: 12 },
});
