// ─── Root Layout ──────────────────────────────────────────────────────────────
//
// Wraps every screen in the app. Does three things:
//
//   1. Loads custom fonts (Anybody, DM Sans, JetBrains Mono)
//   2. Initializes Supabase auth and watches for session changes
//   3. Routes the user to the right screen based on their state:
//        No session  → /auth (sign in / sign up)
//        Session, no onboarding → /onboarding (first launch only)
//        Session + onboarded → /(tabs) (the main app)
//
// The SafeAreaProvider here wraps everything so any screen can use
// useSafeAreaInsets() to avoid the phone's notch and gesture bars.

import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  Anybody_400Regular,
  Anybody_700Bold,
} from '@expo-google-fonts/anybody';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';

import { useAuthStore } from '@/stores/useAuthStore';
import { useUserStore } from '@/stores/useUserStore';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';

export default function RootLayout() {
  const { session, loading, initialize } = useAuthStore();
  const { hasOnboarded, loadFromSupabase } = useUserStore();
  const { initialize: initSubscription }   = useSubscriptionStore();

  // Load all custom fonts before any screen renders
  const [fontsLoaded] = useFonts({
    Anybody_400Regular,
    Anybody_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_700Bold,
  });

  // On app startup: check if a saved session exists
  useEffect(() => {
    initialize();
  }, []);

  // Once auth is resolved and fonts are loaded, redirect to the right screen.
  // This effect re-runs whenever session changes (login, logout).
  useEffect(() => {
    if (!fontsLoaded || loading) return;

    if (!session) {
      // Not logged in → show auth screen
      router.replace('/auth');
    } else if (!hasOnboarded) {
      // Logged in but first launch → show onboarding
      router.replace('/onboarding');
    } else {
      // Fully set up → main app
      // Sync Supabase data and initialize subscription status in parallel
      loadFromSupabase(session.user.id);
      initSubscription(session.user.id);
      router.replace('/(tabs)');
    }
  }, [fontsLoaded, loading, session, hasOnboarded]);

  // Show nothing (splash screen stays visible) until fonts + auth are ready
  if (!fontsLoaded || loading) {
    return null;
  }

  return (
    // SafeAreaProvider makes insets available to all child screens
    <SafeAreaProvider>
      <StatusBar style="light" />

      <Stack screenOptions={{ headerShown: false }}>
        {/* Auth + onboarding — no tab bar */}
        <Stack.Screen name="auth" />
        <Stack.Screen name="onboarding" />

        {/* Main app — tab bar lives here */}
        <Stack.Screen name="(tabs)" />

        {/* Gate Trigger — slides up from the bottom like an urgent alert */}
        <Stack.Screen
          name="gate"
          options={{
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
          }}
        />

        {/* Post-Game Decision — fades in after the game completes */}
        <Stack.Screen
          name="post-game"
          options={{
            presentation: 'fullScreenModal',
            animation: 'fade',
            gestureEnabled: false,
          }}
        />

        {/* Paywall — slides up when the user taps upgrade */}
        <Stack.Screen
          name="paywall"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />

        {/* Accountability Partner setup (Pro only) */}
        <Stack.Screen
          name="partner"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />

        {/* Impulse journal history */}
        <Stack.Screen
          name="journal"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />

        {/* Weekly insights (Pro only) */}
        <Stack.Screen
          name="insights"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
