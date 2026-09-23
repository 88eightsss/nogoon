// ─── Page Guide ─────────────────────────────────────────────────────────────
//
// First-time explainer shown once per tab, the first time a new user lands
// on it. Explains what the screen is for and why it's worth using — not a
// full tutorial, just enough context that nothing feels unexplained.
//
// State lives in useUserStore.seenPageGuides (persisted), keyed by `page`,
// so it auto-shows exactly once per install. After that it's reachable
// again any time via the tab header's "?" button, which sets the transient
// useUserStore.guideReopenRequest to this same `page` id — that's the whole
// per-page help system now; there's no separate combined help screen.
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

import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
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
  // even after it's already been seen once — that's the whole mechanism
  // behind "help, per page" without a separate combined help screen.
  const reopened = useUserStore((s) => s.guideReopenRequest === page);
  const clearGuideReopenRequest = useUserStore((s) => s.clearGuideReopenRequest);

  const visible = !seen || reopened;
  if (!visible) return null;

  const dismiss = () => {
    if (!seen) markPageGuideSeen(page);
    if (reopened) clearGuideReopenRequest();
  };

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
