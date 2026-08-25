// ─── Paywall (retired) ───────────────────────────────────────────────────────
//
// NoGoon is free — all features are included. This screen is kept as a
// dead-end route so any old deep-links don't crash. It immediately redirects
// back to the home tab.

import { useEffect } from 'react';
import { router } from 'expo-router';

export default function PaywallScreen() {
  useEffect(() => {
    router.replace('/');
  }, []);

  return null;
}
