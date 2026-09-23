// ─── Protection Layers Screen ─────────────────────────────────────────────────
//
// Three blocking layers, each independent, each with an explanation
// of exactly what it does and why. Users can enable/disable any layer
// individually. The more layers enabled, the harder the app is to access.
// Plus one reliability check (below) that isn't a blocking layer itself but
// keeps Layer 1 alive.
//
// Layer 1 — App Blocker (Accessibility Service)
//   Already existed. Watches for app switches and throws up the gate screen.
//   Requires: Accessibility permission (one-tap enable).
//
// Layer 2 — Network Shield (DNS VPN)
//   Blocks blocked apps at the network layer. Even if the gate is bypassed,
//   the app can't load its content feed. DNS-only, no privacy cost.
//   Requires: VPN permission (one system dialog, remembered forever).
//
// Layer 3 — Notification Filter
//   Silences notifications from blocked apps — the backdoor that triggers
//   cravings even when you're not actively trying to open the app.
//   Requires: Notification Access (user grants once in Settings).
//
// Battery Exemption (not a blocking layer, but shown here for the same
//   reason as the three above: it's invisible until it's the reason
//   blocking silently stopped working). Android — and on top of that,
//   several phone makers' own battery managers — can force-stop the
//   Accessibility Service that Layer 1 depends on to save power. This
//   checks + requests the standard Android exemption. It used to only be
//   requested once during onboarding, with no verification that it actually
//   took — this screen now checks the real OS state via
//   checkBatteryOptimized() so the status shown is never just optimistic.

import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  AppState,
  NativeModules,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAppBlocker } from '@/hooks/useAppBlocker';
import { useVpn } from '@/hooks/useVpn';
import { useNotificationListener } from '@/hooks/useNotificationListener';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

// ─── Protection Layer Card ────────────────────────────────────────────────────

interface LayerCardProps {
  number: number;
  icon: string;
  title: string;
  subtitle: string;
  description: string;
  statusLabel: string;
  isActive: boolean;
  isLoading?: boolean;
  actionLabel: string;
  onAction: () => void;
  cautionLabel?: string;
  cautionDetail?: string;
  locked?: boolean; // true = permission not yet granted
}

