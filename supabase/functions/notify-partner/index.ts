// ═══════════════════════════════════════════════════════════════════════════
//  Supabase Edge Function: notify-partner
//  ──────────────────────────────────────
//  Called from the app whenever a Pro user unlocks a blocked site.
//  Sends an email to their accountability partner so they know.
//
//  Deploy with:
//    npx supabase functions deploy notify-partner
//
//  The function needs one environment secret set in Supabase dashboard:
//    RESEND_API_KEY — from resend.com (free tier sends 3,000 emails/month)
//
//  Request body (JSON):
//    {
//      userId:      string   — the user who unlocked
//      eventType:   'unlock' | 'bypass'
//      domain:      string   — which site was unlocked, e.g. "tiktok.com"
//    }
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── CORS headers ─────────────────────────────────────────────────────────────
// Required so the React Native app can call this function directly

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {

  // Handle browser preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Parse request body ──────────────────────────────────────────────────
    const { userId, eventType, domain } = await req.json();

    if (!userId || !eventType || !domain) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, eventType, domain' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Set up Supabase client (service role — bypasses RLS to read profiles) ─
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ── Load the user's profile to get their name and partner details ────────
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('name, partner_email, partner_name, partner_notify_on_unlock, partner_notify_on_bypass')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Check if this event type should trigger a notification ───────────────
    const shouldNotify =
      (eventType === 'unlock'  && profile.partner_notify_on_unlock)  ||
      (eventType === 'bypass'  && profile.partner_notify_on_bypass);

    if (!shouldNotify || !profile.partner_email) {
      // Notifications turned off or no partner set — silently succeed
      return new Response(
        JSON.stringify({ sent: false, reason: 'notifications disabled or no partner' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Build the email content ──────────────────────────────────────────────
    const userName    = profile.name || 'Your friend';
    const partnerName = profile.partner_name || 'there';
    const isUnlock    = eventType === 'unlock';

    const subject = isUnlock
      ? `${userName} unlocked ${domain} on NoGoon`
      : `${userName} bypassed a NoGoon block`;

    const htmlBody = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; background: #08080e; color: #ffffff; padding: 32px; border-radius: 12px;">

        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 48px;">${isUnlock ? '🔓' : '⚠️'}</span>
        </div>

        <h1 style="color: #6cff5a; font-size: 22px; margin-bottom: 8px;">
          Hey ${partnerName},
        </h1>

        <p style="color: #aaaaaa; font-size: 16px; line-height: 1.6;">
          ${isUnlock
            ? `<strong style="color: #ffffff;">${userName}</strong> just unlocked <strong style="color: #ffffff;">${domain}</strong> on NoGoon. They spent points to access it.`
            : `<strong style="color: #ffffff;">${userName}</strong> dismissed a NoGoon block on <strong style="color: #ffffff;">${domain}</strong> without completing a game.`
          }
        </p>

        <p style="color: #aaaaaa; font-size: 15px; line-height: 1.6; margin-top: 16px;">
          This is your cue to check in with them. A quick message goes a long way.
        </p>

        <div style="margin-top: 24px; padding: 16px; background: #1a1a2e; border-radius: 8px; border-left: 4px solid #6cff5a;">
          <p style="color: #888888; font-size: 13px; margin: 0;">
            You're receiving this because ${userName} added you as their NoGoon accountability partner.
            They chose this — it means they trust you.
          </p>
        </div>

      </div>
    `;

    // ── Send via Resend (free — 3,000 emails/month) ──────────────────────────
    // Sign up at resend.com, verify a domain, get an API key,
    // then add it as RESEND_API_KEY in Supabase → Project Settings → Edge Functions → Secrets

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      console.warn('[notify-partner] RESEND_API_KEY not set — email not sent');
      return new Response(
        JSON.stringify({ sent: false, reason: 'RESEND_API_KEY not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    'NoGoon <notifications@yourdomain.com>', // replace with your verified Resend domain
        to:      [profile.partner_email],
        subject: subject,
        html:    htmlBody,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error('[notify-partner] Resend error:', errorText);
      return new Response(
        JSON.stringify({ sent: false, error: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Success ──────────────────────────────────────────────────────────────
    return new Response(
      JSON.stringify({ sent: true, to: profile.partner_email }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[notify-partner] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
