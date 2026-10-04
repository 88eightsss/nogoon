// ─── Page Guide ─────────────────────────────────────────────────────────────
//
// First-time explainer, once per tab. It no longer pops up on arrival — a new
// user landing on five screens and getting five walls of text in a row was
// overwhelming. Instead the first visit shows a small, dismissible "New here?"
// bubble tucked under the header, pointing up at the "?" button. Tapping it
// opens the guide when the user is ready; the bubble then glides up toward the
// "?" and disappears, and from then on the guide lives only behind that button.
// The bubble's × just dismisses it without opening anything.
//
// State lives in useUserStore.seenPageGuides (persisted), keyed by `page`, so
// the bubble shows exactly once per install. The tab header's "?" button
// re-opens the guide any time by setting the transient
// useUserStore.guideReopenRequest to this same `page` id — that's the whole
// per-page help system; there's no separate combined help screen.
//
// Usage (inside a tab screen, rendered alongside the screen's own content):
//   <PageGuide
//     page="home"
//     icon="home"
//     accent={colors.accent}
//     title="Today"
//     subtitle="Your daily snapshot — streak, blocklist, and quick stats."
//     points={[
//       { icon: 'zap', title: 'Streak ring', body: 'Grows every day you don\'t give in.' },
//       ...
//     ]}
//   />
//
// No icon is ever rendered as an emoji character here — Feather glyphs only,
// so the guide reads the same on every device and font size.

import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useUserStore } from '@/stores/useUserStore';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

export type PageGuidePoint = {
  icon:  FeatherName;
  title: string;
  body:  string;
};

type Props = {
  // Unique, stable key for this screen — e.g. 'home', 'blocklist', 'arcade',
  // 'calm', 'profile'. Changing it will show the guide again, so keep it fixed.
  page:     string;
  icon:     FeatherName;
  accent:   string;
  title:    string;
  subtitle: string;
  points:   PageGuidePoint[];
};

