// ═══════════════════════════════════════════════════════════════════════════
// NoGoon INTERACTIVE TUTORIAL
// ─────────────────────────────
// 6-step swipeable walkthrough covering what onboarding doesn't already.
// Each step has an animated visual mockup, a plain-English explanation,
// and a "Try It" deep-link to the relevant screen.
//
// Entry points:
//   • help.tsx → "Take the Tour" button
//   • Auto-shown after onboarding (when hasSeenTutorial is false)
//
// Completion: markTutorialSeen() persisted via useUserStore.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  Animated,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { FONTS } from '@/constants/Colors';
import { NETWORK_SHIELD_ENABLED } from '@/constants/features';
import { useThemedColors, type ArcadeColors } from '@/hooks/useThemedColors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { useUserStore } from '@/stores/useUserStore';

// ─── Step definitions ─────────────────────────────────────────────────────────

type Step = {
  id: string;
  emoji: string;
  colorKey: keyof ArcadeColors;
  dimKey: keyof ArcadeColors;
  title: string;
  subtitle: string;
  body: string;
  cta?: { label: string; route: Href };
  Illustration: React.FC<{ accent: string; dim: string }>;
};

// ─── Illustrations ────────────────────────────────────────────────────────────
// Each is a lightweight React component drawing a stylised mockup with Views.

const FocusIllustration: React.FC<{ accent: string; dim: string }> = ({ accent, dim }) => {
  const COLORS = useThemedColors();
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, { toValue: 1, duration: 3000, useNativeDriver: true }),
        Animated.timing(progress, { toValue: 0, duration: 500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  return (
    <View style={ill.container}>
      <View style={[ill.focusCard, { backgroundColor: COLORS.surface, borderColor: COLORS.cardBorder }]}>
        <Feather name="clock" size={28} color={accent} />
        <Text style={[ill.focusTime, { color: COLORS.textPrimary }]}>45:00</Text>
        <Text style={[ill.focusLabel, { color: COLORS.textMuted }]}>Focus Session</Text>
        <View style={[ill.progressTrack, { backgroundColor: COLORS.border }]}>
          <Animated.View
            style={[
              ill.progressFill,
              { transform: [{ scaleX: progress }], transformOrigin: 'left', backgroundColor: accent },
            ]}
          />
        </View>
        <View style={[ill.focusBadge, { backgroundColor: dim, borderColor: accent }]}>
          <Text style={[ill.focusBadgeText, { color: accent }]}>Blocking paused</Text>
        </View>
      </View>
    </View>
  );
};

const VpnIllustration: React.FC<{ accent: string; dim: string }> = ({ accent, dim }) => {
  const COLORS = useThemedColors();
  const flash = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flash, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [flash]);

  const layers = [
    ...(NETWORK_SHIELD_ENABLED ? [{ icon: 'wifi' as const, label: 'VPN DNS filter' }] : []),
    { icon: 'bell-off' as const, label: 'Notification block' },
    { icon: 'eye-off' as const, label: 'Accessibility watch' },
  ];

  return (
    <View style={ill.container}>
      {layers.map((l, i) => (
        <Animated.View
          key={i}
          style={[
            ill.layerRow,
            { backgroundColor: COLORS.surface, borderColor: COLORS.cardBorder, opacity: flash.interpolate({ inputRange: [0.4, 1], outputRange: [0.6 + i * 0.15, 1] }) },
          ]}
        >
          <View style={[ill.layerIcon, { backgroundColor: dim }]}>
            <Feather name={l.icon} size={16} color={accent} />
          </View>
          <Text style={[ill.layerLabel, { color: COLORS.textSecondary }]}>{l.label}</Text>
          <View style={[ill.onBadge, { backgroundColor: dim }]}>
            <Text style={[ill.onText, { color: accent }]}>ON</Text>
          </View>
        </Animated.View>
      ))}
    </View>
  );
};

