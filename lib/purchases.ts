// ─── RevenueCat Purchases Client ────────────────────────────────────────────── //
//
// RevenueCat is the service that handles all subscription billing and in-app
// purchases. Currently Android-only (Google Play) via a single API.
//
// HOW TO SET THIS UP:
//   1. Go to app.revenuecat.com → Create account → New Project
//   2. Add your Android app
//   3. In RevenueCat Dashboard → Project Settings → API Keys
//   4. Copy the "Public SDK key" (production key starts with goog_)
//   5. Paste the key below as REVENUECAT_ANDROID_KEY
//
// HOW IT CONNECTS TO GOOGLE PLAY:
//   - In Google Play Console → create subscriptions with the Product IDs below
//   - Then link those products to RevenueCat in their dashboard
//   - Create an entitlement called "nogoon_pro" in RevenueCat and attach
//     both subscription products to it
//
// SUBSCRIPTION TIERS:
//   nogoon_basic_monthly — $2.88/month  "New Leaf" (core features)
//   nogoon_partner       — $8.00/month  "Partner"  (Pro + partner tools)
//
// POINT PACKS (one-time consumable purchases):
//   nogoon_points_500    — $0.99 → 500 points
//   nogoon_points_1500   — $1.99 → 1,500 points
//   nogoon_points_5000   — $4.99 → 5,000 points
//
// ⚠️ IMPORTANT: react-native-purchases requires a native build (EAS Build).
//    It will NOT work in Expo Go. The app will show the paywall UI but
//    actual purchases won't process until you build with EAS.

import type {
  RCCustomerInfo,
  RCOfferings,
  RCPackage,
  RCPurchaseResult,
} from '@/types/purchases';

// ─── YOUR REVENUECAT API KEYS ───────────────────────────────────────────────── //
// ⚠️ TODO: Before release, replace the test key below with your PRODUCTION key.
//    Go to: app.revenuecat.com → Project Settings → API Keys → copy the goog_ key.
const REVENUECAT_ANDROID_KEY = 'test_cAEXmoziVycrJWMJaJDHdwPleDy'; // ← SWAP TO goog_ BEFORE LAUNCH

// ─── Product IDs ────────────────────────────────────────────────────────────── //
// These must exactly match the Product IDs you create in Google Play Console
// and link in the RevenueCat dashboard.
export const PRODUCT_IDS = {
  // Subscriptions
  NEW_LEAF: 'nogoon_basic_monthly',  // $2.88/month — "New Leaf" tier
  PARTNER: 'nogoon_partner',         // $8.00/month — "Partner" tier (Pro + partner tools)

  // Point packs (one-time consumable)
  POINTS_500: 'nogoon_points_500',   // $0.99 → 500 points
  POINTS_1500: 'nogoon_points_1500', // $1.99 → 1,500 points
  POINTS_5000: 'nogoon_points_5000', // $4.99 → 5,000 points
} as const;

// ─── Safe check for native module availability ──────────────────────────────── //
// In Expo Go, react-native-purchases isn't available. We check before calling
// any methods so the app doesn't crash during development.

// The Purchases SDK module — typed loosely since it may not be available
let Purchases: {
  configure: (config: { apiKey: string }) => void;
  logIn: (userId: string) => Promise<{ customerInfo: RCCustomerInfo }>;
  getCustomerInfo: () => Promise<RCCustomerInfo>;
  getOfferings: () => Promise<RCOfferings>;
  purchasePackage: (pkg: RCPackage) => Promise<RCPurchaseResult>;
  restorePurchases: () => Promise<RCCustomerInfo>;
} | null = null;

try {
  // This import will succeed in a proper EAS build but fail in Expo Go
  Purchases = require('react-native-purchases').default;
} catch {
  // Expected in Expo Go — silently skip
  console.log('[Purchases] react-native-purchases not available (Expo Go)');
}

export const isPurchasesAvailable = !!Purchases;

// ─── Initialize RevenueCat ──────────────────────────────────────────────────── //
// Called once on app startup (from _layout.tsx, after auth is ready).
// Must be called before any purchase methods are used.
export async function initializePurchases(userId: string): Promise<void> {
  if (!Purchases) return;

  try {
    // Android-only for now
    Purchases.configure({ apiKey: REVENUECAT_ANDROID_KEY });

    // Link this RevenueCat user to the Supabase user ID so purchases
    // are associated with the right account across devices
    await Purchases.logIn(userId);
  } catch (e: unknown) {
    console.warn('[Purchases] Failed to initialize RevenueCat:', e);
  }
}

// ─── Check subscription status ──────────────────────────────────────────────── //
// Returns true if the user has an active NoGoon subscription (New Leaf or Partner).
export async function checkProStatus(): Promise<boolean> {
  if (!Purchases) return false;

  try {
    const info: RCCustomerInfo = await Purchases.getCustomerInfo();
    // entitlements.active contains any currently active subscriptions
    return info.entitlements.active['nogoon_pro'] !== undefined;
  } catch {
    return false;
  }
}

// ─── Get available packages ─────────────────────────────────────────────────── //
// Returns the subscription and point pack products from Google Play Store.
// These have real prices localized to the user's country.
export async function getOfferings(): Promise<RCPackage[]> {
  if (!Purchases) return [];

  try {
    const offerings: RCOfferings = await Purchases.getOfferings();
    if (offerings.current?.availablePackages) {
      return offerings.current.availablePackages;
    }
    return [];
  } catch {
    return [];
  }
}

// ─── Purchase a package ─────────────────────────────────────────────────────── //
// Triggers the Google Play purchase sheet.
// Returns true on success, false if cancelled or failed.
export async function purchasePackage(pkg: RCPackage): Promise<boolean> {
  if (!Purchases) return false;

  try {
    const result: RCPurchaseResult = await Purchases.purchasePackage(pkg);
    return result.customerInfo.entitlements.active['nogoon_pro'] !== undefined;
  } catch (e: unknown) {
    // userCancelled = user tapped "Cancel" — not an error, just do nothing
    if (e && typeof e === 'object' && 'userCancelled' in e && (e as { userCancelled: boolean }).userCancelled) {
      return false;
    }
    throw e;
  }
}

// ─── Restore previous purchases ────────────────────────────────────────────── //
// Google requires apps to offer a "Restore Purchases" button.
// This re-validates any past purchases the user already paid for.
export async function restorePurchases(): Promise<boolean> {
  if (!Purchases) return false;

  try {
    const info: RCCustomerInfo = await Purchases.restorePurchases();
    return info.entitlements.active['nogoon_pro'] !== undefined;
  } catch {
    return false;
  }
}
