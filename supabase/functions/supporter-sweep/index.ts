// ─── supporter-sweep (the scan bot) ──────────────────────────────────────────
//
// Runs on a schedule and looks at supporter tiles AFTER the upload check:
//   1. every tile waiting for review (paid, not yet live)      — second opinion before it can go live
//   2. every live tile that has an open report                 — people flagged it, look again now
//   3. live tiles not checked in the last 7 days (15 per run)  — rules and models change; keep checking
// A tile that fails is taken off the Wall at once (status 'removed', picture deleted from storage, the
// reason kept in review_note). Anything the scanner cannot judge (outage, bad answer) is left alone and retried.
// Tiles that pass stay as they are: waiting tiles still wait for you to approve them (supporter_approve),
// unless the secret SUPPORTER_AUTO_APPROVE is set to "1", in which case a tile that passes this second
// check goes live by itself.
//
// Secrets: CRON_SECRET, ANTHROPIC_API_KEY (SUPABASE_* automatic). Optional: SUPPORTER_AUTO_APPROVE.
// Deploy:  supabase functions deploy supporter-sweep --no-verify-jwt   (the cron secret is the gate)
// Schedule (every 6 hours) is in scripts/feed-go.ps1 / deploy-backend.ps1.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { scanImage, toBase64, sha256Hex } from '../_shared/scan.ts';

const BUCKET = 'wall-supporters';
const LIVE_RECHECK_DAYS = 7;
const MAX_PER_RUN = 25;

type Row = { id: string; status: string; image_path: string | null; scan: Record<string, unknown> | null; txn_id: string | null };

serve(async (req: Request) => {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret) return new Response('Forbidden', { status: 403 });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const autoApprove = Deno.env.get('SUPPORTER_AUTO_APPROVE') === '1';
  const cols = 'id,status,image_path,scan,txn_id';

  // 1. waiting for review   2. reported   3. live and due for a recheck
  const queue = new Map<string, Row>();
  const add = (rows: Row[] | null) => { for (const r of rows ?? []) if (r.image_path && !queue.has(r.id)) queue.set(r.id, r); };

  add((await db.from('wall_supporters').select(cols).eq('status', 'pending_review').order('paid_at', { ascending: true }).limit(MAX_PER_RUN)).data as Row[]);

  const { data: reports } = await db.from('wall_reports').select('supporter_id').eq('handled', false).not('supporter_id', 'is', null).limit(50);
  const reported = [...new Set((reports ?? []).map((r: { supporter_id: string }) => r.supporter_id))];
  if (reported.length) add((await db.from('wall_supporters').select(cols).in('id', reported).eq('status', 'live')).data as Row[]);

  const cutoff = new Date(Date.now() - LIVE_RECHECK_DAYS * 86400000).toISOString();
  const { data: live } = await db.from('wall_supporters').select(cols).eq('status', 'live').limit(500);
  const due = ((live ?? []) as Row[])
    .filter((r) => !r.scan || typeof r.scan.swept_at !== 'string' || (r.scan.swept_at as string) < cutoff)
    .sort((a, b) => String(a.scan?.swept_at ?? '').localeCompare(String(b.scan?.swept_at ?? '')))
    .slice(0, 15);
  add(due);

  const out = { looked: 0, removed: 0, approved: 0, passed: 0, scanner_down: 0, missing: 0, removed_ids: [] as string[], refund_needed: [] as string[] };

  for (const row of [...queue.values()].slice(0, MAX_PER_RUN)) {
    out.looked++;
    const dl = await db.storage.from(BUCKET).download(row.image_path!);
    if (dl.error || !dl.data) { out.missing++; continue; }
    const bytes = new Uint8Array(await dl.data.arrayBuffer());
    const type = row.image_path!.endsWith('.png') ? 'image/png' : 'image/jpeg';
    const scan = await scanImage(toBase64(bytes), type);
    const sha = (row.scan?.sha256 as string | undefined) ?? await sha256Hex(bytes);

    if (!scan.checked) { out.scanner_down++; continue; }          // try again next run

    if (!scan.allowed) {
      await db.from('wall_supporters').update({
        status: 'removed',
        scan: { ...scan, sha256: sha, swept_at: new Date().toISOString(), source: 'sweep' },
        review_note: `Scan bot: ${scan.reasons.join(', ') || 'not allowed'}${row.txn_id ? ' (paid: refund in Play Console)' : ''}`,
      }).eq('id', row.id).in('status', ['pending_review', 'live']);
      await db.storage.from(BUCKET).remove([row.image_path!]);    // do not keep the picture
      await db.from('wall_reports').update({ handled: true }).eq('supporter_id', row.id);
      out.removed++; out.removed_ids.push(row.id);
      if (row.txn_id) out.refund_needed.push(row.id);
      continue;
    }

    await db.from('wall_supporters').update({
      scan: { ...scan, sha256: sha, swept_at: new Date().toISOString(), source: 'sweep' },
    }).eq('id', row.id);
    out.passed++;
    if (autoApprove && row.status === 'pending_review') {
      const { error } = await db.rpc('supporter_approve', { p_id: row.id });
      if (!error) out.approved++;
    }
  }

  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } });
});
