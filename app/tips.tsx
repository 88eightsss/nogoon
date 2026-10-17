// ═══════════════════════════════════════════════════════════════════════════
// NoGoon TIPS & FEATURE GUIDE
// ───────────────────────────
// The smaller stuff — settings and shortcuts that don't fit the 8-level
// "how it works" briefing in help.tsx, and are too granular for the
// 10-step interactive tour. Linked from a card on the Help screen.
// ═══════════════════════════════════════════════════════════════════════════

import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as IntentLauncher from 'expo-intent-launcher';
import { FONTS } from '@/constants/Colors';
import { NETWORK_SHIELD_ENABLED } from '@/constants/features';
import { useThemedColors } from '@/hooks/useThemedColors';
import { SPACING, RADIUS } from '@/constants/Spacing';

// ─── Tip content ──────────────────────────────────────────────────────────────

type Tip = { icon: string; title: string; body: string; action?: { label: string; run: () => void } };

// Android can't switch grayscale on for us (that needs a permission Play Store apps can't hold),
// so this opens the system settings and the tip says where the switch lives.
const openPhoneSettings = () => {
  IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.ACCESSIBILITY_SETTINGS).catch(() => {});
};

const TIPS: readonly Tip[] = [
  {
    icon: 'droplet',
    title: 'Try your phone\'s own grayscale',
    body: "A black-and-white screen is a lot less tempting: bright reds, pinks and notification dots are built to pull your eye, and without colour they lose most of their grip. On Samsung: Settings > Digital Wellbeing > Bedtime mode > Grayscale (you can schedule it for evenings). On Pixel: Settings > Accessibility > Color and motion > Color correction > Grayscale.",
    action: { label: 'Open phone settings', run: openPhoneSettings },
  },
  {
    icon: 'toggle-left',
    title: "Turn off games you don't like",
    body: "In Arcade, scroll to Intercept games and flip off anything you'd rather skip — it just won't come up when you hit a blocker anymore.",
  },
  {
    icon: 'unlock',
    title: 'Spend points for a temporary unlock',
    body: "Genuinely need a blocked app? Points buy 20 minutes of access. It's there for real needs, not for talking yourself past every craving.",
  },
  {
    icon: 'lock',
    title: 'Hard lock has a 24-hour cooldown',
    body: "Turning Hard lock off takes a full day once it's on, by design — so the decision gets made in a calm moment, not a craving.",
  },
  {
    icon: 'home',
    title: 'Your room or a plain page',
    body: 'Today is a small room you can name and decorate. Prefer it plain? Switch at the bottom of Today or in Customize.',
  },
  {
    icon: 'zap',
    title: 'Jump straight to what you use most',
    body: 'Tap the window, door, corkboard, bed or dresser in your room to jump to that tab.',
  },
  {
    icon: 'sliders',
    title: 'The brightness dial is a real spectrum',
    body: "Drag it anywhere between Dark, Grey, and Light on the Me tab. Grey is a genuine third stop, not a blend gone muddy.",
  },
  {
    icon: 'square',
    title: 'Match the border style to your mood',
    body: 'Clean, Sharp, Soft, Bold, Halo, or Stitched — border styles change every card\'s edges, Halo adds a soft glow, Stitched adds a dotted trim. Purely cosmetic, purely yours.',
  },
  {
    icon: 'target',
    title: 'Set a Daily Intention each morning',
    body: "A short note about what you're protecting your focus for. It quietly resurfaces on the intercept screen as a reminder from past-you.",
  },
  {
    icon: 'moon',
    title: 'Schedule Wind-down for the evenings',
    body: 'Set a cutoff time on your Profile and NoGoon adds friction automatically after dark — no willpower required.',
  },
  {
    icon: 'shield',
    title: NETWORK_SHIELD_ENABLED ? 'Stack all three protection layers' : 'Stack both protection layers',
    body: NETWORK_SHIELD_ENABLED
      ? 'Accessibility Service, VPN DNS filter, and Notification Listener each close a different gap. Turn on all three on the Coverage screen for the fewest ways around a block.'
      : 'Accessibility Service and Notification Listener each close a different gap. Turn on both on the Coverage screen for the fewest ways around a block.',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function TipsScreen() {
  const C = useThemedColors();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: C.border }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={C.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: C.textPrimary }]}>
          Tips & Feature Guide
        </Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro */}
        <View style={styles.intro}>
          <Text style={[styles.introTitle, { color: C.textPrimary }]}>
            Smaller stuff worth knowing
          </Text>
          <Text style={[styles.introBody, { color: C.textSecondary }]}>
            Shortcuts and settings that make NoGoon feel like yours.
          </Text>
        </View>

        {/* Tip cards */}
        {TIPS.map((tip, i) => (
          <View
            key={i}
            style={[styles.tipCard, { backgroundColor: C.surface, borderColor: C.cardBorder }]}
          >
            <View style={[styles.tipIconWrap, { backgroundColor: C.arcade + '18', borderColor: C.arcade + '40' }]}>
              <Feather name={tip.icon as any} size={18} color={C.arcade} />
            </View>
            <View style={styles.tipText}>
              <Text style={[styles.tipTitle, { color: C.textPrimary }]}>{tip.title}</Text>
              <Text style={[styles.tipBody, { color: C.textSecondary }]}>{tip.body}</Text>
              {tip.action ? (
                <Pressable
                  onPress={tip.action.run}
                  style={[styles.tipAction, { borderColor: C.arcade }]}
                  accessibilityRole="button"
                  accessibilityLabel={tip.action.label}
                >
                  <Text style={[styles.tipActionText, { color: C.arcade }]}>{tip.action.label}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}

        {/* Footer */}
        <View style={[styles.footerCard, { backgroundColor: C.arcade + '12', borderColor: C.arcade + '30' }]}>
          <Text style={[styles.footerTitle, { color: C.arcade }]}>Got a suggestion?</Text>
          <Text style={[styles.footerBody, { color: C.textSecondary }]}>
            This page grows as NoGoon does. If something here is out of date or you want to
            see a feature explained, let us know from the Me tab.
          </Text>
        </View>

        <View style={{ height: SPACING.huge }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },

  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 17,
  },

  scroll: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    gap: SPACING.md,
  },

  intro: {
    paddingBottom: SPACING.sm,
    gap: SPACING.xs,
  },

  introTitle: {
    fontFamily: FONTS.display,
    fontSize: 26,
    letterSpacing: -0.3,
  },

  introBody: {
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 22,
  },

  tipCard: {
    flexDirection: 'row',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    gap: SPACING.md,
  },

  tipIconWrap: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tipText: {
    flex: 1,
    gap: 4,
  },

  tipTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
  },

  tipBody: {
    fontFamily: FONTS.body,
    fontSize: 13.5,
    lineHeight: 20,
  },

  tipAction: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
    marginTop: SPACING.xs,
  },

  tipActionText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
  },

  footerCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },

  footerTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
  },

  footerBody: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 22,
  },
});
