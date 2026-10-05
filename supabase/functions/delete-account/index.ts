// ─── Delete Account Edge Function ────────────────────────────────────────── //
//
// Permanently deletes the calling user's account and every row tied to it.
// Required by Google Play (in-app account deletion).
//
// The user id comes from the verified JWT, never from the request body, so a
// caller can only ever delete their own account.
//
// Deploy:  supabase functions deploy delete-account
// (SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided
//  to edge functions automatically.)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// Tables that hold per-user rows, and the column that points at the user.
// A table that doesn't exist (yet) is skipped, so this list can be generous.
const USER_TABLES: { table: string; column: string }[] = [
  { table: 'blocklist', column: 'user_id' },
  { table: 'game_sessions', column: 'user_id' },
  { table: 'journal_entries', column: 'user_id' },
  { table: 'profiles', column: 'id' },
];

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Missing or invalid Authorization header' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');

    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!url || !serviceKey) return json({ error: 'Server is not configured' }, 500);

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify the caller's JWT and get their id.
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: 'Invalid session' }, 401);
    const userId = userData.user.id;

    // 1. Delete the user's rows. Errors on a missing table are ignored; any other
    //    failure stops the deletion so we never leave an orphaned half-account.
    for (const { table, column } of USER_TABLES) {
      const { error } = await admin.from(table).delete().eq(column, userId);
      if (error) {
        const missing = error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message);
        if (!missing) {
          console.error(`delete-account: ${table} delete failed`, error);
          return json({ error: `Could not delete ${table} data` }, 500);
        }
      }
    }

    // 2. Delete the auth user itself.
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error('delete-account: auth delete failed', deleteError);
      return json({ error: 'Could not delete the account' }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    console.error('delete-account: unexpected error', e);
    return json({ error: 'Unexpected error' }, 500);
  }
});
