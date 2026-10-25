// ─── event-submit ────────────────────────────────────────────────────────────
//
// Receives an event from the public host page (web/host). Everything lands as 'pending' in
// public.event_submissions; nothing reaches the app until you approve it (see the migration header).
// Checks here are a first line; the database re-checks every rule (url_ok, lengths, enums).
//
// Anti-abuse: a hidden honeypot field, at most 5 submissions per day per network address (stored only as a
// salted hash), and strict length/format limits. No attendee data is collected: only the organiser's name,
// contact email and the event details.
//
// Deploy: supabase functions deploy event-submit --no-verify-jwt     Secret: none required (uses the service role).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const KINDS = ['market', 'volunteer', 'community', 'outdoors', 'class', 'music', 'other'];
const REGIONS = ['Maui', 'Oahu', 'Hawaii (statewide)'];
const DAILY_LIMIT = 5;
const clean = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');
const iso = (v: unknown) => { if (typeof v !== 'string' || !v) return null; const t = Date.parse(v); return Number.isNaN(t) ? null : new Date(t).toISOString(); };

// Same rule as public.url_ok() in the database (the database is the final judge).
function urlOk(u: string): boolean {
  if (u.length > 500 || !/^https:\/\//i.test(u)) return false;
  let h: string;
  try { const x = new URL(u); if (x.username || x.password) return false; h = x.hostname.toLowerCase(); } catch { return false; }
  if (/^[0-9.]+$/.test(h) || h.includes(':')) return false;
  return !/(^|\.)(bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|buff\.ly|rebrand\.ly|cutt\.ly|shorturl\.at|t\.ly|lnkd\.in)$/.test(h);
}

async function sha(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  try {
    const b = await req.json().catch(() => ({}));
    // Honeypot: a real person never fills the hidden field. Pretend success so bots learn nothing.
    if (clean(b.website, 50)) return json({ ok: true });

    const row = {
      org_name: clean(b.org_name, 80),
      contact_email: clean(b.contact_email, 120),
      title: clean(b.title, 120),
      summary: clean(b.summary, 300),
      kind: KINDS.includes(clean(b.kind, 20)) ? clean(b.kind, 20) : 'community',
      region: clean(b.region, 60),
      place_name: clean(b.place_name, 120),
      when_text: clean(b.when_text, 120),
      starts_at: iso(b.starts_at),
      ends_at: iso(b.ends_at),
      recurring: b.recurring === true,
      cost: clean(b.cost, 40),
      url: clean(b.url, 500),
      signup_url: clean(b.signup_url, 500) || null,
    };
    if (row.org_name.length < 2) return json({ error: 'Add the name of your group or business.' }, 400);
    if (!/^[^@ ]+@[^@ ]+\.[^@ ]+$/.test(row.contact_email)) return json({ error: 'Add a valid contact email. We only use it to reach you about this listing.' }, 400);
    if (row.title.length < 3) return json({ error: 'Give the event a title.' }, 400);
    if (!REGIONS.includes(row.region)) return json({ error: 'Pick Maui, Oahu or statewide.' }, 400);
    if (!row.when_text) return json({ error: 'Say when it happens, for example "Saturdays 7:30 to 11 am".' }, 400);
    if (!urlOk(row.url)) return json({ error: 'The page about the event must be a normal https:// link (no link shorteners).' }, 400);
    if (row.signup_url && !urlOk(row.signup_url)) return json({ error: 'The sign-up link must be a normal https:// link (no link shorteners).' }, 400);

    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const ip = (req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? 'unknown').split(',')[0].trim();
    const ip_hash = await sha(`${new Date().toISOString().slice(0, 10)}|${ip}|${Deno.env.get('CRON_SECRET') ?? 'salt'}`);
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await admin.from('event_submissions').select('id', { count: 'exact', head: true }).eq('ip_hash', ip_hash).gte('created_at', since);
    if ((count ?? 0) >= DAILY_LIMIT) return json({ error: 'That is the daily limit for one connection. Try again tomorrow.' }, 429);

    const { error } = await admin.from('event_submissions').insert({ ...row, ip_hash });
    if (error) { console.error('[event-submit]', error.message); return json({ error: 'We could not save that. Check the fields and try again.' }, 400); }
    return json({ ok: true });
  } catch (e) {
    console.error('[event-submit]', e);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
