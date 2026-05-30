// ─── Subscription Store ─────────────────────────────────────────────────────── //
//
// Tracks whether the user has an active NoGoon subscription (New Leaf or Partner).
// Used throughout the app to:
//   - Show/hide premium features
//   - Decide whether to charge points for unlocks
//   - Route to the paywall when free users try premium features
//
// The actual billing is handled by RevenueCat (lib/purchases.ts).
// This store just holds the current subscription state so any
// component can read it without making a network call.
//
// Both "New Leaf" ($2.88/mo) and "Partner" ($8/mo) grant the
// "nogoon_pro" entitlement — isPro covers either tier.

import { create } from 'zustand';
import {
  checkProStatus,
  getOfferings,
  purchasePackage,
  restorePurchases,
  initializePurchases,
  isPurchasesAvailable,
} from '@/lib/purchases';
import type { RCPackage } from '@/types/purchases';

// ─── Launch Promo ───────────────────────────────────────────────────────────── //
// All users get free Pro access until this date. Lets the app build a user base
// before requiring payment. To extend: change the date. To end early: set to past.
const LAUNCH_PROMO_END = new Date('2026-09-01T00:00:00Z');

export function isLaunchPromoActive(): boolean {
  return new Date() < LAUNCH_PROMO_END;
}

export function launchPromoDaysLeft(): number {
  const now = new Date();
  const diff = LAUNCH_PROMO_END.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// ─── Types ──────────────────────────────────────────────────────────────────── //
interface SubscriptionState {
  // Is the user subscribed to NoGoon Pro?
  isPro: boolean;

  // True while we're checking subscription status with RevenueCat
  loading: boolean;

  // The available subscription + point pack products from Google Play
  // (these are real objects from RevenueCat with localized prices)
  offerings: RCPackage[];

  // ── Developer / testing override ──────────────────────────────────────────
  // Forces isPro = true regardless of RevenueCat status.
  // ONLY for testing during development — lets you test Pro features without
  // a real subscription. Toggle in Profile → Developer Mode.
  devModeEnabled: boolean;
  toggleDevMode: () => void;

  // ── Actions ──
  // Initialize: check subscription status on app startup
  initialize: (userId: string) => Promise<void>;

  // Re-check status (call after a purchase or restore)
  refresh: () => Promise<void>;

  // Trigger a purchase of a specific package
  purchase: (pkg: RCPackage) => Promise<boolean>;

  // Restore purchases from Google Play Store
  restore: () => Promise<boolean>;
}

// ─── Store ──────────────────────────────────────────────────────────────────── //
export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  isPro: false,
  loading: true,
  offerings: [],
  devModeEnabled: false,

  // ── toggleDevMode ─────────────────────────────────────────────────────────
  // Flips the dev override on/off. When on, isPro is forced true everywhere.
  // This overrides whatever RevenueCat returns — purely for local testing.
  toggleDevMode: () => {
    const next = !get().devModeEnabled;
    set({ devModeEnabled: next });
    // If turning dev mode on, immediately set isPro true.
    // If turning off, re-fetch real status from RevenueCat.
    if (next) {
      set({ isPro: true });
    } else {
      get().refresh();
    }
  },

  // ── initialize ────────────────────────────────────────────────────────────
  // Called from _layout.tsx after the user logs in.
  // Sets up RevenueCat with the user's ID and fetches their subscription status.
  // Priority chain: dev mode → launch promo → RevenueCat
  initialize: async (userId: string) => {
    set({ loading: true });

    // Start RevenueCat and link to this user's account
    await initializePurchases(userId);

    // Dev mode always wins
    if (get().devModeEnabled) {
      set({ isPro: true, loading: false });
      return;
    }

    // Launch promo grants free Pro — no need to check RevenueCat
    if (isLaunchPromoActive()) {
      // Still fetch offerings so the paywall can show prices for after promo
      try {
        const offerings = await getOfferings();
        set({ isPro: true, offerings, loading: false });
      } catch {
        set({ isPro: true, offerings: [], loading: false });
      }
      return;
    }

    try {
      // Fetch subscription status and available products in parallel
      const [proStatus, offerings] = await Promise.all([
        checkProStatus(),
        getOfferings(),
      ]);

      set({ isPro: proStatus, offerings, loading: false });
    } catch {
      // If this fails (no internet, RevenueCat key not set), just default to free
      set({ isPro: false, offerings: [], loading: false });
    }
  },

  // ── refresh ────────────────────────────────────────────────────────────────
  // Re-checks subscription status without re-initializing.
  // Call this after a purchase completes or after restoring.
  refresh: async () => {
    // If dev mode is on, don't overwrite isPro with the real RevenueCat value
    if (get().devModeEnabled) return;

    // During launch promo, keep Pro active
    if (isLaunchPromoActive()) {
      set({ isPro: true });
      return;
    }

    try {
      const proStatus = await checkProStatus();
      set({ isPro: proStatus });
    } catch {
      // Silently ignore network errors
    }
  },

  // ── purchase ──────────────────────────────────────────────────────────────
  // Triggers the native purchase sheet for a specific package.
  // The package objects come from offerings[] — pass them directly.
  purchase: async (pkg: RCPackage): Promise<boolean> => {
    try {
      const success = await purchasePackage(pkg);
      if (success) {
        await get().refresh();
      }
      return success;
    } catch (e: unknown) {
      // Re-throw so the UI can show a specific error message if needed
      throw e;
    }
  },

  // ── restore ────────────────────────────────────────────────────────────────
  // Required by Google. Lets users get back their subscription if they
  // reinstalled the app or switched phones.
  restore: async (): Promise<boolean> => {
    try {
      const hasActive = await restorePurchases();
      if (hasActive) {
        await get().refresh();
      }
      return hasActive;
    } catch {
      return false;
    }
  },
}));
