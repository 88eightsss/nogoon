// ─── place-search ────────────────────────────────────────────────────────────
//
// Turns what someone types in Local ("Lahai…") into a short list of real places, so the phone never
// talks to a third party directly and no one's IP address goes to the geocoder. Only the typed text is
// forwarded, with no account or device information. Nothing is stored.
//
// Provider: Open-Meteo geocoding (GeoNames data). Its free host is for NON-COMMERCIAL use. Before NoGoon
// earns money (Pro, the Wall) either set OPEN_METEO_KEY (their paid plan, switches to the customer host)
// or swap `search()` for another provider. Nothing else in the app needs to change.
//
// Deploy WITH JWT checking (the app sends its public anon key):  supabase functions deploy place-search

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const cut = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');

async function search(q: string) {
  const key = Deno.env.get('OPEN_METEO_KEY');
  const host = key ? 'https://customer-geocoding-api.open-meteo.com' : 'https://geocoding-api.open-meteo.com';
  const url = `${host}/v1/search?name=${encodeURIComponent(q)}&count=8&language=en&format=json${key ? `&apikey=${encodeURIComponent(key)}` : ''}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`geocoder ${res.status}`);
  const data = await res.json();
  const list = Array.isArray(data?.results) ? data.results : [];
  return list.slice(0, 8).map((r: Record<string, unknown>) => ({
    id: String(r.id ?? ''),
    name: cut(r.name, 60),
    admin1: cut(r.admin1, 60),
    country: cut(r.country, 60),
    country_code: cut(r.country_code, 2).toUpperCase(),
  })).filter((r: { name: string }) => r.name);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });
  try {
    const raw = await req.text();
    if (raw.length > 500) return json({ error: 'Too long' }, 413);
    const q = cut(JSON.parse(raw)?.q, 60).trim();
    if (q.length < 2) return json({ results: [] });
    return json({ results: await search(q) });
  } catch (e) {
    console.error('[place-search]', e);
    return json({ results: [], error: 'unavailable' }, 502);
  }
});
