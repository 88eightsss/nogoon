// ─── Spot the Sponsored ───────────────────────────────────────────────────────
//
// A scrollable social media feed. Five of the fourteen posts are hidden ads.
// Tap every ad you can find before the 60-second timer runs out.
//
// MECHANICS:
//   • Tap a post to flag it as an ad (tap again to un-flag)
//   • Timer runs out OR tap "Reveal" to end early
//   • Reveal phase: green = correctly flagged, orange = missed, red = false positive
//
// SCORING:
//   Correct flag  +20 pts
//   False positive -10 pts  (minimum score = 0)
//
// AD DIFFICULTY LEVELS (mixed in the feed):
//   OBVIOUS   — "SPONSORED" label clearly visible, big CTA button
//   MEDIUM    — "Paid Partnership" label, subtle
//   SUBTLE    — Tiny "ad" label in the corner
//   SNEAKY    — No label, just a suspiciously promotional post
//   ASTERISK  — "Not sponsored*" with disclosure buried in fine print

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { FONTS } from '@/constants/Colors';
import { useThemedColors, type ArcadeColors } from '@/hooks/useThemedColors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { ProceedButton } from '@/components/ui/ProceedButton';
import { fetchAdForPlacement, trackAdEvent, type AdCampaign } from '@/services/ads';

// ─── Data types ───────────────────────────────────────────────────────────────

interface FeedPost {
  id: string;
  username: string;
  handle: string;
  avatarColor: string;
  // Time is empty for brand accounts — that's a tell
  timeAgo: string;
  content: string;
  imageColor?: string;
  imageEmoji?: string;
  likes: string;
  comments: string;
  isAd: boolean;
  // Ad-specific fields
  sponsorLabel?: string;   // "SPONSORED" | "Paid Partnership" | "ad" | "" (hidden)
  adCta?: string;          // e.g. "Shop Now"
  adBadge?: string;        // e.g. "ENDS TONIGHT ⏰"
  adTrick?: string;        // explanation shown in reveal
  // Sponsored campaign fields (only for the real sponsor post)
  isSponsored?: boolean;   // marks the honest real ad
  ctaUrl?: string;         // deep link for the real CTA
  sponsoredCtaColor?: string;
}

// ─── Feed data ────────────────────────────────────────────────────────────────
// 14 posts — 5 are ads (flagged isAd: true). Mixed difficulty.