export function PageGuide({ page, icon, accent, title, subtitle, points }: Props) {
  const { colors } = useTheme();
  const seen = useUserStore((s) => !!s.seenPageGuides[page]);
  const markPageGuideSeen = useUserStore((s) => s.markPageGuideSeen);

  // The header's "?" button re-requests this exact page's guide on demand,
  // even after it's already been seen once.
  const reopened = useUserStore((s) => s.guideReopenRequest === page);
  const clearGuideReopenRequest = useUserStore((s) => s.clearGuideReopenRequest);

  // The guide card is opened by tapping the bubble (local state) or the "?"
  // (store request) — never automatically.
  const [open, setOpen] = useState(false);
  const [bubbleGone, setBubbleGone] = useState(false);
  const [leaving, setLeaving] = useState(false);   // true while the fly-away animation runs

  // Bubble animation: fades/slides in shortly after the screen settles, and
  // on press glides up toward the header's "?" while shrinking away.
  const appear = useRef(new Animated.Value(0)).current;   // 0 hidden → 1 shown
  const leave  = useRef(new Animated.Value(0)).current;   // 0 in place → 1 gone

  // Stays mounted through the fly-away animation even though marking the page
  // seen (which happens at the start of it) would otherwise unmount it at once.
  const showBubble = !bubbleGone && (!seen || leaving);

  // Opening the guide from the header "?" before touching the bubble counts as
  // having found help — retire the bubble so it doesn't linger behind the card.
  useEffect(() => {
    if (reopened && !seen) markPageGuideSeen(page);
  }, [reopened, seen, markPageGuideSeen, page]);

  useEffect(() => {
    if (!showBubble) return;
    const t = setTimeout(() => {
      Animated.timing(appear, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    }, 700);
    return () => clearTimeout(t);
  }, [showBubble, appear]);

  const flyAway = (then?: () => void) => {
    setLeaving(true);
    markPageGuideSeen(page);
    Animated.timing(leave, { toValue: 1, duration: 280, useNativeDriver: true }).start(() => {
      setBubbleGone(true);
      then?.();
    });
  };

  const visible = open || reopened;

  const dismiss = () => {
    setOpen(false);
    if (reopened) clearGuideReopenRequest();
  };

  const bubbleOpacity = Animated.multiply(appear, leave.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }));
  const bubbleTranslateY = Animated.add(
    appear.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }),
    leave.interpolate({ inputRange: [0, 1], outputRange: [0, -28] }),
  );
  const bubbleScale = leave.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] });

  const bubble = showBubble ? (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.bubbleWrap,
          { opacity: bubbleOpacity, transform: [{ translateY: bubbleTranslateY }, { scale: bubbleScale }] },
        ]}
      >
        {/* little caret pointing up at the header's "?" */}
        <View style={[styles.caret, { backgroundColor: accent }]} />
        <View style={[styles.bubble, { backgroundColor: accent }]}>
          <Pressable
            style={styles.bubbleMain}
            onPress={() => flyAway(() => setOpen(true))}
            hitSlop={6}
          >
            <Feather name={icon} size={14} color={colors.background} />
            <Text style={[styles.bubbleText, { color: colors.background }]}>New here? Quick look</Text>
          </Pressable>
          <Pressable style={styles.bubbleClose} onPress={() => flyAway()} hitSlop={8}>
            <Feather name="x" size={14} color={colors.background} />
          </Pressable>
        </View>
      </Animated.View>
    </View>
  ) : null;

  if (!visible) return bubble;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={dismiss}>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <View style={[styles.iconWrap, { backgroundColor: accent + '1c' }]}>
            <Feather name={icon} size={28} color={accent} />
          </View>

          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>

          <View style={styles.points}>
            {points.map((p, i) => (
              <View key={i} style={styles.point}>
                <View style={[styles.pointIcon, { backgroundColor: accent + '14' }]}>
                  <Feather name={p.icon} size={15} color={accent} />
                </View>
                <View style={styles.pointText}>
                  <Text style={[styles.pointTitle, { color: colors.text }]}>{p.title}</Text>
                  <Text style={[styles.pointBody, { color: colors.textMuted }]}>{p.body}</Text>
                </View>
              </View>
            ))}
          </View>

          <Pressable style={[styles.button, { backgroundColor: accent }]} onPress={dismiss}>
            <Text style={[styles.buttonText, { color: colors.background }]}>Got it</Text>
          </Pressable>

          <Pressable
            style={styles.tourLink}
            onPress={() => { dismiss(); router.push('/tutorial'); }}
            hitSlop={8}
          >
            <Text style={[styles.tourLinkText, { color: colors.textMuted }]}>
              Or take the full interactive tour
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bubbleWrap: {
    position:   'absolute',
    top:        6,
    right:      SPACING.md,
    alignItems: 'flex-end',
  },
  caret: {
    width:        10,
    height:       10,
    marginRight:  14,
    marginBottom: -5,
    transform:    [{ rotate: '45deg' }],
  },
  bubble: {
    flexDirection:  'row',
    alignItems:     'center',
    borderRadius:   20,
    paddingLeft:    SPACING.md,
    paddingRight:   SPACING.sm,
    paddingVertical: 8,
    gap:            SPACING.sm,
    shadowColor:    '#000',
    shadowOpacity:  0.2,
    shadowRadius:   6,
    shadowOffset:   { width: 0, height: 2 },
    elevation:      4,
  },
  bubbleMain: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  bubbleText: {
    fontFamily: FONTS.bodyBold,
    fontSize:   13,
  },
  bubbleClose: {
    width:          22,
    height:         22,
    alignItems:     'center',
    justifyContent: 'center',
    opacity:        0.8,
  },
  backdrop: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: SPACING.lg,
  },
  card: {
    width:        '100%',
    maxWidth:     400,
    borderRadius: RADIUS.lg,
    borderWidth:  1,
    padding:      SPACING.xl,
    alignItems:   'center',
  },
  iconWrap: {
    width:          56,
    height:         56,
    borderRadius:   18,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   SPACING.md,
  },
  title: {
    fontFamily:  FONTS.display,
    fontSize:    22,
    textAlign:   'center',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontFamily:   FONTS.body,
    fontSize:     14,
    textAlign:    'center',
    lineHeight:   20,
    marginBottom: SPACING.lg,
  },
  points: {
    width:        '100%',
    gap:          SPACING.md,
    marginBottom: SPACING.xl,
  },
  point: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           SPACING.sm,
  },
  pointIcon: {
    width:          30,
    height:         30,
    borderRadius:   10,
    alignItems:     'center',
    justifyContent: 'center',
    marginTop:      2,
  },
  pointText: {
    flex: 1,
  },
  pointTitle: {
    fontFamily:   FONTS.bodyBold,
    fontSize:     14,
    marginBottom: 2,
  },
  pointBody: {
    fontFamily: FONTS.body,
    fontSize:   13,
    lineHeight: 18,
  },
  button: {
    width:        '100%',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems:   'center',
  },
  tourLink: {
    marginTop: 4,
  },
  tourLinkText: {
    fontFamily:    FONTS.body,
    fontSize:      13,
    textDecorationLine: 'underline',
  },
  buttonText: {
    fontFamily: FONTS.bodyBold,
    fontSize:   15,
  },
});
