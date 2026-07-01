// ═══════════════════════════════════════════════════════════════════════════
// NoGoon HELP GUIDE
// ─────────────────
// Video-game intro style: each section is a "level briefing" with an icon,
// a plain-English title, and a 2–3 sentence explanation written like a coach,
// not a manual. Accessible via the ? button on any main tab.
//
// Sections:
//   1. Welcome — what NoGoon actually does
//   2. The intercept screen — what happens when you hit a blocked app
//   3. How blocking works — the accessibility service, why it needs permission
//   4. Streaks & points — the reward loop
//   5. Hard lock mode — BRICKED, when to use it
//   6. Privacy — what we see vs. what we don't
// ═══════════════════════════════════════════════════════════════════════════

import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useUserStore } from '@/stores/useUserStore';
import { getColors, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

// ─── Section content ─────────────────────────────────────────────────────────

const SECTIONS = [
  {
    emoji: '🛡️',
    level: 'Level 1',
    title: 'What NoGoon does',
    body: "NoGoon watches for the apps and sites you've said are distracting. The moment you open one, it steps in before the habit loop fires.\n\nThink of it as a speed bump, not a wall. The goal isn't to punish you — it's to give you one second of choice before autopilot takes over.",
  },
  {
    emoji: '🌬️',
    level: 'Level 2',
    title: 'The intercept screen',
    body: "When you open a blocked app, you'll see a calm breathing screen first. This 5-second pause is the whole product working as intended — most cravings pass in under 90 seconds.\n\nAfter the pause, you'll be asked why you're here. You can play a quick game, do a breathing reset, or — if you genuinely need the app — let yourself through. No guilt, no judgment.",
  },
  {
    emoji: '📱',
    level: 'Level 3',
    title: 'How app blocking works',
    body: "NoGoon uses Android's Accessibility Service to watch which app is in the foreground. When it matches something on your blocklist, the intercept screen appears.\n\nWe only read app names — never your messages, passwords, or any content inside apps. The Accessibility Service is the same permission used by password managers and screen readers. It needs to stay 'On' in your settings for blocking to work.",
  },
  {
    emoji: '🔥',
    level: 'Level 4',
    title: 'Streaks & points',
    body: "Every time you play a game and choose to walk away from a blocked app, your streak grows and you earn points.\n\nPoints can be spent to temporarily unlock a blocked site for 10 minutes — useful when you actually need it. Streaks show your consistency over time. The real win is the walk-away count: how many times you played a game and didn't go back.",
  },
  {
    emoji: '🔒',
    level: 'Level 5',
    title: 'Hard lock mode',
    body: "Hard lock removes the option to unlock a blocked app after the game. There's no escape route — if you open a blocked app, the only exit is to put your phone down.\n\nUse this when you're in a deep work sprint or know you'll negotiate with yourself otherwise. Turning it off requires a 24-hour waiting period by design — so you can't disable it in a moment of weakness.",
  },
  {
    emoji: '🔐',
    level: 'Level 6',
    title: 'Your privacy',
    body: "NoGoon can see which app is open on your screen — that's it. We never read messages, notifications, emails, or anything inside an app.\n\nYour blocklist is stored on your device and optionally synced to your account. We don't sell data, don't show ads, and don't share anything with third parties.",
  },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function HelpScreen() {
  const { colorScheme } = useUserStore();
  const C = getColors(colorScheme ?? 'dark');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: C.border }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={C.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: C.textPrimary }]}>
          How NoGoon Works
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
            Your mission briefing
          </Text>
          <Text style={[styles.introBody, { color: C.textSecondary }]}>
            Six things to know. Read once, refer back whenever.
          </Text>
        </View>

        {/* Sections */}
        {SECTIONS.map((section, i) => (
          <View
            key={i}
            style={[
              styles.sectionCard,
              { backgroundColor: C.surface, borderColor: C.cardBorder },
            ]}
          >
            {/* Level badge + emoji */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEmoji}>{section.emoji}</Text>
              <View style={[styles.levelBadge, { backgroundColor: C.indigoBright + '18', borderColor: C.indigoBright + '40' }]}>
                <Text style={[styles.levelText, { color: C.indigoBright }]}>
                  {section.level}
                </Text>
              </View>
            </View>

            <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>
              {section.title}
            </Text>
            <Text style={[styles.sectionBody, { color: C.textSecondary }]}>
              {section.body}
            </Text>
          </View>
        ))}

        {/* Footer CTA */}
        <View style={[styles.footerCard, { backgroundColor: C.indigoBright + '12', borderColor: C.indigoBright + '30' }]}>
          <Text style={[styles.footerTitle, { color: C.indigoBright }]}>
            Still have questions?
          </Text>
          <Text style={[styles.footerBody, { color: C.textSecondary }]}>
            The best way to learn is to use it. Go block one app you keep reaching for — you'll understand the whole flow in 60 seconds.
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
    fontSize: 30,
    letterSpacing: -0.3,
  },

  introBody: {
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 22,
  },

  sectionCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    gap: SPACING.md,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  sectionEmoji: {
    fontSize: 32,
  },

  levelBadge: {
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: 3,
  },

  levelText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  sectionTitle: {
    fontFamily: FONTS.display,
    fontSize: 22,
    letterSpacing: -0.2,
  },

  sectionBody: {
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 24,
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