const FEED: FeedPost[] = [
  // ── Organic ──────────────────────────────────────────────────────────────
  {
    id: 'o1',
    username: 'Sarah K',
    handle: 'sarah_k',
    avatarColor: '#e91e63',
    timeAgo: '2h',
    content: 'Just made these cookies 🍪 they actually turned out perfect this time. Finally got the ratios right.',
    imageColor: '#f3e5ab',
    imageEmoji: '🍪',
    likes: '312',
    comments: '28',
    isAd: false,
  },
  {
    id: 'o2',
    username: 'Dev News',
    handle: 'devnews',
    avatarColor: '#2196F3',
    timeAgo: '4h',
    content: 'TypeScript 5.8 is out and the performance improvements are actually real. Build times down 30% on our monorepo.',
    likes: '1.2K',
    comments: '94',
    isAd: false,
  },

  // ── Ad 1: OBVIOUS — "SPONSORED" label, big badge, loud CTA ───────────────
  {
    id: 'a1',
    username: 'ShopLux',
    handle: 'ShopLux_Official',
    avatarColor: '#FF5722',
    timeAgo: '',
    content: 'Summer Collection is here ✨ Styles are selling out fast — grab yours before they\'re gone.',
    imageColor: '#FF8A65',
    imageEmoji: '👗',
    likes: '—',
    comments: '—',
    isAd: true,
    sponsorLabel: 'SPONSORED',
    adCta: 'Shop Now — 60% OFF',
    adBadge: 'ENDS TONIGHT ⏰',
    adTrick: '"ENDS TONIGHT" is almost always fake. Countdown timers reset every night. This sale runs all week.',
  },

  {
    id: 'o3',
    username: 'Mike the Hiker',
    handle: 'mikethehiker',
    avatarColor: '#4CAF50',
    timeAgo: '1d',
    content: 'Sunrise from the top this morning. Worth the 4am alarm. Every time.',
    imageColor: '#FFB74D',
    imageEmoji: '🌄',
    likes: '891',
    comments: '43',
    isAd: false,
  },

  // ── Ad 2: MEDIUM — "Paid Partnership" label (easy to miss) ───────────────
  {
    id: 'a2',
    username: 'Layla G',
    handle: 'glowwithlayla',
    avatarColor: '#9C27B0',
    timeAgo: '5h',
    content: 'Ok I genuinely need to talk about this serum 👇 My skin cleared up in 2 weeks. I was skeptical at first but the results have been hard to ignore. Been using it every morning.',
    imageColor: '#F8BBD0',
    imageEmoji: '✨',
    likes: '2.4K',
    comments: '187',
    isAd: true,
    sponsorLabel: 'Paid Partnership',
    adCta: '30% off with code LAYLA',
    adTrick: '"Paid Partnership" labels are easy to scroll past. Influencers are legally required to disclose but many make it as small as possible.',
  },

  {
    id: 'o4',
    username: 'Coffee & Code',
    handle: 'coffeeandcode',
    avatarColor: '#795548',
    timeAgo: '3h',
    content: 'Hot take: dark mode isn\'t about aesthetics. It\'s about reducing cognitive load at 2am when your brain is already at 12%.',
    likes: '3.1K',
    comments: '212',
    isAd: false,
  },
  {
    id: 'o5',
    username: 'Jasmine Arts',
    handle: 'jasminepaints',
    avatarColor: '#FF4081',
    timeAgo: '2d',
    content: 'Finished this piece after 3 weeks. Acrylic on canvas, 24×30. Still nervous to share it but here we go.',
    imageColor: '#E8EAF6',
    imageEmoji: '🎨',
    likes: '567',
    comments: '89',
    isAd: false,
  },

  // ── Ad 3: SUBTLE — Tiny "ad" label in gray, easy to overlook ─────────────
  {
    id: 'a3',
    username: 'Brice Travels',
    handle: 'travelwithbrice',
    avatarColor: '#00BCD4',
    timeAgo: '6h',
    content: 'Booked my last 4 trips through this app and saved over $400 combined. The international flight deals are genuinely insane right now if you have flexibility on dates.',
    imageColor: '#B3E5FC',
    imageEmoji: '✈️',
    likes: '891',
    comments: '54',
    isAd: true,
    sponsorLabel: 'ad',
    adCta: 'Check Deals',
    adTrick: 'The "ad" label is technically there — but it\'s the same color as the username and tiny. Designed to blend in and be legally compliant while functionally invisible.',
  },

  {
    id: 'o6',
    username: 'Carlos Running',
    handle: 'carlosrunning',
    avatarColor: '#FF5722',
    timeAgo: '8h',
    content: 'Week 6 of marathon training done. First 20-mile run this weekend. Genuinely have no idea if I\'m ready but I guess we\'ll find out 😅',
    likes: '445',
    comments: '67',
    isAd: false,
  },
  {
    id: 'o7',
    username: 'Maya Reads',
    handle: 'maya_reads',
    avatarColor: '#673AB7',
    timeAgo: '12h',
    content: 'Just finished Demon Copperhead. Barbara Kingsolver really said "I will destroy you emotionally" and committed to it on every single page.',
    likes: '1.8K',
    comments: '203',
    isAd: false,
  },

  // ── Ad 4: SNEAKY — No label at all. Account IS the brand. ────────────────
  {
    id: 'a4',
    username: 'Natural Skin Co',
    handle: 'naturalskinco',
    avatarColor: '#8BC34A',
    timeAgo: '3h',
    content: 'Been using this moisturizer every morning for 6 weeks and my skin has genuinely never looked better. My dermatologist said the formula is actually solid. Kind of obsessed.',
    imageColor: '#DCEDC8',
    imageEmoji: '🌿',
    likes: '2.1K',
    comments: '318',
    isAd: true,
    sponsorLabel: '',
    adCta: 'Get Yours →',
    adTrick: 'No disclosure label at all. The username IS the brand. A brand posting as if a person = illegal in many countries, but hard to enforce. The "my dermatologist" line is a classic credibility trick.',
  },

  {
    id: 'o8',
    username: 'Tech Breaks',
    handle: 'techbreaks',
    avatarColor: '#607D8B',
    timeAgo: '1d',
    content: 'Fun fact: the first website is still live. It\'s just plain HTML with blue underlined links. No tracking. No ads. Kind of refreshing.',
    likes: '5.4K',
    comments: '321',
    isAd: false,
  },
  {
    id: 'o9',
    username: 'Gretchen Says',
    handle: 'gretchensays',
    avatarColor: '#FF9800',
    timeAgo: '2h',
    content: 'If your meeting could have been an email, your email could have been a thumbs up, and your thumbs up could have been silence.',
    likes: '12.4K',
    comments: '892',
    isAd: false,
  },

  // ── Ad 5: ASTERISK — "Not sponsored*" with tiny fine-print disclosure ─────
  {
    id: 'a5',
    username: 'Mark Chen',
    handle: 'mark_chen_dev',
    avatarColor: '#F44336',
    timeAgo: '7h',
    content: 'Been using this productivity app for 3 months and my output actually doubled. Not sponsored* — just genuinely obsessed with it and think you should try it',
    likes: '3.7K',
    comments: '445',
    isAd: true,
    sponsorLabel: '*ad',
    adCta: 'Try Free',
    adTrick: '"Not sponsored*" with the asterisk disclosure buried in tiny text. Saying you\'re not sponsored in the post while technically being sponsored is deceptive by design.',
  },
];

