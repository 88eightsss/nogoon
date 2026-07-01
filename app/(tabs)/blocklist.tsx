// ─── Blocklist Screen — NoGoon ────────────────────────────────────────────────
//
// Two blocking systems in one screen:
//
//   WEBSITE BLOCKING  — blocks domains in the browser
//   APP BLOCKING      — blocks Android apps via Accessibility Service
//
// ── Remove cost ──────────────────────────────────────────────────────────────
// Free users pay 75 points to permanently remove a site from their blocklist.
// This is a friction mechanic — it makes removal feel costly and deliberate,
// which helps users stay accountable to themselves.
// Pro users remove for free, instantly, no cost.

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
  NativeModules,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useUserStore } from '@/stores/useUserStore';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
import { useAppBlocker, BLOCKABLE_APPS, BlockableApp } from '@/hooks/useAppBlocker';
import { getColors, COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

// ─── Default blocked sites ─────────────────────────────────────────────────────
// These are the top distracting / adult sites as of 2026.
// Users can add more, but removing any costs 75 points (free tier).

const DEFAULT_SITES = [
  'tiktok.com',
  'instagram.com',
  'pornhub.com',
  'xhamster.com',
  'erome.com',
  'redgifs.com',
  'chaturbate.com',
] as const;

// Quick-add chips — sites not already on the blocklist, shown as one-tap adds
const SUGGESTION_POOL = [
  'twitter.com',
  'reddit.com',
  'youtube.com',
  'facebook.com',
  'onlyfans.com',
  'snapchat.com',
  'twitch.tv',
] as const;

// ─── OEM Battery Fix Instructions ─────────────────────────────────────────────
// Some phone makers (Samsung, Xiaomi, OnePlus) have extra battery management on
// top of Android's standard optimization. Even after disabling standard battery
// optimization, these manufacturer layers can still kill the accessibility service.
// We detect the manufacturer and show the specific steps needed for that device.

function getOEMBatteryInstructions(): string | null {
  const brand = (Platform.constants as any)?.Brand?.toLowerCase() ?? '';
  const manufacturer = (Platform.constants as any)?.Manufacturer?.toLowerCase() ?? '';
  const combined = brand + manufacturer;

  if (combined.includes('samsung')) {
    return 'Samsung extra step: Settings → Device Care → Battery → Background usage limits → Never sleeping apps → add NoGoon';
  }
  if (combined.includes('xiaomi') || combined.includes('miui') || combined.includes('redmi')) {
    return 'Xiaomi extra step: Settings → Apps → Manage apps → NoGoon → Battery saver → No restrictions';
  }
  if (combined.includes('oneplus') || combined.includes('oppo')) {
    return 'OnePlus extra step: Settings → Battery → Battery optimization → All apps → NoGoon → Don\'t optimize';
  }
  if (combined.includes('huawei') || combined.includes('honor')) {
    return 'Huawei extra step: Phone Manager → App launch → NoGoon → Manage manually → enable all three toggles';
  }
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BlocklistScreen() {
  const { blocklist, addSite, removeSite, spendPoints, REMOVE_COST, colorScheme } = useUserStore();
  const { isPro } = useSubscriptionStore();
  const C = getColors(colorScheme ?? 'dark');
  const {
    serviceEnabled,
    checking,
    blockedApps,
    toggleApp,
    openSettings,
    checkBatteryOptimized,
    openBatterySettings,
    hasNativeModule,
  } = useAppBlocker();

  // Check if Android battery optimization is killing our background service
  const [batteryOptimized, setBatteryOptimized] = useState(false);

  // Run the battery check once on mount (only meaningful on real device builds)
  useState(() => {
    checkBatteryOptimized().then(setBatteryOptimized);
  });

  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  // Detect OEM-specific battery instructions once on mount
  const oemBatteryNote = getOEMBatteryInstructions();

  // ── Add a domain ────────────────────────────────────────────────────────────
  // Free users are redirected to the paywall — we never silently add a site
  // that won't actually be blocked. That would confuse them into thinking
  // they're protected when they're not.

  const handleAdd = (domain?: string) => {
    // Gate: free users cannot add blocking rules
    if (!isPro) {
      Alert.alert(
        'Blocking is a paid feature',
        'NoGoon Arcade is always free to play.\n\nUpgrade to start blocking sites and apps.',
        [
          {
            text: 'See Plans',
            onPress: () => router.push('/paywall'),
          },
          {
            text: 'Stay in Arcade',
            style: 'cancel',
          },
        ]
      );
      setInput('');
      return;
    }

    const raw = (domain ?? input).trim();
    if (!raw) return;

    const cleaned = raw
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/\/.*$/, '')
      .toLowerCase();

    if (!cleaned.includes('.') || cleaned.includes(' ')) {
      setError('Enter a valid domain, e.g. tiktok.com');
      return;
    }
    if (blocklist.includes(cleaned)) {
      setError(`${cleaned} is already on your list.`);
      return;
    }

    setError('');
    addSite(cleaned);
    setInput('');
  };

  // ── Remove a domain — costs points for free users ───────────────────────────

  const handleRemove = (domain: string) => {
    if (isPro) {
      // Pro users: free removal, no confirmation needed for the cost
      Alert.alert(
        'Remove Site',
        `Remove ${domain} from your blocklist?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: () => removeSite(domain) },
        ]
      );
    } else {
      // Free users: show the point cost upfront
      Alert.alert(
        `Remove ${domain}?`,
        `Removing a site permanently costs ${REMOVE_COST} points.\n\nThis keeps you accountable — removing is a big deal.\n\nYour balance: ${useUserStore.getState().points} pts`,
        [
          { text: 'Keep It Blocked', style: 'cancel' },
          {
            text: `Remove for ${REMOVE_COST} pts`,
            style: 'destructive',
            onPress: () => {
              const success = spendPoints(REMOVE_COST);
              if (success) {
                removeSite(domain);
              } else {
                Alert.alert(
                  'Not Enough Points',
                  `You need ${REMOVE_COST} points to remove a site. Play games to earn more, or upgrade to NoGoon Pro for free removal.`
                );
              }
            },
          },
        ]
      );
    }
  };

  // ── Pre-populate default sites on first load ────────────────────────────────
  // Show a one-tap "Add defaults" button if none of the default sites are blocked
  const hasDefaults = DEFAULT_SITES.some((s) => blocklist.includes(s));
  const addAllDefaults = () => {
    DEFAULT_SITES.forEach((site) => {
      if (!blocklist.includes(site)) addSite(site);
    });
  };

  // ── App groups ──────────────────────────────────────────────────────────────
  const socialApps   = BLOCKABLE_APPS.filter((a) => a.category === 'social');
  const videoApps    = BLOCKABLE_APPS.filter((a) => a.category === 'video');
  const shoppingApps = BLOCKABLE_APPS.filter((a) => a.category === 'shopping');
  const gamingApps   = BLOCKABLE_APPS.filter((a) => a.category === 'gaming');

  // ── Sub-components ──────────────────────────────────────────────────────────

  const AppRow = useCallback(({ app }: { app: BlockableApp }) => {
    const isBlocked = blockedApps.includes(app.id);

    // Free users: tapping any app toggle shows the paywall instead
    const handleToggle = () => {
      if (!isPro) {
        Alert.alert(
          'App blocking is a paid feature',
          'NoGoon Arcade is always free to play.\n\nUpgrade to block apps like TikTok and Instagram.',
          [
            { text: 'See Plans', onPress: () => router.push('/paywall') },
            { text: 'Stay in Arcade', style: 'cancel' },
          ]
        );
        return;
      }
      toggleApp(app.id);
    };

    return (
      <View style={styles.appRow}>
        <View style={[
          styles.appEmojiWrap,
          { backgroundColor: C.border },
          isBlocked && { backgroundColor: C.indigoDim, borderWidth: 1, borderColor: C.indigoBright + '33' },
        ]}>
          <Text style={styles.appEmoji}>{app.emoji}</Text>
        </View>
        <Text style={[styles.appName, { color: C.textSecondary }, isBlocked && { color: C.textPrimary }]}>
          {app.name}
        </Text>
        <Switch
          value={isBlocked}
          onValueChange={handleToggle}
          trackColor={{ false: C.border, true: C.indigoBright + '55' }}
          thumbColor={isBlocked ? C.indigoBright : C.textMuted}
          disabled={!serviceEnabled && isPro}
        />
      </View>
    );
  }, [blockedApps, toggleApp, serviceEnabled, isPro, C]);

  const CategoryHeader = ({ label }: { label: string }) => (
    <Text style={[styles.categoryLabel, { color: C.textMuted }]}>{label}</Text>
  );

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={[styles.scroll, { backgroundColor: C.background }]}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Header ── */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: C.indigoBright }]}>Blocklist</Text>
            <Text style={[styles.subtitle, { color: C.textMuted }]}>
              {blocklist.length} site{blocklist.length !== 1 ? 's' : ''} ·{' '}
              {blockedApps.length} app{blockedApps.length !== 1 ? 's' : ''} blocked
            </Text>
          </View>

          {/* ── Quick-start banner (no defaults yet) ── */}
          {!hasDefaults && (
            <Pressable style={styles.defaultsBanner} onPress={addAllDefaults}>
              <Feather name="zap" size={18} color={COLORS.indigoBright} />
              <View style={{ flex: 1 }}>
                <Text style={styles.defaultsBannerTitle}>Add 7 default sites instantly</Text>
                <Text style={styles.defaultsBannerSub}>
                  TikTok · Instagram · Pornhub · Xhamster · Erome · Redgifs · Chaturbate
                </Text>
              </View>
              <Feather name="plus-circle" size={22} color={COLORS.indigoBright} />
            </Pressable>
          )}

          {/* ════════════════════════════════════════════════════════
              WEBSITE BLOCKING
          ════════════════════════════════════════════════════════ */}

          <View style={styles.sectionHeader}>
            <Feather name="globe" size={16} color={COLORS.indigoBright} />
            <Text style={styles.sectionTitle}>Website Blocking</Text>
            <Text style={styles.sectionTag}>Browser</Text>
          </View>

          {/* Add domain input */}
          <View style={[styles.inputRow, { backgroundColor: C.surface, borderColor: C.cardBorder }]}>
            <TextInput
              style={[styles.input, { color: C.textPrimary }]}
              placeholder="e.g. reddit.com"
              placeholderTextColor={C.textMuted}
              value={input}
              onChangeText={(t) => { setInput(t); setError(''); }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="done"
              onSubmitEditing={() => handleAdd()}
            />
            <Pressable
              style={[styles.addButton, !input.trim() && styles.addButtonDisabled]}
              onPress={() => handleAdd()}
              disabled={!input.trim()}
            >
              <Text style={styles.addButtonText}>Add</Text>
            </Pressable>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Quick-add chips */}
          <View style={styles.chips}>
            {SUGGESTION_POOL.filter((s) => !blocklist.includes(s)).slice(0, 5).map((s) => (
              <Pressable key={s} style={styles.chip} onPress={() => handleAdd(s)}>
                <Feather name="plus" size={11} color={COLORS.indigoBright} />
                <Text style={styles.chipText}>{s}</Text>
              </Pressable>
            ))}
          </View>

          {/* Blocked site list */}
          {blocklist.length > 0 && (
            <View style={[styles.listCard, { backgroundColor: C.surface, borderColor: C.cardBorder }]}>
              {blocklist.map((domain, index) => (
                <View key={domain}>
                  <View style={styles.domainRow}>
                    <View style={[styles.domainAvatar, { backgroundColor: C.indigoDim, borderColor: C.indigoBright + '33' }]}>
                      <Text style={[styles.domainAvatarText, { color: C.indigoBright }]}>
                        {domain[0].toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.domainText, { color: C.textPrimary }]}>{domain}</Text>
                    <Pressable onPress={() => handleRemove(domain)} hitSlop={16} style={[styles.removeBtn, { backgroundColor: C.surface, borderColor: C.cardBorder }]}>
                      <Feather name="x" size={15} color={C.textMuted} />
                    </Pressable>
                  </View>
                  {index < blocklist.length - 1 && <View style={[styles.separator, { backgroundColor: C.border }]} />}
                </View>
              ))}
            </View>
          )}

          {blocklist.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🌐</Text>
              <Text style={styles.emptyTitle}>No sites blocked yet</Text>
              <Text style={styles.emptyBody}>
                Add websites above or tap "Add 7 default sites" to get started instantly.
              </Text>
            </View>
          )}

          {/* ════════════════════════════════════════════════════════
              APP BLOCKING (Android)
          ════════════════════════════════════════════════════════ */}

          <View style={[styles.sectionHeader, { marginTop: SPACING.xl }]}>
            <Feather name="shield" size={16} color={COLORS.purple} />
            <Text style={[styles.sectionTitle, { color: COLORS.purple }]}>App Blocking</Text>
            <Text style={styles.sectionTag}>Android</Text>
          </View>

          {/* Permission banner */}
          {!checking && !serviceEnabled && (
            <Pressable style={styles.permissionBanner} onPress={openSettings}>
              <View style={styles.permissionLeft}>
                <Feather name="alert-triangle" size={20} color={COLORS.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.permissionTitle}>Permission Required</Text>
                  <Text style={styles.permissionBody}>
                    Tap here → Settings → NoGoon → enable Accessibility Service to block apps in real time.
                  </Text>
                </View>
              </View>
              <Feather name="chevron-right" size={18} color={COLORS.textMuted} />
            </Pressable>
          )}

          {!checking && serviceEnabled && (
            <View style={styles.enabledRow}>
              <View style={styles.enabledBadge}>
                <Feather name="check-circle" size={16} color={COLORS.green} />
                <Text style={styles.enabledText}>App blocking is active</Text>
              </View>
              {/* Test button — lets the user verify the intercept actually fires */}
              <Pressable
                style={styles.testButton}
                onPress={() => router.push({
                  pathname: '/gate',
                  params: { domain: 'instagram.com', confidence: '100', source: 'test' },
                })}
              >
                <Feather name="play-circle" size={14} color={COLORS.purple} />
                <Text style={styles.testButtonText}>Test it</Text>
              </Pressable>
            </View>
          )}

          {/* Battery optimization warning — shown when service is enabled but
              Android might kill it in the background. Tapping opens the one-tap fix. */}
          {serviceEnabled && batteryOptimized && (
            <Pressable style={styles.batteryBanner} onPress={openBatterySettings}>
              <View style={styles.permissionLeft}>
                <Feather name="battery" size={20} color={COLORS.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.permissionTitle}>Battery Optimization On</Text>
                  <Text style={styles.permissionBody}>
                    Android may stop NoGoon in the background. Tap to disable battery optimization and keep blocking active.
                  </Text>
                </View>
              </View>
              <Feather name="chevron-right" size={18} color={COLORS.textMuted} />
            </Pressable>
          )}

          {/* OEM-specific battery fix — shown only on Samsung/Xiaomi/OnePlus/Huawei
              where standard battery optimization exemption alone isn't enough */}
          {serviceEnabled && oemBatteryNote && (
            <View style={styles.oemBanner}>
              <Feather name="info" size={16} color={COLORS.cyan} />
              <Text style={styles.oemBannerText}>{oemBatteryNote}</Text>
            </View>
          )}

          {!hasNativeModule && (
            <View style={styles.expoGoBanner}>
              <Text style={styles.expoGoText}>
                ℹ️  App blocking requires an EAS build. Toggles are shown for preview only.
              </Text>
            </View>
          )}

          {/* App toggle grid */}
          <View style={[styles.appsCard, { backgroundColor: C.surface, borderColor: C.cardBorder }]}>
            <CategoryHeader label="Social" />
            {socialApps.map((app) => <AppRow key={app.id} app={app} />)}
            <View style={[styles.categorySeparator, { backgroundColor: C.border }]} />
            <CategoryHeader label="Video" />
            {videoApps.map((app) => <AppRow key={app.id} app={app} />)}
            <View style={[styles.categorySeparator, { backgroundColor: C.border }]} />
            <CategoryHeader label="Shopping" />
            {shoppingApps.map((app) => <AppRow key={app.id} app={app} />)}
            <View style={[styles.categorySeparator, { backgroundColor: C.border }]} />
            <CategoryHeader label="Gaming" />
            {gamingApps.map((app) => <AppRow key={app.id} app={app} />)}
          </View>

          <View style={{ height: SPACING.xxl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: COLORS.background },
  flex:          { flex: 1 },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.lg },

  header: { paddingTop: SPACING.lg, paddingBottom: SPACING.sm },
  title: {
    fontFamily: FONTS.display,
    fontSize: 32,
    color: COLORS.indigoBright,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  // ── Defaults banner ──
  defaultsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.indigoDim,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.indigoBright + '44',
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  defaultsBannerTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: COLORS.indigoBright,
  },
  defaultsBannerSub: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // ── Section header ──
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    color: COLORS.indigoBright,
    flex: 1,
  },
  sectionTag: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.textMuted,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },

  // ── Input ──
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    gap: SPACING.sm,
  },
  input: {
    flex: 1,
    paddingVertical: SPACING.sm,
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  addButton: {
    backgroundColor: COLORS.indigo,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },
  addButtonDisabled: { backgroundColor: COLORS.border },
  addButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: COLORS.background,
  },
  errorText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.danger,
    marginTop: 2,
  },

  // ── Quick-add chips ──
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.indigoDim,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.indigoBright + '33',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  chipText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.indigoBright,
  },

  // ── Site list ──
  listCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
    overflow: 'hidden',
  },
  domainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 12,
  },
  domainAvatar: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.indigoDim,
    borderWidth: 1,
    borderColor: COLORS.indigoBright + '33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  domainAvatarText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: COLORS.indigoBright,
  },
  domainText: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: { height: 1, backgroundColor: COLORS.border, marginLeft: 44 },

  // ── Empty state ──
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    gap: SPACING.xs,
  },
  emptyEmoji: { fontSize: 36, marginBottom: SPACING.xs },
  emptyTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── App blocking ──
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warning + '15',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.warning + '44',
    padding: SPACING.md,
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  batteryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warning + '10',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.warning + '33',
    padding: SPACING.md,
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  permissionLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  permissionTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: COLORS.warning,
    marginBottom: 2,
  },
  permissionBody: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  enabledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  enabledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  enabledText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.indigoBright,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.purple + '15',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.purple + '44',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  testButtonText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
    color: COLORS.purple,
  },
  oemBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: COLORS.cyan + '10',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cyan + '33',
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  oemBannerText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  expoGoBanner: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  expoGoText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  appsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.md,
  },
  categoryLabel: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: SPACING.xs,
    marginTop: SPACING.xs,
  },
  categorySeparator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 8,
  },
  appEmojiWrap: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appEmojiWrapActive: {
    backgroundColor: COLORS.indigoDim,
    borderWidth: 1,
    borderColor: COLORS.indigoBright + '33',
  },
  appEmoji: { fontSize: 18 },
  appName: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});
