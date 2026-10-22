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

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, AppState } from 'react-native';
import { Stack, router, useSegments, useNavigationContainerRef } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  Anybody_400Regular,
  Anybody_700Bold,
} from '@expo-google-fonts/anybody';
import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
} from '@expo-google-fonts/bricolage-grotesque';
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
import { useTourStore } from '@/stores/useTourStore';
import { useUserStore } from '@/stores/useUserStore';
import { getTodaysBriefing } from '@/lib/dailyGood';
import { initMascots } from '@/services/mascotInit';
import { useThemeStore } from '@/stores/useThemeStore';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
import { requestNotificationPermission, scheduleWeeklyRecap, walkAwaysThisWeek, cancelComebackReminder } from '@/utils/notifications';
import { useAdAppOpen } from '@/components/ads/AdAppOpen';
import { useCloudSync } from '@/hooks/useCloudSync';

// Without a handler Android drops notifications that arrive while the app is open,
// which silenced every celebration (streaks, walk-aways, tokens).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});
import { useNativeSync } from '@/hooks/useNativeSync';
import { useTheme } from '@/hooks/useTheme';
import { AccessibilityDisclosure } from '@/components/AccessibilityDisclosure';
import { isLightColor } from '@/utils/colorLuminance';
import { reportCrash, flushPendingCrash } from '@/lib/crashReport';

// Any uncaught JavaScript error: send an anonymous report (if the person has not turned that off),
// then let React Native's own handler run as before.
const prevGlobalHandler = (globalThis as any).ErrorUtils?.getGlobalHandler?.();
(globalThis as any).ErrorUtils?.setGlobalHandler?.((e: unknown, isFatal?: boolean) => {
  reportCrash('js', e);
  prevGlobalHandler?.(e, isFatal);
});

// ─── Error Boundary ─────────────────────────────────────────────────────────── //
//
// Catches unhandled JS errors anywhere in the component tree and shows a
// recovery screen instead of a white screen crash. Users can tap "Try Again"
// to reload the app.

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  attempt: number;
}

