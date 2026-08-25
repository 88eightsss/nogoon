// ─── useNotificationListener Hook ────────────────────────────────────────────
//
// JS interface for NoGoonNotificationListener — the Notification Filter.
//
// FLOW:
//   1. We check isNotificationListenerEnabled() — has the user granted
//      Notification Access in Android Settings?
//   2. If not, we show a prompt explaining why it's needed and a button
//      to open the settings page.
//   3. Once enabled, we persist a "filterEnabled" boolean that the
//      NoGoonNotificationListener.kt reads on every incoming notification.
//
// Unlike the VPN (which is an Android system dialog), Notification Access
// requires the user to navigate to Settings → Apps → Special App Access →
// Notification Access → NoGoon. We send them there directly.

import { useState, useEffect, useCallback } from 'react';
import { Platform, NativeModules, AppState } from 'react-native';

const { AppBlocker } = NativeModules;
const isAndroid = Platform.OS === 'android';
const hasNative = isAndroid && !!AppBlocker;

export function useNotificationListener() {
  const [isGranted,         setIsGranted]         = useState(false);
  const [isFilterEnabled,   setIsFilterEnabled]   = useState(false);
  const [isLoading,         setIsLoading]         = useState(false);

  // ── Check current status ──────────────────────────────────────────────────

  const checkStatus = useCallback(async () => {
    if (!hasNative) return;
    try {
      const granted = await AppBlocker.isNotificationListenerEnabled();
      setIsGranted(granted);
    } catch {
      setIsGranted(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkStatus();
    });
    return () => sub.remove();
  }, [checkStatus]);

  // ── Open Settings ─────────────────────────────────────────────────────────

  const openSettings = useCallback(async () => {
    if (!hasNative) return;
    try {
      await AppBlocker.openNotificationListenerSettings();
    } catch {
      // Silently fail — worst case user sees nothing
    }
  }, []);

  // ── Toggle filter (requires permission to be granted first) ───────────────

  const toggleFilter = useCallback(async (enabled: boolean) => {
    if (!hasNative || isLoading) return;
    setIsLoading(true);
    try {
      await AppBlocker.setNotificationFilterEnabled(enabled);
      setIsFilterEnabled(enabled);
    } catch {
      // Best-effort
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  return {
    isGranted,
    isFilterEnabled,
    isLoading,
    toggleFilter,
    openSettings,
    checkStatus,
  };
}
