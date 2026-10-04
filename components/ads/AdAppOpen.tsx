// ─── AdAppOpen — App Open Ad Hook ────────────────────────────────────────────
//
// Shows a full-screen App Open Ad every time the app comes to the foreground.
// In NoGoon, this fires on every blocking intercept — each time the user is
// routed into the gate screen. Highest-frequency full-screen ad format in the
// app because NoGoon gets opened many times per session.
//
// HOW IT WORKS:
//   1. Call useAdAppOpen() once in the root _layout.tsx.
//   2. An ad is preloaded immediately on mount.
//   3. Each time AppState transitions to 'active' (app foreground), the
//      preloaded ad shows if ready. A new ad is queued immediately after close.
//
// SETUP (before going live):
//   1. AdMob dashboard → your app → Ad units → Add ad unit → App Open
//   2. Copy the Ad Unit ID
//   3. Replace REAL_APP_OPEN_ID_ANDROID below with your real ID
//
// FREQUENCY CAP: Google enforces a 4-hour minimum between App Open Ads
//   automatically — no counting needed on our side.
//
// REVENUE: App Open eCPM $8–$25, fires far more often than interstitials
//   because every NoGoon intercept is a foreground event.

import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
import { IS_PRODUCTION, isAdIdConfigured } from './AdBanner';

// ─── Ad Unit IDs ──────────────────────────────────────────────────────────────
const TEST_APP_OPEN_ID_ANDROID = 'ca-app-pub-3940256099942544/3419835294';
const REAL_APP_OPEN_ID_ANDROID = 'ca-app-pub-REPLACE_ME/REPLACE_ME';

const APP_OPEN_ID = IS_PRODUCTION
  ? REAL_APP_OPEN_ID_ANDROID
  : TEST_APP_OPEN_ID_ANDROID;

// ─── Lazy SDK import ──────────────────────────────────────────────────────────
let AppOpenAdSDK: any = null;
let AdEventType: any = null;

try {
  const AdMob   = require('react-native-google-mobile-ads');
  AppOpenAdSDK  = AdMob.AppOpenAd;
  AdEventType   = AdMob.AdEventType;
} catch {
  // Expo Go / missing native module — hook is a safe no-op
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAdAppOpen() {
  const { isPro }  = useSubscriptionStore();
  const adRef      = useRef<any>(null);
  const loadedRef  = useRef(false);
  const loadingRef = useRef(false);
  // Keep a ref so the AppState callback never captures a stale isPro value
  const isProRef   = useRef(isPro);
  useEffect(() => { isProRef.current = isPro; }, [isPro]);

  useEffect(() => {
    if (isPro || !AppOpenAdSDK || !isAdIdConfigured(APP_OPEN_ID)) return;

    let cleanupListeners: (() => void) | undefined;

    function loadAd() {
      if (loadingRef.current || isProRef.current) return;
      loadingRef.current = true;

      const ad = AppOpenAdSDK.createForAdRequest(APP_OPEN_ID, {
        requestNonPersonalizedAdsOnly: false,
      });
      adRef.current = ad;

      const unsubLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
        loadedRef.current  = true;
        loadingRef.current = false;
      });
      const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
        loadedRef.current  = false;
        loadingRef.current = false;
        loadAd(); // queue next ad immediately after dismiss
      });
      const unsubError = ad.addAdEventListener(AdEventType.ERROR, () => {
        loadedRef.current  = false;
        loadingRef.current = false;
        setTimeout(loadAd, 30_000); // retry after 30s on error
      });

      ad.load();

      cleanupListeners = () => {
        unsubLoaded();
        unsubClosed();
        unsubError();
      };
    }

    loadAd();

    // Show the preloaded ad every time app comes to foreground
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (
        nextState === 'active'
        && loadedRef.current
        && adRef.current
        && !isProRef.current
      ) {
        adRef.current.show().catch(() => {
          // Show can fail if another ad is already visible — safe to ignore
        });
      }
    });

    return () => {
      appStateSub.remove();
      cleanupListeners?.();
    };
  }, [isPro]);
}
