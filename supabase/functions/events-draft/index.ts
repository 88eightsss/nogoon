// ─── events-draft ────────────────────────────────────────────────────────────
//
// Runs weekly (scheduled) or by hand. Reads the public event pages YOU list in
// public.event_sources, asks Claude Haiku to pull out upcoming events, and saves them as
// status = 'pending' in public.community_events. NOTHING reaches the app until you flip a row to
// 'approved' (Supabase > Table Editor, or SQL). Every event keeps a link back to its source and we
// never copy page text, only a title, a one-line summary, the place and the time.
//
// Secrets: CRON_SECRET and ANTHROPIC_API_KEY (same ones feed-daily uses).
// Deploy:  supabase functions deploy events-draft --no-verify-jwt
// Weekly schedule (SQL editor; Mondays 3am Hawaii = 13:00 UTC):
//   select cron.schedule('events-draft', '0 13 * * 1',
//     $$ select net.http_post(url := 'https://<project-ref>.supabase.co/functions/v1/events-draft',
//          headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>')); $$);
// Add a source (SQL):
//   insert into event_sources (region, kind_hint, url, notes) values ('Oahu', 'market', 'https://...', 'KCC market page');

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const KINDS = ['market', 'volunteer', 'community', 'outdoors', 'class', 'music', 'other'];
const MAX_TEXT = 14000;

const toText = (html: string) =>
  html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/&#8217;|&#039;|&apos;/g, "'").replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);

type Draft = {
  title: string; summary?: string; kind?: string; place_name?: string; when_text?: string;
  starts_at?: string | null; ends_at?: string | null; recurring?: boolean; cost?: string; url?: string;
};

async function extract(key: string, region: string, hint: string, pageUrl: string, text: string): Promise<Draft[]> {
  const today = new Date().toISOString().slice(0, 10);
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2500,
      messages: [{
        role: 'user',
        content:
          `Today is ${today}. Timezone: Pacific/Honolulu. Region: ${region}. This text came from ${pageUrl}:\n\n${text}\n\n` +
          `List the upcoming or recurring in-person community events on this page that suit a general adult audience ` +
          `(farmers markets, volunteering, free or low-cost community happenings, outdoors, classes, local music). ` +
          `Skip anything past, anything age-restricted, bars/nightlife, ticket resales, ads, and anything you are unsure about. ` +
          `For each: title (under 90 chars), summary (one plain sentence, your own words, under 200 chars), ` +
          `kind (one of ${KINDS.join('|')}; hint: ${hint}), place_name, when_text (as people would read it, e.g. "Saturdays 7:30-11 am"), ` +
          `starts_at (ISO 8601 with offset, or null if unknown), ends_at (ISO or null), recurring (true for weekly/monthly), ` +
          `cost ("Free" or the price, or ""), url (a link from the page if there is a specific one, else "${pageUrl}"). ` +
          `Never include phone numbers or email addresses. Respond ONLY with a JSON array.`,
      }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const out: string = (await res.json()).content?.[0]?.text ?? '';
  const arr = out.match(/\[[\s\S]*\]/);
  return arr ? (JSON.parse(arr[0]) as Draft[]) : [];
}

serve(async (req: Request) => {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret) return new Response('Forbidden', { status: 403 });
  try {
    const key = Deno.env.get('ANTHROPIC_API_KEY');
    if (!key) throw new Error('ANTHROPIC_API_KEY missing');
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: sources, error } = await admin.from('event_sources').select('*').eq('active', true);
    if (error) throw error;

    const report: Record<string, number | string> = {};
    for (const src of sources ?? []) {
      try {
        const page = await fetch(src.url, { headers: { 'User-Agent': 'NoGoonEvents/1.0' }, signal: AbortSignal.timeout(15000) });
        if (!page.ok) throw new Error(`page ${page.status}`);
        const drafts = await extract(key, src.region, src.kind_hint, src.url, toText(await page.text()));
        const host = new URL(src.url).hostname.replace(/^www\./, '');
        const rows = drafts.flatMap((d) => {
          if (!d?.title) return [];
          const url = d.url && /^https:\/\//.test(d.url) ? d.url : src.url;
          return [{
            title: d.title.slice(0, 120), summary: (d.summary ?? '').slice(0, 300),
            kind: KINDS.includes(d.kind ?? '') ? d.kind : src.kind_hint, region: src.region,
            place_name: (d.place_name ?? '').slice(0, 120), when_text: (d.when_text ?? '').slice(0, 120),
            starts_at: d.starts_at || null, ends_at: d.ends_at || null, recurring: !!d.recurring,
            cost: (d.cost ?? '').slice(0, 40), url, source: host, status: 'pending',
          }];
        });
        if (rows.length) {
          // ignoreDuplicates: a row you already approved (or hid) is never reset to pending.
          const { error: ie } = await admin.from('community_events').upsert(rows, { onConflict: 'title,url,when_text', ignoreDuplicates: true });
          if (ie) throw ie;
        }
        report[src.url] = rows.length;
      } catch (e) {
        console.error('[events-draft]', src.url, e);
        report[src.url] = `failed: ${(e as Error).message}`;
      }
    }
    return new Response(JSON.stringify({ drafted: report }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[events-draft]', err);
    return new Response(JSON.stringify({ error: 'events-draft failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
