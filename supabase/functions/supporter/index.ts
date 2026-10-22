// ─── supporter ───────────────────────────────────────────────────────────────
//
// Supporter tiles on the Wall (see supabase/migrations/20261025_wall_supporters.sql).
// The app sends { action, ... } with the signed-in person's session token as the Bearer token.
//   mine     — my tiles
//   reserve  — hold one free tile for 20 minutes: { x, y }
//   upload   — send the image for that tile: { id, image (base64), type }. It is scanned first; only an image
//              that passes is stored, and only then can the tile be paid for.
//   cancel   — let go of a tile I have not paid for: { id }
//   report   — report a supporter tile (no sign-in needed): { id, reason }. Two open reports hide it until reviewed.
// Payment is NOT handled here. Google Play Billing (through RevenueCat) takes the $2.50 and
// supporter-webhook moves the tile on to review.
//
// Secrets: ANTHROPIC_API_KEY (the same one feed-daily uses). SUPABASE_* are provided automatically.
// Deploy WITH JWT checking:  supabase functions deploy supporter

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const int = (v: unknown) => (Number.isInteger(v) ? (v as number) : NaN);

const BUCKET = 'wall-supporters';
const HOLD_RESERVE_MIN = 20;
const HOLD_PAY_MIN = 30;
const MAX_IMAGE_BYTES = 300 * 1024;
const MAX_OPEN = 5;          // tiles a person can have in progress or waiting for review at once
const MAX_REJECTS_PER_DAY = 5;

function decode(b64: string): Uint8Array | null {
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch { return null; }
}
const isJpeg = (b: Uint8Array) => b.length > 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
const isPng = (b: Uint8Array) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;

type Scan = { allowed: boolean; reasons: string[]; checked: boolean };

