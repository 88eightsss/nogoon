// ─── Auth Store ───────────────────────────────────────────────────────────────
//
// Manages the user's login session using Supabase Auth.
// This store handles: signing up, signing in, signing out, and tracking
// whether the user currently has an active session.
//
// The root layout (_layout.tsx) reads `session` from this store to decide
// whether to show the auth screen, onboarding, or the main app.

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/useUserStore';
import { useModesStore } from '@/stores/useModesStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthState {
  // The active Supabase session (null = not logged in)
  session: Session | null;

  // The current user object (null = not logged in)
  user: User | null;

  // True while we're waiting for Supabase to confirm the session on startup
  loading: boolean;

  // ── Actions ──
  // Initialize: checks Supabase for an existing session (called on app start)
  initialize: () => Promise<void>;

  // Sign up with email + password, then create a profile row
  // `needsConfirmation` is true when the account was created but Supabase wants
  // the email confirmed first, so no session exists yet.
  signUp: (email: string, password: string, name: string) => Promise<{ error: AuthError | null; needsConfirmation: boolean }>;

  // Sign in with existing email + password
  signIn: (email: string, password: string) => Promise<AuthError | null>;

  // Sign out, clear the session, AND wipe local user data
  signOut: () => Promise<void>;

  // Forgot password: sends a 6-digit reset code to the given email
  requestPasswordReset: (email: string) => Promise<AuthError | null>;

  // Confirm password reset: verifies the emailed code, then sets the new password
  confirmPasswordReset: (email: string, code: string, newPassword: string) => Promise<AuthError | null>;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  loading: true,

  // ── initialize ────────────────────────────────────────────────────────────
  // Called once in _layout.tsx on app startup.
  // Checks if a saved session exists (from a previous launch) and restores it.
  // Also sets up a listener so the store stays in sync if the session changes
  // (e.g., token expiry, sign out from another device).

  initialize: async () => {
    try {
      // Get the current session from SecureStore (persisted by Supabase client).
      // Wrapped in try/catch so a network error or bad credentials don't crash
      // the app — we just treat it as "not logged in" and show the auth screen.
      const { data: { session } } = await supabase.auth.getSession();
      set({ session, user: session?.user ?? null, loading: false });

      // Listen for future session changes (sign in, sign out, token refresh)
      supabase.auth.onAuthStateChange((_event, session) => {
        set({ session, user: session?.user ?? null });
      });
    } catch (e) {
      // Network failure or unconfigured Supabase keys — treat as logged out
      console.warn('Supabase init failed (check your URL + anon key in lib/supabase.ts):', e);
      set({ session: null, user: null, loading: false });
    }
  },

  // ── signUp ────────────────────────────────────────────────────────────────
  // Creates a Supabase auth account, then inserts a row in the `profiles` table
  // with the user's chosen name and zeroed-out stats.

  signUp: async (email, password, name) => {
    // The name also rides along as auth metadata so onboarding can reuse it even if
    // the profile row below can't be written yet (no session until email is confirmed).
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });

    if (error) return { error, needsConfirmation: false };

    // Create the profile row — this is the user's game data record
    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        name,
        points: 0,
        xp: 0,
        streak: 0,
        longest_streak: 0,
        games_played: 0,
      });
    }

    return { error: null, needsConfirmation: !data.session };
  },

  // ── signIn ────────────────────────────────────────────────────────────────

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ?? null;
  },

  // ── signOut ───────────────────────────────────────────────────────────────
  // Signs out of Supabase AND clears all local user data from the device.
  // This ensures the next person who logs in on the same phone gets a clean slate —
  // they won't see the previous user's streak, points, or blocklist.

  signOut: async () => {
    // 1. Sign out of Supabase (clears the session token from SecureStore) and
    //    clear the auth state — _layout.tsx redirects to /auth.
    await supabase.auth.signOut();
    set({ session: null, user: null });

    // 2. THEN wipe all local user data (points, streak, blocklist, etc.).
    //    Doing this first flipped hasOnboarded to false while the session was
    //    still set, which bounced the user to /onboarding for a moment before
    //    /auth. With the session already gone, the redirect is straight to /auth.
    useUserStore.getState().resetStore();
    // The wiped lists are gone, so forget which Mode was applied over them. (The
    // Modes themselves are device settings and stay.)
    useModesStore.getState().setApplied(null, null);
    // Companion, nicknames, feed tokens etc. live in their own per-account keys;
    // clear them so the next account on this phone doesn't inherit them.
    try {
      const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('@nogoon_'));
      if (keys.length > 0) await AsyncStorage.multiRemove(keys);
    } catch (e) {
      console.warn('signOut: clearing companion keys failed', e);
    }
  },

  // ── requestPasswordReset ──────────────────────────────────────────────────
  // Sends a 6-digit recovery code to the user's email via Supabase Auth.
  // The code is entered on the next screen along with the new password.

  requestPasswordReset: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return error ?? null;
  },

  // ── confirmPasswordReset ──────────────────────────────────────────────────
  // Verifies the emailed code (which logs the user in via a recovery session),
  // then immediately updates their password to the new one they chose.

  confirmPasswordReset: async (email, code, newPassword) => {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'recovery',
    });
    if (verifyError) return verifyError;

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    return updateError ?? null;
  },
}));
