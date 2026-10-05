// ─── Temporary unlock ────────────────────────────────────────────────────────
//
// Tells the Android Accessibility Service to let one app/site through for a
// while. This is the only thing that actually grants an unlock — the service
// enforces (and expires) it natively, so there's no JS-side bookkeeping.
//
// It lives here, not inside useAppBlocker, so the gate and post-game screens
// can grant an unlock without mounting the whole blocker-sync hook (which runs
// its own timers and pushes the blocklist to native every time it mounts).
//
// `target` is the raw identifier the service matches on: the Android package
// name for an app (e.g. "com.instagram.android") or the domain for a site
// (e.g. "instagram.com") — NOT the pretty display name.

import { NativeModules, Platform } from 'react-native';
import { useUserStore } from '@/stores/useUserStore';

const { AppBlocker } = NativeModules;
const hasNativeModule = Platform.OS === 'android' && !!AppBlocker;

export const DEFAULT_UNLOCK_MINUTES = 10;

// Opens the target app after an unlock so the user isn't left on NoGoon's home
// screen. Quietly does nothing for websites, or on a build without the native
// launchApp method.
export async function launchBlockedApp(target: string): Promise<void> {
  if (!target || !hasNativeModule || typeof AppBlocker.launchApp !== 'function') return;
  try {
    await AppBlocker.launchApp(target);
  } catch (e) {
    console.warn('launchApp native call failed:', e);
  }
}

export async function grantTemporaryUnlock(
  target: string,
  minutes: number = DEFAULT_UNLOCK_MINUTES,
  countAsGiveIn: boolean = true,
): Promise<boolean> {
  if (!target || !hasNativeModule) return false;
  const expiryMs = Date.now() + minutes * 60 * 1000;
  try {
    await AppBlocker.setTemporaryUnlock(target, expiryMs.toString());
    // Letting the app through counts as giving in for streak purposes.
    if (countAsGiveIn) useUserStore.getState().recordGiveIn();
    return true;
  } catch (e) {
    console.warn('setTemporaryUnlock native call failed:', e);
    return false;
  }
}
