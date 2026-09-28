// ─── useAppBlocker Hook — NoGoon ──────────────────────────────────────────────
//
// This is the JavaScript-side interface for the Android app blocker.
// It wraps the native Android module (AppBlockerModule.kt) and provides
// a clean, simple API for the React Native UI to use.
//
// WHAT IT DOES:
//   - Checks if the user has granted Accessibility Service permission
//   - Syncs the blocked apps list to the native Android layer
//   - Provides a function to open Android's Accessibility Settings
//
// ANDROID ONLY:
//   On iOS this hook returns safe no-ops (does nothing) because iOS doesn't
//   support the same type of background service. iOS has Screen Time API
//   for parental controls, but that's a separate integration.
//
// USAGE:
//   const { serviceEnabled, blockedApps, toggleApp, openSettings } = useAppBlocker()

import { useState, useEffect, useCallback } from 'react';
import { Platform, NativeModules, AppState } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import { useUserStore } from '@/stores/useUserStore';
import { useModesStore, resolveActiveMode } from '@/stores/useModesStore';
import { getLocalDateKey } from '@/utils/date';

// The native module registered by AppBlockerPackage.kt
// On Android, this will be a real object. On iOS or Expo Go, it's undefined.
const { AppBlocker } = NativeModules;
const isAndroid = Platform.OS === 'android';
const hasNativeModule = isAndroid && !!AppBlocker;

// ─── Popular apps catalogue ────────────────────────────────────────────────────
// These are the apps users most commonly want to block.
// Each entry has:
//   id       — Android package name (unique identifier for each app)
//   name     — Display name shown in the UI
//   emoji    — Visual icon since we don't load app icons
//   category — Groups apps in the UI

export interface BlockableApp {
  id: string;       // Android package name
  name: string;     // Human-readable name
  emoji: string;    // Icon emoji
  category: 'social' | 'video' | 'shopping' | 'gaming';
}

export const BLOCKABLE_APPS: BlockableApp[] = [
  // ── Social ──
  { id: 'com.instagram.android',         name: 'Instagram',  emoji: '📸', category: 'social' },
  { id: 'com.zhiliaoapp.musically',      name: 'TikTok',     emoji: '🎵', category: 'social' },
  { id: 'com.twitter.android',           name: 'X (Twitter)',emoji: '𝕏',  category: 'social' },
  { id: 'com.snapchat.android',          name: 'Snapchat',   emoji: '👻', category: 'social' },
  { id: 'com.facebook.katana',           name: 'Facebook',   emoji: '👤', category: 'social' },
  { id: 'com.pinterest',                 name: 'Pinterest',  emoji: '📌', category: 'social' },
  { id: 'com.bereal.ft',                 name: 'BeReal',     emoji: '📷', category: 'social' },
  { id: 'com.discord',                   name: 'Discord',    emoji: '🎮', category: 'social' },

  // ── Video ──
  { id: 'com.google.android.youtube',   name: 'YouTube',    emoji: '▶️',  category: 'video' },
  { id: 'com.netflix.mediaclient',       name: 'Netflix',    emoji: '🎬', category: 'video' },
  { id: 'com.amazon.avod.thirdpartyclient', name: 'Prime Video', emoji: '🎥', category: 'video' },
  { id: 'com.twitch.android.viewer',    name: 'Twitch',     emoji: '🟣', category: 'video' },

  // ── Shopping ──
  { id: 'com.amazon.mShop.android.shopping', name: 'Amazon', emoji: '📦', category: 'shopping' },
  { id: 'com.shein.gplay',              name: 'SHEIN',      emoji: '👗', category: 'shopping' },

  // ── Gaming ──
  { id: 'com.kiloo.subwaysurf',         name: 'Subway Surfers', emoji: '🏃', category: 'gaming' },
  { id: 'com.supercell.clashofclans',   name: 'Clash of Clans', emoji: '⚔️', category: 'gaming' },
  { id: 'com.roblox.client',            name: 'Roblox',     emoji: '🟥', category: 'gaming' },
];