const IntentionIllustration: React.FC<{ accent: string; dim: string }> = ({ accent, dim }) => {
  const COLORS = useThemedColors();
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(fade, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.delay(2000),
        Animated.timing(fade, { toValue: 0, duration: 1000, useNativeDriver: true }),
        Animated.delay(500),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [fade]);

  return (
    <View style={ill.container}>
      <View style={[ill.intentionCard, { backgroundColor: COLORS.surface, borderColor: accent + '60' }]}>
        <Text style={[ill.intentionTime, { color: COLORS.textMuted }]}>Today's intention</Text>
        <Animated.Text style={[ill.intentionGoal, { color: COLORS.textPrimary, opacity: fade }]}>
          "Finish the design doc."
        </Animated.Text>
        <View style={[ill.intentionTag, { backgroundColor: dim }]}>
          <Feather name="sunrise" size={13} color={accent} />
          <Text style={[ill.intentionTagText, { color: accent }]}>Set every morning</Text>
        </View>
      </View>
    </View>
  );
};

const InsightsIllustration: React.FC<{ accent: string; dim: string }> = ({ accent, dim }) => {
  const COLORS = useThemedColors();
  const bars = [5, 3, 8, 2, 11, 7, 9];
  const anims = bars.map(() => useRef(new Animated.Value(0)).current);

  useEffect(() => {
    const stagger = Animated.stagger(
      120,
      anims.map((a) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(a, { toValue: 1, duration: 800, useNativeDriver: true }),
            Animated.delay(1500),
            Animated.timing(a, { toValue: 0, duration: 400, useNativeDriver: true }),
            Animated.delay(200),
          ])
        )
      )
    );
    stagger.start();
    return () => stagger.stop();
  }, []);

  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const maxH = 60;

  return (
    <View style={ill.container}>
      <View style={ill.chartWrap}>
        {bars.map((barValue, i) => {
          // Same visual mapping as before (0 -> 4px, 11 -> maxH), now driven by a
          // static target height + a 0-1 native-driven scaleY instead of animating
          // `height` directly (height can't run on the native thread).
          const barHeight = 4 + (barValue / 11) * (maxH - 4);
          return (
            <View key={i} style={ill.barCol}>
              <Animated.View
                style={[
                  ill.bar,
                  {
                    backgroundColor: accent,
                    height: barHeight,
                    transform: [{ scaleY: anims[i] }],
                    transformOrigin: 'bottom',
                  },
                ]}
              />
              <Text style={[ill.barLabel, { color: COLORS.textMuted }]}>{dayLabels[i]}</Text>
            </View>
          );
        })}
      </View>
      <View style={[ill.insightChip, { backgroundColor: dim, borderColor: accent + '40' }]}>
        <Text style={[ill.insightText, { color: accent }]}>Peak urge: 9–10 PM</Text>
      </View>
    </View>
  );
};