function LayerCard({
  number, icon, title, subtitle, description,
  statusLabel, isActive, isLoading, actionLabel, onAction,
  cautionLabel, cautionDetail, locked,
}: LayerCardProps) {
  return (
    <View style={[styles.card, isActive && styles.cardActive]}>
      {/* Card header */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={[styles.layerBadge, isActive && styles.layerBadgeActive]}>
            <Text style={styles.layerBadgeText}>{number}</Text>
          </View>
          <Text style={styles.cardIcon}>{icon}</Text>
          <View>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.cardSubtitle}>{subtitle}</Text>
          </View>
        </View>
        {/* Status pill */}
        <View style={[styles.statusPill, isActive ? styles.statusPillOn : styles.statusPillOff]}>
          {isLoading ? (
            <ActivityIndicator size="small" color={COLORS.textSecondary} />
          ) : (
            <View style={[styles.statusDot, isActive ? styles.statusDotOn : styles.statusDotOff]} />
          )}
          <Text style={[styles.statusLabel, isActive ? styles.statusLabelOn : styles.statusLabelOff]}>
            {isLoading ? 'Working…' : statusLabel}
          </Text>
        </View>
      </View>

      {/* Description */}
      <Text style={styles.cardDescription}>{description}</Text>

      {/* Caution (permission not granted) */}
      {locked && cautionLabel && (
        <View style={styles.caution}>
          <Feather name="info" size={14} color={COLORS.warning} />
          <View style={{ flex: 1 }}>
            <Text style={styles.cautionLabel}>{cautionLabel}</Text>
            {cautionDetail && <Text style={styles.cautionDetail}>{cautionDetail}</Text>}
          </View>
        </View>
      )}

      {/* Action button */}
      <Pressable
        style={({ pressed }) => [
          styles.actionButton,
          isActive && styles.actionButtonOff,
          pressed && styles.actionButtonPressed,
          isLoading && styles.actionButtonDisabled,
        ]}
        onPress={onAction}
        disabled={isLoading}
      >
        <Text style={[styles.actionLabel, isActive && styles.actionLabelOff]}>
          {actionLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const { AppBlocker } = NativeModules;
const hasNative = Platform.OS === 'android' && !!AppBlocker;

type DomainLogEntry = { domain: string; ts: number };

function formatRelative(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProtectionScreen() {
  const {
    serviceEnabled, openSettings: openAccessibility, checkServiceStatus,
    checkBatteryOptimized, openBatterySettings,
    isKnownOemOffender, openOemAutostartSettings, requestNotificationPermission,
  } = useAppBlocker();

  const {
    isActive: vpnActive, isLoading: vpnLoading, toggle: toggleVpn,
    permissionGranted: vpnPermissionGranted,
  } = useVpn();

  const {
    isGranted: notifGranted, isFilterEnabled: notifEnabled, isLoading: notifLoading,
    toggleFilter: toggleNotif, openSettings: openNotifSettings,
  } = useNotificationListener();

  const [domainLog, setDomainLog] = useState<DomainLogEntry[]>([]);

  // Battery exemption — separate from Accessibility permission. Starts
  // "checking" (rather than assuming false) so the card doesn't flash
  // "Not exempted" for a frame before the real native check resolves.
  const [batteryExempt, setBatteryExempt] = useState(false);
  const [batteryChecking, setBatteryChecking] = useState(true);

  const fetchBatteryStatus = useCallback(async () => {
    const stillOptimized = await checkBatteryOptimized();
    setBatteryExempt(!stillOptimized);
    setBatteryChecking(false);
  }, [checkBatteryOptimized]);

  const fetchDomainLog = useCallback(async () => {
    if (!hasNative) return;
    try {
      const raw: string = await AppBlocker.getVpnDomainLog();
      const parsed: DomainLogEntry[] = JSON.parse(raw);
      setDomainLog(parsed);
    } catch {
      setDomainLog([]);
    }
  }, []);

  // Re-check accessibility service status when app returns to foreground.
  // VPN and notification hooks already have their own foreground listeners.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkServiceStatus();
        fetchDomainLog();
        fetchBatteryStatus();
      }
    });
    return () => sub.remove();
  }, [checkServiceStatus, fetchDomainLog, fetchBatteryStatus]);

  // Fetch domain log + battery status whenever screen comes into focus
  useFocusEffect(useCallback(() => {
    fetchDomainLog();
    fetchBatteryStatus();
  }, [fetchDomainLog, fetchBatteryStatus]));

  // Once the Accessibility Service is on, it starts a persistent "protection
  // active" foreground notification — ask for POST_NOTIFICATIONS (Android 13+)
  // so that notification is actually visible instead of silently suppressed.
  useEffect(() => {
    if (serviceEnabled) {
      requestNotificationPermission();
    }
  }, [serviceEnabled, requestNotificationPermission]);

  const activeCount = [serviceEnabled, vpnActive, notifGranted && notifEnabled, batteryExempt]
    .filter(Boolean).length;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color={COLORS.textSecondary} />
          </Pressable>
          <Text style={styles.headerTitle}>Protection Layers</Text>
          <View style={styles.backButton} />
        </View>

        {/* Summary bar */}
        <View style={styles.summary}>
          <View style={styles.summaryLeft}>
            <Text style={styles.summaryCount}>
              {activeCount}/4
            </Text>
            <Text style={styles.summaryLabel}>checks active</Text>
          </View>
          <View style={styles.summaryBars}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[
                  styles.summaryBar,
                  i < activeCount && styles.summaryBarFilled,
                ]}
              />
            ))}
          </View>
        </View>

        <Text style={styles.sectionIntro}>
          Each layer blocks the app a different way. Stack all three for maximum protection.
        </Text>

        {/* Layer 1 — App Blocker */}
        <LayerCard
          number={1}
          icon="🛡️"
          title="App Blocker"
          subtitle="Accessibility Service"
          description="Watches for app switches in the background. The moment you open a blocked app, NoGoon intercepts it and shows the gate screen — forcing you to pause before you can continue."
          statusLabel={serviceEnabled ? 'Active' : 'Off'}
          isActive={serviceEnabled}
          actionLabel={serviceEnabled ? 'Disable in Settings' : 'Enable App Blocker'}
          onAction={openAccessibility}
          locked={!serviceEnabled}
          cautionLabel={serviceEnabled ? undefined : 'Permission required'}
          cautionDetail={serviceEnabled ? undefined : "Tap 'Enable' and select NoGoon in Accessibility Settings."}
        />

        {/* Layer 2 — Network Shield */}
        <LayerCard
          number={2}
          icon="🌐"
          title="Network Shield"
          subtitle="DNS Blocker"
          description="Even if the gate is bypassed, blocked apps can't load their content feed. This works by intercepting DNS lookups — only those queries go through the VPN, everything else is untouched. No privacy cost, no latency penalty."
          statusLabel={vpnActive ? 'Active' : 'Off'}
          isActive={vpnActive}
          isLoading={vpnLoading}
          actionLabel={vpnActive ? 'Disable Network Shield' : 'Enable Network Shield'}
          onAction={toggleVpn}
          locked={!vpnPermissionGranted}
          cautionLabel={vpnPermissionGranted ? undefined : 'One-time setup required'}
          cautionDetail={vpnPermissionGranted ? undefined : "Android will show a system dialog asking you to trust this VPN — tap OK once and it\'s remembered forever."}
        />

        {/* Layer 3 — Notification Filter */}
        <LayerCard
          number={3}
          icon="🔕"
          title="Notification Filter"
          subtitle="Notification Listener"
          description="Silences notifications from blocked apps before they reach your notification bar. Those '3 new messages' pings are engineered to trigger the same craving the blocker is trying to prevent — this closes that backdoor."
          statusLabel={
            !notifGranted ? 'Not set up' :
            notifEnabled  ? 'Active' :
                            'Permission granted, filter off'
          }
          isActive={notifGranted && notifEnabled}
          isLoading={notifLoading}
          actionLabel={
            !notifGranted
              ? 'Grant Notification Access'
              : notifEnabled
                ? 'Disable Filter'
                : 'Enable Filter'
          }
          onAction={() => {
            if (!notifGranted) {
              openNotifSettings();
            } else {
              toggleNotif(!notifEnabled);
            }
          }}
          locked={!notifGranted}
          cautionLabel={notifGranted ? undefined : 'Permission required'}
          cautionDetail={notifGranted ? undefined : "Go to Special App Access → Notification Access → toggle NoGoon on."}
        />

        {/* Battery Exemption — reliability check, not a blocking layer */}
        <LayerCard
          number={4}
          icon="🔋"
          title="Battery Exemption"
          subtitle="Keeps the App Blocker alive"
          description="Android's battery saver can quietly force-stop background services — including the Accessibility Service Layer 1 depends on — to save power. This is a separate permission from Accessibility and has to be granted on its own."
          statusLabel={batteryExempt ? 'Exempted' : 'Not exempted'}
          isActive={batteryExempt}
          isLoading={batteryChecking}
          actionLabel={batteryExempt ? 'Manage in Settings' : 'Exempt NoGoon'}
          onAction={openBatterySettings}
          locked={!batteryExempt}
          cautionLabel={batteryExempt ? undefined : 'Recommended for reliable blocking'}
          cautionDetail={
            batteryExempt
              ? undefined
              : "Tap above, then allow NoGoon to run in the background. Some phones (Samsung, Xiaomi, Oppo, Vivo) have a second, separate battery manager in their own Settings app on top of this one — worth checking there too."
          }
        />

        {/* OEM autostart / battery manager — shown only for manufacturers known to
            run their own killer on top of stock Android. Status is intentionally
            NOT shown as a checkmark: there's no API to verify this setting, so
            claiming a verified state here would repeat the exact "optimistic
            checkmark" mistake already fixed for Battery Exemption above. */}
        {isKnownOemOffender && (
          <View style={styles.oemCard}>
            <View style={styles.oemHeader}>
              <Feather name="alert-triangle" size={14} color={COLORS.textSecondary} />
              <Text style={styles.oemTitle}>Device-specific battery manager</Text>
            </View>
            <Text style={styles.oemBody}>
              Your phone's manufacturer runs its own autostart/battery manager on top of
              Android's — Battery Exemption above doesn't cover it. There's no way for
              NoGoon to check this setting for you, so this can't be shown as a checkmark
              like the layers above. Open it and make sure NoGoon is allowed to run in
              the background / auto-start.
            </Text>
            <Text style={styles.oemBody}>
              One more thing worth doing on these phones: open your recent apps
              (the square/multitasking button), find NoGoon's card, and lock it —
              usually a long-press on the card. That alone stops a lot of these
              manufacturers from killing it, even before you touch the setting above.
            </Text>
            <Pressable style={styles.oemButton} onPress={openOemAutostartSettings}>
              <Text style={styles.oemButtonText}>Open Autostart Settings</Text>
              <Feather name="external-link" size={14} color={COLORS.background} />
            </Pressable>
          </View>
        )}

        {/* VPN Domain Log */}
        {domainLog.length > 0 && (
          <View style={styles.domainLogCard}>
            <View style={styles.domainLogHeader}>
              <Feather name="activity" size={14} color={COLORS.textSecondary} />
              <Text style={styles.domainLogTitle}>Network Shield — recent blocks</Text>
            </View>
            {domainLog.map((entry, i) => (
              <View key={i} style={[styles.domainLogRow, i < domainLog.length - 1 && styles.domainLogRowBorder]}>
                <Text style={styles.domainLogDomain} numberOfLines={1}>{entry.domain}</Text>
                <Text style={styles.domainLogTime}>{formatRelative(entry.ts)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer note */}
        <View style={styles.footer}>
          <Feather name="lock" size={14} color={COLORS.textSecondary} />
          <Text style={styles.footerText}>
            All protection runs on-device. NoGoon never sees your network traffic or notification content.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 17,
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },

  // ── Summary ──
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  summaryCount: {
    fontFamily: FONTS.bodyBold,
    fontSize: 28,
    color: COLORS.textPrimary,
    letterSpacing: -1,
  },
  summaryLabel: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  summaryBars: {
    flexDirection: 'row',
    gap: 6,
  },
  summaryBar: {
    width: 36,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
  },
  summaryBarFilled: {
    backgroundColor: COLORS.green,
  },

  sectionIntro: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },

  // ── Card ──
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardActive: {
    borderColor: COLORS.green + '60',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  layerBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layerBadgeActive: {
    backgroundColor: COLORS.green,
  },
  layerBadgeText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.background,
  },
  cardIcon: {
    fontSize: 22,
  },
  cardTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    color: COLORS.textPrimary,
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },

  // ── Status pill ──
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  statusPillOn: {
    backgroundColor: COLORS.green + '20',
  },
  statusPillOff: {
    backgroundColor: COLORS.border,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotOn: {
    backgroundColor: COLORS.green,
  },
  statusDotOff: {
    backgroundColor: COLORS.textSecondary,
  },
  statusLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
  },
  statusLabelOn: {
    color: COLORS.green,
  },
  statusLabelOff: {
    color: COLORS.textSecondary,
  },

  // ── Description ──
  cardDescription: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 21,
    marginBottom: SPACING.md,
  },

  // ── Caution ──
  caution: {
    flexDirection: 'row',
    gap: SPACING.xs,
    backgroundColor: COLORS.warning + '12',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    alignItems: 'flex-start',
  },
  cautionLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.warning,
  },
  cautionDetail: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 17,
  },

  // ── Action button ──
  actionButton: {
    backgroundColor: COLORS.green,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionButtonOff: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionButtonPressed: {
    opacity: 0.7,
  },
  actionButtonDisabled: {
    opacity: 0.4,
  },
  actionLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: COLORS.background,
  },
  actionLabelOff: {
    color: COLORS.textSecondary,
  },

  // ── Domain Log ──
  oemCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  oemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  oemTitle: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
    color: COLORS.textSecondary,
    letterSpacing: 0.3,
  },
  oemBody: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
  },
  oemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.indigo,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
  },
  oemButtonText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.background,
  },
  domainLogCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.xs,
  },
  domainLogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  domainLogTitle: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
    color: COLORS.textSecondary,
    letterSpacing: 0.3,
  },
  domainLogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  domainLogRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  domainLogDomain: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.textPrimary,
    flex: 1,
    marginRight: SPACING.sm,
  },
  domainLogTime: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
  },

  // ── Footer ──
  footer: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginTop: SPACING.md,
    alignItems: 'flex-start',
  },
  footerText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
    flex: 1,
  },
});
