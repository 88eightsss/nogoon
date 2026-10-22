// ─── Notification helpers ─────────────────────────────────────────────────────
//
// Wraps expo-notifications for milestone / streak celebrations.
// All notifications are LOCAL — no server needed.
//
// Usage:
//   await requestNotificationPermission();   // call once on app start
//   maybeNotifyStreak(newStreak);            // call after incrementStreak
//   maybeNotifyWalkAway(newCount);           // call after incrementWalkAway

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// ── Android channel ──────────────────────────────────────────────────────────
const CHANNEL_ID = 'nogoon-milestones';

export async function setupNotificationChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Milestones',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200, 100, 200],
    lightColor: '#A78BFA',
  });
}

// ── Permission ───────────────────────────────────────────────────────────────
export async function requestNotificationPermission(): Promise<boolean> {
  await setupNotificationChannel();
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ── Fire a notification immediately ─────────────────────────────────────────
async function fire(title: string, body: string) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null, // immediate
    });
  } catch {
    // Permissions not granted or unavailable — fail silently
  }
}

// ── Streak milestones ────────────────────────────────────────────────────────
const STREAK_MILESTONES: Record<number, { title: string; body: string }> = {
  3:   { title: '3-Day Streak!',  body: "Three days strong. You're building something real." },
  7:   { title: '7-Day Streak!',  body: "One week of staying in control. That's huge." },
  14:  { title: '2-Week Streak!', body: "14 days. Your brain is literally rewiring." },
  30:  { title: '30-Day Streak!', body: "A full month. You've levelled up for real." },
  60:  { title: '60-Day Streak!', body: "Two months of discipline. Legendary." },
  100: { title: '100-Day Streak!', body: "100 days. Most people quit. You didn't." },
};

export async function maybeNotifyStreak(newStreak: number) {
  const milestone = STREAK_MILESTONES[newStreak];
  if (milestone) {
    await fire(milestone.title, milestone.body);
  }
}

// ── Walk-away milestones ─────────────────────────────────────────────────────
const WALKAWAY_MILESTONES: Record<number, { title: string; body: string }> = {
  10:  { title: '10 Walk-Aways!',  body: "Ten times you chose yourself over the scroll." },
  25:  { title: '25 Walk-Aways!',  body: "25 urges redirected. You're genuinely different now." },
  50:  { title: '50 Walk-Aways!',  body: "Halfway to 100. Your focus is a superpower." },
  100: { title: '100 Walk-Aways!', body: "100. You've proven you run the app, not the other way around." },
};

export async function maybeNotifyWalkAway(newCount: number) {
  const milestone = WALKAWAY_MILESTONES[newCount];
  if (milestone) {
    await fire(milestone.title, milestone.body);
  }
}

// ── Weekly recap — fires every Sunday at 9 am ────────────────────────────────
// Call once on app startup (after permission granted). We cancel any existing
// 'weekly-recap' before re-scheduling to prevent duplicate Sunday fires.
// Walk-aways in the last 7 days (today included) from the date-keyed tally.
export function walkAwaysThisWeek(dailyWalkAways: Record<string, number>): number {
  let total = 0;
  const d = new Date();
  for (let i = 0; i < 7; i++) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    total += dailyWalkAways[key] ?? 0;
    d.setDate(d.getDate() - 1);
  }
  return total;
}

export async function scheduleWeeklyRecap(walkAwayCount: number, streak: number) {
  try {
    await Notifications.cancelScheduledNotificationAsync('weekly-recap').catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: 'weekly-recap',
      content: {
        title: 'Your weekly recap',
        body: buildRecapBody(walkAwayCount, streak),
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: 1, // Sunday
        hour: 9,
        minute: 0,
      },
    });
  } catch {
    // Permissions not granted or unavailable — fail silently
  }
}

function buildRecapBody(walkAways: number, streak: number): string {
  if (walkAways === 0) return "A new week starts now. You've got this.";
  if (streak >= 7)  return `${walkAways} walk-away${walkAways === 1 ? '' : 's'} this week · ${streak}-day streak. Keep going.`;
  return `${walkAways} walk-away${walkAways === 1 ? '' : 's'} this week. Every one counts.`;
}

// ── Comeback reminder ────────────────────────────────────────────────────────

/** Cancel the comeback reminder — call on every app open. */
export async function cancelComebackReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync('pet-comeback').catch(() => {});
  } catch {}
}

// ── Daily summary — fires at 8pm with today's walk-away count ───────────────
// Rescheduled every time the user walks away so the count stays accurate.
// Does nothing if it's already past 8pm (the old one already fired or never fired).
export async function scheduleDailySummary(todayWalkAways: number, topDomain?: string): Promise<void> {
  try {
    const now = new Date();
    const eightPm = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0);
    if (eightPm.getTime() <= now.getTime()) return; // Past 8pm — skip until tomorrow

    // Open counts are keyed by domain OR Android package id ("com.instagram.android");
    // a raw package id reads badly in a notification, so only name plain domains.
    const namedDomain = topDomain && (topDomain.match(/\./g) ?? []).length < 2 ? topDomain : undefined;
    topDomain = namedDomain;

    const body = todayWalkAways === 0
      ? "The urge might hit tonight. NoGoon's got you."
      : `${todayWalkAways} walk-away${todayWalkAways !== 1 ? 's' : ''} today${topDomain ? ` · ${topDomain} was calling` : ''}. Strong work.`;

    await Notifications.cancelScheduledNotificationAsync('daily-summary').catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: 'daily-summary',
      content: { title: 'Your day at a glance', body, sound: false },
      trigger: { date: eightPm } as any,
    });
  } catch {
    // Permissions not granted or unavailable — fail silently
  }
}

// ── Daily "briefing is ready" reminder ───────────────────────────────────────
// Optional, off by default, and the same words every day: no streak pressure, no teasers.
// A local notification (no server). Rescheduling replaces the old one.
const BRIEFING_CHANNEL = 'nogoon-briefing';
const BRIEFING_ID = 'briefing-ready';

/** Turn the reminder on (asking for permission if needed) or off. Returns false if permission was refused. */
export async function setBriefingReminder(on: boolean, hhmm: string): Promise<boolean> {
  try {
    await Notifications.cancelScheduledNotificationAsync(BRIEFING_ID).catch(() => {});
    if (!on) return true;
    if (!(await requestNotificationPermission())) return false;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(BRIEFING_CHANNEL, {
        name: 'Daily briefing',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
    await Notifications.scheduleNotificationAsync({
      identifier: BRIEFING_ID,
      content: { title: "Today's briefing is ready", body: 'A small batch, once a day. Read it, then put the phone down.', sound: false },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: Number.isFinite(h) ? h : 8,
        minute: Number.isFinite(m) ? m : 0,
        channelId: BRIEFING_CHANNEL,
      },
    });
    return true;
  } catch {
    return false;
  }
}
