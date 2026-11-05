// ─── Post once: the AI step (client side) ──────────────────────────────────────────────────────────
//
// Calls the `post-once-write` edge function. No key is in the app. The function only answers signed-in,
// verified hosts. Everything it returns is checked AGAIN here before it is shown: the host's locked facts
// (title, when, area, cost, link) must appear word for word, and X must fit. A draft that fails is dropped
// and the plain version stays. The AI never changes a fact and never posts anything.

import { supabase } from '@/lib/supabase';
import { lockedFactsPresent, xLength, X_LIMIT, type PostOnceEvent } from '@/lib/postOnce';

export type Tone = 'warm' | 'plain' | 'short';
export const TONE_LABEL: Record<Tone, string> = { warm: 'Warm', plain: 'Plain', short: 'Short' };
export type Channel = 'facebook' | 'instagram' | 'x' | 'neighbors' | 'bulletin';
export type Drafts = Partial<Record<Channel, string>>;

export type AiResult<T> = ({ ok: true } & T) | { ok: false; message: string; code?: string };

async function call(body: Record<string, unknown>): Promise<{ ok: true; data: any } | { ok: false; message: string; code?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('post-once-write', { body });
    if (error) {
      // A non-2xx reply carries our own message in the response body; read it when it is there.
      let message = 'The AI helper could not be reached. Your plain version still works.';
      let code: string | undefined;
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') {
        try { const j = await ctx.json(); if (j?.error) message = String(j.error); if (j?.code) code = String(j.code); } catch { /* keep default */ }
      }
      return { ok: false, message, code };
    }
    if (!data || data.error) return { ok: false, message: String(data?.error ?? 'No answer came back.'), code: data?.code };
    return { ok: true, data };
  } catch {
    return { ok: false, message: 'The AI helper could not be reached. Your plain version still works.' };
  }
}

function eventBody(e: PostOnceEvent) {
  return {
    title: e.title, host: e.host, kind: e.kind, mode: e.mode, when: e.when, weekday: e.weekday, time: e.time,
    area: e.area, cost: e.cost, ask: e.ask, smallest: e.smallest, details: e.details, link: e.link,
  };
}

/** Ask for new words in a tone. Only drafts that keep every locked fact (and fit X) are returned. */
export async function writeWithAI(e: PostOnceEvent, tone: Tone): Promise<AiResult<{ drafts: Drafts; rejected: Channel[] }>> {
  const r = await call({ action: 'write', tone, event: eventBody(e) });
  if (!r.ok) return r;
  const raw = (r.data.drafts ?? {}) as Record<string, unknown>;
  const drafts: Drafts = {};
  const rejected: Channel[] = [];
  for (const ch of ['facebook', 'instagram', 'x', 'neighbors', 'bulletin'] as Channel[]) {
    const t = typeof raw[ch] === 'string' ? (raw[ch] as string).trim() : '';
    if (!t) { rejected.push(ch); continue; }
    if (!lockedFactsPresent(e, t).ok) { rejected.push(ch); continue; }
    if (ch === 'x' && xLength(t) > X_LIMIT) { rejected.push(ch); continue; }
    drafts[ch] = t;
  }
  if (Object.keys(drafts).length === 0) return { ok: false, message: 'The AI draft changed one of your facts, so it was thrown away. Your plain version is still here.' };
  return { ok: true, drafts, rejected };
}

export type ReadFields = {
  title: string; host: string; when: string; area: string; cost: string; ask: string; smallest: string; details: string; link: string;
  kind: 'hand' | 'happening'; guessed: string[];
};

/** Pick a flyer photo from the library (no camera, no extra permissions) and shrink it. Null if cancelled. */
export async function pickFlyerPhoto(): Promise<{ base64: string; mediaType: string } | null> {
  type Picker = { launchImageLibraryAsync: (o: Record<string, unknown>) => Promise<{ canceled: boolean; assets?: { uri: string; base64?: string | null; mimeType?: string }[] }> };
  let picker: Picker;
  try { picker = require('expo-image-picker'); } catch { throw new Error('Picking a photo is not available in this build.'); }
  const res = await picker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.5, base64: true });
  if (res.canceled || !res.assets?.[0]?.base64) return null;
  const a = res.assets[0];
  const mt = a.mimeType === 'image/png' || a.mimeType === 'image/webp' ? a.mimeType : 'image/jpeg';
  return { base64: a.base64 as string, mediaType: mt };
}

/** Read the fields a flyer photo shows. Nothing is saved; the host reviews every field before using it. */
export async function readFlyer(photo: { base64: string; mediaType: string }): Promise<AiResult<{ fields: ReadFields }>> {
  if (photo.base64.length > 2_000_000) return { ok: false, message: 'That photo is too large. Try a smaller one.' };
  const r = await call({ action: 'read', image_base64: photo.base64, media_type: photo.mediaType });
  if (!r.ok) return r;
  const f = r.data.fields as ReadFields | undefined;
  if (!f) return { ok: false, message: 'Could not read that flyer. Try a clearer photo, or type it in.' };
  return { ok: true, fields: f };
}
