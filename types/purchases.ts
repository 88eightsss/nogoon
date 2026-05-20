// ─── RevenueCat Type Definitions ─────────────────────────────────────────── //
//
// Replaces all `any` types in lib/purchases.ts and stores/useSubscriptionStore.ts.
// Import these wherever RevenueCat objects are used.
//
// Based on react-native-purchases SDK types. If you install @types/react-native-purchases
// or the SDK ships its own types, you can delete this file and use those instead.

/** A product available for purchase (subscription or one-time) */
export interface RCProduct {
  identifier: string;
  description: string;
  title: string;
  price: number;
  priceString: string;
  currencyCode: string;
  introPrice: RCIntroPrice | null;
  productCategory: 'SUBSCRIPTION' | 'NON_SUBSCRIPTION';
  productType: 'AUTO_RENEWABLE_SUBSCRIPTION' | 'NON_CONSUMABLE' | 'CONSUMABLE';
  subscriptionPeriod?: string;
}

/** Introductory pricing info for a subscription */
export interface RCIntroPrice {
  price: number;
  priceString: string;
  period: string;
  cycles: number;
  periodUnit: string;
  periodNumberOfUnits: number;
}

/** An available package (wraps a product with a package type) */
export interface RCPackage {
  identifier: string;
  packageType: 'MONTHLY' | 'ANNUAL' | 'WEEKLY' | 'LIFETIME' | 'CUSTOM';
  product: RCProduct;
  offeringIdentifier: string;
}

/** An offering (a group of packages) */
export interface RCOffering {
  identifier: string;
  serverDescription: string;
  metadata: Record<string, unknown>;
  availablePackages: RCPackage[];
  monthly: RCPackage | null;
  annual: RCPackage | null;
  weekly: RCPackage | null;
  lifetime: RCPackage | null;
}

/** All current offerings */
export interface RCOfferings {
  current: RCOffering | null;
  all: Record<string, RCOffering>;
}

/** Info about an active entitlement */
export interface RCEntitlementInfo {
  identifier: string;
  isActive: boolean;
  willRenew: boolean;
  periodType: 'NORMAL' | 'INTRO' | 'TRIAL';
  latestPurchaseDate: string;
  originalPurchaseDate: string;
  expirationDate: string | null;
  store: 'PLAY_STORE' | 'APP_STORE' | 'STRIPE' | 'PROMOTIONAL';
  productIdentifier: string;
  isSandbox: boolean;
  unsubscribeDetectedAt: string | null;
  billingIssueDetectedAt: string | null;
}

/** Customer info returned after purchase or restore */
export interface RCCustomerInfo {
  entitlements: {
    active: Record<string, RCEntitlementInfo>;
    all: Record<string, RCEntitlementInfo>;
  };
  activeSubscriptions: string[];
  allPurchasedProductIdentifiers: string[];
  latestExpirationDate: string | null;
  firstSeen: string;
  originalAppUserId: string;
  managementURL: string | null;
  originalPurchaseDate: string | null;
  nonSubscriptionTransactions: RCTransaction[];
}

/** A non-subscription transaction (point packs, etc.) */
export interface RCTransaction {
  transactionIdentifier: string;
  productIdentifier: string;
  purchaseDate: string;
}

/** Result of a purchase attempt */
export interface RCPurchaseResult {
  customerInfo: RCCustomerInfo;
  productIdentifier: string;
}

// ─── Usage ──────────────────────────────────────────────────────────────────── //
//
// In lib/purchases.ts, replace:
//   catch (error: any) → catch (error: unknown)
//   (offerings: any) → (offerings: RCOfferings)
//   (customerInfo: any) → (customerInfo: RCCustomerInfo)
//   (result: any) → (result: RCPurchaseResult)
//
// In stores/useSubscriptionStore.ts, replace:
//   (info: any) → (info: RCCustomerInfo)
//
// Import like:
//   import type { RCCustomerInfo, RCOfferings, RCPurchaseResult } from '@/types/purchases';
