// ═══════════════════════════════════════════════════════════════════════════
// NoGoon INTERACTIVE TUTORIAL
// ─────────────────────────────
// 10-step swipeable walkthrough covering every major feature.
// Each step has an animated visual mockup, a plain-English explanation,
// and a "Try It" deep-link to the relevant screen.
//
// Entry points:
//   • help.tsx → "Take the Tour" button
//   • Auto-shown after onboarding (when hasSeenTutorial is false)
//
// Completion: markTutorialSeen() persisted via useUserStore.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  FlatList,
  Animated,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { useUserStore } from '@/stores/useUserStore';

const { width: SCREEN_W } = Dimensions.get('window');
const C = COLORS;

// ─── Step definitions ─────────────────────────────────────────────────────────

type Step = {
  id: string;
  emoji: string;
  accentColor: string;
  accentDim: string;
  title: string;
  subtitle: string;
  body: string;
  cta?: { label: string; route: Href };
  Illustration: React.FC<{ accent: string; dim: string }>;
};

// ─── Illustrations ────────────────────────────────────────────────────────────
// Each is a lightweight React component drawing a stylised mockup with Views.

const BlocklistIllustration: React.FC<{ accent: string; dim: string }> = ({ accent, dim }) => {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  const rows = ['instagram.com', 'tiktok.com', 'twitter.com'];
  return (
    <View style={ill.container}>
      <Animated.View style={[ill.shieldWrap, { opacity }]}>
        <View style={[ill.shield, { backgroundColor: dim, borderColor: accent }]}>
          <Feather name="shield" size={36} color={accent} />
        </View>
      </Animated.View>
      <View style={ill.list}>
        {rows.map((r, i) => (
          <View key={i} style={[ill.row, { backgroundColor: C.surface, borderColor: C.cardBorder }]}>
            <View style={[ill.dot, { backgroundColor: accent }]} />
            <Text style={[ill.rowText, { color: C.textSecondary }]}>{r}</Text>
            <Feather name="x" size={14} color={C.textMuted} />
          </View>
        ))}
      </View>
    </View>
  );
};

const GateIllustration: React.FC<{ accent: string; dim: string }> = ({ accent, dim }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.08, duration: 1400, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 1400, useNativeDriver: true }),
      ])
    ).start();
    const dotAnim = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    dotAnim(dot1, 0);
    dotAnim(dot2, 200);
    dotAnim(dot3, 400);
  }, [scale, dot1, dot2, dot3]);

  return (
    <View style={[ill.container, { gap: SPACING.md }]}>
      <Animated.View style={[ill.breathCircle, { backgroundColor: dim, borderColor: accent, transform: [{ scale }] }]}>
        <Feather name="wind" size={32} color={accent} />
      </Animated.View>
      <Text style={[ill.gateLabel, { color: C.textMuted }]}>breathe</Text>
      <View style={ill.dotsRow}>
        {[dot1, dot2, dot3].map((d, i) => (
          <Animated.View key={i} style={[ill.progressDot, { backgroundColor: accent, opacity: d }]} />
        ))}
      </View>
      <View style={[ill.domainChip, { backgroundColor: dim, borderColor: accent }]}>
        <Text style={[ill.domainText, { color: accent }]}>instagram.com</Text>
      </View>
    </View>
  );
};

const ArcadeIllustration: React.FC<{ accent: string; dim: string }> = ({ accent, dim }) => {
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(slide, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.delay(400),
        Animated.timing(slide, { toValue: 0, duration: 600, useNativeDriver: true }),
        Animated.delay(400),
      ])
    ).start();
  }, [slide]);

  const tiles = [
    ['#388E3C', '#2E7D32', '#1B5E20'],
    ['#00796B', '#388E3C', '#2E7D32'],
    ['#2E7D32', '#1B5E20', '#388E3C'],
  ];

  return (
    <View style={ill.container}>
      <View style={ill.gameGrid}>
        {tiles.map((row, ri) => (
          <View key={ri} style={ill.gameRow}>
            {row.map((color, ci) => (
              <Animated.View
                key={ci}
                style={[
                  ill.gameTile,
                  {
                    backgroundColor: color,
                    transform: [
                      { scale: slide.interpolate({ inputRange: [0, 1], outputRange: [1, ri === 1 && ci === 1 ? 1.15 : 1] }) },
                    ],
                  },
                ]}
              />
            ))}
          </View>
        ))}
      </View>
      <View style={[ill.gameLabel, { backgroundColor: dim, borderColor: accent }]}>
        <Text style={[ill.gameLabelText, { color: accent }]}>15 games available</Text>
      </View>
    </View>
  );
};

