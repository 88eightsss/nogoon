// ─── local-news ──────────────────────────────────────────────────────────────
//
// Runs daily (scheduled). Reads the public RSS/Atom feeds listed in public.news_sources and keeps the
// newest HEADLINES with a link back to the publisher. It stores no article text and no images: the app
// shows the headline and the outlet's name, and tapping opens the outlet's own page.
// Rows older than 14 days are removed.
//
// Secrets: CRON_SECRET.   Deploy: supabase functions deploy local-news --no-verify-jwt
// Schedule (SQL editor):
//   select cron.schedule('local-news', '30 15 * * *',
//     $$ select net.http_post(url := 'https://<project-ref>.supabase.co/functions/v1/local-news',
//          headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>')); $$);

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PER_FEED = 12;
const clean = (v: string, n: number) =>
  v.replace(/<!\[CDATA\[|\]\]>/g, ' ').replace(/<[^>]+>/g, ' ')
   .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
   .replace(/&#8217;|&#039;|&apos;|&rsquo;/g, "'").replace(/&#8211;|&ndash;/g, '-').replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"')
   .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

type Headline = { title: string; url: string; published_at: string | null };

function parseFeed(xml: string): Headline[] {
  if (!/<(rss|feed)[\s>]/i.test(xml.slice(0, 800))) return [];
  const items = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/g) ?? [];
  const out: Headline[] = [];
  for (const it of items.slice(0, PER_FEED)) {
    const g = (t: string) => it.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`))?.[1] ?? '';
    const title = clean(g('title'), 200);
    const link = clean(g('link'), 500) || (it.match(/<link[^>]*href=["']([^"']+)["']/)?.[1] ?? '');
    const when = Date.parse(clean(g('pubDate') || g('updated') || g('published'), 60));
    if (title && /^https:\/\//.test(link)) out.push({ title, url: link, published_at: Number.isNaN(when) ? null : new Date(when).toISOString() });
  }
  return out;
}

async function logRun(job: string, ok: boolean, detail: Record<string, unknown>) {
  try {
    const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    await db.from('job_runs').insert({ job, ok, detail });
  } catch (e) { console.error('[logRun]', e); }
}

serve(async (req: Request) => {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret) return new Response('Forbidden', { status: 403 });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: sources, error } = await admin.from('news_sources').select('region, name, url').eq('active', true);
    if (error) throw error;
    const report: Record<string, number | string> = {};
    await Promise.all((sources ?? []).map(async (src) => {
      try {
        const res = await fetch(src.url, { headers: { 'User-Agent': 'NoGoonHeadlines/1.0' }, signal: AbortSignal.timeout(15000) });
        if (!res.ok) throw new Error(`feed ${res.status}`);
        const heads = parseFeed(await res.text());
        const rows = heads.map((h) => ({ region: src.region, title: h.title, url: h.url, source: src.name, published_at: h.published_at }));
        if (rows.length) {
          // ignoreDuplicates: a headline you hid stays hidden.
          const { error: ie } = await admin.from('local_news').upsert(rows, { onConflict: 'url', ignoreDuplicates: true });
          if (ie) throw ie;
        }
        report[src.url] = rows.length;
      } catch (e) {
        console.error('[local-news]', src.url, e);
        report[src.url] = `failed: ${(e as Error).message}`;
      }
    }));
    await admin.from('local_news').delete().lt('fetched_at', new Date(Date.now() - 14 * 86400000).toISOString());
    const failed = Object.values(report).filter((v) => typeof v === 'string').length;
    await logRun('local-news', failed < Math.max(1, Object.keys(report).length), { sources: Object.keys(report).length, failed });
    return new Response(JSON.stringify({ headlines: report }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[local-news]', err);
    await logRun('local-news', false, { error: String((err as Error)?.message ?? err).slice(0, 200) });
    return new Response(JSON.stringify({ error: 'local-news failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
