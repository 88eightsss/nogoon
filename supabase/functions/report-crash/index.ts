// ─── report-crash ────────────────────────────────────────────────────────────
//
// Receives a short, anonymous crash report from the app (only if the person left "Send anonymous crash
// reports" on in Setup & fixes). Stores app version, phone model, the error text and the screen; never an
// account, name, email or device identifier. Anything that looks like an email address is removed and
// URLs lose their query strings. A daily cap stops anyone from filling the table.
//
// Deploy WITH JWT checking (the app sends its public anon key):  supabase functions deploy report-crash

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const DAILY_CAP = 400;
const MAX_BODY = 12000;

const cut = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');
const scrub = (s: string) =>
  s.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
   .replace(/https?:\/\/[^\s)'"]+/g, (u) => u.split('?')[0]);

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY) return new Response('Too large', { status: 413, headers: cors });
    const b = JSON.parse(raw);
    const kind = b?.kind === 'boundary' ? 'boundary' : b?.kind === 'js' ? 'js' : null;
    if (!kind) return new Response('Bad request', { status: 400, headers: cors });

    const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const since = new Date(Date.now() - 86400000).toISOString();
    const { count } = await db.from('crash_reports').select('id', { count: 'exact', head: true }).gte('at', since);
    if ((count ?? 0) >= DAILY_CAP) return new Response(JSON.stringify({ stored: false }), { status: 202, headers: cors });

    const { error } = await db.from('crash_reports').insert({
      kind,
      app_version: cut(b.app_version, 20), build: cut(b.build, 12), platform: cut(b.platform, 12),
      os_version: cut(b.os_version, 20), device: cut(b.device, 60), screen: cut(b.screen, 80),
      message: scrub(cut(b.message, 500)), stack: scrub(cut(b.stack, 3000)),
    });
    if (error) throw error;

    // Housekeeping: keep 90 days.
    if (Math.random() < 0.05) await db.from('crash_reports').delete().lt('at', new Date(Date.now() - 90 * 86400000).toISOString());
    return new Response(JSON.stringify({ stored: true }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[report-crash]', e);
    return new Response('Error', { status: 500, headers: cors });
  }
});
