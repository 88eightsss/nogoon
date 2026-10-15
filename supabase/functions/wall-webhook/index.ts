// ─── wall-webhook ───────────────────────────────────────────────────────────────
//
// Stripe → this function. Marks a paid Wall listing as ready for review; frees the tiles when a
// checkout expires. Deploy WITHOUT JWT checking (Stripe cannot send one; the signature is the gate):
//   supabase functions deploy wall-webhook --no-verify-jwt
// Stripe dashboard → Developers → Webhooks → add endpoint
//   https://<project-ref>.supabase.co/functions/v1/wall-webhook
//   events: checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.expired
// Then set the secret: STRIPE_WEBHOOK_SECRET (whsec_...).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const enc = new TextEncoder();

async function validSignature(raw: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]));
  const t = parts.t;
  const sigs = header.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  if (!t || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${raw}`)));
  const hex = Array.from(mac).map((b) => b.toString(16).padStart(2, '0')).join('');
  return sigs.some((s) => s.length === hex.length && s.split('').reduce((acc, ch, i) => acc | (ch.charCodeAt(0) ^ hex.charCodeAt(i)), 0) === 0);
}

serve(async (req) => {
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const sig = req.headers.get('stripe-signature');
  if (!secret || !sig) return new Response('Not configured', { status: 400 });

  const raw = await req.text();
  if (!(await validSignature(raw, sig, secret))) return new Response('Bad signature', { status: 400 });

  const event = JSON.parse(raw);
  const obj = event.data?.object ?? {};
  const listingId: string | undefined = obj.metadata?.listing_id;
  if (!listingId) return new Response('ok');

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  if ((event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') && obj.payment_status === 'paid') {
    await db.from('wall_listings')
      .update({ status: 'pending_review', paid_at: new Date().toISOString() })
      .eq('id', listingId).eq('status', 'pending_payment');
  } else if (event.type === 'checkout.session.expired') {
    await db.from('wall_listings').update({ status: 'cancelled' }).eq('id', listingId).eq('status', 'pending_payment');
  }
  return new Response('ok');
});
