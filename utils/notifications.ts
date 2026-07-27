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
  3:   { title: '🔥 3-Day Streak!',  body: "Three days strong. You're building something real." },
  7:   { title: '🔥 7-Day Streak!',  body: "One week of staying in control. That's huge." },
  14:  { title: '🔥 2-Week Streak!', body: "14 days. Your brain is literally rewiring." },
  30:  { title: '🌙 30-Day Streak!', body: "A full month. You've levelled up for real." },
  60:  { title: '⚡ 60-Day Streak!', body: "Two months of discipline. Legendary." },
  100: { title: '🏆 100-Day Streak!', body: "100 days. Most people quit. You didn't." },
};

export async function maybeNotifyStreak(newStreak: number) {
  const milestone = STREAK_MILESTONES[newStreak];
  if (milestone) {
    await fire(milestone.title, milestone.body);
  }
}

// ── Walk-away milestones ─────────────────────────────────────────────────────
const WALKAWAY_MILESTONES: Record<number, { title: string; body: string }> = {
  10:  { title: '🚶 10 Walk-Aways!',  body: "Ten times you chose yourself over the scroll." },
  25:  { title: '💪 25 Walk-Aways!',  body: "25 urges redirected. You're genuinely different now." },
  50:  { title: '🧠 50 Walk-Aways!',  body: "Halfway to 100. Your focus is a superpower." },
  100: { title: '🏆 100 Walk-Aways!', body: "100. You've proven you run the app, not the other way around." },
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
export async function scheduleWeeklyRecap(walkAwayCount: number, streak: number) {
  try {
    await Notifications.cancelScheduledNotificationAsync('weekly-recap').catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: 'weekly-recap',
      content: {
        title: '📊 Your weekly recap',
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
  if (streak >= 7)  return `${walkAways} walk-away${walkAways === 1 ? '' : 's'} this week · ${streak}-day streak 🔥 Keep going.`;
  return `${walkAways} walk-away${walkAways === 1 ? '' : 's'} this week. Every one counts. 💪`;
}
