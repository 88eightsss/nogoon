// ─── useVpn Hook ──────────────────────────────────────────────────────────────
//
// JS interface for NoGoonVpnService — the DNS-based Network Shield.
//
// FLOW:
//   1. User taps "Enable Network Shield"
//   2. AppBlocker.startVpn() is called on the native side
//   3. If VPN permission hasn't been granted yet, the native module calls
//      startActivityForResult with the intent from VpnService.prepare() —
//      Android shows the system consent dialog automatically.
//   4. When the user approves, the VPN service starts and the promise resolves.
//      If denied, the promise rejects with VPN_PERMISSION_DENIED.
//
// The consent dialog is handled entirely in Kotlin (AppBlockerModule.kt).
// This hook only needs to call startVpn() and handle success/failure.

import { useState, useEffect, useCallback } from 'react';
import { Platform, NativeModules, AppState } from 'react-native';

const { AppBlocker } = NativeModules;
const isAndroid = Platform.OS === 'android';
const hasNative = isAndroid && !!AppBlocker;

export function useVpn() {
  const [isActive,          setIsActive]          = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [isLoading,         setIsLoading]         = useState(false);

  // ── Check current VPN status ─────────────────────────────────────────────

  const checkStatus = useCallback(async () => {
    if (!hasNative) return;
    try {
      const [active, granted] = await Promise.all([
        AppBlocker.isVpnActive(),
        AppBlocker.isVpnPermissionGranted(),
      ]);
      setIsActive(active);
      setPermissionGranted(granted);
    } catch {
      setIsActive(false);
    }
  }, []);

  // Poll when app comes to foreground (user may have changed VPN state in Settings)
  useEffect(() => {
    checkStatus();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkStatus();
    });
    return () => sub.remove();
  }, [checkStatus]);

  // ── Start VPN ─────────────────────────────────────────────────────────────
  // Kotlin handles the system consent dialog via startActivityForResult.
  // Promise resolves true once the service starts, or rejects if denied.

  const startVpn = useCallback(async () => {
    if (!hasNative || isLoading) return;
    setIsLoading(true);
    try {
      await AppBlocker.startVpn();
      setIsActive(true);
      setPermissionGranted(true);
    } catch (e: any) {
      // VPN_PERMISSION_DENIED = user declined the dialog; anything else = error
      setIsActive(false);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  // ── Stop VPN ──────────────────────────────────────────────────────────────

  const stopVpn = useCallback(async () => {
    if (!hasNative || isLoading) return;
    setIsLoading(true);
    try {
      await AppBlocker.stopVpn();
      setIsActive(false);
    } catch {
      // Best-effort — VPN may have already stopped
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const toggle = useCallback(() => {
    if (isActive) return stopVpn();
    return startVpn();
  }, [isActive, startVpn, stopVpn]);

  return {
    isActive,
    isLoading,
    permissionGranted,
    toggle,
    startVpn,
    stopVpn,
    checkStatus,
  };
}
