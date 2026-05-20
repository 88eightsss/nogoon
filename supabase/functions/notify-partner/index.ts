// ─── Notify Partner Edge Function ────────────────────────────────────────── //
//
// Sends an accountability email to the user's partner when a relapse occurs.
// Called from the React Native app after a gate session where the user
// chose to continue instead of walking away.
//
// SECURITY FIXES applied (from audit items 1, 2, 4, 6):
//   1. userId extracted from JWT — no longer trusted from request body
//   2. All user-provided text is HTML-escaped before email insertion
//   4. Sender email uses real domain (update YOUR_VERIFIED_DOMAIN below)
//   6. CORS restricted to the app's origin (no wildcard)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── HTML Escaping ──────────────────────────────────────────────────────────── //

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─── CORS Headers ───────────────────────────────────────────────────────────── //
// Restricted: only the native app should call this function.
// Since it's called from a React Native app (not a browser), we can lock
// this down. If you ever need browser access, replace with your specific domain.

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://nogoon.app', // Replace with your actual domain if needed
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ─── Main Handler ───────────────────────────────────────────────────────────── //

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── 1. Extract user ID from JWT (not from request body) ──────────────── //
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    // Verify the JWT and get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;

    // ── 2. Parse request body (domain only — userId comes from JWT) ──────── //
    const { domain } = await req.json();
    if (!domain || typeof domain !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing domain field' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 3. Look up user profile and partner email ────────────────────────── //
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('display_name, partner_email, partner_name')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profile.partner_email) {
      return new Response(
        JSON.stringify({ error: 'No partner email configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 4. Build email with escaped user-provided content ────────────────── //
    const safeName = escapeHtml(profile.display_name || 'Someone');
    const safePartnerName = escapeHtml(profile.partner_name || 'there');
    const safeDomain = escapeHtml(domain);

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>NoGoon Partner Notification</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0A0A0A; color: #FFFFFF; margin: 0; padding: 20px; }
          .container { max-width: 480px; margin: 0 auto; padding: 32px; background: #111111; border-radius: 16px; border: 1px solid #222222; }
          .header { text-align: center; margin-bottom: 24px; }
          .title { font-size: 20px; font-weight: 700; color: #FF69B4; margin: 0; }
          .body-text { font-size: 15px; line-height: 1.6; color: #CCCCCC; }
          .domain { background: #1A1A1A; border: 1px solid #333333; border-radius: 8px; padding: 12px 16px; font-family: monospace; color: #FF69B4; text-align: center; margin: 16px 0; }
          .footer { font-size: 12px; color: #666666; text-align: center; margin-top: 24px; border-top: 1px solid #222222; padding-top: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <p class="title">NoGoon — Partner Alert</p>
          </div>
          <p class="body-text">
            Hey ${safePartnerName},
          </p>
          <p class="body-text">
            ${safeName} wanted you to know they had a tough moment. They tried to access:
          </p>
          <div class="domain">${safeDomain}</div>
          <p class="body-text">
            They chose to set up accountability with you because your support matters.
            A quick check-in or encouraging message could make a real difference right now.
          </p>
          <p class="body-text">
            Remember — this takes courage. No judgment, just support.
          </p>
          <div class="footer">
            <p>Sent by NoGoon on behalf of ${safeName}.</p>
            <p>They chose you as their accountability partner.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // ── 5. Send via Resend ───────────────────────────────────────────────── //
    // TODO: Replace YOUR_VERIFIED_DOMAIN with your actual Resend-verified domain
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      return new Response(
        JSON.stringify({ error: 'Resend API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'NoGoon <notifications@nogoon.app>', // ← Replace with your verified Resend domain
        to: [profile.partner_email],
        subject: `${safeName} could use your support right now`,
        html: emailHtml,
      }),
    });

    if (!resendResponse.ok) {
      const resendError = await resendResponse.text();
      console.error('[notify-partner] Resend error:', resendError);
      return new Response(
        JSON.stringify({ error: 'Failed to send email' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[notify-partner] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
