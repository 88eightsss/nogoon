// ─── Auth Store ───────────────────────────────────────────────────────────────
//
// Manages the user's login session using Supabase Auth.
// This store handles: signing up, signing in, signing out, and tracking
// whether the user currently has an active session.
//
// The root layout (_layout.tsx) reads `session` from this store to decide
// whether to show the auth screen, onboarding, or the main app.

import { create } from 'zustand';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/useUserStore';

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
  signUp: (email: string, password: string, name: string) => Promise<AuthError | null>;

  // Sign in with existing email + password
  signIn: (email: string, password: string) => Promise<AuthError | null>;

  // Sign out, clear the session, AND wipe local user data
  signOut: () => Promise<void>;
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
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) return error;

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

    return null; // null = success
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
    // 1. Wipe all local user data (points, streak, blocklist, etc.)
    useUserStore.getState().resetStore();

    // 2. Sign out of Supabase (clears the session token from SecureStore)
    await supabase.auth.signOut();

    // 3. Clear the auth state — _layout.tsx will redirect to /auth
    set({ session: null, user: null });
  },
}));
