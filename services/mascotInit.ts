// One-off, on app start: an install that already had a companion keeps its progress. Its lifetime
// walk-aways become that companion's feedings, so nothing already earned is lost.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { isCharacterId } from '@/constants/sprites';
import { CHARACTER_KEY, useMascotStore } from '@/stores/useMascotStore';
import { useUserStore } from '@/stores/useUserStore';

function whenHydrated(store: { persist: { hasHydrated: () => boolean; onFinishHydration: (fn: () => void) => () => void } }): Promise<void> {
  if (store.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const off = store.persist.onFinishHydration(() => { off(); resolve(); });
  });
}

export async function initMascots(): Promise<void> {
  try {
    await Promise.all([whenHydrated(useMascotStore), whenHydrated(useUserStore)]);
    if (useMascotStore.getState().migrated) return;
    const raw = await AsyncStorage.getItem(CHARACTER_KEY);
    const n = raw === null ? NaN : parseInt(raw, 10);
    useMascotStore.getState().migrate(isCharacterId(n) ? n : 0, useUserStore.getState().walkAwayCount);
  } catch {
    // Best effort: with no migration the companion just starts from zero.
  }
}
