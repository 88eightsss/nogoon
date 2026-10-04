// ─── Ad Wall ──────────────────────────────────────────────────────────────────
//
// A full-screen collage of garish fake ads — every format, every size, total chaos.
// This is what the internet looks like without NoGoon.
//
// Navigation: push this screen when you want to show the contrast.
// e.g. from paywall: "See what you're protected from →"

import { useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AdBanner } from '@/components/ads/AdBanner';
import { FONTS } from '@/constants/Colors';
import { useThemedColors, type ArcadeColors } from '@/hooks/useThemedColors';
import { SPACING, RADIUS } from '@/constants/Spacing';

// ─── Fake ad data ─────────────────────────────────────────────────────────────
// Parody ads that mirror real dark-pattern ads found online.

const FAKE_ADS: Array<{
  bg: string;
  text: string;
  sub?: string;
  cta: string;
  ctaBg: string;
  badge?: string;
  rotate?: number;
  height?: number;
}> = [
  {
    bg: '#FF3B30',
    text: '⚠️ YOUR IPHONE HAS A VIRUS',
    sub: 'Tap NOW to remove 3 threats',
    cta: 'CLEAN NOW — FREE',
    ctaBg: '#34C759',
    badge: 'URGENT',
    rotate: -1.5,
    height: 120,
  },
  {
    bg: '#FF9500',
    text: '🎉 CONGRATULATIONS! You\'ve been selected',
    sub: 'Claim your FREE iPhone 15 Pro',
    cta: 'CLAIM PRIZE',
    ctaBg: '#FF3B30',
    badge: '⏰ 00:02:41',
    rotate: 0.8,
    height: 100,
  },
  {
    bg: '#1C1C1E',
    text: 'One WEIRD trick to lose 40 lbs',
    sub: 'Doctors absolutely hate this',
    cta: 'See The Trick →',
    ctaBg: '#FF9500',
    rotate: -0.5,
    height: 90,
  },
  {
    bg: '#007AFF',
    text: '💬 You have (3) unread messages',
    sub: 'Singles in your area are waiting',
    cta: 'View Messages',
    ctaBg: '#FF3B30',
    badge: 'HOT 🔥',
    rotate: 1.2,
    height: 100,
  },
  {
    bg: '#34C759',
    text: 'FINAL NOTICE: Subscription Expiring',
    sub: 'Renew Norton™ to stay protected',
    cta: 'RENEW NOW — $2.99',
    ctaBg: '#FF3B30',
    badge: 'ACT NOW',
    rotate: -0.3,
    height: 110,
  },
  {
    bg: '#5856D6',
    text: 'She tried THIS for 30 days',
    sub: 'Results shocked her entire family',
    cta: 'Read Her Story',
    ctaBg: '#FF9500',
    rotate: 0.6,
    height: 90,
  },
  {
    bg: '#FF2D55',
    text: '🏆 You\'re our 1,000,000th visitor!',
    sub: 'Spin to win your guaranteed reward',
    cta: 'SPIN NOW',
    ctaBg: '#34C759',
    badge: 'TODAY ONLY',
    rotate: -1.0,
    height: 130,
  },
  {
    bg: '#FF9500',
    text: 'MAKE $500/DAY FROM HOME',
    sub: 'No experience needed. Guaranteed.',
    cta: 'Start Earning',
    ctaBg: '#007AFF',
    badge: 'LIMITED SPOTS',
    rotate: 0.4,
    height: 100,
  },
  {
    bg: '#1C1C1E',
    text: '🔒 Your data was leaked',
    sub: 'Scan now to see what\'s exposed',
    cta: 'Free Scan →',
    ctaBg: '#FF3B30',
    badge: '⚡ URGENT',
    rotate: -0.7,
    height: 110,
  },
  {
    bg: '#007AFF',
    text: 'IQ Test: Can you score 130+?',
    sub: '97% of people fail this question',
    cta: 'Take the Test',
    ctaBg: '#34C759',
    rotate: 1.5,
    height: 90,
  },
  {
    bg: '#FF3B30',
    text: '🎮 Free Robux Generator',
    sub: 'No human verification required!',
    cta: 'Generate Robux',
    ctaBg: '#5856D6',
    badge: '100% WORKING',
    rotate: -0.2,
    height: 100,
  },
  {
    bg: '#34C759',
    text: 'Crypto EXPLODES 10,000%',
    sub: 'Elon Musk\'s secret investment revealed',
    cta: 'Invest Now →',
    ctaBg: '#FF9500',
    badge: '🚀 ACT FAST',
    rotate: 0.9,
    height: 110,
  },
];

