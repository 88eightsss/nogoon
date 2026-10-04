// ─── useCloudSync ────────────────────────────────────────────────────────────
//
// Keeps the cloud profile (points, XP, streak, games played, walk-aways) in
// step with this device. Mounted once in the root layout.
//
// Why it exists: progress is recorded locally, but nothing ever uploaded it,
// so the cloud copy stayed at zero. Combined with the on-launch load, that
// made progress look like it reset. Now every change to those fields is pushed
// up shortly after it happens (debounced so a burst of updates is one write),
// and again when the app goes to the background, which is when Android is most
// likely to kill the process before a pending write fires.

import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useUserStore } from '@/stores/useUserStore';

const DEBOUNCE_MS = 4000;

const pick = (s: ReturnType<typeof useUserStore.getState>) =>
  [s.points, s.xp, s.streak, s.longestStreak, s.gamesPlayed, s.walkAwayCount].join('|');

export function useCloudSync(userId: string | undefined, ready: boolean) {
  useEffect(() => {
    if (!userId || !ready) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastSynced = pick(useUserStore.getState());

    const flush = () => {
      if (timer) { clearTimeout(timer); timer = null; }
      const current = pick(useUserStore.getState());
      if (current === lastSynced) return;
      lastSynced = current;
      useUserStore.getState().syncToSupabase(userId).catch(() => {});
    };

    const unsubscribe = useUserStore.subscribe((state) => {
      if (pick(state) === lastSynced) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, DEBOUNCE_MS);
    });

    const appState = AppState.addEventListener('change', (next) => {
      if (next !== 'active') flush();
    });

    return () => {
      unsubscribe();
      appState.remove();
      if (timer) clearTimeout(timer);
    };
  }, [userId, ready]);
}
