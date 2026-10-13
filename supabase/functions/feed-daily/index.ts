// ─── feed-daily ──────────────────────────────────────────────────────────────
//
// Runs ONCE a day (scheduled, not called by the app). Reads a short list of positive-news
// RSS feeds, asks Claude Haiku to pick up to 5 genuinely uplifting stories and rewrite each
// as a short original summary, then stores them in public.feed_items with a link to the
// original article. The app reads that table, so cost does not grow with users.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   CRON_SECRET        — any long random string; the scheduler sends it as x-cron-secret
//   ANTHROPIC_API_KEY  — from console.anthropic.com
//   (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically)
//
// Schedule (SQL editor, after deploying; replace the two placeholders yourself):
//   select cron.schedule('feed-daily', '0 14 * * *',            -- 14:00 UTC = 4am Hawaii
//     $$ select net.http_post(
//          url := 'https://<project-ref>.supabase.co/functions/v1/feed-daily',
//          headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>')
//        ); $$);
//
// Deploy with --no-verify-jwt (the cron secret is the gate): supabase functions deploy feed-daily --no-verify-jwt
//
// Before shipping, check each feed's terms. We store a headline, our own one-to-two sentence
// summary, the outlet name and a link back. We never copy article text.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Candidate feeds. Confirm each URL still resolves and that the outlet allows headline +
// summary + link use before you rely on it. Remove any that fail; the function skips errors.
const FEEDS: { name: string; url: string }[] = [
  { name: 'Good News Network', url: 'https://www.goodnewsnetwork.org/feed/' },
  { name: 'Positive News',     url: 'https://www.positive.news/feed/' },
  { name: 'Reasons to be Cheerful', url: 'https://reasonstobecheerful.world/feed/' },
  { name: 'The Optimist Daily', url: 'https://www.optimistdaily.com/feed/' },
];

const PER_FEED = 8;
const PICK = 5;

type Candidate = { title: string; link: string; desc: string; source: string };

const strip = (s: string) =>
  s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&')
   .replace(/&#8217;|&#039;|&apos;/g, "'").replace(/&quot;|&#8220;|&#8221;/g, '"')
   .replace(/\s+/g, ' ').trim();

function parseRss(xml: string, source: string): Candidate[] {
  const items = xml.match(/<item[\s\S]*?<\/item>/g) ?? [];
  return items.slice(0, PER_FEED).flatMap((it) => {
    const pick = (tag: string) => it.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] ?? '';
    const title = strip(pick('title'));
    const link = strip(pick('link'));
    const desc = strip(pick('description')).slice(0, 400);
    return title && /^https:\/\//.test(link) ? [{ title, link, desc, source }] : [];
  });
}

serve(async (req: Request) => {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret) {
    return new Response('Forbidden', { status: 403 });
  }
  try {
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY missing');

    const settled = await Promise.allSettled(
      FEEDS.map(async (f) => {
        const res = await fetch(f.url, { headers: { 'User-Agent': 'NoGoonFeed/1.0' } });
        if (!res.ok) throw new Error(`${f.name} ${res.status}`);
        return parseRss(await res.text(), f.name);
      }),
    );
    const pool = settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : []));
    if (pool.length < PICK) throw new Error(`only ${pool.length} candidates`);

    const list = pool.map((c, i) => `${i}. ${c.title} — ${c.desc}`).join('\n');
    const ai = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 900,
        messages: [{
          role: 'user',
          content:
            `Candidates:\n${list}\n\nChoose up to ${PICK} stories that are genuinely uplifting and true-to-life. ` +
            `Skip anything about war, violence, crime, disasters, politics, health scares, ads, or listicles. ` +
            `Prefer variety (nature, people, science, community). For each, write a headline under 10 words and a warm, ` +
            `plain summary of at most 2 sentences in your own words. Best story first. ` +
            `Respond ONLY with JSON: [{"i": <number>, "headline": "...", "summary": "...", "category": "nature|people|science|community|culture"}]`,
        }],
      }),
    });
    if (!ai.ok) throw new Error(`Anthropic ${ai.status}`);
    const text: string = (await ai.json()).content?.[0]?.text ?? '';
    const arr = text.match(/\[[\s\S]*\]/);
    if (!arr) throw new Error('unparseable model output');
    const picks = JSON.parse(arr[0]) as { i: number; headline: string; summary: string; category?: string }[];

    const day = new Date().toISOString().slice(0, 10);
    const rows = picks.slice(0, PICK).flatMap((p, rank) => {
      const c = pool[p.i];
      if (!c || !p.headline || !p.summary) return [];
      return [{
        day, rank, headline: p.headline.slice(0, 140), summary: p.summary.slice(0, 400),
        source: c.source, url: c.link, category: p.category ?? 'good',
      }];
    });
    if (rows.length === 0) throw new Error('no usable picks');

    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { error } = await admin.from('feed_items').upsert(rows, { onConflict: 'day,url' });
    if (error) throw error;

    return new Response(JSON.stringify({ day, stored: rows.length }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[feed-daily]', err);
    return new Response(JSON.stringify({ error: 'feed-daily failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
