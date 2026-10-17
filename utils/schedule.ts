// ─── Schedule helpers shared by the Modes screens ─────────────────────────────

import type { ModePreset, ModeSchedule } from '@/stores/useModesStore';

export const DAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** '17:05' -> '5:05 PM' */
export function format12(t: string): string {
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return t;
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function daysLabel(days: number[]): string {
  if (days.length === 0 || days.length === 7) return 'Every day';
  const has = (list: number[]) => list.length === days.length && list.every((d) => days.includes(d));
  if (has([1, 2, 3, 4, 5])) return 'Weekdays';
  if (has([0, 6])) return 'Weekends';
  return [...days].sort().map((d) => DAY_ABBR[d]).join(', ');
}

export function scheduleSummary(s: ModeSchedule): string {
  return `${daysLabel(s.days)} · ${format12(s.start)} – ${format12(s.end)}`;
}

function minutesOf(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function human(mins: number): string {
  if (mins < 1) return 'less than a minute';
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d >= 1) return `${d} day${d === 1 ? '' : 's'}${h ? ` ${h} h` : ''}`;
  if (h >= 1) return `${h} h${m ? ` ${m} min` : ''}`;
  return `${m} min`;
}

/** The next moment any enabled schedule starts or ends, as a sentence ("Work starts in 2 h 15 min"). */
export function nextChangeLine(modes: ModePreset[], now: Date = new Date()): string | null {
  let best: { at: number; text: (mins: number) => string } | null = null;
  const nowMs = now.getTime();
  for (const mode of modes) {
    const s = mode.schedule;
    if (!s?.enabled) continue;
    const st = minutesOf(s.start), en = minutesOf(s.end);
    if (st === en) continue;
    for (let add = -1; add <= 8; add++) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + add);
      if (s.days.length > 0 && !s.days.includes(day.getDay())) continue;
      const startAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(st / 60), st % 60).getTime();
      const endBase = en > st ? 0 : 1;   // overnight window ends the next day
      const endAt = new Date(day.getFullYear(), day.getMonth(), day.getDate() + endBase, Math.floor(en / 60), en % 60).getTime();
      if (startAt > nowMs && (!best || startAt < best.at)) best = { at: startAt, text: (m) => `${mode.name} starts in ${human(m)}` };
      if (startAt <= nowMs && endAt > nowMs && (!best || endAt < best.at)) best = { at: endAt, text: (m) => `${mode.name} ends in ${human(m)}` };
    }
  }
  if (!best) return null;
  return best.text(Math.round((best.at - nowMs) / 60000));
}
