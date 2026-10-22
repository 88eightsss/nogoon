// ─── wall ─────────────────────────────────────────────────────────────────────
//
// Public API for The Wall (see supabase/migrations/20261016_ad_wall.sql).
// POST JSON { action, ... } with the project's anon key as the Bearer token:
//   checkout  — reserve tiles + create a Stripe Checkout session; returns { url }
//   inquiry   — "invoice me" request from the advertise page
//   report    — report a listing from the app
// Quotes and the live board are read straight from the database (wall_quote, wall_stats, wall_public).
//
// Secrets (Supabase → Edge Functions → Secrets):
//   STRIPE_SECRET_KEY   — sk_live_... (or sk_test_... while testing)
//   WALL_WEB_URL        — where the advertise page is hosted, e.g. https://nogoon.example/advertise
//   (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically)
// Deploy: supabase functions deploy wall

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const CATEGORIES = ['food_drink', 'local_business', 'health_wellness', 'books_media', 'education', 'tech_tools', 'art_craft', 'services', 'nonprofit', 'other'];
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const int = (v: unknown) => (Number.isInteger(v) ? (v as number) : NaN);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'Bad JSON' }, 400); }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Honeypot: real people leave this empty.
  if (str(body.website, 50)) return json({ ok: true });

  switch (body.action) {
    case 'inquiry': {
      const company = str(body.company, 80), email = str(body.email, 120), message = str(body.message, 1000);
      if (company.length < 2 || !/^[^@ ]+@[^@ ]+\.[^@ ]+$/.test(email)) return json({ error: 'Add a company name and a valid email.' }, 400);
      // Keep the inbox usable: a handful of inquiries per email per day.
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { count: recent } = await db.from('wall_inquiries').select('id', { count: 'exact', head: true }).eq('email', email).gte('created_at', since);
      if ((recent ?? 0) >= 5) return json({ error: 'We already have your inquiries. We will reply by email.' }, 429);
      const { error } = await db.from('wall_inquiries').insert({ company, email, message });
      if (error) return json({ error: 'Could not save that. Try again.' }, 500);
      return json({ ok: true });
    }

    case 'report': {
      const id = str(body.listing_id, 60), reason = str(body.reason, 300);
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Bad listing' }, 400);
      const { error } = await db.from('wall_reports').insert({ listing_id: id, reason });
      if (error) return json({ error: 'Could not send the report.' }, 500);
      return json({ ok: true });
    }

    case 'checkout': {
      const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
      const webUrl = Deno.env.get('WALL_WEB_URL');
      if (!stripeKey || !webUrl) return json({ error: 'Card payments are not switched on yet. Use "Send an inquiry" and we will invoice you.' }, 503);

      const x = int(body.x), y = int(body.y), w = int(body.w), h = int(body.h), months = int(body.months);
      const company = str(body.company, 40), headline = str(body.headline, 60);
      const url = str(body.url, 300), imageUrl = str(body.image_url, 300);
      const region = str(body.region, 40);
      const perk = str(body.perk, 80);
      const color = str(body.color, 7), category = str(body.category, 40), email = str(body.email, 120);

      if ([x, y, w, h, months].some(Number.isNaN)) return json({ error: 'Pick your tiles first.' }, 400);
      if (company.length < 2) return json({ error: 'Add your company name (2 to 40 characters).' }, 400);
      if (!/^https:\/\/[^ ]+$/.test(url)) return json({ error: 'Your link must start with https://' }, 400);
      if (imageUrl && !/^https:\/\/[^ ]+$/.test(imageUrl)) return json({ error: 'The image link must start with https://' }, 400);
      if (!/^#[0-9A-Fa-f]{6}$/.test(color)) return json({ error: 'Pick a tile colour.' }, 400);
      if (region && region.length < 2) return json({ error: 'Where are you? Use at least two letters, or leave it blank.' }, 400);
      if (perk && perk.length < 4) return json({ error: 'Describe the perk in at least a few words, or leave it blank.' }, 400);
      if (perk && /https?:\/\/|www\.|@/i.test(perk)) return json({ error: 'Keep web addresses and emails out of the perk text.' }, 400);
      if (!CATEGORIES.includes(category)) return json({ error: 'Pick a category from the list.' }, 400);
      if (!/^[^@ ]+@[^@ ]+\.[^@ ]+$/.test(email)) return json({ error: 'Add a valid email for your receipt.' }, 400);
      if (body.agree !== true) return json({ error: 'Please confirm your ad follows the rules.' }, 400);

      // At most two unpaid reservations per email, so tiles cannot be hoarded.
      const { count } = await db.from('wall_listings').select('id', { count: 'exact', head: true })
        .eq('contact_email', email).eq('status', 'pending_payment');
      if ((count ?? 0) >= 2) return json({ error: 'You have unpaid reservations. Finish those first, or wait an hour.' }, 429);

      // Price is always computed here, never taken from the browser.
      const { data: quote, error: qErr } = await db.rpc('wall_quote', { p_x: x, p_y: y, p_w: w, p_h: h, p_months: months });
      if (qErr || !quote) return json({ error: 'Could not price those tiles.' }, 400);
      if (!quote.free) return json({ error: 'Some of those tiles are taken or outside the wall. Pick again.' }, 409);
      const total = quote.total_cents as number;
      if (total < 50) return json({ error: 'Order is below the minimum.' }, 400);

      const { data: row, error: insErr } = await db.from('wall_listings').insert({
        x, y, w, h, company, headline: headline || null, url, image_url: imageUrl || null, region: region || null, perk: perk || null, color, category,
        contact_email: email, months, price_cents: total,
      }).select('id').single();
      if (insErr || !row) {
        if (insErr?.code === '23P01') return json({ error: 'Someone just took some of those tiles. Pick again.' }, 409);
        return json({ error: 'Could not reserve those tiles.' }, 500);
      }

      const form = new URLSearchParams({
        mode: 'payment',
        'line_items[0][quantity]': '1',
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][unit_amount]': String(total),
        'line_items[0][price_data][product_data][name]': `NoGoon Wall: ${w * h} tile${w * h === 1 ? '' : 's'} for ${months} month${months === 1 ? '' : 's'}`,
        'line_items[0][price_data][product_data][description]': `${company}. Reviewed before going live; refunded in full if it is not approved.`,
        success_url: `${webUrl}?paid=1`,
        cancel_url: `${webUrl}?cancelled=1`,
        customer_email: email,
        client_reference_id: row.id,
        'metadata[listing_id]': row.id,
        expires_at: String(Math.floor(Date.now() / 1000) + 31 * 60),
      });
      const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form,
      });
      const session = await res.json();
      if (!res.ok || !session.url) {
        await db.from('wall_listings').update({ status: 'cancelled' }).eq('id', row.id);
        return json({ error: 'Could not start the payment. Try again.' }, 502);
      }
      await db.from('wall_listings').update({ stripe_session_id: session.id }).eq('id', row.id);
      return json({ url: session.url });
    }

    default:
      return json({ error: 'Unknown action' }, 400);
  }
});
