// ─── Paywall (retired) ───────────────────────────────────────────────────────
//
// NoGoon is free — all features are included. This screen is kept as a
// dead-end route so any old deep-links don't crash. It immediately redirects
// back to the home tab.
//
// Monetization is planned for later, not deleted: the RevenueCat scaffolding
// in lib/purchases.ts and the ad-wall.tsx contrast screen ("see what you're
// protected from") are both still here, intentionally dormant, waiting for
// this screen to be rebuilt when that work actually starts.

import { useEffect } from 'react';
import { router } from 'expo-router';

export default function PaywallScreen() {
  useEffect(() => {
    router.replace('/');
  }, []);

  return null;
}
