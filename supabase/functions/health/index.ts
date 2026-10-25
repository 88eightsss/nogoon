// ─── health ──────────────────────────────────────────────────────────────────
//
// A tiny status check for the scheduled jobs. Returns 200 when every job has run successfully recently
// and 503 when one is overdue, so a free uptime monitor (UptimeRobot, Better Stack) that pings this
// address can email you the day something stops. It reveals only job names, times and ok flags.
//
//   feed-daily   expected every day            -> overdue after 30 hours
//   events-draft expected Monday and Thursday  -> overdue after 5 days
//   local-news   expected every day            -> overdue after 30 hours
//
// Deploy WITHOUT JWT checking so the monitor can call it:  supabase functions deploy health --no-verify-jwt
// Address: https://<project-ref>.supabase.co/functions/v1/health

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const JOBS: { job: string; maxHours: number }[] = [
  { job: 'feed-daily', maxHours: 30 },
  { job: 'events-draft', maxHours: 24 * 5 },
  { job: 'local-news', maxHours: 30 },
];

serve(async () => {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  try {
    const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const jobs: Record<string, unknown> = {};
    let allOk = true;
    for (const { job, maxHours } of JOBS) {
      const { data: okRow } = await db.from('job_runs').select('ran_at').eq('job', job).eq('ok', true).order('ran_at', { ascending: false }).limit(1);
      const { data: lastRow } = await db.from('job_runs').select('ok, ran_at').eq('job', job).order('ran_at', { ascending: false }).limit(1);
      const lastOk = okRow?.[0]?.ran_at as string | undefined;
      const ageHours = lastOk ? Math.round(((Date.now() - Date.parse(lastOk)) / 3600000) * 10) / 10 : null;
      const healthy = ageHours !== null && ageHours <= maxHours;
      if (!healthy) allOk = false;
      jobs[job] = { healthy, lastOkAt: lastOk ?? null, ageHours, lastRunOk: lastRow?.[0]?.ok ?? null, maxHours };
    }
    return new Response(JSON.stringify({ ok: allOk, jobs }), { status: allOk ? 200 : 503, headers });
  } catch (e) {
    console.error('[health]', e);
    return new Response(JSON.stringify({ ok: false, error: 'health check failed' }), { status: 503, headers });
  }
});
