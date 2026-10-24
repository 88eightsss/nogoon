// ─── supporter-webhook ───────────────────────────────────────────────────────
//
// RevenueCat calls this when someone buys the supporter tile in Google Play. It moves that person's paid-for
// tile from "ready" to "pending_review" (nothing shows until the owner approves it), and takes the tile down
// if the purchase is refunded.
//
// RevenueCat > Project settings > Integrations > Webhooks:
//   URL: https://<project-ref>.supabase.co/functions/v1/supporter-webhook
//   Authorization header value: the same text as the secret REVENUECAT_WEBHOOK_SECRET
// Secrets: REVENUECAT_WEBHOOK_SECRET.   Deploy WITHOUT JWT checking:  supabase functions deploy supporter-webhook --no-verify-jwt
//
// A payment that cannot be matched to a tile (for example the hold ran out and someone else took the tile)
// is recorded in supporter_purchases with a note, so it can be refunded in the Play Console:
//   select * from supporter_purchases where matched is null and not refunded;

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// One Play product per price: global tiles ($2.50) and local tiles ($5.00). wall_config says which board uses which.
const PRODUCT_IDS = ['nogoon_wall_tile', 'nogoon_wall_tile_local'];
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });

function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET') ?? '';
  const given = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!secret || !same(given, secret)) return json({ error: 'No' }, 401);

  let ev: Record<string, unknown>;
  try { ev = ((await req.json()) as { event?: Record<string, unknown> }).event ?? {}; } catch { return json({ error: 'Bad JSON' }, 400); }

  const type = String(ev.type ?? '');
  const product = String(ev.product_id ?? '');
  const txn = String(ev.transaction_id ?? ev.original_transaction_id ?? '');
  const uid = String(ev.app_user_id ?? '');
  if (!PRODUCT_IDS.includes(product) || !txn) return json({ ok: true, ignored: true });   // other products are not ours

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });

  // A refund / cancellation: take the tile down and remember it.
  if (type === 'CANCELLATION' || type === 'REFUND') {
    await db.from('wall_supporters').update({ status: 'removed', review_note: 'Purchase refunded' }).eq('txn_id', txn);
    await db.from('supporter_purchases').update({ refunded: true }).eq('txn_id', txn);
    return json({ ok: true });
  }
  if (type !== 'NON_RENEWING_PURCHASE' && type !== 'INITIAL_PURCHASE') return json({ ok: true, ignored: true });

  const isUuid = /^[0-9a-f-]{36}$/i.test(uid);
  const { error: dup } = await db.from('supporter_purchases').insert({ txn_id: txn, user_id: isUuid ? uid : null, product });
  if (dup) return json({ ok: true, duplicate: true });          // already handled (RevenueCat retries)

  if (!isUuid) {
    await db.from('supporter_purchases').update({ note: 'No account on this purchase. Refund it.' }).eq('txn_id', txn);
    return json({ ok: true });
  }

  const { data: row } = await db.from('wall_supporters').select('id,board').eq('user_id', uid).eq('status', 'ready')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!row) {
    await db.from('supporter_purchases').update({ note: 'Paid, but no tile was ready. Refund it.' }).eq('txn_id', txn);
    return json({ ok: true });
  }

  // The tile's board decides which price (product) is right. Paying the wrong one is refunded by hand.
  const { data: cfg } = await db.from('wall_config').select('supporter_product').eq('board', row.board).maybeSingle();
  if (cfg && cfg.supporter_product !== product) {
    await db.from('supporter_purchases').update({ note: `Paid for ${product} but the tile is on the ${row.board} board (needs ${cfg.supporter_product}). Refund it.` }).eq('txn_id', txn);
    return json({ ok: true });
  }

  const { error } = await db.from('wall_supporters').update({ status: 'pending_review', txn_id: txn, paid_at: new Date().toISOString() }).eq('id', row.id);
  if (error) {
    await db.from('supporter_purchases').update({ note: `Paid, but the tile could not be kept (${error.message.slice(0, 80)}). Refund it.` }).eq('txn_id', txn);
    return json({ ok: true });
  }
  await db.from('supporter_purchases').update({ matched: row.id }).eq('txn_id', txn);
  return json({ ok: true });
});