const WalkAwayIllustration: React.FC<{ accent: string; dim: string }> = ({ accent, dim }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const confettiAnims = Array.from({ length: 6 }, () => ({
    y: useRef(new Animated.Value(0)).current,
    x: useRef(new Animated.Value(0)).current,
    op: useRef(new Animated.Value(0)).current,
  }));

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(scale, { toValue: 1.1, duration: 200, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }),
      ])
    ).start();

    confettiAnims.forEach((a, i) => {
      const angle = (i / 6) * Math.PI * 2;
      const dx = Math.cos(angle) * 40;
      const dy = Math.sin(angle) * 40;
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 100),
          Animated.parallel([
            Animated.timing(a.x, { toValue: dx, duration: 600, useNativeDriver: true }),
            Animated.timing(a.y, { toValue: dy, duration: 600, useNativeDriver: true }),
            Animated.timing(a.op, { toValue: 1, duration: 300, useNativeDriver: true }),
          ]),
          Animated.timing(a.op, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.parallel([
            Animated.timing(a.x, { toValue: 0, duration: 0, useNativeDriver: true }),
            Animated.timing(a.y, { toValue: 0, duration: 0, useNativeDriver: true }),
          ]),
          Animated.delay(800),
        ])
      ).start();
    });
  }, [scale]);

  const confettiColors = [accent, C.green, C.cyan, C.purple, '#6D28D9', C.warning];

  return (
    <View style={ill.container}>
      <View style={{ alignItems: 'center', justifyContent: 'center', height: 120 }}>
        {confettiAnims.map((a, i) => (
          <Animated.View
            key={i}
            style={[
              ill.confetti,
              {
                backgroundColor: confettiColors[i % confettiColors.length],
                opacity: a.op,
                transform: [{ translateX: a.x }, { translateY: a.y }],
              },
            ]}
          />
        ))}
        <Animated.View style={[ill.walkAwayBtn, { backgroundColor: accent, transform: [{ scale }] }]}>
          <Feather name="log-out" size={20} color="#fff" />
          <Text style={ill.walkAwayText}>Walk Away</Text>
        </Animated.View>
      </View>
      <View style={ill.statRow}>
        <View style={[ill.statChip, { backgroundColor: dim }]}>
          <Text style={[ill.statNum, { color: accent }]}>47</Text>
          <Text style={[ill.statLabel, { color: C.textMuted }]}>walk-aways</Text>
        </View>
        <View style={[ill.statChip, { backgroundColor: dim }]}>
          <Text style={[ill.statNum, { color: accent }]}>12</Text>
          <Text style={[ill.statLabel, { color: C.textMuted }]}>day streak</Text>
        </View>
      </View>
    </View>
  );
};

const FocusIllustration: React.FC<{ accent: string; dim: string }> = ({ accent, dim }) => {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(progress, { toValue: 1, duration: 3000, useNativeDriver: false }),
        Animated.timing(progress, { toValue: 0, duration: 500, useNativeDriver: false }),
      ])
    ).start();
  }, [progress]);
  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={ill.container}>
      <View style={[ill.focusCard, { backgroundColor: C.surface, borderColor: C.cardBorder }]}>
        <Feather name="clock" size={28} color={accent} />
        <Text style={[ill.focusTime, { color: C.textPrimary }]}>45:00</Text>
        <Text style={[ill.focusLabel, { color: C.textMuted }]}>Focus Session</Text>
        <View style={ill.progressTrack}>
          <Animated.View style={[ill.progressFill, { width: barWidth, backgroundColor: accent }]} />
        </View>
        <View style={[ill.focusBadge, { backgroundColor: dim, borderColor: accent }]}>
          <Text style={[ill.focusBadgeText, { color: accent }]}>Blocking paused</Text>
        </View>
      </View>
    </View>
  );
};

const VpnIllustration: React.FC<{ accent: string; dim: string }> = ({ accent, dim }) => {
  const flash = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(flash, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [flash]);

  const layers = [
    { icon: 'wifi' as const, label: 'VPN DNS filter' },
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
            { backgroundColor: C.surface, borderColor: C.cardBorder, opacity: flash.interpolate({ inputRange: [0.4, 1], outputRange: [0.6 + i * 0.15, 1] }) },
          ]}
        >
          <View style={[ill.layerIcon, { backgroundColor: dim }]}>
            <Feather name={l.icon} size={16} color={accent} />
          </View>
          <Text style={[ill.layerLabel, { color: C.textSecondary }]}>{l.label}</Text>
          <View style={[ill.onBadge, { backgroundColor: dim }]}>
            <Text style={[ill.onText, { color: accent }]}>ON</Text>
          </View>
        </Animated.View>
      ))}
    </View>
  );
};

