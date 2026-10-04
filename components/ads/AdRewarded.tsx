// ─── AdRewarded Component ─────────────────────────────────────────────────────
//
// Renders a "Watch a 30s ad → earn +50 points" button.
// Uses Google AdMob's Rewarded Ad format — the highest-revenue ad type.
//
// HOW IT WORKS:
//   1. The ad preloads in the background as soon as this component mounts.
//   2. When the user taps the button, the full-screen rewarded ad plays.
//   3. If the user watches it to completion, Google fires the earn_reward event
//      and we call onRewarded() — the parent adds 50 bonus points.
//   4. If the user skips or the ad fails to load, we show a disabled button
//      so the layout stays stable.
//
// REVENUE:
//   Rewarded ads pay 3–5× more than banner ads (eCPM $15–$40 vs $5).
//   This is the highest-revenue format AdMob offers.
//
// SETUP (before going live):
//   1. In AdMob dashboard: Apps → your app → Ad units → Add ad unit → Rewarded
//   2. Copy the Ad Unit ID
//   3. Replace REAL_REWARDED_ID_ANDROID below with your real ID
//   4. Set IS_PRODUCTION = true in AdBanner.tsx
//
// POLICY NOTE:
//   This is policy-safe — the user explicitly opts in by tapping the button.
//   AdMob explicitly supports this "opt-in rewarded" pattern.

import { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
import { FONTS } from '@/constants/Colors';
import { useThemedColors, type ArcadeColors } from '@/hooks/useThemedColors';
import { SPACING, RADIUS } from '@/constants/Spacing';

// ─── Ad Unit IDs ──────────────────────────────────────────────────────────────
// Test IDs are Google's official test IDs — safe to use during development.
// ⚠️  Replace REAL_REWARDED_ID_ANDROID with your real Ad Unit ID before launch.

const TEST_REWARDED_ID_ANDROID  = 'ca-app-pub-3940256099942544/5224354917';
const REAL_REWARDED_ID_ANDROID  = 'ca-app-pub-REPLACE_ME/REPLACE_ME';

// Import IS_PRODUCTION from AdBanner so there's one flag to flip
import { IS_PRODUCTION, isAdIdConfigured } from './AdBanner';

const REWARDED_ID = IS_PRODUCTION ? REAL_REWARDED_ID_ANDROID : TEST_REWARDED_ID_ANDROID;

// ─── Lazy SDK import ──────────────────────────────────────────────────────────
// Fails silently in Expo Go (no native module) — component shows disabled state.

let RewardedAdSDK: any = null;
let RewardedAdEventType: any = null;

try {
  const AdMob = require('react-native-google-mobile-ads');
  RewardedAdSDK = AdMob.RewardedAd;
  RewardedAdEventType = AdMob.RewardedAdEventType;
} catch {
  // Expo Go / missing native module — component degrades gracefully
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AdRewardedProps {
  bonusPoints?: number;   // Points awarded when ad is watched (default 50)
  onRewarded: () => void; // Called when user earns the reward
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AdRewarded({ bonusPoints = 50, onRewarded }: AdRewardedProps) {
  const { isPro } = useSubscriptionStore();

  // Pro users never see ads — this is a free-tier-only revenue mechanism
  if (isPro) return null;

  // No native module (Expo Go / iOS simulator)
  if (!RewardedAdSDK) return null;

  return <AdRewardedInner bonusPoints={bonusPoints} onRewarded={onRewarded} />;
}

// ─── Inner component (only mounts when native module is available) ─────────────

function AdRewardedInner({ bonusPoints, onRewarded }: Required<AdRewardedProps>) {
  const COLORS = useThemedColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [loaded, setLoaded]   = useState(false);
  const [loading, setLoading] = useState(true);
  const [used, setUsed]       = useState(false);

  const adRef = useRef<any>(null);

  useEffect(() => {
    if (!RewardedAdSDK) return;
    if (!isAdIdConfigured(REWARDED_ID)) { setLoading(false); return; }

    // Create and preload a rewarded ad
    const ad = RewardedAdSDK.createForAdRequest(REWARDED_ID, {
      requestNonPersonalizedAdsOnly: false,
    });
    adRef.current = ad;

    const unsubLoaded = ad.addAdEventListener(
      RewardedAdEventType.LOADED,
      () => { setLoaded(true); setLoading(false); }
    );
    const unsubError = ad.addAdEventListener(
      RewardedAdEventType.ERROR,
      () => { setLoaded(false); setLoading(false); }
    );
    const unsubEarned = ad.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      () => {
        setUsed(true);
        onRewarded();
      }
    );

    ad.load();

    return () => {
      unsubLoaded();
      unsubError();
      unsubEarned();
    };
  }, [onRewarded]);

  const handlePress = async () => {
    if (!loaded || !adRef.current) return;
    try {
      await adRef.current.show();
    } catch {
      // Ad failed to show — do nothing, keep the button in its current state
    }
  };

  // Already watched — don't show the button again
  if (used) return null;

  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.button, (!loaded || loading) && styles.buttonDisabled]}
        onPress={handlePress}
        disabled={!loaded || loading}
      >
        <Feather
          name={loading ? 'loader' : 'play-circle'}
          size={16}
          color={loaded ? COLORS.warning : COLORS.textMuted}
        />
        <Text style={[styles.buttonText, !loaded && styles.buttonTextDisabled]}>
          {loading
            ? 'Loading ad...'
            : `Watch a 30s ad → +${bonusPoints} bonus points`}
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (COLORS: ArcadeColors) => StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.warning + '12',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.warning + '44',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  buttonDisabled: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.cardBorder,
  },
  buttonText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.warning,
  },
  buttonTextDisabled: {
    color: COLORS.textMuted,
  },
});
