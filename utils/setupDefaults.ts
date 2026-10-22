// ─── Apply the setup-question answers ─────────────────────────────────────────
//
// Turns SetupAnswers (constants/setupQuestions.ts) into changes in the existing
// stores. Only answered questions change anything, and nothing is ever removed
// or switched off, so re-running the questions never wipes existing settings.
// The answers themselves are not saved anywhere.

import { planSetupDefaults, type SetupAnswers } from '@/constants/setupQuestions';
import { useUserStore } from '@/stores/useUserStore';
import { useBriefingPrefs } from '@/stores/useBriefingPrefs';
import { useRoomStore } from '@/stores/useRoomStore';
import { filterInstalledApps } from '@/hooks/useAppBlocker';
import { setBriefingReminder } from '@/utils/notifications';

export async function applySetupAnswers(answers: SetupAnswers): Promise<void> {
  const plan = planSetupDefaults(answers);
  const user = useUserStore.getState();

  // Q1: add the starter sites and the installed starter apps (union with what's there).
  plan.addDomains.forEach((d) => user.addSite(d));
  if (plan.addApps.length > 0) {
    const installed = await filterInstalledApps(plan.addApps);
    const current = useUserStore.getState().blockedApps;
    const next = Array.from(new Set([...current, ...installed]));
    if (next.length !== current.length) useUserStore.getState().setBlockedApps(next);
  }

  // Q2: Wind-down for evening / late night.
  if (plan.windDownHour !== null) {
    user.setWindDownHour(plan.windDownHour);
    user.setWindDownEnabled(true);
  }

  // Q2: Briefing reminder, only when the box was changed. Keeps any time already set (default 08:00).
  if (plan.briefingReminder !== null) {
    const prefs = useBriefingPrefs.getState();
    const ok = await setBriefingReminder(plan.briefingReminder, prefs.remindAt);
    prefs.setRemind(plan.briefingReminder && ok);   // stays off if notifications were refused
  }

  // Q3: what Need a minute and Unwind put first.
  if (plan.helpFirst !== null) useRoomStore.getState().setHelpFirst(plan.helpFirst);
}
