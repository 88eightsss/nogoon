// ─── Local date keys ──────────────────────────────────────────────────────────
//
// Every "which calendar day is this" check in the app — streaks, daily
// walk-away buckets, the weekly activity chart, the companion's daily
// feed/care state, wind-down's nightly commitment, the dead-reckoning
// screen — needs to agree on what "today" means. Before this file existed,
// call sites individually did `new Date().toISOString().split('T')[0]`,
// which is UTC, not the device's local calendar day. That's invisible near
// UTC+0, but for anyone at a meaningful offset (Hawaii is UTC-10) the day
// boundary silently lands at 2pm local instead of midnight — evening
// activity gets filed under tomorrow's date.
//
// getLocalDateKey/getLocalMonthKey read the device's local Y/M/D directly
// (no toISOString detour), so "today" here matches what the clock on the
// user's home screen says. Every read/write of a date-keyed field
// (dailyWalkAways, lastStreakDate, streakRestoreMonth, the weekly chart,
// nogoon_start_date, etc.) must go through these so producers and
// consumers of the same key never disagree.

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

// 'YYYY-MM-DD' in the device's local timezone. Defaults to now.
export function getLocalDateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// 'YYYY-MM' in the device's local timezone. Defaults to now.
export function getLocalMonthKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

// Inverse of getLocalDateKey: turns a 'YYYY-MM-DD' key back into a Date at
// LOCAL midnight for that day. Deliberately not `new Date(key)` — that
// string form is parsed as UTC midnight per the ECMAScript spec, which is
// the same local/UTC mismatch this file exists to avoid: subtracting a day
// in ms from a UTC-midnight timestamp and reading it back in a negative
// UTC-offset timezone (e.g. Hawaii, UTC-10) lands on the wrong local
// calendar day. Building the Date from its Y/M/D parts avoids that.
export function parseLocalDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

// Local calendar-day difference between two 'YYYY-MM-DD' keys (a - b).
// Safe across DST because it walks Date objects via setDate(), not raw ms
// math on possibly-UTC-anchored timestamps.
export function localDateKeyDiffDays(a: string, b: string): number {
  const ms = parseLocalDateKey(a).getTime() - parseLocalDateKey(b).getTime();
  return Math.round(ms / 86_400_000);
}
