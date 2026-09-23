// ═══════════════════════════════════════════════════════════════════════════
//  ODD ONE OUT — Pro Game (Mario Party style)
//  ──────────────────────────────────────────
//  Three "ads" are shown side by side. Two are identical. One has a subtle
//  difference. The user must tap the odd one out.
//
//  WHY IT WORKS AS A PATTERN INTERRUPT:
//  This game teaches ad literacy — the ability to notice manipulation.
//  The differences are designed to mirror real dark patterns (fake urgency,
//  misleading buttons, price tricks). It's a mindfulness tool disguised
//  as a game. After playing, users are more skeptical of what they see online.
//
//  5 ROUNDS — gets harder each round (more subtle differences)
//
//  SCORING:
//    Correct: +20 pts per round  (max 100 pts)
//    Wrong:    +0 pts (no penalty — learning is the reward)
//
//  The "ads" are rendered as styled React Native Views, not images,
//  so they work offline and are fully customizable.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
  ScrollView,
  Animated,
  Linking,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { FONTS } from '@/constants/Colors';
import { useThemedColors, type ArcadeColors } from '@/hooks/useThemedColors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { ProceedButton } from '@/components/ui/ProceedButton';
import { fetchAdForPlacement, trackAdEvent, type AdCampaign } from '@/services/ads';

// ─── Ad data types ────────────────────────────────────────────────────────────

// Each "ad" is described by its visual fields
interface AdData {
  brand: string;           // Top brand name
  headline: string;        // Main headline text
  subtext: string;         // Secondary line below headline
  buttonLabel: string;     // CTA button label
  buttonColor: string;     // CTA button background color
  badgeText?: string;      // Optional badge (e.g. "LIMITED TIME!")
  price?: string;          // Optional price display
  rating?: string;         // Optional star rating string
}

// Each round defines a "base" ad, an "odd" ad (with one field changed),
// and which position (0, 1, or 2) the odd one is in.
interface RoundData {
  label: string;                  // What to look for (shown as hint if desired)
  difficulty: 'easy' | 'medium' | 'hard';
  base: AdData;                   // The "normal" ad (shown twice)
  odd: AdData;                    // The slightly different ad
  oddPosition: 0 | 1 | 2;        // Which of the 3 slots has the odd one
  explanation: string;            // Shown after answering — explains the dark pattern
}

// ─── Round definitions ────────────────────────────────────────────────────────
// 5 rounds, increasing subtlety. Each teaches a real advertising dark pattern.