const WindDownIllustration: React.FC<{ accent: string; dim: string }> = ({ accent, dim }) => {
  const COLORS = useThemedColors();
  const moonGlow = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(moonGlow, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(moonGlow, { toValue: 0.6, duration: 1800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [moonGlow]);

  return (
    <View style={ill.container}>
      <Animated.View style={[ill.moonCircle, { backgroundColor: dim, borderColor: accent, opacity: moonGlow }]}>
        <Text style={{ fontSize: 36 }}>🌙</Text>
      </Animated.View>
      <View style={[ill.scheduleCard, { backgroundColor: COLORS.surface, borderColor: COLORS.cardBorder }]}>
        <View style={ill.scheduleRow}>
          <Feather name="clock" size={14} color={accent} />
          <Text style={[ill.scheduleText, { color: COLORS.textSecondary }]}>Starts at 9:00 PM</Text>
        </View>
        <View style={ill.scheduleRow}>
          <Feather name="sun" size={14} color={COLORS.textMuted} />
          <Text style={[ill.scheduleText, { color: COLORS.textMuted }]}>Ends at 8:00 AM</Text>
        </View>
        <View style={[ill.scheduleTag, { backgroundColor: dim }]}>
          <Text style={[ill.scheduleTagText, { color: accent }]}>Every day</Text>
        </View>
      </View>
    </View>
  );
};

const LootIllustration: React.FC<{ accent: string; dim: string }> = ({ accent, dim }) => {
  const bounce = useRef(new Animated.Value(0)).current;
  const sparkle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bounceLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: -8, duration: 500, useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.delay(1000),
      ])
    );
    const sparkleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sparkle, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(sparkle, { toValue: 0, duration: 600, useNativeDriver: true }),
      ])
    );
    bounceLoop.start();
    sparkleLoop.start();
    return () => { bounceLoop.stop(); sparkleLoop.stop(); };
  }, [bounce, sparkle]);

  const items = ['🎮', '📔', '📊']; // Arcade, Journal, Insights

  return (
    <View style={ill.container}>
      <Animated.View style={[ill.chestWrap, { transform: [{ translateY: bounce }] }]}>
        <Text style={{ fontSize: 56 }}>📦</Text>
        <Animated.View style={[ill.chestGlow, { backgroundColor: accent + '30', opacity: sparkle }]} />
      </Animated.View>
      <View style={ill.lootRow}>
        {items.map((emoji, i) => (
          <Animated.View
            key={i}
            style={[
              ill.lootItem,
              {
                backgroundColor: dim,
                borderColor: accent + '40',
                opacity: sparkle.interpolate({ inputRange: [0, 1], outputRange: [0.5 + i * 0.1, 1] }),
              },
            ]}
          >
            <Text style={{ fontSize: 22 }}>{emoji}</Text>
          </Animated.View>
        ))}
      </View>
    </View>
  );
};

