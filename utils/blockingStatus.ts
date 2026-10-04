// ─── Blocking status presentation ────────────────────────────────────────────
//
// One place that turns the blocker's status into what the user sees, so the
// Today strip, the Protect pill, the Me row and the organizer card can't drift
// apart. Only a genuinely OFF Accessibility Service is an alarm (red + pulse);
// "paused" and "nothing blocked yet" are different situations and used to be
// shown with the same red "Blocking off — tap to fix" as a missing permission.
//
// 'checking' is the first moment after launch before the service state is
// known — shown as nothing, instead of flashing red until the check returns.

import type { ThemePalette } from '@/constants/Themes';

export type BlockingStatus = 'checking' | 'paused' | 'active' | 'empty' | 'off';

export type BlockingStatusView = {
  visible: boolean;                 // false → render nothing yet
  icon: 'shield' | 'alert-circle' | 'pause-circle' | 'plus-circle';
  label: string;                    // full line, e.g. on the Today strip
  short: string;                    // compact label for pills / rows
  color: string;
  dim: string;
  alarm: boolean;                   // true only when the service is off
};

export function describeBlockingStatus(status: BlockingStatus, colors: ThemePalette): BlockingStatusView {
  switch (status) {
    case 'active':
      return { visible: true, icon: 'shield', label: 'Blocking active', short: 'Active',
               color: colors.success, dim: colors.successDim, alarm: false };
    case 'off':
      return { visible: true, icon: 'alert-circle', label: 'Blocking off — tap to fix', short: 'Off — tap to fix',
               color: colors.danger, dim: colors.dangerDim, alarm: true };
    case 'paused':
      return { visible: true, icon: 'pause-circle', label: 'Blocking paused', short: 'Paused',
               color: colors.warning, dim: colors.warningDim, alarm: false };
    case 'empty':
      return { visible: true, icon: 'plus-circle', label: 'Nothing blocked yet — add an app on Protect', short: 'Nothing blocked yet',
               color: colors.warning, dim: colors.warningDim, alarm: false };
    default:
      return { visible: false, icon: 'shield', label: '', short: '', color: colors.textMuted, dim: colors.surface, alarm: false };
  }
}
