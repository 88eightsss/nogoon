// Leaves the gate / post-game flow.
//
// The blocker launches the gate through a deep link (nogoon://gate…). If NoGoon was
// not already running, the navigation stack is just [gate], and `dismissAll()` has
// nothing to pop — the screen stayed put and buttons like "Never mind" appeared dead.
// Fall back to replacing the route with the main app in that case.

import { router } from 'expo-router';

export function exitGate(): void {
  try {
    if (router.canDismiss()) {
      router.dismissAll();
      return;
    }
  } catch {
    // fall through to the replace below
  }
  router.replace('/(tabs)');
}
