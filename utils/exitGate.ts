// Leaves the gate / post-game flow.
//
// The blocker launches the gate through a deep link (nogoon://gate...). If NoGoon was
// not already running, the navigation stack is just [gate], and `dismissAll()` has
// nothing to pop - the screen stayed put and buttons like "Never mind" appeared dead.
// Fall back to replacing the route with the main app in that case.
//
// Walking away must also LEAVE the blocked app. Closing the gate alone reveals whatever was
// underneath (the blocked app), which then re-fires the gate or, when the retrigger is swallowed
// by a cooldown, simply stays open. So by default we also send the phone to the home screen.
// Pass { keepApp: true } when the person is about to be taken INTO an app on purpose (an unlock,
// or opening Messages for a hello), so Home does not fight that launch.

import { NativeModules, Platform } from 'react-native';
import { router } from 'expo-router';

const { AppBlocker } = NativeModules;

export function exitGate(opts: { keepApp?: boolean } = {}): void {
  let dismissed = false;
  try {
    if (router.canDismiss()) {
      router.dismissAll();
      dismissed = true;
    }
  } catch {
    // fall through to the replace below
  }
  if (!dismissed) router.replace('/(tabs)');

  if (!opts.keepApp && Platform.OS === 'android' && typeof AppBlocker?.goHome === 'function') {
    // Let the navigation settle first so the gate is gone when Home animates in.
    setTimeout(() => { try { AppBlocker.goHome(); } catch { /* best effort */ } }, 60);
  }
}