const IntentionIllustration: React.FC<{ accent: string; dim: string }> = ({ accent, dim }) => {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(fade, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.delay(2000),
        Animated.timing(fade, { toValue: 0, duration: 1000, useNativeDriver: true }),
        Animated.delay(500),
      ])
    ).start();
  }, [fade]);

  return (
    <View style={ill.container}>
      <View style={[ill.intentionCard, { backgroundColor: C.surface, borderColor: accent + '60' }]}>
        <Text style={[ill.intentionTime, { color: C.textMuted }]}>Today's intention</Text>
        <Animated.Text style={[ill.intentionGoal, { color: C.textPrimary, opacity: fade }]}>
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
  const bars = [5, 3, 8, 2, 11, 7, 9];
  const anims = bars.map(() => useRef(new Animated.Value(0)).current);

  useEffect(() => {
    Animated.stagger(
      120,
      anims.map((a, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(a, { toValue: bars[i], duration: 800, useNativeDriver: false }),
            Animated.delay(1500),
            Animated.timing(a, { toValue: 0, duration: 400, useNativeDriver: false }),
            Animated.delay(200),
          ])
        )
      )
    ).start();
  }, []);

  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const maxH = 60;

  return (
    <View style={ill.container}>
      <View style={ill.chartWrap}>
        {bars.map((_, i) => (
          <View key={i} style={ill.barCol}>
            <Animated.View
              style={[
                ill.bar,
                {
                  backgroundColor: accent,
                  height: anims[i].interpolate({ inputRange: [0, 11], outputRange: [4, maxH] }),
                },
              ]}
            />
            <Text style={[ill.barLabel, { color: C.textMuted }]}>{dayLabels[i]}</Text>
          </View>
        ))}
      </View>
      <View style={[ill.insightChip, { backgroundColor: dim, borderColor: accent + '40' }]}>
        <Text style={[ill.insightText, { color: accent }]}>Peak urge: 9–10 PM</Text>
      </View>
    </View>
  );
};