const ROUNDS: RoundData[] = [
  // Round 1 — Easy: fake countdown badge
  {
    label: 'Spot the fake urgency',
    difficulty: 'easy',
    base: {
      brand: 'SHOPMAX',
      headline: 'Summer Sale',
      subtext: '40% off everything',
      buttonLabel: 'Shop Now',
      buttonColor: '#e74c3c',
      price: '$19.99',
    },
    odd: {
      brand: 'SHOPMAX',
      headline: 'Summer Sale',
      subtext: '40% off everything',
      buttonLabel: 'Shop Now',
      buttonColor: '#e74c3c',
      price: '$19.99',
      badgeText: 'ENDS IN 2 HRS!',   // ← The difference: fake urgency badge
    },
    oddPosition: 1,
    explanation: '"Ends in 2 hours!" is a classic fake urgency tactic. The deal never actually ends.',
  },

  // Round 2 — Easy: different button label
  {
    label: 'Which button tricks you?',
    difficulty: 'easy',
    base: {
      brand: 'STREAMFLIX',
      headline: 'Watch Anything',
      subtext: 'Start your free trial',
      buttonLabel: 'Try Free',
      buttonColor: '#8e44ad',
      rating: '★★★★★',
    },
    odd: {
      brand: 'STREAMFLIX',
      headline: 'Watch Anything',
      subtext: 'Start your free trial',
      buttonLabel: 'Subscribe',    // ← "Subscribe" vs "Try Free" — skips trial framing
      buttonColor: '#8e44ad',
      rating: '★★★★★',
    },
    oddPosition: 2,
    explanation: 'Changing "Try Free" to "Subscribe" hides that you\'re signing up for a paid plan.',
  },

  // Round 3 — Medium: subtle price difference
  {
    label: 'Find the price trick',
    difficulty: 'medium',
    base: {
      brand: 'ProApp™',
      headline: 'Go Premium',
      subtext: 'Unlock all features',
      buttonLabel: 'Get Premium',
      buttonColor: '#2980b9',
      price: '$4.99/mo',
      badgeText: 'POPULAR',
    },
    odd: {
      brand: 'ProApp™',
      headline: 'Go Premium',
      subtext: 'Unlock all features',
      buttonLabel: 'Get Premium',
      buttonColor: '#2980b9',
      price: '$4.99/wk',           // ← /wk not /mo — 4x more expensive!
      badgeText: 'POPULAR',
    },
    oddPosition: 0,
    explanation: '$4.99/week = ~$260/year. The same number looks cheap but means something very different.',
  },

  // Round 4 — Medium: different star rating
  {
    label: 'Which rating is manipulated?',
    difficulty: 'medium',
    base: {
      brand: 'GLOWSKIN',
      headline: 'Clear Skin Fast',
      subtext: 'Dermatologist approved',
      buttonLabel: 'Buy Now',
      buttonColor: '#e67e22',
      rating: '★★★★☆',
      price: '$29',
    },
    odd: {
      brand: 'GLOWSKIN',
      headline: 'Clear Skin Fast',
      subtext: 'Dermatologist approved',
      buttonLabel: 'Buy Now',
      buttonColor: '#e67e22',
      rating: '★★★★★',            // ← Full 5 stars — vs 4 stars on base
      price: '$29',
    },
    oddPosition: 1,
    explanation: 'One ad shows 4 stars, one shows 5. Ratings are routinely inflated or faked in ads.',
  },

  // Round 5 — Hard: misleading button color (red = stop, but used as CTA)
  {
    label: 'Spot the color trick',
    difficulty: 'hard',
    base: {
      brand: 'LEANFIT',
      headline: 'Lose Weight Fast',
      subtext: 'Join 1M+ members today',
      buttonLabel: 'Cancel Anytime',
      buttonColor: '#27ae60',       // Green = safe, go, yes
      rating: '★★★★½',
      badgeText: 'FREE TRIAL',
    },
    odd: {
      brand: 'LEANFIT',
      headline: 'Lose Weight Fast',
      subtext: 'Join 1M+ members today',
      buttonLabel: 'Cancel Anytime',
      buttonColor: '#c0392b',       // ← Red = stop/danger — but used as main CTA button
      rating: '★★★★½',
      badgeText: 'FREE TRIAL',
    },
    oddPosition: 2,
    explanation: 'Red buttons subconsciously suggest "stop" — but ads use them anyway because they get more clicks through contrast.',
  },
];

// ─── Ad Card Component ────────────────────────────────────────────────────────
// Renders a single mini "ad" as a styled View.

interface AdCardProps {
  ad: AdData;
  position: number;
  onPress: (position: number) => void;
  result: 'correct' | 'wrong' | 'revealed' | null; // feedback state
  answered: boolean;
  styles: ReturnType<typeof makeStyles>;
  COLORS: ArcadeColors;
}

