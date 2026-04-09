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
  const { blockedApps, setBlockedApps } = useUserStore();
  const [serviceEnabled, setServiceEnabled] = useState(false);
  const [checking, setChecking]             = useState(true);

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

  // ── Actions ────────────────────────────────────────────────────────────────

  // Toggle a single app on/off in the blocklist
  const toggleApp = useCallback((packageName: string) => {
    const isBlocked = blockedApps.includes(packageName);
    const updated   = isBlocked
      ? blockedApps.filter((p) => p !== packageName)
      : [...blockedApps, packageName];
    setBlockedApps(updated);
  }, [blockedApps, setBlockedApps]);

  // Open Android's Accessibility Settings so user can enable the service
  const openSettings = useCallback(async () => {
    if (!hasNativeModule) return;
    try {
      await AppBlocker.openAccessibilitySettings();
    } catch (e) {
      console.warn('Could not open accessibility settings:', e);
    }
  }, []);

  return {
    serviceEnabled,   // boolean — true if user has granted permission
    checking,         // boolean — true while first checking status
    blockedApps,      // string[] — list of blocked package names
    toggleApp,        // (packageName: string) => void
    openSettings,     // () => void — opens Android Settings
    checkServiceStatus,
    hasNativeModule,  // boolean — false in Expo Go, true in built app
  };
}
