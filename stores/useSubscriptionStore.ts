// ─── Subscription Store ───────────────────────────────────────────────────── //
//
// NoGoon is free — all features are included.
// This store exists for backward compat; isPro is always true.

import { create } from 'zustand';

interface SubscriptionState {
  isPro: boolean;
  loading: boolean;
  devModeEnabled: boolean;
  toggleDevMode: () => void;
  initialize: (_userId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export const useSubscriptionStore = create<SubscriptionState>(() => ({
  isPro: true,
  loading: false,
  devModeEnabled: false,
  toggleDevMode: () => {},
  initialize: async () => {},
  refresh: async () => {},
}));

// Legacy helpers — kept so any imports don't break
export function isLaunchPromoActive(): boolean { return true; }
export function launchPromoDaysLeft(): number { return 0; }
