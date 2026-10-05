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
import { NativeModules, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/useUserStore';
import { useModesStore } from '@/stores/useModesStore';
import { useBubblesStore } from '@/stores/useBubblesStore';
import { useProgressStore } from '@/stores/useProgressStore';
import { usePetStore } from '@/stores/usePetStore';

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

  // Permanently deletes the account (server-side) and wipes local data.
  // Resolves to an error message, or null on success.
  deleteAccount: () => Promise<string | null>;

  // Forgot password: sends a 6-digit reset code to the given email
  requestPasswordReset: (email: string) => Promise<AuthError | null>;

  // Confirm password reset: verifies the emailed code, then sets the new password
  confirmPasswordReset: (email: string, code: string, newPassword: string) => Promise<AuthError | null>;
}

// ─── Local wipe ───────────────────────────────────────────────────────────────
// Everything that belongs to the signed-in account and lives on this phone. Used by
// signOut AND by the auth listener, so a session that ends any other way (account
// deleted elsewhere, refresh token revoked) can't leave the previous account's
// points, streak and blocklists behind for the next person to inherit.

let wiping = false;

async function wipeLocal() {
  if (wiping) return;
  wiping = true;
  try {
    const locked =
      useUserStore.getState().isBricked ||
      useUserStore.getState().isColdTurkey ||
      (useUserStore.getState().focusSessionEnd ?? 0) > Date.now();

    useUserStore.getState().resetStore();
    // The wiped lists are gone, so forget which Mode was applied over them. (The
    // Modes themselves are device settings and stay.)
    useModesStore.getState().setApplied(null, null);
    // Other persisted stores keep their state in memory and would simply write it back,
    // so reset them in memory too (private brain-bubble text, pet stats, unlock toasts).
    useBubblesStore.setState(useBubblesStore.getInitialState(), true);
    useProgressStore.setState(useProgressStore.getInitialState(), true);
    usePetStore.setState(usePetStore.getInitialState(), true);

    // The Android service reads its own copy of the lists, which would otherwise keep
    // gating the old account's apps with nobody signed in. A self-imposed lock
    // (Hard Mode, Cold Turkey, Focus Session) is the exception: it keeps enforcing on
    // purpose, so signing out can't be used to get around it.
    const native = NativeModules.AppBlocker;
    if (!locked && Platform.OS === 'android' && native) {
      try {
        await native.setBlockedApps?.([]);
        await native.setBlockedDomains?.([]);
        await native.setModesConfig?.('[]', '');
      } catch (e) {
        console.warn('wipeLocal: clearing native lists failed', e);
      }
    }
    // Scheduled reminders (recap, comeback, daily summary) are about the old account too.
    try { await Notifications.cancelAllScheduledNotificationsAsync(); } catch { /* best effort */ }

    // Companion, nicknames, feed tokens etc. live in their own per-account keys.
    try {
      const loose = [
        'nogoon_start_date', 'nogoon_today_intention', 'nogoon_intention_date',
        'goon_last_shown_milestone', 'goon_last_shown_streak_milestone',
        'nogoon_whatnow_nudge_shown', 'nogoon_organizer_edit_hint_seen',
      ];
      const keys = (await AsyncStorage.getAllKeys()).filter(
        (k) => k.startsWith('@nogoon_') || k.includes('dead-reckoning') || k.includes('dead_reckoning') || loose.includes(k)
      );
      if (keys.length > 0) await AsyncStorage.multiRemove(keys);
    } catch (e) {
      console.warn('wipeLocal: clearing companion keys failed', e);
    }
  } finally {
    wiping = false;
  }
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
      supabase.auth.onAuthStateChange((event, session) => {
        set({ session, user: session?.user ?? null });
        // The session ended without going through signOut() (deleted account, revoked
        // refresh token). Wipe the previous account's data from this phone.
        if (event === 'SIGNED_OUT') void wipeLocal();
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
    // 1. Sign out of Supabase and clear the auth state — _layout.tsx redirects to /auth.
    //    If the server call fails (offline), supabase-js leaves the saved session on
    //    disk and the next launch would sign the user straight back in, so also drop
    //    it locally.
    const { error } = await supabase.auth.signOut();
    if (error) await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    set({ session: null, user: null });

    // 2. THEN wipe all local user data. Doing this first flipped hasOnboarded to false
    //    while the session was still set, which bounced the user to /onboarding for a
    //    moment before /auth.
    await wipeLocal();
  },

  // ── deleteAccount ─────────────────────────────────────────────────────────
  // Calls the `delete-account` edge function (which removes the user's rows and
  // the auth user using the service role), then does a normal sign-out so every
  // local store, key and native list is wiped exactly like a regular sign-out.

  deleteAccount: async () => {
    try {
      const { data, error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
      if (error || (data && (data as { error?: string }).error)) {
        return (data as { error?: string } | null)?.error ?? 'Could not delete your account. Check your connection and try again.';
      }
    } catch {
      return 'Could not delete your account. Check your connection and try again.';
    }
    // The server-side user is gone; signing out may report an invalid session,
    // which is fine — the local session is cleared either way.
    try { await useAuthStore.getState().signOut(); } catch { /* already gone */ }
    return null;
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
    // verifyOtp consumes the single-use code and signs the user in. If the password
    // update then failed (e.g. same as the old one), a retry must not verify again.
    const existing = useAuthStore.getState().session;
    const alreadyVerified = existing?.user?.email?.toLowerCase() === email.trim().toLowerCase();
    if (!alreadyVerified) {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'recovery',
      });
      if (verifyError) return verifyError;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    return updateError ?? null;
  },
}));