const WindDownIllustration: React.FC<{ accent: string; dim: string }> = ({ accent, dim }) => {
  const moonGlow = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(moonGlow, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(moonGlow, { toValue: 0.6, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, [moonGlow]);

  return (
    <View style={ill.container}>
      <Animated.View style={[ill.moonCircle, { backgroundColor: dim, borderColor: accent, opacity: moonGlow }]}>
        <Text style={{ fontSize: 36 }}>🌙</Text>
      </Animated.View>
      <View style={[ill.scheduleCard, { backgroundColor: C.surface, borderColor: C.cardBorder }]}>
        <View style={ill.scheduleRow}>
          <Feather name="clock" size={14} color={accent} />
          <Text style={[ill.scheduleText, { color: C.textSecondary }]}>Starts at 9:00 PM</Text>
        </View>
        <View style={ill.scheduleRow}>
          <Feather name="sun" size={14} color={C.textMuted} />
          <Text style={[ill.scheduleText, { color: C.textMuted }]}>Ends at 8:00 AM</Text>
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
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: -8, duration: 500, useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.delay(1000),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(sparkle, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(sparkle, { toValue: 0, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, [bounce, sparkle]);

  const items = ['🎨', '🌟', '🏆', '⚡'];

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

// ─── Steps ────────────────────────────────────────────────────────────────────

const STEPS: Step[] = [
  {
    id: 'blocklist',
    emoji: '🛡️',
    accentColor: C.purple,
    accentDim: C.purpleDim,
    title: 'Block what pulls you in',
    subtitle: 'Step 1 of 9',
    body: 'Add any app or website to your blocklist. The moment you open one, NoGoon steps in before the habit loop fires.\n\nTap the + on the Block tab to add your first site.',
    cta: { label: 'Open Blocklist', route: '/(tabs)/blocklist' },
    Illustration: BlocklistIllustration,
  },
  {
    id: 'gate',
    emoji: '🌬️',
    accentColor: C.indigoBright,
    accentDim: C.indigoDim,
    title: 'The intercept screen',
    subtitle: 'Step 2 of 9',
    body: 'When you open a blocked app, you get a 3-second breathing pause. A calm moment before the craving hits full force.\n\nMost urges peak and pass in under 90 seconds — the pause is the product.',
    Illustration: GateIllustration,
  },
  {
    id: 'arcade',
    emoji: '🎮',
    accentColor: C.arcade,
    accentDim: C.arcadeDim,
    title: 'Play a game instead',
    subtitle: 'Step 3 of 9',
    body: 'After the pause, you\'re offered a quick game — 2048, Snake, WordWeave, BallSort, and 11 more. They redirect the dopamine hit.\n\nYou choose whether to unlock the app or walk away when the game ends.',
    cta: { label: 'Browse the Arcade', route: '/(tabs)/arcade' },
    Illustration: ArcadeIllustration,
  },
  {
    id: 'walkaway',
    emoji: '🚶',
    accentColor: C.green,
    accentDim: C.greenDim,
    title: 'Walk Away wins every time',
    subtitle: 'Step 4 of 9',
    body: 'Walk Away is always the primary button after a game. Each walk-away earns XP, builds your streak, and goes in your lifetime total.\n\nThe walk-away count is the only metric that matters — it\'s how many times the app actually worked.',
    Illustration: WalkAwayIllustration,
  },
  {
    id: 'focus',
    emoji: '⏱️',
    accentColor: C.cyan,
    accentDim: C.cyanDim,
    title: 'Focus Session',
    subtitle: 'Step 5 of 9',
    body: 'Need to work without interruption? Start a Focus Session to pause blocking for a set time. It expires automatically — no willpower required to end it.\n\nFind it on the Home screen or via the Quick Settings tile.',
    cta: { label: 'Go to Home', route: '/' },
    Illustration: FocusIllustration,
  },
  {
    id: 'protection',
    emoji: '🔐',
    accentColor: C.purple,
    accentDim: C.purpleDim,
    title: 'Three layers of protection',
    subtitle: 'Step 6 of 9',
    body: 'NoGoon has three independent blocking layers: the Accessibility Service (app-level), a VPN DNS filter (network-level), and a Notification Listener (push-level).\n\nEnable all three on the Protection screen for airtight coverage.',
    cta: { label: 'Protection Settings', route: '/protection' },
    Illustration: VpnIllustration,
  },
  {
    id: 'intention',
    emoji: '🎯',
    accentColor: C.indigoBright,
    accentDim: C.indigoDim,
    title: 'Daily Intention',
    subtitle: 'Step 7 of 9',
    body: 'Set a short intention each morning — what you\'re protecting your focus for. It shows up quietly on the gate screen as a reminder of your own words.\n\nNot a rule. Just a nudge from past-you to present-you.',
    cta: { label: 'Set Today\'s Intention', route: '/' },
    Illustration: IntentionIllustration,
  },
  {
    id: 'insights',
    emoji: '📊',
    accentColor: C.cyan,
    accentDim: C.cyanDim,
    title: 'Track your patterns',
    subtitle: 'Step 8 of 9',
    body: 'The Insights screen shows your daily walk-aways for the past week, your peak distraction hour, and how you felt after each intercept.\n\nSpots emerge quickly — most people find a 2-hour window that accounts for most of their scrolling.',
    cta: { label: 'View Insights', route: '/insights' },
    Illustration: InsightsIllustration,
  },
  {
    id: 'winddown',
    emoji: '🌙',
    accentColor: C.indigo,
    accentDim: 'rgba(27,94,32,0.15)',
    title: 'Wind-down Mode',
    subtitle: 'Step 9 of 9',
    body: 'Schedule automatic quiet hours. After your cutoff, NoGoon ramps up friction on every blocked site — harder games, longer pauses, fewer escape routes.\n\nSet it once on your Profile and stop negotiating with yourself at night.',
    cta: { label: 'Open Profile', route: '/(tabs)/profile' },
    Illustration: WindDownIllustration,
  },
];

// ─── Tutorial screen ──────────────────────────────────────────────────────────

export default function TutorialScreen() {
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
            <Feather name="arrow-left" size={20} color={C.textMuted} />
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
        <View style={[styles.illuWrap, { backgroundColor: step.accentDim, borderColor: step.accentColor + '30' }]}>
          <step.Illustration accent={step.accentColor} dim={step.accentDim} />
        </View>

        {/* Step badge */}
        <View style={[styles.stepBadge, { backgroundColor: step.accentDim, borderColor: step.accentColor + '50' }]}>
          <Text style={[styles.stepBadgeText, { color: step.accentColor }]}>
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
            style={[styles.ctaBtn, { borderColor: step.accentColor + '60', backgroundColor: step.accentDim }]}
            onPress={() => handleCta(step.cta!.route)}
          >
            <Text style={[styles.ctaText, { color: step.accentColor }]}>{step.cta.label}</Text>
            <Feather name="arrow-right" size={14} color={step.accentColor} />
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
                  ? { backgroundColor: step.accentColor, width: 20 }
                  : { backgroundColor: C.border, width: 8 },
              ]}
            />
          </Pressable>
        ))}
      </View>

      {/* Next / Finish button */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.nextBtn, { backgroundColor: step.accentColor }]}
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
  progressFill: { height: 6, borderRadius: 3 } as ViewStyle,
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

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.background,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
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
    color: C.textSecondary,
  },

  skipText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: C.textMuted,
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
    color: C.textPrimary,
    lineHeight: 32,
  },

  body: {
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 24,
    color: C.textSecondary,
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
