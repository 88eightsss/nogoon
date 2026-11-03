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
import { IS_PRODUCTION, isAdIdConfigured } from './AdBanner';

// ─── Ad Unit IDs ──────────────────────────────────────────────────────────────
const TEST_INTERSTITIAL_ID_ANDROID = 'ca-app-pub-3940256099942544/1033173712';
const REAL_INTERSTITIAL_ID_ANDROID = 'ca-app-pub-REPLACE_ME/REPLACE_ME';

const INTERSTITIAL_ID = IS_PRODUCTION
  ? REAL_INTERSTITIAL_ID_ANDROID
  : TEST_INTERSTITIAL_ID_ANDROID;

// Show interstitial every N gate game completions
const SHOW_EVERY_N_GAMES = 2;

// ─── Lazy SDK import ──────────────────────────────────────────────────────────
let InterstitialAdSDK: any = null;
let AdEventType: any = null;

try {
  // The AdMob package was removed (e3a6dc1): NoGoon ships with no third-party ads.
  // A static require would still make Metro look for it, so this throws into the catch below.
  const AdMob: any = null; if (!AdMob) throw new Error('ads removed');
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
    if (isPro || !InterstitialAdSDK || !isAdIdConfigured(INTERSTITIAL_ID)) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    // Listener unsubscribers for the ad currently loaded. Replaced on every reload
    // so each ad's listeners are removed, not just the first one's.
    let unsubs: Array<() => void> = [];

    const clearListeners = () => {
      unsubs.forEach((unsub) => unsub());
      unsubs = [];
    };

    const loadAd = () => {
      if (cancelled) return;
      clearListeners();

      const ad = InterstitialAdSDK.createForAdRequest(INTERSTITIAL_ID, {
        requestNonPersonalizedAdsOnly: false,
      });
      adRef.current = ad;
      loadedRef.current = false;

      unsubs = [
        ad.addAdEventListener(AdEventType.LOADED, () => {
          loadedRef.current = true;
        }),
        ad.addAdEventListener(AdEventType.CLOSED, () => {
          // Ad was dismissed — preload the next one immediately
          loadedRef.current = false;
          loadAd();
        }),
        ad.addAdEventListener(AdEventType.ERROR, () => {
          loadedRef.current = false;
          // Retry after 30s on error
          if (retryTimer) clearTimeout(retryTimer);
          retryTimer = setTimeout(loadAd, 30_000);
        }),
      ];

      ad.load();
    };

    loadAd();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      clearListeners();
      adRef.current = null;
      loadedRef.current = false;
    };
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
