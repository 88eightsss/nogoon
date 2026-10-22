// ─── Anonymous crash reports ─────────────────────────────────────────────────
//
// When the app hits an unexpected JavaScript error, send a short report to our own backend (report-crash)
// so a tester's crash reaches us without them copying logs. It carries the app version, the phone model,
// the error text and the screen; never an account, name, email or device identifier. People can turn it
// off in Setup & fixes. The report is written to the phone first and sent on the next launch if the app
// died before it could be sent.

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

const FLAG = 'nogoon_crash_reports';          // 'off' when the person turned it off
const PENDING = 'nogoon_pending_crash';
let sentThisLaunch = 0;

export async function crashReportingOn(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(FLAG)) !== 'off'; } catch { return true; }
}
export async function setCrashReportingOn(on: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(FLAG, on ? 'on' : 'off');
    if (!on) await AsyncStorage.removeItem(PENDING);
  } catch { /* ignore */ }
}

type Report = { kind: 'js' | 'boundary'; message: string; stack: string; screen: string };

async function send(r: Report): Promise<boolean> {
  const model = (Platform.constants as { Model?: string } | undefined)?.Model ?? '';
  const { error } = await supabase.functions.invoke('report-crash', {
    body: {
      ...r,
      app_version: Constants.expoConfig?.version ?? '',
      build: String(Constants.expoConfig?.android?.versionCode ?? ''),
      platform: Platform.OS,
      os_version: String(Platform.Version),
      device: model,
    },
  });
  return !error;
}

/** Fire and forget. Never throws, never reports more than 3 times per launch. */
export async function reportCrash(kind: Report['kind'], error: unknown, screen = ''): Promise<void> {
  try {
    if (sentThisLaunch >= 3 || !(await crashReportingOn())) return;
    sentThisLaunch += 1;
    const e = error instanceof Error ? error : new Error(String(error));
    const r: Report = { kind, message: e.message ?? '', stack: e.stack ?? '', screen };
    await AsyncStorage.setItem(PENDING, JSON.stringify(r));     // in case the app dies before the send finishes
    if (await send(r)) await AsyncStorage.removeItem(PENDING);
  } catch { /* reporting must never cause a crash */ }
}

/** Call once at launch: sends a report the app did not manage to send before it closed. */
export async function flushPendingCrash(): Promise<void> {
  try {
    if (!(await crashReportingOn())) { await AsyncStorage.removeItem(PENDING); return; }
    const raw = await AsyncStorage.getItem(PENDING);
    if (!raw) return;
    if (await send(JSON.parse(raw) as Report)) await AsyncStorage.removeItem(PENDING);
  } catch { /* try again next launch */ }
}
