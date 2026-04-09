// ─── RevenueCat Purchases Client ──────────────────────────────────────────────
//
// RevenueCat is the service that handles all subscription billing and in-app
// purchases. It works across both iOS (App Store) and Android (Google Play)
// using a single API, so you don't have to build separate billing systems.
//
// HOW TO SET THIS UP:
//   1. Go to app.revenuecat.com → Create account → New Project
//   2. Add your iOS app and/or Android app
//   3. In RevenueCat Dashboard → Project Settings → API Keys
//   4. Copy the "Public SDK key" for each platform
//   5. Paste the keys below as REVENUECAT_IOS_KEY and REVENUECAT_ANDROID_KEY
//
// HOW IT CONNECTS TO THE APP STORES:
//   - For iOS: In App Store Connect → create a subscription product with
//     Product ID: "gate_pro_monthly" and price $2.88/month
//   - For Android: In Google Play Console → create a subscription with
//     the same Product IDs
//   - Then link those products to RevenueCat in their dashboard
//
// PRODUCT IDs (must match exactly in App Store Connect / Google Play):
//   gate_pro_monthly    — $2.88/month GATE Pro subscription
//   gate_points_500     — $0.99 one-time purchase for 500 points
//   gate_points_1500    — $1.99 one-time purchase for 1,500 points
//   gate_points_5000    — $4.99 one-time purchase for 5,000 points
//
// ⚠️ IMPORTANT: react-native-purchases requires a native build (EAS Build).
//    It will NOT work in Expo Go. The app will show the paywall UI but
//    actual purchases won't process until you build with EAS.

import { Platform, NativeModules } from 'react-native';

// ─── YOUR REVENUECAT API KEYS ─────────────────────────────────────────────────
// ⚠️  Paste your keys here. Get them from: app.revenuecat.com → Settings → API Keys

const REVENUECAT_IOS_KEY     = 'appl_PASTE_YOUR_IOS_KEY_HERE';
const REVENUECAT_ANDROID_KEY = 'goog_PASTE_YOUR_ANDROID_KEY_HERE';

// ─── Product IDs ──────────────────────────────────────────────────────────────
// These must exactly match the Product IDs you create in App Store Connect
// and Google Play Console.

export const PRODUCT_IDS = {
  PRO_MONTHLY:   'gate_pro_monthly',   // $2.88/month subscription
  POINTS_500:    'gate_points_500',    // $0.99 → 500 points
  POINTS_1500:   'gate_points_1500',   // $1.99 → 1,500 points
  POINTS_5000:   'gate_points_5000',   // $4.99 → 5,000 points
} as const;

// ─── Safe check for native module availability ────────────────────────────────
// In Expo Go, react-native-purchases isn't available. We check before calling
// any methods so the app doesn't crash during development.

let Purchases: any = null;

try {
  // This import will succeed in a proper EAS build but fail in Expo Go
  Purchases = require('react-native-purchases').default;
} catch {
  // Expected in Expo Go — silently skip
  console.log('[Purchases] react-native-purchases not available (Expo Go)');
}

export const isPurchasesAvailable = !!Purchases;

// ─── Initialize RevenueCat ────────────────────────────────────────────────────
// Called once on app startup (from _layout.tsx, after auth is ready).
// Must be called before any purchase methods are used.

export async function initializePurchases(userId: string): Promise<void> {
  if (!Purchases) return;

  try {
    const apiKey = Platform.OS === 'ios'
      ? REVENUECAT_IOS_KEY
      : REVENUECAT_ANDROID_KEY;

    // Configure with the API key
    Purchases.configure({ apiKey });

    // Link this RevenueCat user to the Supabase user ID so purchases
    // are associated with the right account across devices
    await Purchases.logIn(userId);
  } catch (e) {
    console.warn('[Purchases] Failed to initialize RevenueCat:', e);
  }
}

// ─── Check subscription status ────────────────────────────────────────────────
// Returns true if the user has an active GATE Pro subscription.

export async function checkProStatus(): Promise<boolean> {
  if (!Purchases) return false;
  try {
    const info = await Purchases.getCustomerInfo();
    // entitlements.active contains any currently active subscriptions
    return info.entitlements.active['gate_pro'] !== undefined;
  } catch {
    return false;
  }
}

// ─── Get available packages ───────────────────────────────────────────────────
// Returns the subscription and point pack products from App Store / Play Store.
// These have real prices localized to the user's country.

export async function getOfferings(): Promise<any[]> {
  if (!Purchases) return [];
  try {
    const offerings = await Purchases.getOfferings();
    if (offerings.current?.availablePackages) {
      return offerings.current.availablePackages;
    }
    return [];
  } catch {
    return [];
  }
}

// ─── Purchase a package ───────────────────────────────────────────────────────
// Triggers the App Store / Google Play purchase sheet.
// Returns true on success, false if cancelled or failed.

export async function purchasePackage(pkg: any): Promise<boolean> {
  if (!Purchases) return false;
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo.entitlements.active['gate_pro'] !== undefined;
  } catch (e: any) {
    // userCancelled = user tapped "Cancel" — not an error, just do nothing
    if (e.userCancelled) return false;
    throw e;
  }
}

// ─── Restore previous purchases ──────────────────────────────────────────────
// Apple and Google require apps to offer a "Restore Purchases" button.
// This re-validates any past purchases the user already paid for.

export async function restorePurchases(): Promise<boolean> {
  if (!Purchases) return false;
  try {
    const info = await Purchases.restorePurchases();
    return info.entitlements.active['gate_pro'] !== undefined;
  } catch {
    return false;
  }
}
