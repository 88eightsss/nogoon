// ─── useNativeSync — NoGoon ───────────────────────────────────────────────────
//
// App-wide side effects that push JS state down to the Android Accessibility
// Service (blocked apps/sites, Modes, curfew, widget stats). Mounted ONCE in the
// root layout — previously these effects lived inside useAppBlocker, which is
// mounted by several screens at once, so every change was pushed (and every
// Mode re-applied) multiple times.
//
// MODES: a Mode is a saved bundle of blocklist + game settings. Applying one
// swaps the live lists for the Mode's lists, but the user's own lists are
// snapshotted first and restored when the Mode stops resolving — so a
// scheduled "Work" Mode never permanently replaces what you blocked yourself.
// The Mode is applied once per activation (or when its contents change), not on
// every timer tick, so edits made while a Mode is on aren't silently reverted.

import { useEffect, useState } from 'react';
import { Platform, NativeModules, AppState } from 'react-native';
import { useUserStore } from '@/stores/useUserStore';
import { useModesStore, resolveActiveMode } from '@/stores/useModesStore';
import { getLocalDateKey } from '@/utils/date';

const { AppBlocker } = NativeModules;
const hasNativeModule = Platform.OS === 'android' && !!AppBlocker;

export function useNativeSync(enabled: boolean) {
  const blockedApps = useUserStore((s) => s.blockedApps);
  const websiteBlocklist = useUserStore((s) => s.blocklist);
  const curfewEnabled = useUserStore((s) => s.curfewEnabled);
  const curfewStart = useUserStore((s) => s.curfewStart);
  const curfewEnd = useUserStore((s) => s.curfewEnd);
  const walkAwayCount = useUserStore((s) => s.walkAwayCount);
  const streak = useUserStore((s) => s.streak);
  const dailyWalkAways = useUserStore((s) => s.dailyWalkAways);
  const modes = useModesStore((s) => s.modes);
  const activeModeId = useModesStore((s) => s.activeModeId);

  // Blocked apps / sites → native
  useEffect(() => {
    if (!enabled || !hasNativeModule) return;
    AppBlocker.setBlockedApps(blockedApps).catch(console.warn);
  }, [enabled, blockedApps]);

  useEffect(() => {
    if (!enabled || !hasNativeModule) return;
    AppBlocker.setBlockedDomains(websiteBlocklist).catch(console.warn);
  }, [enabled, websiteBlocklist]);

  // Re-check Modes every minute while foregrounded, and on resume, so a
  // scheduled boundary applies even if NoGoon wasn't reopened exactly then.
  const [modeCheckTick, setModeCheckTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => setModeCheckTick((t) => t + 1), 60_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setModeCheckTick((t) => t + 1);
    });
    return () => { clearInterval(interval); sub.remove(); };
  }, [enabled]);

  // Apply / restore the active Mode.
  // Not touched here: isBricked / isColdTurkey (they have their own disable
  // cooldown a schedule must not bypass) and curfew (a separate override layer).
  useEffect(() => {
    if (!enabled) return;
    const modesState = useModesStore.getState();
    const user = useUserStore.getState();
    const active = resolveActiveMode(modes, activeModeId);

    if (!active) {
      const snap = modesState.baseSnapshot;
      if (snap) {
        user.setBlockedApps(snap.apps);
        useUserStore.setState({ blocklist: snap.domains });
        modesState.setApplied(null, null);
      }
      return;
    }

    const key = JSON.stringify([active.id, active.blockedApps, active.blockedDomains,
      active.gameMode, active.noGames, active.preferWaitingRoom]);
    if (modesState.appliedKey === key) return;

    // First activation: remember the user's own lists so they can be restored.
    const snapshot = modesState.baseSnapshot ?? { apps: user.blockedApps, domains: user.blocklist };
    // A Mode that lists nothing leaves the user's lists alone rather than
    // silently dropping all protection.
    if (active.blockedApps.length > 0 || active.blockedDomains.length > 0) {
      user.setBlockedApps(active.blockedApps);
      useUserStore.setState({ blocklist: active.blockedDomains });
    }
    user.setGameMode(active.gameMode);
    user.setNoGames(active.noGames);
    user.setPreferWaitingRoom(active.preferWaitingRoom);
    modesState.setApplied(key, snapshot);
    // modeCheckTick only re-runs the check; its value is never read.
  }, [enabled, modes, activeModeId, modeCheckTick]);

  // Full Modes config → native, so the service can resolve the active Mode
  // itself at a schedule boundary while NoGoon is closed.
  useEffect(() => {
    if (!enabled || !hasNativeModule) return;
    const modesJson = JSON.stringify(
      modes.map((m) => ({ id: m.id, apps: m.blockedApps, domains: m.blockedDomains, schedule: m.schedule }))
    );
    AppBlocker.setModesConfig(modesJson, activeModeId ?? '').catch(console.warn);
  }, [enabled, modes, activeModeId]);

  // Digital Curfew → native
  useEffect(() => {
    if (!enabled || !hasNativeModule) return;
    AppBlocker.setCurfew(curfewEnabled, curfewStart, curfewEnd).catch(console.warn);
  }, [enabled, curfewEnabled, curfewStart, curfewEnd]);

  // Widget stats → native
  useEffect(() => {
    if (!enabled || !hasNativeModule) return;
    const todayCount = dailyWalkAways[getLocalDateKey()] ?? 0;
    AppBlocker.setTodayStats(todayCount, streak).catch(console.warn);
  }, [enabled, walkAwayCount, streak, dailyWalkAways]);
}
