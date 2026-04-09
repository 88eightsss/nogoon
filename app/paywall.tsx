// ═══════════════════════════════════════════════════════════════════════════
//  NoGoon PAYWALL  —  3 subscription tiers + point packs
//  ─────────────────────────────────────────────────────
//  Shown when:
//    - User taps "Upgrade" from Profile
//    - User tries a Pro feature or runs out of points
//
//  TIERS:
//    Free          — $0/month       (5 unlocks/month, ads, basic games)
//    NoGoon        — $2.88/month    (unlimited unlocks, all games, no ads)
//    NoGoon Pro    — $4.22/month    (everything + streak protection, insights,
//                    $39.99/year     custom duration, BRICKED mode)
//    Pro + Partner — $8/month flat  (everything Pro + accountability partner)
//
//  Billing runs through RevenueCat. Add your API key to lib/purchases.ts
//  and create matching products in App Store Connect / Google Play.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
import { useUserStore } from '@/stores/useUserStore';
import { isPurchasesAvailable } from '@/lib/purchases';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

// ─── Subscription tier definitions ────────────────────────────────────────────
//
// Each tier card shows a price, a feature list, and a subscribe button.
// The productId must match exactly what you create in RevenueCat.

const TIERS = [
  {
    id:          'nogoon_monthly',
    name:        'NoGoon',
    price:       '$2.88',
    period:      '/ month',
    tagline:     'The essentials — no limits',
    color:       COLORS.green,
    highlight:   false,
    features: [
      { icon: 'infinite-outline',        label: 'Unlimited site unlocks'      },
      { icon: 'game-controller-outline', label: 'All mini-games unlocked'     },
      { icon: 'cloud-outline',           label: 'Cloud sync across devices'   },
      { icon: 'close-circle-outline',    label: 'No ads, ever'                },
    ],
  },
  {
    id:          'nogoon_pro_monthly',
    name:        'NoGoon Pro',
    price:       '$4.22',
    period:      '/ month',
    annualId:    'nogoon_pro_annual',
    annualPrice: '$39.99 / year',
    annualSave:  'Save $10',
    tagline:     'Maximum control over your mind',
    color:       COLORS.purple,
    highlight:   true, // shown as the recommended option
    features: [
      { icon: 'infinite-outline',        label: 'Everything in NoGoon'              },
      { icon: 'shield-checkmark-outline',label: 'Streak protection (1 restore/month)' },
      { icon: 'bar-chart-outline',       label: 'Weekly insights & deep stats'      },
      { icon: 'timer-outline',           label: 'Custom game duration (30/60/90s)'  },
      { icon: 'cube-outline',            label: 'BRICKED hard mode'                 },
    ],
  },
  {
    id:          'nogoon_partner_monthly',
    name:        'Pro + Partner',
    price:       '$8',
    period:      '/ month',
    tagline:     'Add accountability to every block',
    color:       COLORS.cyan,
    highlight:   false,
    features: [
      { icon: 'checkmark-circle-outline', label: 'Everything in NoGoon Pro'         },
      { icon: 'people-outline',           label: 'Accountability partner setup'     },
      { icon: 'notifications-outline',    label: 'Partner notified on unlocks'      },
      { icon: 'heart-outline',            label: 'Shared progress reports'          },
    ],
  },
] as const;

// ─── Point pack definitions ───────────────────────────────────────────────────
// One-time purchases. Prices must match App Store Connect / Google Play exactly.

const POINT_PACKS = [
  {
    productId: 'nogoon_points_500',
    points:    500,
    price:     '$0.99',
    label:     '500 Points',
    sublabel:  '≈ 2–3 unlocks',
    color:     COLORS.textSecondary,
  },
  {
    productId: 'nogoon_points_1500',
    points:    1500,
    price:     '$1.99',
    label:     '1,500 Points',
    sublabel:  '≈ 7 unlocks',
    color:     COLORS.cyan,
    badge:     'Popular',
  },
  {
    productId: 'nogoon_points_5000',
    points:    5000,
    price:     '$4.99',
    label:     '5,000 Points',
    sublabel:  '≈ 25 unlocks',
    color:     COLORS.purple,
    badge:     'Best Value',
  },
] as const;

// ─── Main component ────────────────────────────────────────────────────────────