// Asks Claude whether the picture is fine for a small tile on an all-ages app. Fails CLOSED: anything
// unclear, any error, any unparsable answer means the image is not accepted.
async function scanImage(b64: string, mediaType: string): Promise<Scan> {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) return { allowed: false, reasons: ['scanner_unavailable'], checked: false };
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system:
          'You are a content-safety checker for small square pictures that people put on a public board inside a wellbeing app used by all ages. ' +
          'Reply with JSON only: {"allowed": true|false, "reasons": [short codes]}. ' +
          'Set allowed to false if the picture contains or suggests ANY of: nudity or sexual content or a sexually suggestive pose ("sexual"); ' +
          'any sexual or suggestive depiction of a child, or a child in a state of undress ("minor"); graphic violence, gore or self-harm ("violence"); ' +
          'hate symbols or harassment ("hate"); drugs, weapons or gambling promotion ("illegal"); readable web addresses, phone numbers, email addresses, QR codes or advertising text ("contact"); ' +
          'a screenshot of private messages or personal documents ("private"). Also false if you cannot tell what it is. When unsure, set allowed to false. ' +
          'Ordinary art, pets, nature, food, logos, memes without the above, selfies of clothed people and plain graphics are allowed.',
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
            { type: 'text', text: 'Check this picture. JSON only.' },
          ],
        }],
      }),
    });
    if (!res.ok) return { allowed: false, reasons: [`scanner_http_${res.status}`], checked: false };
    const data = await res.json();
    const text: string = (data?.content ?? []).map((c: { text?: string }) => c.text ?? '').join('');
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return { allowed: false, reasons: ['unparsable'], checked: true };
    const j = JSON.parse(m[0]);
    const reasons = Array.isArray(j.reasons) ? j.reasons.slice(0, 6).map((r: unknown) => String(r).slice(0, 24)) : [];
    return { allowed: j.allowed === true, reasons, checked: true };
  } catch {
    return { allowed: false, reasons: ['scanner_error'], checked: false };
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'Bad JSON' }, 400); }

  const url = Deno.env.get('SUPABASE_URL')!;
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: ud } = token ? await db.auth.getUser(token) : { data: { user: null } };
  const user = ud?.user ?? null;
  const action = body.action;

  // Reports are allowed without signing in.
  if (action === 'report') {
    const id = str(body.id, 60), reason = str(body.reason, 300);
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Bad tile' }, 400);
    const { error } = await db.from('wall_reports').insert({ supporter_id: id, reason });
    if (error) return json({ error: 'Could not send the report.' }, 500);
    const { count } = await db.from('wall_reports').select('id', { count: 'exact', head: true }).eq('supporter_id', id).eq('handled', false);
    if ((count ?? 0) >= 2) {
      await db.from('wall_supporters').update({ status: 'removed', review_note: 'Hidden automatically after reports' }).eq('id', id).eq('status', 'live');
    }
    return json({ ok: true });
  }

  if (!user) return json({ error: 'Sign in to become a supporter.' }, 401);
  const uid = user.id;

  switch (action) {
    case 'mine': {
      const { data } = await db.from('wall_supporters')
        .select('id,x,y,status,image_url,reserved_until,ends_at,created_at')
        .eq('user_id', uid).in('status', ['reserved', 'ready', 'pending_review', 'live']).order('created_at', { ascending: false }).limit(50);
      return json({ tiles: data ?? [] });
    }

    case 'reserve': {
      const x = int(body.x), y = int(body.y);
      if (Number.isNaN(x) || Number.isNaN(y) || x < 0 || y < 0) return json({ error: 'Pick a tile first.' }, 400);
      // Let go of any unpaid hold of mine, so one person cannot sit on many tiles.
      await db.from('wall_supporters').update({ status: 'cancelled' }).eq('user_id', uid).in('status', ['reserved', 'ready']);
      const { count } = await db.from('wall_supporters').select('id', { count: 'exact', head: true })
        .eq('user_id', uid).in('status', ['pending_review', 'live']);
      if ((count ?? 0) >= MAX_OPEN * 4) return json({ error: 'That is plenty of tiles for now. Thank you!' }, 429);
      const until = new Date(Date.now() + HOLD_RESERVE_MIN * 60000).toISOString();
      const { data, error } = await db.from('wall_supporters').insert({ user_id: uid, x, y, status: 'reserved', reserved_until: until }).select('id,reserved_until').single();
      if (error) {
        const taken = /taken|outside/i.test(error.message);
        return json({ error: taken ? 'Someone just took that tile. Pick another.' : 'Could not hold that tile. Try again.' }, taken ? 409 : 500);
      }
      return json({ id: data.id, reserved_until: data.reserved_until });
    }

    case 'upload': {
      const id = str(body.id, 60);
      const type = body.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const b64 = typeof body.image === 'string' ? body.image : '';
      if (!/^[0-9a-f-]{36}$/i.test(id) || !b64 || b64.length > MAX_IMAGE_BYTES * 1.4) return json({ error: 'That image is too big. Pick a smaller one.' }, 400);

      const { data: row } = await db.from('wall_supporters').select('id,status,reserved_until').eq('id', id).eq('user_id', uid).maybeSingle();
      if (!row || !['reserved', 'ready'].includes(row.status)) return json({ error: 'Pick your tile again.' }, 409);
      if (new Date(row.reserved_until).getTime() < Date.now()) return json({ error: 'Your hold on that tile ran out. Pick it again.' }, 409);

      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { count: rejected } = await db.from('wall_supporters').select('id', { count: 'exact', head: true })
        .eq('user_id', uid).eq('status', 'rejected').gte('created_at', since);
      if ((rejected ?? 0) >= MAX_REJECTS_PER_DAY) return json({ error: 'Too many images today. Try again tomorrow.' }, 429);

      const bytes = decode(b64);
      if (!bytes || bytes.length > MAX_IMAGE_BYTES || !(type === 'image/png' ? isPng(bytes) : isJpeg(bytes))) {
        return json({ error: 'That does not look like a normal photo. Pick another.' }, 400);
      }

      const scan = await scanImage(b64, type);
      if (!scan.allowed) {
        const scannerDown = !scan.checked;
        if (!scannerDown) await db.from('wall_supporters').update({ status: 'rejected', scan, review_note: 'Automatic scan' }).eq('id', id);
        return json({
          ok: false,
          message: scannerDown
            ? 'We could not check images right now. Please try again in a bit. You have not been charged.'
            : 'That image cannot go on the Wall. Please choose a different one (no people in revealing clothes, violence, web addresses or text you would not want everyone to read). You have not been charged.',
        });
      }

      const path = `${id}-${crypto.randomUUID().slice(0, 8)}.${type === 'image/png' ? 'png' : 'jpg'}`;
      const up = await db.storage.from(BUCKET).upload(path, bytes, { contentType: type, upsert: false });
      if (up.error) return json({ error: 'Could not save the image. Try again.' }, 500);
      const imageUrl = `${url}/storage/v1/object/public/${BUCKET}/${path}`;
      const hold = new Date(Date.now() + HOLD_PAY_MIN * 60000).toISOString();
      const { error } = await db.from('wall_supporters').update({
        status: 'ready', image_path: path, image_url: imageUrl, scan, reserved_until: hold,
      }).eq('id', id).eq('user_id', uid);
      if (error) { await db.storage.from(BUCKET).remove([path]); return json({ error: 'Could not hold that tile. Pick it again.' }, 409); }
      return json({ ok: true, id, image_url: imageUrl, hold_until: hold });
    }

    case 'cancel': {
      const id = str(body.id, 60);
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Bad tile' }, 400);
      const { data } = await db.from('wall_supporters').update({ status: 'cancelled' })
        .eq('id', id).eq('user_id', uid).in('status', ['reserved', 'ready']).select('image_path').maybeSingle();
      if (data?.image_path) await db.storage.from(BUCKET).remove([data.image_path]);
      return json({ ok: true });
    }

    default:
      return json({ error: 'Unknown action' }, 400);
  }
});
