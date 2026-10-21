// ─── feed-daily ──────────────────────────────────────────────────────────────
//
// Runs ONCE a day (scheduled, not called by the app). Reads a short list of positive-news
// RSS feeds, asks Claude Haiku to pick up to 10 genuinely uplifting stories and rewrite each
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
// Briefing sections (one run writes all three; each is independent, so one failing never blocks the others):
//   good    — positive RSS stories (above)
//   curious — most-read Wikipedia articles of yesterday: what people are looking up
//   world   — Wikipedia "In the news": a calm, factual look at major events (shown only if the user opts in)
// Wikipedia data comes from the free Wikimedia Feed API (api.wikimedia.org/feed/v1). Be polite: one call a day, with a User-Agent.
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

const PER_FEED = 12;
const PICK = 10;

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

type Row = { day: string; rank: number; headline: string; summary: string; source: string; url: string; category: string; section: 'good' | 'curious' | 'world' };

async function askClaude(key: string, prompt: string, maxTokens = 900): Promise<any[]> {
  const ai = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!ai.ok) throw new Error(`Anthropic ${ai.status}`);
  const text: string = (await ai.json()).content?.[0]?.text ?? '';
  const arr = text.match(/\[[\s\S]*\]/);
  if (!arr) throw new Error('unparseable model output');
  return JSON.parse(arr[0]);
}

// ── Wikipedia: "curious" (most read) + "world" (in the news) ─────────────────────────────────
const SKIP_TITLES = /^(Main_Page|Special:|Wikipedia:|Portal:|Help:|File:|Category:|Template:|Talk:|Deaths_in_)/;

// One upsert cannot touch the same (day, url) twice, and a model may pick the same story twice.
function uniqueByUrl<T extends { url: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.url) ? false : (seen.add(r.url), true)));
}

async function wikiRows(key: string, day: string): Promise<Row[]> {
  // Yesterday (UTC): the day with complete pageview data.
  const y = new Date(Date.now() - 86400000);
  const path = `${y.getUTCFullYear()}/${String(y.getUTCMonth() + 1).padStart(2, '0')}/${String(y.getUTCDate()).padStart(2, '0')}`;
  // Same feed, two doors. api.wikimedia.org is tried first; if it is down or retired, the
  // Wikipedia REST door answers with the identical JSON.
  const headers = { 'User-Agent': 'NoGoonFeed/1.0 (contact via the NoGoon app listing)' };
  let res = await fetch(`https://api.wikimedia.org/feed/v1/wikipedia/en/featured/${path}`, { headers }).catch(() => null);
  if (!res || !res.ok) {
    res = await fetch(`https://en.wikipedia.org/api/rest_v1/feed/featured/${path}`, { headers });
  }
  if (!res.ok) throw new Error(`wikimedia ${res.status}`);
  const feed = await res.json();
  const out: Row[] = [];

  const read = (feed?.mostread?.articles ?? []).filter((a: any) => a?.titles?.canonical && !SKIP_TITLES.test(a.titles.canonical)).slice(0, 30);
  if (read.length >= 5) {
    const list = read.map((a: any, i: number) => `${i}. ${a.normalizedtitle ?? a.title} — ${(a.description ?? a.extract ?? '').slice(0, 160)}`).join('\n');
    const picks = await askClaude(key,
      `These are the most-read Wikipedia articles yesterday:\n${list}\n\nChoose up to 6 that show what people are genuinely curious about. ` +
      `Skip anything sexual, graphic, about a person's death or crime, or that is only a celebrity gossip hook. ` +
      `For each, write a headline under 9 words and one plain sentence (in your own words) on why people may be looking it up or what it is. ` +
      `Respond ONLY with JSON: [{"i": <number>, "headline": "...", "summary": "..."}]`, 1100);
    picks.slice(0, 6).forEach((p, rank) => {
      const a = read[p.i];
      const url = a?.content_urls?.desktop?.page;
      if (a && url && p.headline && p.summary) out.push({ day, rank, headline: String(p.headline).slice(0, 140), summary: String(p.summary).slice(0, 400), source: 'Wikipedia', url, category: 'curious', section: 'curious' });
    });
  }

  const news = (feed?.news ?? []).slice(0, 10)
    .map((n: any) => ({ story: strip(n?.story ?? ''), url: n?.links?.[0]?.content_urls?.desktop?.page as string | undefined }))
    .filter((n: any) => n.story && n.url);
  if (news.length >= 2) {
    const list = news.map((n: any, i: number) => `${i}. ${n.story}`).join('\n');
    const picks = await askClaude(key,
      `Major news items today (from Wikipedia "In the news"):\n${list}\n\nWrite a calm briefing of up to 5 of these. For each: a neutral headline under 10 words and one or two plain sentences ` +
      `saying what happened and, if known, what is being done. No graphic detail, no speculation, no casualty counts beyond what is essential, no loaded words, no opinion. ` +
      `Skip an item if it cannot be told calmly. Respond ONLY with JSON: [{"i": <number>, "headline": "...", "summary": "..."}]`, 1000);
    picks.slice(0, 5).forEach((p, rank) => {
      const n = news[p.i];
      if (n && p.headline && p.summary) out.push({ day, rank, headline: String(p.headline).slice(0, 140), summary: String(p.summary).slice(0, 400), source: 'Wikipedia', url: n.url!, category: 'world', section: 'world' });
    });
  }
  return uniqueByUrl(out);
}

serve(async (req: Request) => {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret) {
    return new Response('Forbidden', { status: 403 });
  }
  try {
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY missing');
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const today = new Date().toISOString().slice(0, 10);

    // Wikipedia sections run first and independently; a failure is logged, never fatal.
    let wikiStored = 0;
    try {
      const wr = await wikiRows(anthropicKey, today);
      if (wr.length) {
        const { error: werr } = await admin.from('feed_items').upsert(wr, { onConflict: 'day,url' });
        if (werr) throw werr;
        wikiStored = wr.length;
      }
    } catch (e) { console.error('[feed-daily:wiki]', e); }

    const settled = await Promise.allSettled(
      FEEDS.map(async (f) => {
        const res = await fetch(f.url, { headers: { 'User-Agent': 'NoGoonFeed/1.0' } });
        if (!res.ok) throw new Error(`${f.name} ${res.status}`);
        return parseRss(await res.text(), f.name);
      }),
    );
    const pool = settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : []));
    if (pool.length < 5) throw new Error(`only ${pool.length} candidates`);

    const list = pool.map((c, i) => `${i}. ${c.title} — ${c.desc}`).join('\n');
    const ai = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2200,
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
    const rows = uniqueByUrl(picks.slice(0, PICK).flatMap((p, rank) => {
      const c = pool[p.i];
      if (!c || !p.headline || !p.summary) return [];
      return [{
        day, rank, headline: p.headline.slice(0, 140), summary: p.summary.slice(0, 400),
        source: c.source, url: c.link, category: p.category ?? 'good', section: 'good',
      }];
    }));
    if (rows.length === 0) throw new Error('no usable picks');

    const { error } = await admin.from('feed_items').upsert(rows, { onConflict: 'day,url' });
    if (error) throw error;

    return new Response(JSON.stringify({ day, stored: rows.length, wiki: wikiStored }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[feed-daily]', err);
    return new Response(JSON.stringify({ error: 'feed-daily failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
