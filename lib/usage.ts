// ─── Anonymous usage counts ──────────────────────────────────────────────────
//
// Counts a handful of things (onboarded, gate opened, walked away, went on an outing) and sends the totals
// to our own backend once in a while, so we can tell whether the app works and whether people stay.
// What is sent: the counts, the app version, and a random token that the phone replaces EVERY DAY, so a
// day's token cannot be linked to the day before. Never an account, email, device id or location.
// It follows the same switch as crash reports (Setup & fixes): off means nothing is counted or sent.
//
// Counts are kept on the phone and sent on launch and when the app comes back to the front, at most every
// ten minutes. A failed send keeps the counts for next time. Nothing here can throw into the app.

import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { crashReportingOn } from '@/lib/crashReport';

export type UsageEvent = 'onboarded' | 'demo_done' | 'accessibility_on' | 'gate_open' | 'walk_away' | 'outing';

const PENDING = 'nogoon_usage_pending';
const TOKEN = 'nogoon_usage_token';
const MIN_GAP_MS = 10 * 60 * 1000;

let counts: Partial<Record<UsageEvent, number>> | null = null;   // loaded lazily, mirrors storage
let lastFlush = 0;
let flushing = false;

const utcDay = () => new Date().toISOString().slice(0, 10);

async function load(): Promise<Partial<Record<UsageEvent, number>>> {
  if (counts) return counts;
  try { counts = JSON.parse((await AsyncStorage.getItem(PENDING)) ?? '{}') ?? {}; } catch { counts = {}; }
  return counts as Partial<Record<UsageEvent, number>>;
}

/** Count one event. Fire and forget. */
export function track(event: UsageEvent): void {
  void (async () => {
    try {
      if (!(await crashReportingOn())) return;
      const c = await load();
      c[event] = Math.min((c[event] ?? 0) + 1, 500);
      await AsyncStorage.setItem(PENDING, JSON.stringify(c));
    } catch { /* counting must never cause a crash */ }
  })();
}

async function todaysToken(): Promise<string> {
  const day = utcDay();
  try {
    const raw = await AsyncStorage.getItem(TOKEN);
    if (raw) { const t = JSON.parse(raw) as { day: string; token: string }; if (t.day === day && t.token) return t.token; }
  } catch { /* make a new one */ }
  let token = '';
  while (token.length < 24) token += Math.random().toString(36).slice(2);
  token = token.slice(0, 24);
  try { await AsyncStorage.setItem(TOKEN, JSON.stringify({ day, token })); } catch { /* ignore */ }
  return token;
}

/** Send the totals. Safe to call often: it sends at most every ten minutes unless `force`. */
export async function flushUsage(force = false): Promise<void> {
  if (flushing || (!force && Date.now() - lastFlush < MIN_GAP_MS)) return;
  flushing = true;
  try {
    if (!(await crashReportingOn())) {
      counts = {};
      await AsyncStorage.multiRemove([PENDING, TOKEN]);
      return;
    }
    lastFlush = Date.now();
    const sent = { ...(await load()) };
    const { error } = await supabase.rpc('report_usage', {
      p_token: await todaysToken(),
      p_version: Constants.expoConfig?.version ?? '',
      p_counts: sent,
    });
    if (error) return;   // keep the counts, try again next time
    // Subtract what was sent (new events may have been counted while the request was out).
    const now = await load();
    for (const k of Object.keys(sent) as UsageEvent[]) {
      const left = (now[k] ?? 0) - (sent[k] ?? 0);
      if (left > 0) now[k] = left; else delete now[k];
    }
    await AsyncStorage.setItem(PENDING, JSON.stringify(now));
  } catch { /* try again next time */ } finally {
    flushing = false;
  }
}
