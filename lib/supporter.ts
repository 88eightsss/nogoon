// ─── Supporter tiles (client) ─────────────────────────────────────────────────
// Talks to the `supporter` edge function (supabase/functions/supporter). Payment is Google Play Billing
// through lib/purchases.ts; the server moves a paid tile on to review when RevenueCat calls its webhook.

import { supabase } from '@/lib/supabase';

export type MyTile = {
  id: string; board?: string; x: number; y: number;
  status: 'reserved' | 'ready' | 'pending_review' | 'live';
  image_url: string | null; reserved_until: string | null; ends_at: string | null;
};

type Result<T> = ({ ok: true } & T) | { ok: false; message: string };

async function call<T>(body: Record<string, unknown>): Promise<Result<T>> {
  try {
    const { data, error } = await supabase.functions.invoke('supporter', { body });
    if (error) {
      // The function answers errors with a JSON { error } body; show its words when they come through.
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') {
        const j = await ctx.json().catch(() => null);
        if (j?.error) return { ok: false, message: String(j.error) };
      }
      return { ok: false, message: 'Something went wrong. Check your connection and try again.' };
    }
    if (data?.error) return { ok: false, message: String(data.error) };
    return { ok: true, ...(data as T) };
  } catch {
    return { ok: false, message: 'Something went wrong. Check your connection and try again.' };
  }
}

export const myTiles = () => call<{ tiles: MyTile[] }>({ action: 'mine' });
export const reserveTile = (board: string, x: number, y: number) => call<{ id: string; board?: string; reserved_until: string }>({ action: 'reserve', board, x, y });
export const cancelTile = (id: string) => call<Record<string, never>>({ action: 'cancel', id });
export const reportSupporterTile = async (id: string, reason: string) => (await call<Record<string, never>>({ action: 'report', id, reason })).ok;

/** Sends the picture. `ok: true` means it passed the automatic check and the tile can be paid for. */
export async function uploadTileImage(id: string, base64: string): Promise<Result<{ image_url: string; hold_until: string }>> {
  const r = await call<{ ok?: boolean; message?: string; image_url?: string; hold_until?: string }>({ action: 'upload', id, image: base64, type: 'image/jpeg' });
  if (!r.ok) return r;
  if (r.message || !r.image_url) return { ok: false, message: r.message ?? 'That image could not be used.' };
  return { ok: true, image_url: r.image_url, hold_until: r.hold_until ?? '' };
}

// ── Choosing and shrinking a picture ─────────────────────────────────────────────
// expo-image-picker and expo-image-manipulator are native modules; they are loaded lazily so the rest of the
// app still runs in a build that lacks them.
type Picker = {
  launchImageLibraryAsync: (o: Record<string, unknown>) => Promise<{ canceled: boolean; assets?: { uri: string }[] }>;
};
type Manip = {
  manipulateAsync: (uri: string, actions: unknown[], o: Record<string, unknown>) => Promise<{ uri: string; base64?: string }>;
  SaveFormat: { JPEG: string };
};

/** Lets the person pick a picture, crops it square, shrinks it to 256 x 256 and returns a JPEG (preview uri + base64). */
export async function pickTileImage(): Promise<{ uri: string; base64: string } | null> {
  let picker: Picker, manip: Manip;
  try {
    picker = require('expo-image-picker');
    manip = require('expo-image-manipulator');
  } catch {
    throw new Error('Picking pictures is not available in this build.');
  }
  const res = await picker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
  if (res.canceled || !res.assets?.[0]) return null;
  const out = await manip.manipulateAsync(res.assets[0].uri, [{ resize: { width: 256, height: 256 } }], {
    compress: 0.7, format: manip.SaveFormat.JPEG, base64: true,
  });
  if (!out.base64) return null;
  return { uri: out.uri, base64: out.base64 };
}