const GAME_DURATION = 60;

// ─── FeedPost Component ───────────────────────────────────────────────────────

type RevealState = 'correct' | 'missed' | 'wrong' | null;

function FeedPostCard({
  post,
  flagged,
  onToggle,
  revealed,
  disabled,
  onCtaPress,
  styles,
  COLORS,
}: {
  post: FeedPost;
  flagged: boolean;
  onToggle: (id: string) => void;
  revealed: boolean;
  disabled: boolean;
  onCtaPress?: () => void;
  styles: ReturnType<typeof makeStyles>;
  COLORS: ArcadeColors;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const revealState: RevealState = revealed
    ? flagged && post.isAd    ? 'correct'
    : flagged && !post.isAd   ? 'wrong'
    : !flagged && post.isAd   ? 'missed'
    : null
    : null;

  const handlePress = () => {
    if (disabled) return;
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 60, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, damping: 10, useNativeDriver: true }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle(post.id);
  };

  const borderColor = flagged && !revealed
    ? COLORS.warning
    : revealState === 'correct' ? COLORS.green
    : revealState === 'wrong'   ? COLORS.danger
    : revealState === 'missed'  ? '#f59e0b'
    : COLORS.cardBorder;

  return (
    <Pressable onPress={handlePress}>
      <Animated.View
        style={[
          styles.postCard,
          { borderColor },
          flagged && !revealed && styles.postFlagged,
          revealState === 'correct' && styles.postCorrect,
          revealState === 'wrong'   && styles.postWrong,
          revealState === 'missed'  && styles.postMissed,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        {/* ── Post header ─────────────────────────────────────────────────── */}
        <View style={styles.postHeader}>
          {/* Avatar */}
          <View style={[styles.avatar, { backgroundColor: post.avatarColor }]}>
            <Text style={styles.avatarText}>
              {post.username.charAt(0).toUpperCase()}
            </Text>
          </View>

          {/* Name + handle + time */}
          <View style={styles.postMeta}>
            <View style={styles.postMetaRow}>
              <Text style={styles.postUsername}>{post.username}</Text>
              {/* Sponsor label — hidden = '' but rendered tiny */}
              {post.sponsorLabel !== undefined && (
                <Text style={[
                  styles.sponsorLabel,
                  post.sponsorLabel === 'SPONSORED' && styles.sponsorLabelBold,
                  (post.sponsorLabel === 'ad' || post.sponsorLabel === '*ad') && styles.sponsorLabelTiny,
                ]}>
                  {post.sponsorLabel}
                </Text>
              )}
            </View>
            <Text style={styles.postHandle}>
              @{post.handle}{post.timeAgo ? ` · ${post.timeAgo}` : ''}
            </Text>
          </View>

          {/* Flag button */}
          {!revealed && (
            <Pressable
              style={[styles.flagBtn, flagged && styles.flagBtnActive]}
              onPress={handlePress}
              hitSlop={8}
            >
              <Text style={styles.flagBtnText}>{flagged ? '🚩' : '⚑'}</Text>
            </Pressable>
          )}

          {/* Reveal badge */}
          {revealState && (
            <View style={[
              styles.revealBadge,
              revealState === 'correct' ? styles.revealBadge_correct :
              revealState === 'wrong'   ? styles.revealBadge_wrong   :
                                         styles.revealBadge_missed,
            ]}>
              <Text style={styles.revealBadgeText}>
                {revealState === 'correct' ? '✓ Ad' : revealState === 'wrong' ? '✗ Not ad' : '! Missed'}
              </Text>
            </View>
          )}
        </View>

        {/* ── Image placeholder ───────────────────────────────────────────── */}
        {post.imageColor && (
          <View style={[styles.postImage, { backgroundColor: post.imageColor }]}>
            <Text style={styles.postImageEmoji}>{post.imageEmoji}</Text>
          </View>
        )}

        {/* ── Content ─────────────────────────────────────────────────────── */}
        <Text style={styles.postContent}>{post.content}</Text>

        {/* Ad badge (urgency trick) */}
        {post.adBadge && (
          <View style={styles.adBadge}>
            <Text style={styles.adBadgeText}>{post.adBadge}</Text>
          </View>
        )}

        {/* CTA button */}
        {post.adCta && (
          <Pressable
            style={[
              styles.ctaButton,
              post.sponsoredCtaColor ? { backgroundColor: post.sponsoredCtaColor } : undefined,
            ]}
            onPress={onCtaPress}
            disabled={!onCtaPress}
          >
            <Text style={styles.ctaButtonText}>{post.adCta}</Text>
          </Pressable>
        )}

        {/* ── Engagement row (organic posts only) ─────────────────────────── */}
        {post.likes !== '—' && (
          <View style={styles.engagementRow}>
            <View style={styles.engagementItem}>
              <Feather name="heart" size={13} color={COLORS.textMuted} />
              <Text style={styles.engagementText}>{post.likes}</Text>
            </View>
            <View style={styles.engagementItem}>
              <Feather name="message-circle" size={13} color={COLORS.textMuted} />
              <Text style={styles.engagementText}>{post.comments}</Text>
            </View>
          </View>
        )}

        {/* ── Reveal explanation ───────────────────────────────────────────── */}
        {revealed && post.isAd && post.isSponsored && (
          <View style={[styles.trickCard, { borderColor: COLORS.cyan + '44', backgroundColor: COLORS.cyan + '11' }]}>
            <Text style={[styles.trickLabel, { color: COLORS.cyan }]}>HONEST AD</Text>
            <Text style={styles.trickText}>{post.adTrick}</Text>
          </View>
        )}
        {revealed && post.isAd && post.adTrick && !post.isSponsored && (
          <View style={styles.trickCard}>
            <Text style={styles.trickLabel}>THE TRICK</Text>
            <Text style={styles.trickText}>{post.adTrick}</Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Phase = 'intro' | 'playing' | 'revealed';

interface Props {
  onComplete: (score: number) => void;
}

export function SpotTheSponsored({ onComplete }: Props) {
  const COLORS = useThemedColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [phase,   setPhase]   = useState<Phase>('intro');
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [sponsoredCampaign, setSponsoredCampaign] = useState<AdCampaign | null>(null);

  const timeLeftRef       = useRef(GAME_DURATION);
  const clockRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const completionTracked = useRef(false);

  // ── Sponsored insert position (random slot in second half of feed) ──────────
  const sponsoredInsertIdx = useRef(Math.floor(Math.random() * 6) + 4); // positions 4-9

  // ── Fetch campaign on mount ─────────────────────────────────────────────────
  useEffect(() => {
    fetchAdForPlacement('spot_sponsored').then((campaign) => {
      if (campaign) setSponsoredCampaign(campaign);
    });
  }, []);

  // ── Build dynamic feed (splices sponsored post if campaign is active) ───────
  const activeFeed: FeedPost[] = (() => {
    if (!sponsoredCampaign) return FEED;
    const sponsoredPost: FeedPost = {
      id: `sponsored_${sponsoredCampaign.id}`,
      username: sponsoredCampaign.brand_name,
      handle: sponsoredCampaign.brand_handle ?? sponsoredCampaign.brand_name.toLowerCase().replace(/\s/g, ''),
      avatarColor: sponsoredCampaign.brand_color,
      timeAgo: '',
      content: sponsoredCampaign.post_content ?? sponsoredCampaign.headline,
      imageEmoji: sponsoredCampaign.post_image_emoji ?? undefined,
      likes: '—',
      comments: '—',
      isAd: true,
      isSponsored: true,
      sponsorLabel: 'SPONSORED',
      adCta: sponsoredCampaign.cta_label,
      ctaUrl: sponsoredCampaign.cta_url,
      sponsoredCtaColor: sponsoredCampaign.brand_color,
      adTrick: `${sponsoredCampaign.brand_name} clearly labeled this "SPONSORED" and made a straightforward pitch — no dark patterns, no hidden costs.`,
    };
    const result = [...FEED];
    result.splice(Math.min(sponsoredInsertIdx.current, result.length), 0, sponsoredPost);
    return result;
  })();

  const adCount = activeFeed.filter(p => p.isAd).length;

  // ── Start game ─────────────────────────────────────────────────────────────
  const startGame = () => {
    timeLeftRef.current = GAME_DURATION;
    setTimeLeft(GAME_DURATION);
    setFlagged(new Set());
    completionTracked.current = false;
    setPhase('playing');
    if (sponsoredCampaign) {
      trackAdEvent('impression', sponsoredCampaign.id, 'spot_sponsored');
    }
  };

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') return;

    clockRef.current = setInterval(() => {
      timeLeftRef.current -= 1;
      setTimeLeft(timeLeftRef.current);
      if (timeLeftRef.current <= 0) {
        clearInterval(clockRef.current!);
        setPhase('revealed');
      }
    }, 1000);

    return () => { if (clockRef.current) clearInterval(clockRef.current); };
  }, [phase]);

  // ── Toggle flag ────────────────────────────────────────────────────────────
  const toggleFlag = useCallback((id: string) => {
    setFlagged(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ── Reveal (early exit) ────────────────────────────────────────────────────
  const handleReveal = () => {
    if (clockRef.current) clearInterval(clockRef.current);
    if (sponsoredCampaign && !completionTracked.current) {
      completionTracked.current = true;
      const sponsoredId = `sponsored_${sponsoredCampaign.id}`;
      const userFlaggedSponsor = flagged.has(sponsoredId);
      trackAdEvent(
        userFlaggedSponsor ? 'correct_tap' : 'wrong_tap',
        sponsoredCampaign.id,
        'spot_sponsored'
      );
      trackAdEvent('completion', sponsoredCampaign.id, 'spot_sponsored');
    }
    setPhase('revealed');
  };

  const handleCtaPress = useCallback(() => {
    if (!sponsoredCampaign) return;
    trackAdEvent('cta_click', sponsoredCampaign.id, 'spot_sponsored');
    Linking.openURL(sponsoredCampaign.cta_url).catch(() => {});
  }, [sponsoredCampaign]);

  // ── Score ──────────────────────────────────────────────────────────────────
  const correctFlags   = activeFeed.filter(p => p.isAd && flagged.has(p.id)).length;
  const wrongFlags     = activeFeed.filter(p => !p.isAd && flagged.has(p.id)).length;
  const rawScore       = correctFlags * 20 - wrongFlags * 10;
  const score          = Math.max(0, rawScore);

  // ══════════════════════════════════════════════════════════════════════════
  //  INTRO
  // ══════════════════════════════════════════════════════════════════════════

  if (phase === 'intro') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.heroEmoji}>📱</Text>
          <Text style={styles.title}>Spot the Sponsored</Text>
          <Text style={styles.subtitle}>
            Scroll through the feed.{'\n'}
            Tap every hidden ad before time runs out.
          </Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoRow}>⏱  60 seconds</Text>
            <Text style={styles.infoRow}>🎯  {adCount} ads hidden in the feed</Text>
            <Text style={styles.infoRow}>🚩  Tap a post to flag it as an ad</Text>
            <Text style={styles.infoRow}>💡  Some ads are obvious. Some aren't.</Text>
          </View>
          <Pressable style={styles.startBtn} onPress={startGame}>
            <Text style={styles.startBtnText}>Start Scrolling →</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  REVEALED (result)
  // ══════════════════════════════════════════════════════════════════════════

  if (phase === 'revealed') {
    const missed = adCount - correctFlags;
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
          {/* Score header */}
          <View style={styles.resultHeader}>
            <Text style={styles.resultEmoji}>
              {correctFlags === adCount ? '🏆' : correctFlags >= 3 ? '🕵️' : '😶'}
            </Text>
            <Text style={styles.resultTitle}>
              {correctFlags === adCount
                ? 'Ad Detective!'
                : `${correctFlags} / ${adCount} ads found`}
            </Text>

            {/* Stat row */}
            <View style={styles.statRow}>
              <View style={[styles.statItem, { borderColor: COLORS.green + '66' }]}>
                <Text style={[styles.statNum, { color: COLORS.green }]}>{correctFlags}</Text>
                <Text style={styles.statLabel}>found</Text>
              </View>
              <View style={[styles.statItem, { borderColor: '#f59e0b66' }]}>
                <Text style={[styles.statNum, { color: '#f59e0b' }]}>{missed}</Text>
                <Text style={styles.statLabel}>missed</Text>
              </View>
              <View style={[styles.statItem, { borderColor: COLORS.danger + '66' }]}>
                <Text style={[styles.statNum, { color: COLORS.danger }]}>{wrongFlags}</Text>
                <Text style={styles.statLabel}>wrong</Text>
              </View>
              <View style={[styles.statItem, { borderColor: COLORS.purple + '66' }]}>
                <Text style={[styles.statNum, { color: COLORS.purple }]}>{score}</Text>
                <Text style={styles.statLabel}>pts</Text>
              </View>
            </View>
          </View>

          <Text style={styles.sectionLabel}>THE FEED — REVEALED</Text>

          {activeFeed.map(post => (
            <FeedPostCard
              key={post.id}
              post={post}
              flagged={flagged.has(post.id)}
              onToggle={() => {}}
              revealed
              disabled
              onCtaPress={post.isSponsored ? handleCtaPress : undefined}
              styles={styles}
              COLORS={COLORS}
            />
          ))}

          <ProceedButton
            label="Continue →"
            onPress={() => onComplete(score)}
            style={{ marginTop: SPACING.lg }}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  PLAYING
  // ══════════════════════════════════════════════════════════════════════════

  const timerColor = timeLeft <= 10 ? COLORS.danger : timeLeft <= 20 ? COLORS.warning : COLORS.textMuted;

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Sticky timer bar ─────────────────────────────────────────────── */}
      <View style={styles.timerBar}>
        <View style={styles.timerLeft}>
          <Feather name="clock" size={14} color={timerColor} />
          <Text style={[styles.timerText, { color: timerColor }]}>{timeLeft}s</Text>
        </View>
        <View style={styles.timerCenter}>
          <Text style={styles.timerInstruction}>
            Tap the ads 🚩  {flagged.size > 0 ? `${flagged.size} flagged` : ''}
          </Text>
        </View>
        <Pressable style={styles.revealBtn} onPress={handleReveal}>
          <Text style={styles.revealBtnText}>Reveal</Text>
        </Pressable>
      </View>

      {/* ── Feed ─────────────────────────────────────────────────────────── */}
      <ScrollView
        style={styles.feed}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeFeed.map(post => (
          <FeedPostCard
            key={post.id}
            post={post}
            flagged={flagged.has(post.id)}
            onToggle={toggleFlag}
            revealed={false}
            disabled={false}
            styles={styles}
            COLORS={COLORS}
          />
        ))}
        <View style={{ height: SPACING.xxl }} />
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

  // ── Intro / complete ──────────────────────────────────────────────────────
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.lg,
  },
  heroEmoji: {
    fontSize: 72,
    lineHeight: 88,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 32,
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
  startBtn: {
    backgroundColor: COLORS.warning,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    width: '100%',
    alignItems: 'center',
  },
  startBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 17,
    color: COLORS.background,
  },

  // ── Timer bar ─────────────────────────────────────────────────────────────
  timerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    zIndex: 10,
  },
  timerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 48,
  },
  timerText: {
    fontFamily: FONTS.monoBold,
    fontSize: 16,
  },
  timerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  timerInstruction: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  revealBtn: {
    backgroundColor: COLORS.purple + '22',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.purple + '66',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },
  revealBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: COLORS.purple,
  },

  // ── Feed scroll ───────────────────────────────────────────────────────────
  feed: { flex: 1 },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    gap: SPACING.sm,
  },

  // ── Post card ─────────────────────────────────────────────────────────────
  postCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  postFlagged: {
    backgroundColor: COLORS.warning + '0d',
    borderColor: COLORS.warning,
  },
  postCorrect: {
    backgroundColor: COLORS.green + '0d',
  },
  postWrong: {
    backgroundColor: COLORS.danger + '0d',
  },
  postMissed: {
    backgroundColor: '#f59e0b0d',
  },

  // Header row
  postHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: '#fff',
  },
  postMeta: {
    flex: 1,
    gap: 2,
  },
  postMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flexWrap: 'wrap',
  },
  postUsername: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  sponsorLabel: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  sponsorLabelBold: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.warning,
    backgroundColor: COLORS.warning + '22',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: RADIUS.xs,
  },
  sponsorLabelTiny: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.textMuted,
    letterSpacing: 0.3,
  },
  postHandle: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
  },

  // Flag button
  flagBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    flexShrink: 0,
  },
  flagBtnActive: {
    backgroundColor: COLORS.warning + '22',
    borderColor: COLORS.warning,
  },
  flagBtnText: {
    fontSize: 16,
  },

  // Reveal badge (replaces flag button in reveal phase)
  revealBadge: {
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    flexShrink: 0,
  },
  revealBadge_correct: {
    backgroundColor: COLORS.green + '22',
    borderColor: COLORS.green + '66',
  },
  revealBadge_wrong: {
    backgroundColor: COLORS.danger + '22',
    borderColor: COLORS.danger + '66',
  },
  revealBadge_missed: {
    backgroundColor: '#f59e0b22',
    borderColor: '#f59e0b66',
  },
  revealBadgeText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.textPrimary,
    letterSpacing: 0.3,
  },

  // Image placeholder
  postImage: {
    width: '100%',
    height: 140,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postImageEmoji: {
    fontSize: 48,
  },

  // Content text
  postContent: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 21,
  },

  // Ad badge (urgency trick label)
  adBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.danger + '22',
    borderRadius: RADIUS.xs,
    borderWidth: 1,
    borderColor: COLORS.danger + '55',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  adBadgeText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.danger,
    letterSpacing: 0.5,
  },

  // CTA button
  ctaButton: {
    backgroundColor: COLORS.warning,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  ctaButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: COLORS.background,
  },

  // Engagement row
  engagementRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  engagementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  engagementText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
  },

  // Ad trick explanation (reveal phase)
  trickCard: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.warning + '44',
    padding: SPACING.md,
    gap: 4,
  },
  trickLabel: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.warning,
    letterSpacing: 1.2,
  },
  trickText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },

  // Result header
  resultHeader: {
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.xl,
  },
  resultEmoji: {
    fontSize: 64,
    lineHeight: 80,
  },
  resultTitle: {
    fontFamily: FONTS.display,
    fontSize: 28,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  statRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingVertical: SPACING.md,
    gap: 2,
  },
  statNum: {
    fontFamily: FONTS.monoBold,
    fontSize: 24,
  },
  statLabel: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
  },

  sectionLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
});
