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
import { Platform, NativeModules } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import { useUserStore } from '@/stores/useUserStore';

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
  const { blockedApps, setBlockedApps, blocklist: websiteBlocklist } = useUserStore();
  const [serviceEnabled, setServiceEnabled] = useState(false);
  const [checking, setChecking]             = useState(true);

  // ── Temporary unlock state ─────────────────────────────────────────────────
  // Tracks domains the user has unlocked temporarily after playing a game.
  // Key = domain string, Value = expiry timestamp (ms).
  // When the current time passes the expiry, the domain is blocked again.
  const [tempUnlocks, setTempUnlocks] = useState<Record<string, number>>({});

  // ── Check if Accessibility Service is enabled ──────────────────────────────
  // Polls every 2 seconds so the UI updates immediately after the user grants
  // permission in Android Settings without needing to restart the app.

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

  useEffect(() => {
    checkServiceStatus();
    const interval = setInterval(checkServiceStatus, 2000);
    return () => clearInterval(interval);
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

  // ── Derived blocking status ───────────────────────────────────────────────
  // Three possible states that ShieldStatus and the home screen can display:
  //   'active'  — accessibility service is ON and at least one site/app is blocked
  //   'empty'   — service is ON but the blocklist is empty (user hasn't added anything)
  //   'off'     — accessibility service is disabled (needs user to go to Settings)
  const hasAnyBlocks = blockedApps.length > 0 || websiteBlocklist.length > 0;
  const blockingStatus: 'active' | 'empty' | 'off' = !serviceEnabled
    ? 'off'
    : hasAnyBlocks
      ? 'active'
      : 'empty';

  return {
    serviceEnabled,        // boolean — true if user has granted permission
    checking,              // boolean — true while first checking status
    blockedApps,           // string[] — list of blocked package names
    toggleApp,             // (packageName: string) => void
    openSettings,          // () => void — opens Accessibility Settings
    checkBatteryOptimized, // () => Promise<boolean> — true if optimization is ON (bad)
    openBatterySettings,   // () => void — opens battery optimization settings
    checkServiceStatus,
    hasNativeModule,       // boolean — false in Expo Go, true in built app
    blockingStatus,        // 'active' | 'empty' | 'off' — for ShieldStatus component
    unlockTemporarily,     // (domain, minutes) => void — after game, let domain through
    tempUnlocks,           // Record<domain, expiryMs> — currently unlocked domains
  };
}
