// ─── Root Layout ────────────────────────────────────────────────────────────── //
//
// Wraps every screen in the app. Does three things:
//
//   1. Loads custom fonts (Anybody, DM Sans, JetBrains Mono)
//   2. Initializes Supabase auth and watches for session changes
//   3. Routes the user to the right screen based on their state:
//        No session       → /auth       (sign in / sign up)
//        Session, no onboarding → /onboarding (first launch only)
//        Session + onboarded   → /(tabs)     (the main app)
//
// The SafeAreaProvider here wraps everything so any screen can use
// useSafeAreaInsets() to avoid the phone's notch and gesture bars.

import React, { useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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

// ─── Error Boundary ─────────────────────────────────────────────────────────── //
//
// Catches unhandled JS errors anywhere in the component tree and shows a
// recovery screen instead of a white screen crash. Users can tap "Try Again"
// to reload the app.

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to console for debugging — swap with a crash reporter later
    console.error('[NoGoon] Uncaught error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.emoji}>😵</Text>
          <Text style={errorStyles.title}>Something went wrong</Text>
          <Text style={errorStyles.message}>
            The app hit an unexpected error. This has been logged.
          </Text>
          {__DEV__ && this.state.error && (
            <Text style={errorStyles.detail}>
              {this.state.error.message}
            </Text>
          )}
          <TouchableOpacity
            style={errorStyles.button}
            onPress={this.handleReset}
          >
            <Text style={errorStyles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  message: {
    color: '#888888',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  detail: {
    color: '#FF69B4',
    fontSize: 12,
    fontFamily: 'JetBrainsMono_400Regular',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  button: {
    backgroundColor: '#FF69B4',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  buttonText: {
    color: '#0A0A0A',
    fontSize: 16,
    fontWeight: '700',
  },
});

// ─── Root Layout ────────────────────────────────────────────────────────────── //

export default function RootLayout() {
  const { session, loading, initialize } = useAuthStore();
  const { hasOnboarded, loadFromSupabase } = useUserStore();
  const { initialize: initSubscription } = useSubscriptionStore();

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
  }, [initialize]);

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
    <ErrorBoundary>
      {/* SafeAreaProvider makes insets available to all child screens */}
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

          {/* Setup guide — re-enable Accessibility Service from home screen */}
          <Stack.Screen
            name="setup-guide"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />
        </Stack>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