// Module-level so useSyncExternalStore does not resubscribe on every render.
const subscribeTourHydration = (cb: () => void) => useTourStore.persist.onFinishHydration(cb);
const tourHydrated = () => useTourStore.persist.hasHydrated();

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, attempt: 0 };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, attempt: 0 };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[NoGoon] Uncaught error:', error, info.componentStack);
    reportCrash('boundary', Object.assign(new Error(error.message), { stack: `${error.stack ?? ''}\n${info.componentStack ?? ''}` }));
  }

  handleReset = () => {
    this.setState((st) => ({ hasError: false, error: null, attempt: st.attempt + 1 }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <Text style={[errorStyles.emoji, { fontFamily: undefined }]}>!</Text>
          <Text style={errorStyles.title}>Something went wrong</Text>
          <Text style={errorStyles.message}>
            The app hit an unexpected error. Tap Try Again. If it keeps happening, open Profile, then Setup & fixes.
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
    // A new key remounts the whole tree, so Try Again starts clean instead of re-rendering the crash.
    return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>;
  }
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F9F5',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    color: '#1A2E1A',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  message: {
    color: '#4A6741',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  detail: {
    color: '#C62828',
    fontSize: 12,
    fontFamily: 'JetBrainsMono_400Regular',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  button: {
    backgroundColor: '#388E3C',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

// ─── Root Layout ────────────────────────────────────────────────────────────── //

export default function RootLayout() {
  const { colors: themeColors } = useTheme();
  const { session, loading, initialize } = useAuthStore();
  const { hasOnboarded, loadFromSupabase, refreshStreakRestores, checkStreakContinuity } = useUserStore();
  const { initialize: initSubscription } = useSubscriptionStore();

  // Full-screen ad on every app foreground (= every NoGoon intercept)
  useAdAppOpen();

  // On every app open: the comeback reminder is no longer needed.
  useEffect(() => {
    cancelComebackReminder().catch(() => {});
  }, []);

  // Load all custom fonts before any screen renders
  const [fontsLoaded, fontError] = useFonts({
    Anybody_400Regular,
    Anybody_700Bold,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
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

  // The user store is persisted to AsyncStorage and hydrates asynchronously.
  // Until it has, `hasOnboarded` is just its default (false) — routing on that
  // would send a returning user back through onboarding for a moment.
  // The theme store hydrates the same way; without waiting for it the first frame
  // painted the default theme before flipping to the saved one.
  const bothHydrated = () => useUserStore.persist.hasHydrated() && useThemeStore.persist.hasHydrated();
  const [storeHydrated, setStoreHydrated] = useState(bothHydrated);
  useEffect(() => {
    if (bothHydrated()) { setStoreHydrated(true); return; }
    const check = () => { if (bothHydrated()) setStoreHydrated(true); };
    const u1 = useUserStore.persist.onFinishHydration(check);
    const u2 = useThemeStore.persist.onFinishHydration(check);
    return () => { u1(); u2(); };
  }, []);

  // Credit an existing install's walk-aways to its companion, once.
  useEffect(() => { initMascots(); }, []);
  // A crash the app could not report before it closed is sent now (a few seconds after launch).
  useEffect(() => { const t = setTimeout(() => { flushPendingCrash(); }, 4000); return () => clearTimeout(t); }, []);

  // Keep the current route in a ref so the routing effect can look at it
  // without re-running every time the user navigates.
  const segments = useSegments();
  const segmentsRef = useRef<string[]>(segments as string[]);
  segmentsRef.current = segments as string[];

  // Depend on the user's id, not the session object: Supabase hands out a new
  // session object on every token refresh (about hourly), which used to re-fire
  // all of this and yank the user out of whatever screen they were on.
  const userId = session?.user.id;
  // Watchdogs: a stalled network session check, font error or storage read must never leave
  // the app on a blank screen. After a few seconds we go on with what we have.
  const [authTimedOut, setAuthTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAuthTimedOut(true), 6000);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    const t = setTimeout(() => setStoreHydrated(true), 8000);
    return () => clearTimeout(t);
  }, []);
  const ready = (fontsLoaded || !!fontError) && (!loading || authTimedOut) && storeHydrated;

  // A fresh install / new phone starts with hasOnboarded=false even for an account
  // that finished onboarding long ago. Check the cloud once before deciding to
  // send someone through onboarding again.
  const [cloudCheckedFor, setCloudCheckedFor] = useState<string | null>(null);
  useEffect(() => {
    if (!ready || !userId || hasOnboarded || cloudCheckedFor === userId) return;
    let cancelled = false;
    loadFromSupabase(userId).finally(() => { if (!cancelled) setCloudCheckedFor(userId); });
    return () => { cancelled = true; };
  }, [ready, userId, hasOnboarded, cloudCheckedFor, loadFromSupabase]);

  // Routing: auth → onboarding → tabs. Only ever moves the user when they are
  // somewhere they shouldn't be, never when they're already in the right place.
  // In particular it must not touch a gate that the blocker service just
  // launched via deep link (cold start) or a flow in progress.
  // The navigator only exists once this layout has rendered the Stack. Navigating before that
  // throws "Attempted to navigate before mounting the Root Layout" and closes the app, which
  // is what happened when everything else became ready on the very first render.
  // (useRootNavigationState().key is defined from the first render, so it cannot be used for this;
  // the navigation container's own isReady() is the signal router.replace itself checks.)
  const navRef = useNavigationContainerRef();
  const [navReady, setNavReady] = useState(() => navRef.isReady());
  useEffect(() => {
    if (navReady) return;
    if (navRef.isReady()) { setNavReady(true); return; }
    const id = setInterval(() => { if (navRef.isReady()) { setNavReady(true); clearInterval(id); } }, 50);
    return () => clearInterval(id);
  }, [navRef, navReady]);
  useEffect(() => {
    if (!ready || !navReady) return;
    const top = segmentsRef.current[0];

    if (!userId) {
      if (top !== 'auth' && top !== 'forgot-password' && top !== 'reset-password') router.replace('/auth');
    } else if (!hasOnboarded) {
      if (cloudCheckedFor !== userId) return; // still checking the cloud profile
      // reset-password finishes its own password update before moving on.
      if (top !== 'onboarding' && top !== 'reset-password') router.replace('/onboarding');
    } else {
      const inFlow = top === 'gate' || top === 'waiting-room' || top === 'post-game';
      const inApp = top === '(tabs)' || inFlow;
      const onEntryScreen = top === undefined || top === 'auth' || top === 'onboarding' || top === 'index';
      if (!inApp && onEntryScreen) router.replace('/(tabs)');
    }
  }, [ready, navReady, userId, hasOnboarded, cloudCheckedFor]);

  // Once per login / app start (not per token refresh): pull cloud data and set
  // up per-open housekeeping.
  useEffect(() => {
    if (!ready || !userId || !hasOnboarded) return;
    initSubscription(userId);
    // On every app open: reset monthly streak restores + protect streak with freeze tokens
    refreshStreakRestores();
    // Pull the cloud copy FIRST, then run the streak check. The other way round, the
    // cloud merge (max of local and cloud) resurrected a streak the check had just ended.
    loadFromSupabase(userId).finally(() => checkStreakContinuity());
  }, [ready, userId, hasOnboarded]);

  // Ask for notification permission (then schedule the weekly recap) only once the tour has
  // had its turn and the tabs are showing, so two system prompts never stack up on first run.
  const tourOffered = useTourStore((st) => st.offered);
  const tourLoaded = useSyncExternalStore(subscribeTourHydration, tourHydrated, () => false);
  const topSegment = segments[0];
  const askedNotifRef = useRef(false);
  useEffect(() => {
    if (askedNotifRef.current) return;
    if (!ready || !userId || !hasOnboarded || !tourLoaded || !tourOffered || topSegment !== '(tabs)') return;
    let fired = false;
    const t = setTimeout(() => {
      fired = true;
      askedNotifRef.current = true;
      requestNotificationPermission().then((granted) => {
        if (granted) {
          const { dailyWalkAways: dw, streak: st } = useUserStore.getState();
          scheduleWeeklyRecap(walkAwaysThisWeek(dw), st);
        }
      });
    }, 1500);
    return () => { if (!fired) clearTimeout(t); };
  }, [ready, userId, hasOnboarded, tourLoaded, tourOffered, topSegment]);

  // Warm today's briefing as soon as the app is up, so the Briefing tab opens with the full
  // daily feed already loaded instead of a spinner. getTodaysBriefing caches per local day, so
  // this costs one request a day and later calls are instant.
  useEffect(() => {
    if (!ready || !userId || !hasOnboarded) return;
    getTodaysBriefing().catch(() => {});
  }, [ready, userId, hasOnboarded]);

  // Housekeeping that must also happen when the app comes back to the foreground —
  // the process often survives for days, so "on launch" alone isn't enough: finish a
  // pending Hard Mode disable, roll monthly restores, and notice a missed day.
  useEffect(() => {
    if (!ready || !userId || !hasOnboarded) return;
    const run = () => {
      const s = useUserStore.getState();
      s.settleBricked();
      s.refreshStreakRestores();
      s.checkStreakContinuity();
      // Keep the Sunday recap's numbers current (it's scheduled with a fixed body).
      // (Only check — never re-prompt from a foreground event.)
      Notifications.getPermissionsAsync().then(({ status }) => {
        if (status === 'granted') {
          const st = useUserStore.getState();
          scheduleWeeklyRecap(walkAwaysThisWeek(st.dailyWalkAways), st.streak);
        }
      }).catch(() => {});
    };
    run();
    const sub = AppState.addEventListener('change', (next) => { if (next === 'active') run(); });
    return () => sub.remove();
  }, [ready, userId, hasOnboarded]);

  // Push progress (points, XP, streak, walk-aways) up to the cloud as it changes.
  useCloudSync(userId, ready && hasOnboarded);

  // Push blocklist, Modes, curfew and widget stats to the Accessibility Service.
  useNativeSync(ready && !!userId);

  // Show nothing (splash screen stays visible) until fonts + auth are ready
  if (!ready) {
    return null;
  }

  return (
    <ErrorBoundary>
      {/* SafeAreaProvider makes insets available to all child screens */}
      <SafeAreaProvider>
        <StatusBar style={isLightColor(themeColors.background) ? 'dark' : 'light'} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: themeColors.background } }}>
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

          {/* Impulse journal history */}
          <Stack.Screen
            name="customize"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />

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

          {/* The Wall — finite sponsor board, opened on purpose from the Briefing */}
          <Stack.Screen name="wall" options={{ animation: 'slide_from_right' }} />

          {/* Do-it-now timer for the body offers (pushups, stretch, walk, water) */}
          <Stack.Screen name="offer-timer" options={{ animation: 'fade' }} />
          <Stack.Screen name="elsewhere" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="events" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="crash-report" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="setup-help" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="walk" options={{ animation: 'slide_from_right' }} />

          {/* Personal milestones / achievement badges */}
          <Stack.Screen
            name="milestones"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />

          {/* Ad Wall — "what the internet looks like without NoGoon" — kept
              dormant for when the paywall comes back; not currently linked */}
          <Stack.Screen
            name="ad-wall"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />

          {/* Protection Layers — VPN, Notification Filter, App Blocker toggles */}
          <Stack.Screen
            name="protection"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />

          {/* The Waiting Room — 5s pause before unlock */}
          <Stack.Screen
            name="waiting-room"
            options={{
              presentation: 'fullScreenModal',
              animation: 'fade',
              gestureEnabled: false,
            }}
          />

          {/* Dead Reckoning — daily prediction vs actual */}
          <Stack.Screen
            name="dead-reckoning"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />

          {/* Privacy Policy */}
          <Stack.Screen
            name="privacy"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />

          {/* Brain Bubbles canvas */}
          <Stack.Screen
            name="bubbles"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />
        </Stack>
        {/* Play-required disclosure shown before opening Accessibility settings */}
        <AccessibilityDisclosure />
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