export default function PaywallScreen() {
  const { isPro, offerings, purchase, restore } = useSubscriptionStore();
  const { addPoints } = useUserStore();

  // Track which product is currently loading a purchase
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [restoring, setRestoring]   = useState(false);

  // Which Pro tier card is selected — defaults to the highlighted (recommended) one
  const [selectedTierId, setSelectedTierId] = useState<string>('nogoon_pro_monthly');

  // Whether the Pro card is showing the annual or monthly option
  const [proAnnual, setProAnnual] = useState(false);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const findPackage = (productId: string) =>
    offerings.find((pkg: any) => pkg.product?.identifier === productId);

  // ── Generic purchase handler — works for any subscription or point pack ──────

  const handlePurchase = useCallback(async (productId: string, label: string) => {
    if (!isPurchasesAvailable) {
      Alert.alert(
        'Not Ready Yet',
        'Purchases require a full app build. Run `eas build` first, then add your RevenueCat API key to lib/purchases.ts.',
        [{ text: 'OK' }]
      );
      return;
    }

    const pkg = findPackage(productId);
    if (!pkg) {
      Alert.alert(
        'Product Not Found',
        `Could not load "${productId}". Make sure it exists in your RevenueCat dashboard and is linked to App Store Connect / Google Play.`,
        [{ text: 'OK' }]
      );
      return;
    }

    setPurchasing(productId);
    try {
      const { purchase: doPurchase } = useSubscriptionStore.getState();
      await doPurchase(pkg);
      Alert.alert(`${label} activated! 🎉`, 'Your account has been upgraded.');
      router.back();
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert('Purchase Failed', e.message ?? 'Something went wrong. Please try again.');
      }
    } finally {
      setPurchasing(null);
    }
  }, [offerings]);

  const handleBuyPoints = useCallback(async (pack: typeof POINT_PACKS[number]) => {
    if (!isPurchasesAvailable) {
      Alert.alert('Not Ready Yet', 'Purchases require a full app build. Run `eas build` first.', [{ text: 'OK' }]);
      return;
    }
    const pkg = findPackage(pack.productId);
    if (!pkg) {
      Alert.alert('Product Not Found', `Could not find "${pack.productId}" in the store.`);
      return;
    }
    setPurchasing(pack.productId);
    try {
      const { purchase: doPurchase } = useSubscriptionStore.getState();
      await doPurchase(pkg);
      addPoints(pack.points);
      Alert.alert(`${pack.points.toLocaleString()} Points Added! 🎉`, 'Your balance has been updated.');
      router.back();
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert('Purchase Failed', e.message ?? 'Something went wrong.');
      }
    } finally {
      setPurchasing(null);
    }
  }, [offerings, addPoints]);

  const handleRestore = useCallback(async () => {
    setRestoring(true);
    try {
      const { restore: doRestore } = useSubscriptionStore.getState();
      const hasActive = await doRestore();
      if (hasActive) {
        Alert.alert('Purchases Restored', 'Your subscription has been restored.');
        router.back();
      } else {
        Alert.alert('Nothing to Restore', 'No previous purchases were found for this account.');
      }
    } catch {
      Alert.alert('Restore Failed', 'Please check your internet connection and try again.');
    } finally {
      setRestoring(false);
    }
  }, []);

  // ── Subscribe button handler — picks the right product based on selected tier + billing ──

  const handleSubscribeSelected = () => {
    const tier = TIERS.find((t) => t.id === selectedTierId);
    if (!tier) return;

    // If Pro is selected and annual toggle is on, use the annual product ID
    const productId =
      selectedTierId === 'nogoon_pro_monthly' && proAnnual && 'annualId' in tier
        ? tier.annualId
        : tier.id;

    handlePurchase(productId, tier.name);
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Close button ── */}
        <Pressable style={styles.closeButton} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={COLORS.textMuted} />
        </Pressable>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headline}>Choose your plan</Text>
          <Text style={styles.subheadline}>
            Upgrade at any time · Cancel any time
          </Text>
        </View>

        {/* ── Tier cards ── */}
        {TIERS.map((tier) => {
          const isSelected = selectedTierId === tier.id;
          return (
            <Pressable
              key={tier.id}
              style={[
                styles.tierCard,
                { borderColor: tier.color + (isSelected ? 'cc' : '33') },
                tier.highlight && styles.tierCardHighlighted,
                isSelected && { borderWidth: 2 },
              ]}
              onPress={() => setSelectedTierId(tier.id)}
            >
              {/* Recommended badge on the highlighted card */}
              {tier.highlight && (
                <View style={[styles.recommendedBadge, { backgroundColor: tier.color }]}>
                  <Text style={styles.recommendedText}>MOST POPULAR</Text>
                </View>
              )}

              {/* Tier name + price */}
              <View style={styles.tierHeader}>
                <View style={styles.tierNameGroup}>
                  <Text style={[styles.tierName, { color: tier.color }]}>{tier.name}</Text>
                  <Text style={styles.tierTagline}>{tier.tagline}</Text>
                </View>
                <View style={styles.tierPriceGroup}>
                  <Text style={[styles.tierPrice, { color: tier.color }]}>{tier.price}</Text>
                  <Text style={styles.tierPeriod}>{tier.period}</Text>
                </View>
              </View>

              {/* Annual billing toggle — Pro tier only */}
              {'annualId' in tier && isSelected && (
                <Pressable
                  style={styles.annualToggle}
                  onPress={() => setProAnnual((v) => !v)}
                >
                  <View style={[styles.annualToggleCheckbox, proAnnual && { backgroundColor: tier.color, borderColor: tier.color }]}>
                    {proAnnual && <Ionicons name="checkmark" size={12} color={COLORS.background} />}
                  </View>
                  <Text style={styles.annualToggleText}>
                    Annual — {tier.annualPrice}
                  </Text>
                  <View style={[styles.saveBadge, { backgroundColor: tier.color + '22', borderColor: tier.color + '55' }]}>
                    <Text style={[styles.saveBadgeText, { color: tier.color }]}>{tier.annualSave}</Text>
                  </View>
                </Pressable>
              )}

              {/* Feature list */}
              <View style={styles.featureList}>
                {tier.features.map((f) => (
                  <View key={f.label} style={styles.featureRow}>
                    <Ionicons name={f.icon as any} size={15} color={tier.color} />
                    <Text style={styles.featureLabel}>{f.label}</Text>
                  </View>
                ))}
              </View>

              {/* Selection indicator */}
              <View style={styles.tierSelectRow}>
                <View style={[
                  styles.radioCircle,
                  { borderColor: tier.color },
                  isSelected && { backgroundColor: tier.color },
                ]} />
                <Text style={[styles.tierSelectText, { color: isSelected ? tier.color : COLORS.textMuted }]}>
                  {isSelected ? 'Selected' : 'Tap to select'}
                </Text>
              </View>
            </Pressable>
          );
        })}

        {/* ── Already Pro ── */}
        {isPro ? (
          <View style={styles.alreadyProBadge}>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.green} />
            <Text style={styles.alreadyProText}>You're already subscribed ✓</Text>
          </View>
        ) : (
          <Pressable
            style={[
              styles.subscribeButton,
              { backgroundColor: TIERS.find((t) => t.id === selectedTierId)?.color ?? COLORS.purple },
              !!purchasing && styles.buttonLoading,
            ]}
            onPress={handleSubscribeSelected}
            disabled={!!purchasing}
          >
            {purchasing ? (
              <ActivityIndicator color={COLORS.background} />
            ) : (
              <View style={styles.subscribeInner}>
                {(() => {
                  const tier = TIERS.find((t) => t.id === selectedTierId);
                  const isAnnual = selectedTierId === 'nogoon_pro_monthly' && proAnnual && tier && 'annualPrice' in tier;
                  return (
                    <>
                      <Text style={styles.subscribePrice}>
                        {isAnnual && tier && 'annualPrice' in tier ? tier.annualPrice : `${tier?.price} ${tier?.period}`}
                      </Text>
                      <Text style={styles.subscribeLabel}>Start {tier?.name}</Text>
                    </>
                  );
                })()}
              </View>
            )}
          </Pressable>
        )}

        <Text style={styles.cancelNote}>
          Cancel any time · No hidden fees
        </Text>

        {/* ── Point Packs section ── */}
        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>Point Packs</Text>
        <Text style={styles.sectionSub}>
          One-time purchase · Use points to unlock sites without a subscription
        </Text>

        {POINT_PACKS.map((pack) => (
          <Pressable
            key={pack.productId}
            style={[
              styles.packCard,
              { borderColor: pack.color + '44' },
              purchasing === pack.productId && styles.buttonLoading,
            ]}
            onPress={() => handleBuyPoints(pack)}
            disabled={!!purchasing}
          >
            {'badge' in pack && (
              <View style={[styles.packBadge, { backgroundColor: pack.color + '22', borderColor: pack.color + '44' }]}>
                <Text style={[styles.packBadgeText, { color: pack.color }]}>{pack.badge}</Text>
              </View>
            )}
            <View style={styles.packLeft}>
              {purchasing === pack.productId ? (
                <ActivityIndicator color={pack.color} />
              ) : (
                <Ionicons name="ellipse" size={28} color={pack.color} />
              )}
              <View>
                <Text style={[styles.packLabel, { color: pack.color }]}>{pack.label}</Text>
                <Text style={styles.packSublabel}>{pack.sublabel}</Text>
              </View>
            </View>
            <Text style={[styles.packPrice, { color: pack.color }]}>{pack.price}</Text>
          </Pressable>
        ))}

        {/* ── Not set up notice (Expo Go / before RevenueCat is configured) ── */}
        {!isPurchasesAvailable && (
          <View style={styles.notReadyBanner}>
            <Text style={styles.notReadyText}>
              ℹ️  Purchases are not active yet.{'\n'}
              To activate: add your RevenueCat API key to{' '}
              <Text style={styles.code}>lib/purchases.ts</Text>, create the
              products in App Store Connect / Google Play, then run an EAS build.
            </Text>
          </View>
        )}

        {/* ── Restore purchases ── */}
        <Pressable style={styles.restoreButton} onPress={handleRestore} disabled={restoring}>
          {restoring
            ? <ActivityIndicator color={COLORS.textMuted} size="small" />
            : <Text style={styles.restoreText}>Restore previous purchases</Text>
          }
        </Pressable>

        <Text style={styles.legalText}>
          Payment charged at confirmation. Subscription renews automatically
          unless cancelled at least 24 hours before the end of the current period.
          Manage subscriptions in your App Store / Google Play account settings.
        </Text>

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.background },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.xl, gap: SPACING.md },

  // ── Close button ──
  closeButton: {
    alignSelf: 'flex-end',
    padding: SPACING.xs,
    marginBottom: -SPACING.sm,
  },

  // ── Header ──
  header: {
    alignItems: 'center',
    gap: SPACING.xs,
    paddingBottom: SPACING.sm,
  },
  headline: {
    fontFamily: FONTS.display,
    fontSize: 34,
    color: COLORS.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subheadline: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  // ── Tier cards ──
  tierCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.lg,
    gap: SPACING.md,
    position: 'relative',
    overflow: 'visible',
  },
  tierCardHighlighted: {
    backgroundColor: COLORS.purpleDim + '88',
  },
  recommendedBadge: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 3,
  },
  recommendedText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.background,
    letterSpacing: 1.5,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: SPACING.xs, // space below recommended badge
  },
  tierNameGroup: { flex: 1, gap: 2 },
  tierName: {
    fontFamily: FONTS.display,
    fontSize: 20,
    letterSpacing: -0.3,
  },
  tierTagline: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  tierPriceGroup: { alignItems: 'flex-end' },
  tierPrice: {
    fontFamily: FONTS.monoBold,
    fontSize: 26,
  },
  tierPeriod: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.textMuted,
  },

  // Annual billing toggle (Pro card only)
  annualToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
  },
  annualToggleCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  annualToggleText: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  saveBadge: {
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  saveBadgeText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 0.5,
  },

  // Feature list inside tier card
  featureList: { gap: SPACING.sm },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  featureLabel: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textSecondary,
    flex: 1,
  },

  // Radio selection indicator at bottom of card
  tierSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  radioCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  tierSelectText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 0.5,
  },

  // ── Subscribe button ──
  subscribeButton: {
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 72,
  },
  buttonLoading: { opacity: 0.7 },
  subscribeInner: { alignItems: 'center', gap: 2 },
  subscribePrice: {
    fontFamily: FONTS.monoBold,
    fontSize: 22,
    color: COLORS.background,
  },
  subscribeLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
    color: COLORS.background + 'cc',
  },
  alreadyProBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.greenDim,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.green + '33',
    paddingVertical: SPACING.lg,
  },
  alreadyProText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 15,
    color: COLORS.green,
  },
  cancelNote: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: -SPACING.xs,
  },

  // ── Divider + section headers ──
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.xs },
  sectionTitle: {
    fontFamily: FONTS.display,
    fontSize: 22,
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  sectionSub: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: -SPACING.xs,
  },

  // ── Point pack cards ──
  packCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.lg,
    gap: SPACING.md,
    position: 'relative',
  },
  packBadge: {
    position: 'absolute',
    top: -10, right: SPACING.md,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  packBadgeText: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 0.5 },
  packLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  packLabel: { fontFamily: FONTS.bodyBold, fontSize: 16 },
  packSublabel: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  packPrice: { fontFamily: FONTS.monoBold, fontSize: 18 },

  // ── Not ready banner ──
  notReadyBanner: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.md,
  },
  notReadyText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },
  code: { fontFamily: FONTS.mono, color: COLORS.cyan },

  // ── Restore + legal ──
  restoreButton: { alignItems: 'center', paddingVertical: SPACING.md },
  restoreText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted, textDecorationLine: 'underline' },
  legalText: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: SPACING.md,
  },
});
