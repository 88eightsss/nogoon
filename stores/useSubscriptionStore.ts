// ─── Subscription Store ───────────────────────────────────────────────────────
//
// Tracks whether the user has an active GATE Pro subscription.
// Used throughout the app to:
//   - Show/hide Pro features
//   - Decide whether to charge points for unlocks
//   - Route to the paywall when non-Pro users try Pro features
//
// The actual billing is handled by RevenueCat (lib/purchases.ts).
// This store just holds the current subscription state so any
// component can read it without making a network call.

import { create } from 'zustand';
import {
  checkProStatus,
  getOfferings,
  purchasePackage,
  restorePurchases,
  initializePurchases,
  isPurchasesAvailable,
} from '@/lib/purchases';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubscriptionState {
  // Is the user subscribed to GATE Pro?
  isPro: boolean;

  // True while we're checking subscription status with RevenueCat
  loading: boolean;

  // The available subscription + point pack products from the App Store
  // (these are real objects from RevenueCat with localized prices)
  offerings: any[];

  // ── Actions ──
  // Initialize: check subscription status on app startup
  initialize: (userId: string) => Promise<void>;

  // Re-check status (call after a purchase or restore)
  refresh: () => Promise<void>;

  // Trigger a purchase of a specific package
  purchase: (pkg: any) => Promise<boolean>;

  // Restore purchases from the App Store / Play Store
  restore: () => Promise<boolean>;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  isPro:     false,
  loading:   true,
  offerings: [],

  // ── initialize ────────────────────────────────────────────────────────────
  // Called from _layout.tsx after the user logs in.
  // Sets up RevenueCat with the user's ID and fetches their subscription status.

  initialize: async (userId: string) => {
    set({ loading: true });

    // Start RevenueCat and link to this user's account
    await initializePurchases(userId);

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

  purchase: async (pkg: any): Promise<boolean> => {
    try {
      const success = await purchasePackage(pkg);
      if (success) {
        await get().refresh();
      }
      return success;
    } catch (e: any) {
      // Re-throw so the UI can show a specific error message if needed
      throw e;
    }
  },

  // ── restore ────────────────────────────────────────────────────────────────
  // Required by Apple. Lets users get back their subscription if they
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