function AdCard({ ad, position, onPress, result, answered, styles, COLORS }: AdCardProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (answered) return;
    Animated.timing(scale, { toValue: 0.95, duration: 80, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, damping: 10, stiffness: 200, useNativeDriver: true }).start();
  };

  // Border color based on result state
  const borderColor =
    result === 'correct'  ? COLORS.green :
    result === 'wrong'    ? COLORS.danger :
    result === 'revealed' ? COLORS.green :
    COLORS.cardBorder;

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={() => !answered && onPress(position)}
      disabled={answered}
      style={styles.adCardPressable}
    >
      <Animated.View
        style={[
          styles.adCard,
          { borderColor },
          result === 'correct'  && styles.adCardCorrect,
          result === 'wrong'    && styles.adCardWrong,
          result === 'revealed' && styles.adCardRevealed,
          { transform: [{ scale }] },
        ]}
      >
        {/* The one they missed -- render this first so it's the first thing the
            eye hits, not a faint border they have to go looking for. */}
        {result === 'revealed' && (
          <View style={styles.revealedBadge}>
            <Text style={styles.revealedBadgeText}>✓ MISSED THIS ONE</Text>
          </View>
        )}

        {/* Optional badge */}
        {ad.badgeText && (
          <View style={styles.adBadge}>
            <Text style={styles.adBadgeText}>{ad.badgeText}</Text>
          </View>
        )}

        {/* Brand name */}
        <Text style={styles.adBrand}>{ad.brand}</Text>

        {/* Headline */}
        <Text style={styles.adHeadline}>{ad.headline}</Text>

        {/* Sub-text */}
        <Text style={styles.adSubtext}>{ad.subtext}</Text>

        {/* Optional rating */}
        {ad.rating && (
          <Text style={styles.adRating}>{ad.rating}</Text>
        )}

        {/* Optional price */}
        {ad.price && (
          <Text style={styles.adPrice}>{ad.price}</Text>
        )}

        {/* CTA Button */}
        <View style={[styles.adButton, { backgroundColor: ad.buttonColor }]}>
          <Text style={styles.adButtonText}>{ad.buttonLabel}</Text>
        </View>

        {/* Result indicator overlay */}
        {result === 'correct' && (
          <View style={styles.resultOverlay}>
            <Text style={styles.resultOverlayEmoji}>✅</Text>
          </View>
        )}
        {result === 'wrong' && (
          <View style={styles.resultOverlay}>
            <Text style={styles.resultOverlayEmoji}>❌</Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onComplete: (score: number) => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function OddOneOut({ onComplete }: Props) {
  const COLORS = useThemedColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [gamePhase, setGamePhase] = useState<'intro' | 'playing' | 'complete'>('intro');
  const [roundIndex, setRoundIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);

  // Which position the user tapped (-1 = none yet)
  const [selectedPos, setSelectedPos] = useState(-1);

  // Total correct answers
  const [correctCount, setCorrectCount] = useState(0);

  // ── Sponsored round ───────────────────────────────────────────────────────
  // Loaded async on mount. Inserted as round 0 if a campaign is live.
  // sponsoredPos: which of the 3 cards is the real (honest) brand ad.

  const [sponsoredCampaign, setSponsoredCampaign] = useState<AdCampaign | null>(null);
  const [sponsoredPos]  = useState<0 | 1 | 2>(() => (Math.floor(Math.random() * 3) as 0 | 1 | 2));
  const sponsoredTrackedRef = useRef(false);

  useEffect(() => {
    fetchAdForPlacement('odd_one_out').then((campaign) => {
      if (campaign) {
        setSponsoredCampaign(campaign);
        trackAdEvent('impression', campaign.id, 'odd_one_out');
      }
    });
  }, []);

  // Total rounds = base ROUNDS + 1 if sponsored
  const totalRounds = ROUNDS.length + (sponsoredCampaign ? 1 : 0);

  // roundIndex 0 = sponsored (if live), then ROUNDS[0..4]
  const isSponsoredRound = sponsoredCampaign !== null && roundIndex === 0;
  const baseRoundIndex   = sponsoredCampaign ? roundIndex - 1 : roundIndex;
  const round = isSponsoredRound ? null : ROUNDS[baseRoundIndex];

  // ── Build the 3 ads for this round ────────────────────────────────────────

  const DARK_PATTERN_ADS: AdData[] = [
    {
      brand: 'LIMITD', headline: 'Last Chance!',
      subtext: 'Only 3 left in stock',
      buttonLabel: 'Buy Now', buttonColor: '#dc2626',
      badgeText: 'ENDS IN 9 MINS', price: '$9.99',
    },
    {
      brand: 'KLICKZ', headline: 'Free Forever*',
      subtext: '*Credit card required',
      buttonLabel: 'Claim Free', buttonColor: '#7c3aed',
      badgeText: 'TODAY ONLY',
    },
  ];

  const getSponsoredAdAtPosition = (pos: number): AdData => {
    if (!sponsoredCampaign) return DARK_PATTERN_ADS[0];
    if (pos === sponsoredPos) {
      return {
        brand: sponsoredCampaign.brand_name.toUpperCase(),
        headline: sponsoredCampaign.headline,
        subtext: sponsoredCampaign.subtext,
        buttonLabel: sponsoredCampaign.cta_label,
        buttonColor: sponsoredCampaign.brand_color,
      };
    }
    return DARK_PATTERN_ADS[pos === 0 ? 0 : 1];
  };

  const getAdAtPosition = (pos: number): AdData => {
    if (isSponsoredRound) return getSponsoredAdAtPosition(pos);
    return pos === round!.oddPosition ? round!.odd : round!.base;
  };

  // ── Handle a tap on one of the 3 ads ──────────────────────────────────────

  const handleTap = (position: number) => {
    if (answered) return;
    setSelectedPos(position);
    setAnswered(true);

    if (isSponsoredRound && sponsoredCampaign) {
      const isCorrect = position === sponsoredPos;
      trackAdEvent(
        isCorrect ? 'correct_tap' : 'wrong_tap',
        sponsoredCampaign.id,
        'odd_one_out'
      );
      if (isCorrect) {
        setScore((s) => s + 20);
        setCorrectCount((c) => c + 1);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setScore((s) => s + 10);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      return;
    }

    const isCorrect = position === round!.oddPosition;
    if (isCorrect) {
      setScore((s) => s + 20);
      setCorrectCount((c) => c + 1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setScore((s) => s + 10);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  // ── Advance to next round ──────────────────────────────────────────────────

  const handleNext = () => {
    if (isSponsoredRound && sponsoredCampaign && !sponsoredTrackedRef.current) {
      sponsoredTrackedRef.current = true;
      trackAdEvent('completion', sponsoredCampaign.id, 'odd_one_out');
    }
    if (roundIndex >= totalRounds - 1) {
      setGamePhase('complete');
    } else {
      setRoundIndex((i) => i + 1);
      setAnswered(false);
      setSelectedPos(-1);
    }
  };

  const handleCtaPress = useCallback(() => {
    if (!sponsoredCampaign) return;
    trackAdEvent('cta_click', sponsoredCampaign.id, 'odd_one_out');
    Linking.openURL(sponsoredCampaign.cta_url).catch(() => {});
  }, [sponsoredCampaign]);

  // ── Determine result state for each card ──────────────────────────────────

  const getCardResult = (pos: number): 'correct' | 'wrong' | 'revealed' | null => {
    if (!answered) return null;
    const oddPos = isSponsoredRound ? sponsoredPos : round!.oddPosition;
    if (pos === selectedPos && selectedPos === oddPos) return 'correct';
    if (pos === selectedPos && selectedPos !== oddPos) return 'wrong';
    if (pos === oddPos && selectedPos !== oddPos) return 'revealed';
    return null;
  };

  // ── Difficulty badge color ─────────────────────────────────────────────────

  const difficultyColor = isSponsoredRound
    ? COLORS.cyan
    : round!.difficulty === 'easy'   ? COLORS.green
    : round!.difficulty === 'medium' ? COLORS.warning
    :                                   COLORS.danger;

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER: Intro
  // ══════════════════════════════════════════════════════════════════════════

  if (gamePhase === 'intro') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centeredContainer}>

          <Text style={styles.heroEmoji}>🕵️</Text>
          <Text style={styles.title}>Odd One Out</Text>

          <Text style={styles.subtitle}>
            Three ads appear side by side.{'\n'}
            Two are identical. One is slightly different.{'\n\n'}
            Tap the odd one out.
          </Text>

          <View style={styles.infoCard}>
            <Text style={styles.infoRow}>🎯  5 rounds, gets harder</Text>
            <Text style={styles.infoRow}>💰  +20 pts per correct answer</Text>
            <Text style={styles.infoRow}>🧠  Learn to spot ad tricks</Text>
          </View>

          <Pressable style={styles.startButton} onPress={() => setGamePhase('playing')}>
            <Text style={styles.startButtonText}>Start →</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER: Complete
  // ══════════════════════════════════════════════════════════════════════════

  if (gamePhase === 'complete') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.centeredContainer} bounces={false}>

          <Text style={styles.heroEmoji}>
            {correctCount === ROUNDS.length ? '🏆' : '🕵️'}
          </Text>

          <Text style={styles.title}>
            {correctCount === ROUNDS.length ? 'Ad Detective!' : `${correctCount}/${ROUNDS.length} correct`}
          </Text>

          <View style={styles.scoreCard}>
            <Text style={styles.scoreNumber}>{score}</Text>
            <Text style={styles.scoreLabel}>points earned</Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoRow}>
              💡 Ads use these tricks on millions of people every day. Now you know what to look for.
            </Text>
          </View>

          <ProceedButton
            label="Continue →"
            onPress={() => onComplete(score)}
            style={{ width: '100%' }}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER: Playing
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.playContainer} bounces={false}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.roundCounter}>Round {roundIndex + 1} / {totalRounds}</Text>
            <View style={[styles.difficultyBadge, { borderColor: difficultyColor }]}>
              <Text style={[styles.difficultyText, { color: difficultyColor }]}>
                {isSponsoredRound ? 'SPONSORED' : round!.difficulty.toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={styles.scoreDisplay}>{score} pts</Text>
        </View>

        {/* ── Instruction ── */}
        <Text style={styles.instruction}>
          {isSponsoredRound
            ? 'Which one is the HONEST ad?'
            : 'Which one is different?'}
        </Text>
        {isSponsoredRound && (
          <Text style={styles.sponsoredHint}>
            Two ads use dark patterns. One is upfront about what it is.
          </Text>
        )}

        {/* ── The 3 ad cards ── */}
        <View style={styles.adsRow}>
          {[0, 1, 2].map((pos) => (
            <AdCard
              key={`${roundIndex}-${pos}`}
              ad={getAdAtPosition(pos)}
              position={pos}
              onPress={handleTap}
              result={getCardResult(pos)}
              answered={answered}
              styles={styles}
              COLORS={COLORS}
            />
          ))}
        </View>

        {/* ── Post-answer explanation ── */}
        {answered && isSponsoredRound && sponsoredCampaign ? (
          <View style={[styles.explanationCard, styles.sponsoredCard]}>
            <View style={styles.sponsoredHeader}>
              <Text style={styles.sponsoredEmoji}>
                {sponsoredCampaign.brand_avatar_emoji ?? '✦'}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.sponsoredBrandName}>{sponsoredCampaign.brand_name}</Text>
                {sponsoredCampaign.brand_handle ? (
                  <Text style={styles.sponsoredHandle}>{sponsoredCampaign.brand_handle}</Text>
                ) : null}
              </View>
              <View style={styles.sponsoredBadge}>
                <Text style={styles.sponsoredBadgeText}>Honest Ad</Text>
              </View>
            </View>
            <Text style={styles.explanationTitle}>
              {selectedPos === sponsoredPos ? '✅ You spotted it!' : '❌ Not quite'}
            </Text>
            <Text style={styles.explanationText}>
              {selectedPos === sponsoredPos
                ? `${sponsoredCampaign.brand_name} disclosed this as an ad and made a straightforward pitch — no tricks, no fake urgency.`
                : `The honest one was ${sponsoredCampaign.brand_name}: no hidden fees, no fake urgency — just a clear pitch.`}
            </Text>
            <Pressable
              style={[styles.ctaButton, { backgroundColor: sponsoredCampaign.brand_color }]}
              onPress={handleCtaPress}
            >
              <Text style={styles.ctaButtonText}>{sponsoredCampaign.cta_label} ↗</Text>
            </Pressable>
            <Pressable style={styles.nextButton} onPress={handleNext}>
              <Text style={styles.nextButtonText}>
                {roundIndex >= totalRounds - 1 ? 'See Results →' : 'Next Round →'}
              </Text>
            </Pressable>
          </View>
        ) : answered ? (
          <View style={styles.explanationCard}>
            <Text style={styles.explanationTitle}>
              {selectedPos === round!.oddPosition ? '✅ Correct!' : '❌ Wrong'}
            </Text>
            <Text style={styles.explanationText}>{round!.explanation}</Text>
            <Pressable style={styles.nextButton} onPress={handleNext}>
              <Text style={styles.nextButtonText}>
                {roundIndex >= totalRounds - 1 ? 'See Results →' : 'Next Round →'}
              </Text>
            </Pressable>
          </View>
        ) : null}

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (COLORS: ArcadeColors) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── Intro / Complete screens ──────────────────────────────────────────────
  centeredContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xxl,
    gap: SPACING.lg,
  },

  heroEmoji: {
    fontSize: 72,
    lineHeight: 88,
  },

  title: {
    fontFamily: FONTS.display,
    fontSize: 34,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },

  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
  },

  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.lg,
    width: '100%',
    gap: SPACING.sm,
  },

  infoRow: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 24,
  },

  startButton: {
    backgroundColor: COLORS.purple,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    width: '100%',
    alignItems: 'center',
  },

  startButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 17,
    color: COLORS.background,
  },

  scoreCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: SPACING.xl,
    alignItems: 'center',
    width: '100%',
  },

  scoreNumber: {
    fontFamily: FONTS.monoBold,
    fontSize: 72,
    color: COLORS.purple,
    lineHeight: 84,
  },

  scoreLabel: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textSecondary,
  },

  // ── Playing screen ────────────────────────────────────────────────────────
  playContainer: {
    flexGrow: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
    gap: SPACING.md,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  roundCounter: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: COLORS.textMuted,
  },

  difficultyBadge: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },

  difficultyText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 0.8,
  },

  scoreDisplay: {
    fontFamily: FONTS.monoBold,
    fontSize: 18,
    color: COLORS.purple,
  },

  instruction: {
    fontFamily: FONTS.display,
    fontSize: 20,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },

  // 3 ad cards in a row
  adsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    justifyContent: 'center',
  },

  adCardPressable: {
    flex: 1,
    maxWidth: '32%',
  },

  // The mini ad card itself
  adCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    padding: SPACING.sm,
    gap: 4,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 180,
  },

  adCardCorrect: {
    backgroundColor: COLORS.green + '15',
  },

  adCardWrong: {
    backgroundColor: COLORS.danger + '15',
  },

  adCardRevealed: {
    backgroundColor: COLORS.green + '22',
    borderWidth: 2.5,
  },

  revealedBadge: {
    alignSelf: 'stretch',
    backgroundColor: COLORS.green,
    borderRadius: RADIUS.xs,
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignItems: 'center',
  },

  revealedBadgeText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 8,
    color: '#fff',
    letterSpacing: 0.2,
    textAlign: 'center',
  },

  adBadge: {
    backgroundColor: COLORS.danger,
    borderRadius: RADIUS.xs,
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },

  adBadgeText: {
    fontFamily: FONTS.mono,
    fontSize: 7,
    color: '#fff',
    letterSpacing: 0.3,
  },

  adBrand: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  adHeadline: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.textPrimary,
    lineHeight: 15,
  },

  adSubtext: {
    fontFamily: FONTS.body,
    fontSize: 9,
    color: COLORS.textSecondary,
    lineHeight: 13,
  },

  adRating: {
    fontFamily: FONTS.body,
    fontSize: 10,
    color: COLORS.warning,
  },

  adPrice: {
    fontFamily: FONTS.monoBold,
    fontSize: 12,
    color: COLORS.textPrimary,
  },

  adButton: {
    borderRadius: RADIUS.xs,
    paddingVertical: 5,
    alignItems: 'center',
    marginTop: 4,
  },

  adButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 9,
    color: '#fff',
  },

  resultOverlay: {
    position: 'absolute',
    top: 4,
    right: 4,
  },

  resultOverlayEmoji: {
    fontSize: 18,
  },

  // Post-answer explanation card
  explanationCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.lg,
    gap: SPACING.md,
  },

  explanationTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 17,
    color: COLORS.textPrimary,
  },

  explanationText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },

  nextButton: {
    backgroundColor: COLORS.purple,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },

  nextButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: COLORS.background,
  },

  // Sponsored round hint line
  sponsoredHint: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: -SPACING.sm,
    paddingHorizontal: SPACING.md,
  },

  // Sponsored explanation card
  sponsoredCard: {
    borderColor: COLORS.cyan,
  },

  sponsoredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },

  sponsoredEmoji: {
    fontSize: 28,
  },

  sponsoredBrandName: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: COLORS.textPrimary,
  },

  sponsoredHandle: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  sponsoredBadge: {
    backgroundColor: COLORS.cyan + '22',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.cyan,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },

  sponsoredBadgeText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.cyan,
  },

  ctaButton: {
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },

  ctaButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    color: '#ffffff',
  },
});
