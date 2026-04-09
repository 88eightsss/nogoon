// ─── Supabase Client ──────────────────────────────────────────────────────────
//
// This file creates the single Supabase client that the entire app uses.
// Supabase handles user accounts, database (profiles, blocklist, game sessions),
// and authentication (sign in / sign up).
//
// HOW TO SET THIS UP:
//   1. Go to supabase.com → New Project
//   2. After it's created, go to Settings → API
//   3. Copy "Project URL" → paste as SUPABASE_URL below
//   4. Copy "anon public" key → paste as SUPABASE_ANON_KEY below
//
// The anon key is safe to ship in the app — Supabase's Row Level Security (RLS)
// policies ensure users can only read/write their own data.

import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// ─── YOUR SUPABASE CREDENTIALS ────────────────────────────────────────────────
// Get these from: supabase.com → your project → Settings → API
//
//   SUPABASE_URL      = the "Project URL"   (looks like https://abc123.supabase.co)
//   SUPABASE_ANON_KEY = the "anon public"   (long string starting with eyJ...)
//
// ⚠️  PASTE YOUR VALUES BELOW — the app won't connect to Supabase until you do.

const SUPABASE_URL      = 'https://hadcagughbyouagwpdhq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhZGNhZ3VnaGJ5b3VhZ3dwZGhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1ODkwNDcsImV4cCI6MjA5MTE2NTA0N30.mymHV-dateubiZ_VT_ZEe_a3pUIk23uoqqXCcMZqIR4';

// ─── SecureStore adapter ──────────────────────────────────────────────────────
// Supabase needs somewhere to store the user's session token between app launches.
// We use expo-secure-store (encrypted on-device storage) instead of AsyncStorage
// because it's more secure for auth tokens.

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

// ─── The client ───────────────────────────────────────────────────────────────

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,     // keeps the user logged in
    persistSession: true,        // saves the session to SecureStore
    detectSessionInUrl: false,   // not a web app, so we don't use URL-based sessions
  },
});
