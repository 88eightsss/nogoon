// ─── Positive News Edge Function ────────────────────────────────────────── //
//
// Called after a successful walk-away as a reward moment.
// Fetches recent headlines from NewsAPI, passes them to Claude Haiku,
// and returns one warm/uplifting summary.
//
// Required secrets (Supabase dashboard → Project Settings → Edge Functions):
//   NEWSAPI_KEY      — from newsapi.org (free tier: 100 req/day)
//   ANTHROPIC_API_KEY — from console.anthropic.com

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Rotate query each call so users don't see the same vibe each time
const QUERIES = [
  'breakthrough discovery innovation',
  'rescue achievement kindness community',
  'science health milestone success',
  'wildlife conservation nature recovery',
  'art culture creativity celebration',
];

// Cost guards. NewsAPI's free tier is 100 requests/day and every call also spends
// model credits, so: signed-in users only, a small per-user hourly cap, and results are
// cached for a few hours and served back at random (in-memory — resets on cold start).
const CACHE_MS = 3 * 60 * 60 * 1000;
const CACHE_MAX = 5;
const MAX_PER_HOUR = 10;
let cache: { at: number; items: unknown[] } = { at: 0, items: [] };
const calls = new Map<string, number[]>();

function overLimit(userId: string): boolean {
  const now = Date.now();
  const recent = (calls.get(userId) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= MAX_PER_HOUR) { calls.set(userId, recent); return true; }
  recent.push(now);
  calls.set(userId, recent);
  return false;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // The app's anon key alone must not be enough to call this: require a user session.
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
    const authClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '');
    const { data: { user } } = await authClient.auth.getUser(token);
    if (!user) return json({ error: 'Sign in required' }, 401);
    if (overLimit(user.id)) return json({ error: 'Too many requests' }, 429);

    // Fresh cache with enough variety? Serve one without spending any quota.
    if (Date.now() - cache.at < CACHE_MS && cache.items.length >= CACHE_MAX) {
      return json(cache.items[Math.floor(Math.random() * cache.items.length)]);
    }

    const newsApiKey   = Deno.env.get('NEWSAPI_KEY');
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

    if (!newsApiKey || !anthropicKey) {
      return new Response(
        JSON.stringify({ error: 'API keys not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 1. Fetch headlines ──────────────────────────────────────────────── //
    const query = QUERIES[Math.floor(Math.random() * QUERIES.length)];
    const newsRes = await fetch(
      `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=10`,
      { headers: { 'X-Api-Key': newsApiKey } }
    );

    if (!newsRes.ok) throw new Error(`NewsAPI ${newsRes.status}`);
    const newsData = await newsRes.json();
    const articles: Array<{ title: string; source: { name: string } }> = newsData.articles ?? [];
    if (articles.length === 0) throw new Error('No articles returned');

    const headlines = articles
      .slice(0, 8)
      .map((a, i) => `${i + 1}. "${a.title}" — ${a.source?.name ?? 'Unknown'}`)
      .join('\n');

    // ── 2. Ask Claude to pick and rewrite the most uplifting one ────────── //
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 220,
        messages: [
          {
            role: 'user',
            content: `Here are recent news headlines:\n\n${headlines}\n\nPick the single most genuinely uplifting or hopeful story. Write:\n1. A short headline under 10 words that captures the good news\n2. A warm, 2-sentence summary that makes someone feel good about the world (no hype, just honest warmth)\n3. The source name\n\nRespond ONLY with valid JSON, no other text:\n{"headline": "...", "summary": "...", "source": "..."}`,
          },
        ],
      }),
    });

    if (!anthropicRes.ok) throw new Error(`Anthropic ${anthropicRes.status}`);
    const anthropicData = await anthropicRes.json();
    const text: string = anthropicData.content?.[0]?.text ?? '';

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Could not parse Claude response');
    const result = JSON.parse(jsonMatch[0]);

    // Remember it (starting a fresh window once the old one has expired).
    if (Date.now() - cache.at >= CACHE_MS) cache = { at: Date.now(), items: [] };
    cache.items.push(result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[positive-news]', err);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch positive news' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