// ─── Fake ad card ─────────────────────────────────────────────────────────────

function FakeAdCard({
  ad,
}: {
  ad: typeof FAKE_ADS[number];
}) {
  const COLORS = useThemedColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View
      style={[
        styles.fakeAd,
        {
          backgroundColor: ad.bg,
          height: ad.height ?? 100,
          transform: [
            { rotate: `${ad.rotate ?? 0}deg` },
            { scale: scaleAnim },
          ],
        },
      ]}
    >
      {ad.badge && (
        <View style={styles.fakeBadge}>
          <Text style={styles.fakeBadgeText}>{ad.badge}</Text>
        </View>
      )}
      <Text style={styles.fakeAdText} numberOfLines={2}>{ad.text}</Text>
      {ad.sub && (
        <Text style={styles.fakeAdSub} numberOfLines={1}>{ad.sub}</Text>
      )}
      <View style={[styles.fakeAdCta, { backgroundColor: ad.ctaBg }]}>
        <Text style={styles.fakeAdCtaText}>{ad.cta}</Text>
      </View>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AdWall() {
  const COLORS = useThemedColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.headerLabel}>WITHOUT NOGOON</Text>
          <Text style={styles.headerTitle}>This is the internet.</Text>
          <Text style={styles.headerSub}>
            Every page. Every scroll. Every click.{'\n'}
            3,000–10,000 ads per person per day.
          </Text>
        </View>

        {/* ── Ad collage ────────────────────────────────────────────────── */}
        {/* Real AdMob units mixed with fake parody ads */}
        <AdBanner size="largeBanner" />

        {FAKE_ADS.slice(0, 3).map((ad, i) => (
          <FakeAdCard key={`fake-${i}`} ad={ad} />
        ))}

        <AdBanner size="mediumRectangle" />

        {FAKE_ADS.slice(3, 7).map((ad, i) => (
          <FakeAdCard key={`fake-${i + 3}`} ad={ad} />
        ))}

        <AdBanner size="largeBanner" />

        {FAKE_ADS.slice(7, 10).map((ad, i) => (
          <FakeAdCard key={`fake-${i + 7}`} ad={ad} />
        ))}

        <AdBanner size="mediumRectangle" />

        {FAKE_ADS.slice(10).map((ad, i) => (
          <FakeAdCard key={`fake-${i + 10}`} ad={ad} />
        ))}

        <AdBanner size="banner" />

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <View style={styles.footer}>
          <Text style={styles.footerEmoji}>🛡️</Text>
          <Text style={styles.footerTitle}>NoGoon blocks this.</Text>
          <Text style={styles.footerSub}>
            Every intercept protects you from another algorithmic rabbit hole.
          </Text>
          <Pressable style={styles.footerBtn} onPress={() => router.back()}>
            <Text style={styles.footerBtnText}>I remember why I use NoGoon</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (COLORS: ArcadeColors) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: SPACING.sm,
    paddingBottom: SPACING.xxl,
    gap: SPACING.xs,
  },

  // Header
  header: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
  },
  headerLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.danger,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontFamily: FONTS.display,
    fontSize: 28,
    color: '#ffffff',
    textAlign: 'center',
  },
  headerSub: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 22,
  },

  // Fake ad card
  fakeAd: {
    width: '100%',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    gap: 4,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fakeBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: RADIUS.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  fakeBadgeText: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: '#fff',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  fakeAdText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    color: '#ffffff',
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  fakeAdSub: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
  },
  fakeAdCta: {
    alignSelf: 'flex-start',
    borderRadius: RADIUS.xs,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 2,
  },
  fakeAdCtaText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: '#ffffff',
    letterSpacing: 0.3,
  },

  // Footer
  footer: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.green + '44',
    padding: SPACING.xl,
    marginTop: SPACING.md,
    gap: SPACING.md,
  },
  footerEmoji: {
    fontSize: 52,
  },
  footerTitle: {
    fontFamily: FONTS.display,
    fontSize: 26,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  footerSub: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  footerBtn: {
    backgroundColor: COLORS.green + '22',
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.green + '88',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    width: '100%',
    alignItems: 'center',
  },
  footerBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    color: COLORS.green,
  },
});
