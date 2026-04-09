// ─── AdBanner Component ───────────────────────────────────────────────────────
//
// A banner ad slot powered by Google AdMob (react-native-google-mobile-ads).
//
// HOW ADS WORK:
//   AdMob is Google's ad network. You sign up, get an App ID and Ad Unit IDs,
//   and Google fills the slot with relevant ads automatically. You earn money
//   every time a user sees or clicks an ad.
//
// HOW TO ACTIVATE:
//   1. Go to apps.admob.com → create account → Add App (Android + iOS)
//   2. Copy your App ID — paste it in app.json under:
//        "plugins": [["react-native-google-mobile-ads", { "androidAppId": "ca-app-pub-XXXX~YYYY" }]]
//   3. Create a Banner Ad Unit → copy the Ad Unit ID
//   4. Paste it into ADMOB_BANNER_ID below (use the test ID during development)
//   5. Run `eas build` — ads will appear in the real build
//
// FREE USERS see ads. PRO users get an ad-free experience.
// This is a major incentive to upgrade to NoGoon Pro.
//
// SIZES:
//   'banner'        — 320×50  — standard, shown at bottom of screen
//   'largeBanner'   — 320×100 — taller, more revenue
//   'mediumRectangle' — 300×250 — most revenue but takes more space
//
// REVENUE ESTIMATE:
//   eCPM (earnings per 1,000 views) for wellness/lifestyle apps: $3–$8
//   At 1,000 DAU × 3 ad views/session = 3,000 impressions/day
//   At $5 eCPM = $15/day = $450/month from ads alone

import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

// ─── AdMob Unit IDs ───────────────────────────────────────────────────────────
// Use the TEST IDs below during development — they show fake Google test ads.
// Replace with your real IDs from the AdMob dashboard before going live.

const TEST_BANNER_ID_ANDROID = 'ca-app-pub-3940256099942544/6300978111';
const TEST_BANNER_ID_IOS     = 'ca-app-pub-3940256099942544/2934735716';

// ⚠️  REPLACE THESE with your real Ad Unit IDs before publishing:
const REAL_BANNER_ID_ANDROID = 'ca-app-pub-REPLACE_ME/REPLACE_ME';
const REAL_BANNER_ID_IOS     = 'ca-app-pub-REPLACE_ME/REPLACE_ME';

// Switch between test and real IDs — set IS_PRODUCTION = true before releasing
const IS_PRODUCTION = false;

export const BANNER_ID = Platform.select({
  android: IS_PRODUCTION ? REAL_BANNER_ID_ANDROID : TEST_BANNER_ID_ANDROID,
  ios:     IS_PRODUCTION ? REAL_BANNER_ID_IOS     : TEST_BANNER_ID_IOS,
  default: TEST_BANNER_ID_ANDROID,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type AdSize = 'banner' | 'largeBanner';

interface AdBannerProps {
  size?: AdSize;
  style?: object;
}

// Height in pixels for each ad size
const AD_HEIGHTS: Record<AdSize, number> = {
  banner:      52,
  largeBanner: 100,
};

// ─── Component ────────────────────────────────────────────────────────────────

let BannerAd: any = null;
let BannerAdSize: any = null;

try {
  // This will succeed in an EAS build with react-native-google-mobile-ads installed.
  // It fails silently in Expo Go — we show a placeholder instead.
  const AdMob   = require('react-native-google-mobile-ads');
  BannerAd      = AdMob.BannerAd;
  BannerAdSize  = AdMob.BannerAdSize;
} catch {
  // Expected in Expo Go
}

export function AdBanner({ size = 'banner', style }: AdBannerProps) {
  const { isPro } = useSubscriptionStore();

  // Pro users see no ads — this is a key selling point
  if (isPro) return null;

  const height = AD_HEIGHTS[size];

  // ── Real ad (EAS build with AdMob installed) ───────────────────────────────
  if (BannerAd && BannerAdSize) {
    return (
      <View style={[styles.adContainer, { height }, style]}>
        <BannerAd
          unitId={BANNER_ID}
          size={size === 'largeBanner' ? BannerAdSize.LARGE_BANNER : BannerAdSize.BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: false }}
        />
      </View>
    );
  }

  // ── Placeholder (Expo Go / development) ────────────────────────────────────
  // Shows the exact same dimensions as the real ad so layout doesn't shift
  // when you switch to a build with real ads.
  return (
    <View style={[styles.placeholder, { height }, style]}>
      <Text style={styles.placeholderText}>[ Ad Space — {size} ]</Text>
      <Text style={styles.placeholderSub}>Activate in AdMob dashboard</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  adContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },

  // Placeholder shown in Expo Go / dev mode
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    borderRadius: RADIUS.sm,
    gap: 2,
    marginVertical: SPACING.xs,
  },
  placeholderText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  placeholderSub: {
    fontFamily: FONTS.body,
    fontSize: 10,
    color: COLORS.textMuted + '88',
  },
});