// Map package name → friendly name for use in gate.tsx
export const PACKAGE_TO_NAME: Record<string, string> = Object.fromEntries(
  BLOCKABLE_APPS.map((app) => [app.id, app.name])
);

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAppBlocker() {
  const {
    blockedApps, setBlockedApps, blocklist: websiteBlocklist, addSite, removeSite,
    curfewEnabled, curfewStart, curfewEnd,
    walkAwayCount, streak, dailyWalkAways,
    setGameMode, setNoGames, setPreferWaitingRoom,
  } = useUserStore();
  const { modes, activeModeId } = useModesStore();
  const [serviceEnabled, setServiceEnabled] = useState(false);
  const [checking, setChecking]             = useState(true);
  const [grayscaleEnabled, setGrayscaleEnabledState] = useState(false);
  // Raw expiry timestamp from native (ms). 0 = not paused. > Date.now() = paused.
  const [blockingPausedUntil, setBlockingPausedUntil] = useState<number>(0);

  // ── Temporary unlock state ─────────────────────────────────────────────────
  // Tracks domains the user has unlocked temporarily after playing a game.
  // Key = domain string, Value = expiry timestamp (ms).
  // When the current time passes the expiry, the domain is blocked again.
  const [tempUnlocks, setTempUnlocks] = useState<Record<string, number>>({});
  // Unlock-time log from native: Record<"YYYY-MM-DD", ms>
  const [unlockTimeLog, setUnlockTimeLog] = useState<Record<string, number>>({});

  // ── Check if Accessibility Service is enabled ──────────────────────────────
  // Checked on mount, on every app resume, and every 30s as a backstop.

  // Load grayscale preference from native layer on mount
  useEffect(() => {
    if (!hasNativeModule) return;
    AppBlocker.isGrayscaleEnabled()
      .then((val: boolean) => setGrayscaleEnabledState(val))
      .catch(() => {});
  }, []);

  // Load blockingPausedUntil timestamp from native layer on mount
  useEffect(() => {
    if (!hasNativeModule) return;
    AppBlocker.isBlockingPaused()
      .then((val: number) => setBlockingPausedUntil(val))
      .catch(() => {});
  }, []);

  const setGrayscaleEnabled = useCallback(async (enabled: boolean) => {
    setGrayscaleEnabledState(enabled);
    if (hasNativeModule) {
      try { await AppBlocker.setGrayscaleEnabled(enabled); } catch {}
    }
  }, []);

  // Clears the pause — called when user taps "Resume" in the app.
  const resumeBlocking = useCallback(async () => {
    setBlockingPausedUntil(0);
    if (hasNativeModule) {
      try { await AppBlocker.setBlockingPaused(false); } catch {}
    }
  }, []);

  const checkServiceStatus = useCallback(async () => {
    if (!hasNativeModule) {
      setChecking(false);
      return;
    }
    try {
      const enabled: boolean = await AppBlocker.isServiceEnabled();
      setServiceEnabled(enabled);
    } catch {
      setServiceEnabled(false);
    } finally {
      setChecking(false);
    }
  }, []);

  // Check service status once on mount, then on every app resume.
  // The service status only changes when the user enables/disables it in Android
  // Settings — no need to poll continuously while the app is in the foreground.
  useEffect(() => {
    checkServiceStatus();
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      checkServiceStatus();
      // Re-check blockingPausedUntil in case user toggled the QS tile while away
      if (hasNativeModule) {
        AppBlocker.isBlockingPaused()
          .then((val: number) => setBlockingPausedUntil(val))
          .catch(() => {});
      }
      // Also clean up any temp unlocks that expired while the app was backgrounded
      const now = Date.now();
      setTempUnlocks(prev => {
        const cleaned = { ...prev };
        let changed = false;
        for (const [domain, expiry] of Object.entries(cleaned)) {
          if (expiry <= now) { delete cleaned[domain]; changed = true; }
        }
        return changed ? cleaned : prev;
      });
    });
    // Re-check every 30 s — Android can kill the service between AppState changes
    const pollInterval = setInterval(checkServiceStatus, 30_000);
    return () => { sub.remove(); clearInterval(pollInterval); };
  }, [checkServiceStatus]);

  // ── Sync blocked apps to native layer ─────────────────────────────────────
  // Any time the JS blockedApps list changes, push the update to SharedPreferences
  // so the Accessibility Service immediately starts/stops blocking those apps.

  useEffect(() => {
    if (!hasNativeModule) return;
    AppBlocker.setBlockedApps(blockedApps).catch(console.warn);
  }, [blockedApps]);

  // ── Sync blocked websites to native layer ──────────────────────────────────
  // Any time the website blocklist changes in JS, push those domains to
  // SharedPreferences so the Accessibility Service can check browser URLs
  // against them in real time. Same pattern as app blocking above.

  useEffect(() => {
    if (!hasNativeModule) return;
    AppBlocker.setBlockedDomains(websiteBlocklist).catch(console.warn);
  }, [websiteBlocklist]);

  // ── Modes: re-check on a timer + on foreground resume ─────────────────────
  // A scheduled Mode (e.g. "Work" 9-5) needs to apply itself even if the user
  // never opens NoGoon exactly at the boundary. This ticks the effect below
  // every 60s while the app is in the foreground, and immediately on resume.

  const [modeCheckTick, setModeCheckTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setModeCheckTick((t) => t + 1), 60_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setModeCheckTick((t) => t + 1);
    });
    return () => { clearInterval(interval); sub.remove(); };
  }, []);

  // ── Modes: apply whichever one currently resolves ──────────────────────────
  // A resolved Mode is a saved bundle (blocklist + game-mode/no-games/
  // waiting-room settings) the user built themselves — applying it just calls
  // the SAME setters the manual blocklist/settings screens already use, so it
  // never becomes a second source of truth for those fields. When no Mode
  // resolves (the common case for anyone who's never touched Modes), this is
  // a no-op and every field stays exactly as manually set.
  //
  // Deliberately NOT touched here: isBricked / isColdTurkey (BRICKED / Cold
  // Turkey have their own manual 24hr/48hr disable-request cooldown — letting
  // a Mode switch flip them would let a schedule bypass that safety gate) and
  // curfew (a separate always-on override layered on top of whichever Mode
  // is active, not something a Mode itself controls). See useModesStore.ts.

  useEffect(() => {
    const active = resolveActiveMode(modes, activeModeId);
    if (!active) return;

    setBlockedApps(active.blockedApps);

    const currentDomains = new Set(useUserStore.getState().blocklist);
    const targetDomains  = new Set(active.blockedDomains);
    for (const d of active.blockedDomains) {
      if (!currentDomains.has(d)) addSite(d);
    }
    for (const d of useUserStore.getState().blocklist) {
      if (!targetDomains.has(d)) removeSite(d);
    }

    setGameMode(active.gameMode);
    setNoGames(active.noGames);
    setPreferWaitingRoom(active.preferWaitingRoom);
    // modeCheckTick deliberately in the deps only to re-run the check, not to
    // read its value — this effect always re-resolves against the live clock.
  }, [modes, activeModeId, modeCheckTick, setBlockedApps, addSite, removeSite, setGameMode, setNoGames, setPreferWaitingRoom]);

  // ── Modes: push the full config natively ───────────────────────────────────
  // Lets the Accessibility Service resolve "which Mode is active" itself,
  // mirroring the Digital Curfew live-check, so a scheduled Mode boundary is
  // enforced even while NoGoon hasn't been reopened to re-apply it from JS.

  useEffect(() => {
    if (!hasNativeModule) return;
    const modesJson = JSON.stringify(
      modes.map((m) => ({
        id: m.id,
        apps: m.blockedApps,
        domains: m.blockedDomains,
        schedule: m.schedule,
      }))
    );
    AppBlocker.setModesConfig(modesJson, activeModeId ?? '').catch(console.warn);
  }, [modes, activeModeId]);

  // ── Sync curfew settings to native ────────────────────────────────────────
  // Called whenever the user changes Digital Curfew in the profile screen so
  // the Accessibility Service can enforce it even before JS finishes loading.

  useEffect(() => {
    if (!hasNativeModule) return;
    AppBlocker.setCurfew(curfewEnabled, curfewStart, curfewEnd).catch(console.warn);
  }, [curfewEnabled, curfewStart, curfewEnd]);

  // ── Sync today's stats to native (for home screen widget) ─────────────────
  // The Glance widget reads "widget_walk_aways_today" and "widget_streak"
  // from SharedPreferences. We update them whenever walk-away count or streak
  // changes so the widget always shows fresh data.

  useEffect(() => {
    if (!hasNativeModule) return;
    const today = getLocalDateKey();
    const todayCount = dailyWalkAways[today] ?? 0;
    AppBlocker.setTodayStats(todayCount, streak).catch(console.warn);
  }, [walkAwayCount, streak, dailyWalkAways]);

  // ── Load unlock-time log on mount + app resume ─────────────────────────────
  // Reads per-day unlock time totals written by the Accessibility Service and
  // makes them available to any screen that needs them (e.g. insights).

  useEffect(() => {
    if (!hasNativeModule) return;
    const fetchUnlockLog = () => {
      AppBlocker.getUnlockTimeLog()
        .then((json: string) => {
          try { setUnlockTimeLog(JSON.parse(json)); } catch {}
        })
        .catch(() => {});
    };
    fetchUnlockLog();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') fetchUnlockLog();
    });
    return () => sub.remove();
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────

  // Toggle a single app on/off in the blocklist
  const toggleApp = useCallback((packageName: string) => {
    const isBlocked = blockedApps.includes(packageName);
    const updated   = isBlocked
      ? blockedApps.filter((p) => p !== packageName)
      : [...blockedApps, packageName];
    setBlockedApps(updated);
  }, [blockedApps, setBlockedApps]);

  // Open Android's Accessibility Settings so user can enable the service.
  // Uses the native module first (most reliable), falls back to expo-intent-launcher
  // (which works even if the custom module isn't registered). This way the settings
  // button always works no matter what.
  const openSettings = useCallback(async () => {
    if (hasNativeModule) {
      try {
        await AppBlocker.openAccessibilitySettings();
        return;
      } catch (e) {
        console.warn('Native openAccessibilitySettings failed, trying fallback:', e);
      }
    }
    // Fallback: expo-intent-launcher can open Android system settings directly
    // without needing our custom native module.
    try {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.ACCESSIBILITY_SETTINGS
      );
    } catch (e) {
      console.warn('Could not open accessibility settings via fallback:', e);
    }
  }, [hasNativeModule]);

  // ── Battery optimization helpers ───────────────────────────────────────────
  // Android can kill the Accessibility Service in the background if battery
  // optimization is active. These functions let us detect and fix that.

  const checkBatteryOptimized = useCallback(async (): Promise<boolean> => {
    if (!hasNativeModule) return false;
    try {
      return await AppBlocker.isBatteryOptimized();
    } catch {
      return false;
    }
  }, []);

  const openBatterySettings = useCallback(async () => {
    if (hasNativeModule) {
      try {
        await AppBlocker.openBatteryOptimizationSettings();
        return;
      } catch (e) {
        console.warn('Native openBatterySettings failed, trying fallback:', e);
      }
    }
    // Fallback: open general battery settings via expo-intent-launcher
    try {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS
      );
    } catch (e) {
      console.warn('Could not open battery settings via fallback:', e);
    }
  }, [hasNativeModule]);

  // ── OEM autostart / battery manager (MIUI, ColorOS, FuntouchOS, One UI...) ──
  // Stock Android's battery exemption (above) isn't enough on many phones —
  // the manufacturer runs its own autostart/battery manager that can still
  // kill background services. There's no API to check that state, so this
  // just deep-links to the right screen for known manufacturers and lets the
  // user flip it on themselves.

  const oemManufacturer = (Platform.OS === 'android' ? Platform.constants?.Manufacturer : '') || '';

  // Manufacturers we have a known deep link for — used to decide whether to
  // even show an "Open autostart settings" affordance in the UI.
  const isKnownOemOffender = isAndroid && /xiaomi|redmi|poco|oppo|realme|oneplus|vivo|iqoo|samsung/i.test(
    oemManufacturer
  );

  const openOemAutostartSettings = useCallback(async (): Promise<boolean> => {
    if (!hasNativeModule) return false;
    try {
      // Resolves true if a manufacturer-specific screen opened, false if we
      // only managed to open the generic App Info screen as a fallback.
      return await AppBlocker.openOemAutostartSettings();
    } catch (e) {
      console.warn('openOemAutostartSettings failed:', e);
      return false;
    }
  }, [hasNativeModule]);

  // ── Notification permission (Android 13+) ───────────────────────────────────
  // Without POST_NOTIFICATIONS granted, the persistent "protection active"
  // foreground notification can't be shown to the user (the foreground
  // service itself still runs either way). Best-effort — safe to call
  // repeatedly, and a no-op on platforms/SDKs that don't need it.

  const requestNotificationPermission = useCallback(async () => {
    if (!isAndroid) return;
    try {
      const Notifications = await import('expo-notifications');
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        await Notifications.requestPermissionsAsync();
      }
    } catch (e) {
      console.warn('requestNotificationPermission failed:', e);
    }
  }, []);

  // ── Grayscale / dopamine-reduction shortcut ────────────────────────────────
  // Opens Android Accessibility Settings → Color Correction so the user can
  // enable "Grayscale" mode. Programmatic toggle requires WRITE_SECURE_SETTINGS
  // which Play Store apps cannot obtain, so this is a one-tap shortcut instead.
  const openGrayscaleSettings = useCallback(async () => {
    if (hasNativeModule) {
      try {
        await AppBlocker.openGrayscaleSettings();
        return;
      } catch (e) {
        console.warn('openGrayscaleSettings failed, trying fallback:', e);
      }
    }
    try {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.ACCESSIBILITY_SETTINGS
      );
    } catch (e) {
      console.warn('Could not open accessibility settings:', e);
    }
  }, [hasNativeModule]);

  // ── Temporary unlock ──────────────────────────────────────────────────────
  // Called from post-game.tsx when the user taps "Unlock for 10 min".
  // Stores the expiry in state (and tells the Android native module too).
  // After the duration, the domain is automatically blocked again.
  const unlockTemporarily = useCallback((domain: string, minutes: number = 10) => {
    const expiryMs = Date.now() + minutes * 60 * 1000;
    setTempUnlocks((prev) => ({ ...prev, [domain]: expiryMs }));

    // Also tell the native module so the Accessibility Service can enforce it
    if (hasNativeModule) {
      try {
        AppBlocker.setTemporaryUnlock(domain, expiryMs.toString());
      } catch (e) {
        console.warn('setTemporaryUnlock native call failed:', e);
      }
    }

    // Auto-clear after the unlock expires
    setTimeout(() => {
      setTempUnlocks((prev) => {
        const updated = { ...prev };
        delete updated[domain];
        return updated;
      });
    }, minutes * 60 * 1000);
  }, [hasNativeModule]);

  // ── Computed pause values ─────────────────────────────────────────────────
  // Derived from the raw timestamp each render — no extra state needed.
  const nowMs = Date.now();
  const isBlockingPaused       = blockingPausedUntil > nowMs;
  const blockingPausedMinutesLeft = isBlockingPaused
    ? Math.ceil((blockingPausedUntil - nowMs) / 60_000)
    : 0;

  // Auto-clear expired pause state so UI updates when the 30-min window closes.
  // A 30s interval is more than accurate enough for a minutes-remaining display.
  useEffect(() => {
    if (!isBlockingPaused) return;
    const interval = setInterval(() => {
      if (blockingPausedUntil <= Date.now()) {
        setBlockingPausedUntil(0);
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [isBlockingPaused, blockingPausedUntil]);

  // ── Derived blocking status ───────────────────────────────────────────────
  // Four possible states that ShieldStatus and the home screen can display:
  //   'paused'  — blocking is temporarily paused via QS tile
  //   'active'  — accessibility service is ON and at least one site/app is blocked
  //   'empty'   — service is ON but the blocklist is empty (user hasn't added anything)
  //   'off'     — accessibility service is disabled (needs user to go to Settings)
  const hasAnyBlocks = blockedApps.length > 0 || websiteBlocklist.length > 0;
  const blockingStatus: 'paused' | 'active' | 'empty' | 'off' = isBlockingPaused
    ? 'paused'
    : !serviceEnabled
      ? 'off'
      : hasAnyBlocks
        ? 'active'
        : 'empty';

  return {
    serviceEnabled,        // boolean — true if user has granted permission
    checking,              // boolean — true while first checking status
    blockedApps, toggleApp,             // (packageName: string) => void
    openSettings,          // () => void — opens Accessibility Settings
    checkBatteryOptimized, // () => Promise<boolean> — true if optimization is ON (bad)
    openBatterySettings,   // () => void — opens battery optimization settings
    isKnownOemOffender,      // boolean — this manufacturer has its own autostart/battery manager
    oemManufacturer,         // string — raw Platform.constants.Manufacturer value (for display/debug)
    openOemAutostartSettings, // () => Promise<boolean> — true if OEM-specific screen opened
    requestNotificationPermission, // () => Promise<void> — asks for POST_NOTIFICATIONS (Android 13+)
    openGrayscaleSettings, // () => void — opens Accessibility Settings → Color Correction
    grayscaleEnabled,      // boolean — whether dim overlay fires on gate launch
    setGrayscaleEnabled,   // (enabled: boolean) => Promise<void>
    checkServiceStatus,
    hasNativeModule,       // boolean — false in Expo Go, true in built app
    blockingStatus,        // 'paused' | 'active' | 'empty' | 'off' — for ShieldStatus component
    unlockTemporarily,     // (domain, minutes) => void — after game, let domain through
    tempUnlocks,           // Record<domain, expiryMs> — currently unlocked domains
    isBlockingPaused,           // boolean — true when QS tile has paused blocking
    blockingPausedMinutesLeft,  // number — minutes remaining in the pause window
    resumeBlocking,             // () => Promise<void> — clears the paused flag
    unlockTimeLog,              // Record<"YYYY-MM-DD", ms> — time spent in unlocked apps per day
  };
}
