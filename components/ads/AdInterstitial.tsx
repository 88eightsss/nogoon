// ─── AdInterstitial Hook ──────────────────────────────────────────────────────
//
// Full-screen interstitial ad shown after every 3rd gate game completion.
// This is the second-highest-revenue AdMob format after rewarded ads.
//
// HOW IT WORKS:
//   1. Call useAdInterstitial() in a component that handles game completion.
//   2. When the game ends, call maybeShowInterstitial().
//   3. Every 3rd call shows the interstitial; other calls skip silently.
//   4. Pro users are never shown interstitial ads.
//
// FREQUENCY:
//   1 interstitial per 3 gate games = roughly 1 per session for engaged users.
//   More frequent than this increases bounce rate. Less frequent = less revenue.
//
// REVENUE:
//   Interstitial eCPM: $8–$20. Higher than banner ($5), lower than rewarded ($15–$40).
//
// SETUP (before going live):
//   1. In AdMob dashboard: Apps → your app → Ad units → Add ad unit → Interstitial
//   2. Copy the Ad Unit ID
//   3. Replace REAL_INTERSTITIAL_ID_ANDROID below with your real ID

import { useRef, useEffect, useCallback } from 'react';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
import { IS_PRODUCTION } from './AdBanner';

// ─── Ad Unit IDs ──────────────────────────────────────────────────────────────
const TEST_INTERSTITIAL_ID_ANDROID = 'ca-app-pub-3940256099942544/1033173712';
const REAL_INTERSTITIAL_ID_ANDROID = 'ca-app-pub-REPLACE_ME/REPLACE_ME';

const INTERSTITIAL_ID = IS_PRODUCTION
  ? REAL_INTERSTITIAL_ID_ANDROID
  : TEST_INTERSTITIAL_ID_ANDROID;

// Show interstitial every N gate game completions
const SHOW_EVERY_N_GAMES = 3;

// ─── Lazy SDK import ──────────────────────────────────────────────────────────
let InterstitialAdSDK: any = null;
let AdEventType: any = null;

try {
  const AdMob = require('react-native-google-mobile-ads');
  InterstitialAdSDK = AdMob.InterstitialAd;
  AdEventType = AdMob.AdEventType;
} catch {
  // Expo Go / missing native module — hook is a safe no-op
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAdInterstitial() {
  const { isPro } = useSubscriptionStore();
  const adRef       = useRef<any>(null);
  const loadedRef   = useRef(false);
  const countRef    = useRef(0); // how many times maybeShowInterstitial has been called

  // Preload the first ad on mount
  useEffect(() => {
    if (isPro || !InterstitialAdSDK) return;

    const loadAd = () => {
      const ad = InterstitialAdSDK.createForAdRequest(INTERSTITIAL_ID, {
        requestNonPersonalizedAdsOnly: false,
      });
      adRef.current = ad;
      loadedRef.current = false;

      const unsubLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
        loadedRef.current = true;
      });
      const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
        // Ad was dismissed — preload the next one immediately
        loadedRef.current = false;
        loadAd();
      });
      const unsubError = ad.addAdEventListener(AdEventType.ERROR, () => {
        loadedRef.current = false;
        // Retry after 30s on error
        setTimeout(loadAd, 30_000);
      });

      ad.load();

      return () => {
        unsubLoaded();
        unsubClosed();
        unsubError();
      };
    };

    const cleanup = loadAd();
    return cleanup;
  }, [isPro]);

  // Call this after each gate game completes.
  // Shows the interstitial every SHOW_EVERY_N_GAMES calls; otherwise a no-op.
  const maybeShowInterstitial = useCallback(async () => {
    if (isPro || !InterstitialAdSDK) return;

    countRef.current += 1;

    if (countRef.current % SHOW_EVERY_N_GAMES !== 0) return;
    if (!loadedRef.current || !adRef.current) return;

    try {
      await adRef.current.show();
    } catch {
      // Show failed — continue to post-game screen without interruption
    }
  }, [isPro]);

  return { maybeShowInterstitial };
}