// A simple still scene for the newer steps: one big emoji with a few small ones beneath it.
const scene = (emojis: string[]): React.FC<{ accent: string; dim: string }> =>
  function SceneIllustration({ accent, dim }) {
    return (
      <View style={ill.container}>
        <Text style={{ fontSize: 56 }}>{emojis[0]}</Text>
        <View style={ill.lootRow}>
          {emojis.slice(1).map((e, i) => (
            <View key={i} style={[ill.lootItem, { backgroundColor: dim, borderColor: accent + '40' }]}>
              <Text style={{ fontSize: 22 }}>{e}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

// ─── Steps ────────────────────────────────────────────────────────────────────

// Trimmed from 10 steps to 6 — the first four (blocklist, intercept screen,
// games, walk-away) already get covered in onboarding's slides + setup card,
// so this tutorial (auto-shown right after that) was re-teaching the same
// four things before ever getting to what's actually new. Kept: everything
// past that point, which onboarding never mentions at all.
const STEPS: Step[] = [
  {
    id: 'unlocks',
    emoji: '🎁',
    colorKey: 'arcade' as const,
    dimKey: 'arcadeDim' as const,
    title: 'Unlock more as you go',
    subtitle: 'Step 1 of 6',
    body: 'Keep walking away and NoGoon opens up: the full Arcade (all 15 games), Insights and Journal all unlock at walk-away milestones.\n\nAnything you see locked isn\'t gone for good — it\'s waiting for you to earn it.',
    cta: { label: "See what's locked", route: '/(tabs)/arcade' },
    Illustration: LootIllustration,
  },
  {
    id: 'minute',
    emoji: '⏸️',
    colorKey: 'arcade' as const,
    dimKey: 'arcadeDim' as const,
    title: 'Need a minute',
    subtitle: '',
    body: 'The big yellow button on Today is for when a craving shows up. Tap it and pick one: breathe, play a quick game, calm down, or write it out.\n\nBreathing is hands-on now: press and hold the orb to breathe in, let go to breathe out. Can\'t hold? Switch to follow-along.',
    cta: { label: 'Try breathing', route: '/breathe' },
    Illustration: scene(['🫧', '🌬️', '🎮', '✍️']),
  },
  {
    id: 'companions',
    emoji: '🐣',
    colorKey: 'cyan' as const,
    dimKey: 'cyanDim' as const,
    title: 'Your companion grows',
    subtitle: '',
    body: 'Every walk-away feeds your companion. In Customize, tap any companion to see all five stages and how far along you are, then pick who to feed. Only one grows at a time.\n\nBorders and colours are in Customize too: Clean, Sharp, Soft, Bold, Halo or Stitched.',
    cta: { label: 'Open Customize', route: '/customize' },
    Illustration: scene(['🥚', '🐣', '🐥', '🦅']),
  },
  {
    id: 'journal',
    emoji: '📓',
    colorKey: 'indigoBright' as const,
    dimKey: 'indigoDim' as const,
    title: 'Your journal, your way',
    subtitle: '',
    body: 'Pages is a colourful journal: pick paper, add stickers (even your companions), doodle, and use a template or a prompt when you don\'t know where to start. Canvas is Brain Bubbles for emptying your head. Moments keeps your quick urge notes.\n\nText size and easy-read spacing are in the Style tab. Everything stays on your phone.',
    cta: { label: 'Open Journal', route: '/journal' },
    Illustration: scene(['📓', '🎨', '⭐', '🌈']),
  },
  {
    id: 'modes',
    emoji: '⏰',
    colorKey: 'purple' as const,
    dimKey: 'purpleDim' as const,
    title: 'Modes run like alarms',
    subtitle: '',
    body: 'Each mode is a saved blocklist with its own time window. Flip the switch to turn its schedule on, tap the card to set the days and spin the clock wheels for start and end times.\n\nThe top of the screen tells you what changes next, like "Work starts in 2 h".',
    cta: { label: 'Open Modes', route: '/modes' },
    Illustration: scene(['⏰', '💼', '🌙', '🏖️']),
  },
  {
    id: 'briefing',
    emoji: '📰',
    colorKey: 'green' as const,
    dimKey: 'greenDim' as const,
    title: 'Briefing and what\'s on near you',
    subtitle: '',
    body: 'The Briefing tab is good news and what the world is curious about. Choose 20 stories (then it ends) or Endless (older stories keep loading).\n\n"Happening near you" lists farmers markets, volunteering and community events, each with a link to the organiser.',
    cta: { label: 'Happening near you', route: '/events' },
    Illustration: scene(['📰', '🌺', '🥭', '🤝']),
  },
  {
    id: 'reachout',
    emoji: '💌',
    colorKey: 'arcade' as const,
    dimKey: 'arcadeDim' as const,
    title: 'A nudge to reach out',
    subtitle: '',
    body: 'After a long scroll, your companion may leave a small card on Today with a ready-made hello. Tap Send to share it with anyone, or "Not today" to tuck it away. It\'s never a notification, and nothing is sent unless you send it.\n\nAnother tip: your phone\'s own grayscale makes scrolling duller. The Tips page shows where to find it.',
    cta: { label: 'See Tips', route: '/tips' },
    Illustration: scene(['💌', '👋', '☎️', '🩶']),
  },
  {
    id: 'focus',
    emoji: '⏱️',
    colorKey: 'cyan' as const,
    dimKey: 'cyanDim' as const,
    title: 'Focus Session',
    subtitle: 'Step 2 of 6',
    body: 'Need to work without interruption? Start a Focus Session to pause-proof your blocklist for a set time — no unlock path until it ends.\n\nFind it on your Profile, under Blocking strength.',
    cta: { label: 'Open Profile', route: '/(tabs)/profile' },
    Illustration: FocusIllustration,
  },
  {
    id: 'protection',
    emoji: '🔐',
    colorKey: 'purple' as const,
    dimKey: 'purpleDim' as const,
    title: NETWORK_SHIELD_ENABLED ? 'Three layers of protection' : 'Two layers of protection',
    subtitle: 'Step 3 of 6',
    body: NETWORK_SHIELD_ENABLED
      ? 'NoGoon has three independent blocking layers: the Accessibility Service (app-level), a VPN DNS filter (network-level), and a Notification Listener (push-level).\n\nEnable all three on the Coverage screen for airtight protection.'
      : 'NoGoon has two independent blocking layers: the Accessibility Service (app-level) and a Notification Listener (push-level).\n\nEnable both on the Coverage screen for the strongest protection.',
    cta: { label: 'Open Coverage', route: '/protection' },
    Illustration: VpnIllustration,
  },
  {
    id: 'intention',
    emoji: '🎯',
    colorKey: 'indigoBright' as const,
    dimKey: 'indigoDim' as const,
    title: 'Daily Intention',
    subtitle: 'Step 4 of 6',
    body: 'Set a short intention each morning — what you\'re protecting your focus for. It shows up quietly on the gate screen as a reminder of your own words.\n\nNot a rule. Just a nudge from past-you to present-you.',
    cta: { label: 'Set Today\'s Intention', route: '/' },
    Illustration: IntentionIllustration,
  },
  {
    id: 'insights',
    emoji: '📊',
    colorKey: 'cyan' as const,
    dimKey: 'cyanDim' as const,
    title: 'Track your patterns',
    subtitle: 'Step 5 of 6',
    body: 'The Insights screen shows your daily walk-aways for the past week, your peak distraction hour, and how you felt after each intercept.\n\nSpots emerge quickly — most people find a 2-hour window that accounts for most of their scrolling.',
    cta: { label: 'View Insights', route: '/insights' },
    Illustration: InsightsIllustration,
  },
  {
    id: 'winddown',
    emoji: '🌙',
    colorKey: 'indigo' as const,
    dimKey: 'indigoDim' as const,
    title: 'Wind-down Mode',
    subtitle: 'Step 6 of 6',
    body: 'Schedule automatic quiet hours. After your cutoff, NoGoon adds friction on every blocked site.\n\nSet it once on your Profile and stop negotiating with yourself at night.',
    cta: { label: 'Open Profile', route: '/(tabs)/profile' },
    Illustration: WindDownIllustration,
  },
];

STEPS.forEach((st, i) => { st.subtitle = `Step ${i + 1} of ${STEPS.length}`; });

// ─── Tutorial screen ──────────────────────────────────────────────────────────

export default function TutorialScreen() {
  const COLORS = useThemedColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const markTutorialSeen = useUserStore((s) => s.markTutorialSeen);
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const goToIndex = useCallback(
    (next: number) => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
        flatRef.current?.scrollToIndex({ index: next, animated: false });
        setCurrentIndex(next);
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      });
    },
    [fadeAnim]
  );

  const handleNext = useCallback(() => {
    if (currentIndex < STEPS.length - 1) {
      goToIndex(currentIndex + 1);
    } else {
      finish();
    }
  }, [currentIndex, goToIndex]);

  const handleBack = useCallback(() => {
    if (currentIndex > 0) goToIndex(currentIndex - 1);
  }, [currentIndex, goToIndex]);

  const finish = useCallback(() => {
    markTutorialSeen();
    router.back();
  }, [markTutorialSeen]);

  const handleCta = useCallback(
    (route: Href) => {
      markTutorialSeen();
      router.replace(route);
    },
    [markTutorialSeen]
  );

  const step = STEPS[currentIndex];
  const isLast = currentIndex === STEPS.length - 1;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        {currentIndex > 0 ? (
          <Pressable style={styles.navBtn} onPress={handleBack} hitSlop={8}>
            <Feather name="arrow-left" size={20} color={COLORS.textMuted} />
          </Pressable>
        ) : (
          <View style={styles.navBtn} />
        )}

        <Text style={styles.headerLabel}>Interactive Tour</Text>

        <Pressable style={styles.navBtn} onPress={finish} hitSlop={8}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>

      {/* FlatList (hidden — used only for scroll state tracking) */}
      <FlatList
        ref={flatRef}
        data={STEPS}
        keyExtractor={(s) => s.id}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={{ position: 'absolute', opacity: 0, height: 0 }}
        renderItem={() => null}
      />

      {/* Main content area */}
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Illustration */}
        <View style={[styles.illuWrap, { backgroundColor: COLORS[step.dimKey], borderColor: COLORS[step.colorKey] + '30' }]}>
          <step.Illustration accent={COLORS[step.colorKey]} dim={COLORS[step.dimKey]} />
        </View>

        {/* Step badge */}
        <View style={[styles.stepBadge, { backgroundColor: COLORS[step.dimKey], borderColor: COLORS[step.colorKey] + '50' }]}>
          <Text style={[styles.stepBadgeText, { color: COLORS[step.colorKey] }]}>
            {step.emoji}  {step.subtitle}
          </Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>{step.title}</Text>

        {/* Body */}
        <Text style={styles.body}>{step.body}</Text>

        {/* CTA */}
        {step.cta && (
          <Pressable
            style={[styles.ctaBtn, { borderColor: COLORS[step.colorKey] + '60', backgroundColor: COLORS[step.dimKey] }]}
            onPress={() => handleCta(step.cta!.route)}
          >
            <Text style={[styles.ctaText, { color: COLORS[step.colorKey] }]}>{step.cta.label}</Text>
            <Feather name="arrow-right" size={14} color={COLORS[step.colorKey]} />
          </Pressable>
        )}
      </Animated.View>

      {/* Progress dots */}
      <View style={styles.dotsRow}>
        {STEPS.map((_, i) => (
          <Pressable key={i} onPress={() => goToIndex(i)} hitSlop={6}>
            <View
              style={[
                styles.dot,
                i === currentIndex
                  ? { backgroundColor: COLORS[step.colorKey], width: 20 }
                  : { backgroundColor: COLORS.border, width: 8 },
              ]}
            />
          </Pressable>
        ))}
      </View>

      {/* Next / Finish button */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.nextBtn, { backgroundColor: COLORS[step.colorKey] }]}
          onPress={handleNext}
        >
          <Text style={styles.nextText}>{isLast ? 'Start using NoGoon' : 'Next'}</Text>
          {!isLast && <Feather name="arrow-right" size={18} color="#fff" />}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ─── Illustration styles ──────────────────────────────────────────────────────

const ill = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    width: '100%',
  } as ViewStyle,

  // Blocklist
  shieldWrap: { marginBottom: SPACING.xs } as ViewStyle,
  shield: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  list: { gap: SPACING.xs, width: '90%' } as ViewStyle,
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  } as ViewStyle,
  dot: { width: 8, height: 8, borderRadius: 4 } as ViewStyle,
  rowText: { flex: 1, fontFamily: FONTS.mono, fontSize: 12 } as TextStyle,

  // Gate
  breathCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  gateLabel: { fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' } as TextStyle,
  dotsRow: { flexDirection: 'row', gap: SPACING.sm } as ViewStyle,
  progressDot: { width: 8, height: 8, borderRadius: 4 } as ViewStyle,
  domainChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  } as ViewStyle,
  domainText: { fontFamily: FONTS.mono, fontSize: 12 } as TextStyle,

  // Arcade
  gameGrid: { gap: 4 } as ViewStyle,
  gameRow: { flexDirection: 'row', gap: 4 } as ViewStyle,
  gameTile: { width: 36, height: 36, borderRadius: RADIUS.xs } as ViewStyle,
  gameLabel: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    marginTop: SPACING.sm,
  } as ViewStyle,
  gameLabelText: { fontFamily: FONTS.mono, fontSize: 11 } as TextStyle,

  // Walk Away
  walkAwayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.xl,
  } as ViewStyle,
  walkAwayText: { color: '#fff', fontFamily: FONTS.bodyBold, fontSize: 15 } as TextStyle,
  confetti: { position: 'absolute', width: 8, height: 8, borderRadius: 4 } as ViewStyle,
  statRow: { flexDirection: 'row', gap: SPACING.md } as ViewStyle,
  statChip: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  } as ViewStyle,
  statNum: { fontFamily: FONTS.display, fontSize: 22 } as TextStyle,
  statLabel: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 0.5 } as TextStyle,

  // Focus
  focusCard: {
    width: '85%',
    alignItems: 'center',
    padding: SPACING.xl,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.sm,
  } as ViewStyle,
  focusTime: { fontFamily: FONTS.display, fontSize: 32, letterSpacing: -0.5 } as TextStyle,
  focusLabel: { fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' } as TextStyle,
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
  } as ViewStyle,
  progressFill: { width: '100%', height: 6, borderRadius: 3 } as ViewStyle,
  focusBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    marginTop: SPACING.xs,
  } as ViewStyle,
  focusBadgeText: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 0.5 } as TextStyle,

  // VPN
  layerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    width: '90%',
  } as ViewStyle,
  layerIcon: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  layerLabel: { flex: 1, fontFamily: FONTS.body, fontSize: 13 } as TextStyle,
  onBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.xs } as ViewStyle,
  onText: { fontFamily: FONTS.monoBold, fontSize: 10, letterSpacing: 1 } as TextStyle,

  // Intention
  intentionCard: {
    width: '85%',
    padding: SPACING.xl,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.md,
  } as ViewStyle,
  intentionTime: { fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' } as TextStyle,
  intentionGoal: { fontFamily: FONTS.display, fontSize: 20, letterSpacing: -0.2 } as TextStyle,
  intentionTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  } as ViewStyle,
  intentionTagText: { fontFamily: FONTS.mono, fontSize: 11 } as TextStyle,

  // Insights
  chartWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 80 } as ViewStyle,
  barCol: { alignItems: 'center', gap: 4 } as ViewStyle,
  bar: { width: 22, borderRadius: 4, minHeight: 4 } as ViewStyle,
  barLabel: { fontFamily: FONTS.mono, fontSize: 10 } as TextStyle,
  insightChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    marginTop: SPACING.sm,
  } as ViewStyle,
  insightText: { fontFamily: FONTS.mono, fontSize: 11 } as TextStyle,

  // Wind-down
  moonCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  scheduleCard: {
    width: '80%',
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.sm,
  } as ViewStyle,
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm } as ViewStyle,
  scheduleText: { fontFamily: FONTS.body, fontSize: 13 } as TextStyle,
  scheduleTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    marginTop: SPACING.xs,
  } as ViewStyle,
  scheduleTagText: { fontFamily: FONTS.mono, fontSize: 11 } as TextStyle,

  // Loot
  chestWrap: { alignItems: 'center', position: 'relative' } as ViewStyle,
  chestGlow: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    top: -10,
  } as ViewStyle,
  lootRow: { flexDirection: 'row', gap: SPACING.md } as ViewStyle,
  lootItem: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
});

// ─── Screen styles ────────────────────────────────────────────────────────────

const makeStyles = (COLORS: ArcadeColors) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  navBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 15,
    color: COLORS.textSecondary,
  },

  skipText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
  },

  content: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    gap: SPACING.md,
  },

  illuWrap: {
    height: 220,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },

  stepBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },

  stepBadgeText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 0.5,
  },

  title: {
    fontFamily: FONTS.display,
    fontSize: 26,
    letterSpacing: -0.3,
    color: COLORS.textPrimary,
    lineHeight: 32,
  },

  body: {
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 24,
    color: COLORS.textSecondary,
  },

  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },

  ctaText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
  },

  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
  },

  dot: {
    height: 8,
    borderRadius: 4,
  },

  footer: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
  },

  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.xl,
  },

  nextText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: '#fff',
  },
});
