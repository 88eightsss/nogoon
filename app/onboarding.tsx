// ─── Onboarding Screen ────────────────────────────────────────────────────────
//
// Shown once, right after a user creates their account. Walks the user
// through NoGoon in order:
//   1–4. Slides — what NoGoon does, the pause/game/choice loop, the tab
//        layout, and a heads-up that a phone setting comes next. No emoji —
//        Feather icons only (see SLIDES below).
//   5.   Name input + 18+ confirmation
//   6.   Setup step — add blocked sites, enable Accessibility Access
//        (step-by-step instructions), the battery-optimization exemption, and
//        two optional rows (VPN filter, notification listener) for the other
//        two of the "three layers of protection".
//   7.   "Make it yours": four skippable questions (components/onboarding/
//        SetupQuestions.tsx): what to cut back on, hardest time, what replaces
//        the scroll, companion + look. The companion and palette pickers that
//        used to be steps of their own live in the last question.
//
// After the questions, completeOnboarding() is called on the store,
// which sets hasOnboarded = true so this screen never shows again.
//
// Per-tab first-visit explainers (Today/Protect/Arcade/Calm/Me) are a
// separate, later mechanism — see components/PageGuide.tsx — shown once each
// the first time a new user actually lands on that tab.

import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  AppState,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Breathe } from '@/components/Breathe';
import { GateDemo } from '@/components/onboarding/GateDemo';
import { track } from '@/lib/usage';
import { useUserStore } from '@/stores/useUserStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useThemeStore } from '@/stores/useThemeStore';
import { useAppBlocker, appPackagesForDomains } from '@/hooks/useAppBlocker';
import { useVpn } from '@/hooks/useVpn';
import { NETWORK_SHIELD_ENABLED } from '@/constants/features';
import { useNotificationListener } from '@/hooks/useNotificationListener';
import { Glyph } from '@/components/ui/Glyph';
import { useOnboardingStyles } from '@/components/onboarding/onboardingStyles';
import { SetupQuestions } from '@/components/onboarding/SetupQuestions';

// ─── Enable button ───────────────────────────────────────────────────────────
// Every pending setup row gets the same gently-breathing button. Its colors are
// derived from the live theme (accent nudged until it has real contrast on the
// card, text black/white by luminance) so it stays readable on all palettes.
function EnableButton({ label, onPress, disabled, bg, fg, style, textStyle, delay = 0 }: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  bg: string;
  fg: string;
  style: any;
  textStyle: any;
  delay?: number;
}) {
  return (
    <Breathe active={!disabled} delay={delay}>
      <Pressable
        style={[style, { backgroundColor: bg, borderWidth: 1.5, borderColor: fg + '55' }]}
        onPress={onPress}
        disabled={disabled}
      >
        <Text style={[textStyle, { color: fg }]}>{label}</Text>
      </Pressable>
    </Breathe>
  );
}

function BackLink({ onPress, styles, color }: { onPress: () => void; styles: { backRow: object; backLink: object }; color: string }) {
  return (
    <Pressable onPress={onPress} style={styles.backRow} accessibilityRole="button" accessibilityLabel="Back">
      <Feather name="arrow-left" size={15} color={color} />
      <Text style={styles.backLink}>Back</Text>
    </Pressable>
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type FeatherName = React.ComponentProps<typeof Feather>['name'];

// ─── Slide content ────────────────────────────────────────────────────────────
//
// No emoji here on purpose — icons are Feather glyphs so the opening screen
// reads the same on every device/font, and colors always come from the
// slide's own `color` so nothing needs a second lookup at render time.
// Covers, in order: what NoGoon actually does, the pause-game-choice loop it
// replaces doomscrolling with, how the app's five tabs are laid out, and a
// heads-up about the one phone setting that has to be turned on next (the
// full step-by-step for that lives on the setup screen right after this).

type Tone = 'protect' | 'calm' | 'arcade' | 'me';
const SLIDES: { icon: FeatherName; title: string; body: string; tone: Tone }[] = [
  {
    icon: 'shield',
    title: 'Stop the scroll.\nStart something better.',
    body: "When you open a feed you want to quit, NoGoon steps in first with a breath, a quick game or a walk, then lets you choose.",
    tone: 'protect',
  },
  {
    icon: 'refresh-cw',
    title: 'Pause. Play.\nThen choose.',
    body: "A game, a breath or a short walk breaks the urge. Most people walk away. If you still want in, a short wait unlocks it.",
    tone: 'calm',
  },
  {
    icon: 'grid',
    title: 'Also in here',
    body: "Briefing: a short daily news read that ends. Step Out: things to do near you. Today: your pal. Unwind: games and calm. Me: your settings and blocking.",
    tone: 'me',
  },
  {
    icon: 'settings',
    title: 'One setting\nturns it on',
    body: "Next, turn on Accessibility Access in Settings so NoGoon can block app opens. About 30 seconds, and we'll guide every tap.",
    tone: 'arcade',
  },
];

// Suggested sites shown as toggleable chips during setup — all pre-selected
const SITE_SUGGESTIONS = [
  { domain: 'tiktok.com',    name: 'TikTok',     emoji: 'music' },
  { domain: 'instagram.com', name: 'Instagram',  emoji: 'camera' },
  { domain: 'youtube.com',   name: 'YouTube',    emoji: 'play' },
  { domain: 'reddit.com',    name: 'Reddit',     emoji: 'cpu' },
  { domain: 'twitter.com',   name: 'X',          emoji: 'x' },
  { domain: 'facebook.com',  name: 'Facebook',   emoji: 'users' },
  { domain: 'snapchat.com',  name: 'Snapchat',   emoji: 'eye-off' },
  { domain: 'twitch.tv',     name: 'Twitch',     emoji: 'video' },
  { domain: 'pornhub.com',   name: 'Pornhub',    emoji: 'slash' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  // Theme colors, the readable button fill and the shared stylesheet (components/onboarding/onboardingStyles.ts).
  const { c, card, btn, styles } = useOnboardingStyles();
  const { setName, completeOnboarding, addSite, blockedApps, setBlockedApps } = useUserStore();
  const { user } = useAuthStore();
  const {
    openSettings, serviceEnabled, checkServiceStatus, checkBatteryOptimized, openBatterySettings,
    isKnownOemOffender, openOemAutostartSettings, requestNotificationPermission,
  } = useAppBlocker();
  const { isActive: vpnActive, isLoading: vpnLoading, startVpn } = useVpn();
  const {
    isGranted: notifGranted, isFilterEnabled: notifEnabled, isLoading: notifLoading,
    toggleFilter: toggleNotif, openSettings: openNotifSettings,
  } = useNotificationListener();

  // Once Notification Access is granted, turn the filter on automatically —
  // matches the Protection/Coverage screen's own behavior, so a user who
  // does this step here never has to flip the same switch again there.
  useEffect(() => {
    if (notifGranted && !notifEnabled) toggleNotif(true);
  }, [notifGranted, notifEnabled, toggleNotif]);

  // ── Poll for accessibility service status ──────────────────────────────────
  // When the user taps "Enable" they're sent to Android Settings. When they
  // come back to the app we want the checkmark to appear automatically.
  // We poll every 1.5s AND listen to AppState so we check immediately on return.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkServiceStatus();
        checkBatteryOptimized().then((stillOptimized) => setBatteryExempt(!stillOptimized));
      }
    });
    // Also check once on mount, in case the user already exempted NoGoon
    // before reaching this screen (e.g. re-running onboarding after a reinstall).
    checkBatteryOptimized().then((stillOptimized) => setBatteryExempt(!stillOptimized));
    return () => subscription.remove();
  }, [checkServiceStatus, checkBatteryOptimized]);

  // Once the Accessibility Service is confirmed on, ask for POST_NOTIFICATIONS
  // (Android 13+) so the persistent "protection active" notification the
  // service starts is actually visible to the user, not silently suppressed.
  useEffect(() => {
    if (serviceEnabled) {
      requestNotificationPermission();
    }
  }, [serviceEnabled, requestNotificationPermission]);

  const [step, setStep]                   = useState(0);
  const setThemeBrightness = useThemeStore((s) => s.setThemeBrightness);
  // The welcome slides open in the light version; the Dark/Light switch in the last setup
  // question still lets people change it. Runs once, on arrival, for a fresh sign-up.
  useEffect(() => { setThemeBrightness(100); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // The sign-up form already asked for a name — reuse it instead of asking again.
  const knownName = (useUserStore.getState().name || (user?.user_metadata?.name as string | undefined) || '').trim();
  const [name, setNameLocal]              = useState(knownName);
  const [nameError, setNameError]         = useState('');
  const [nameSaved, setNameSaved]         = useState(false);
  // NoGoon is 18+ (Play target audience). Confirmed on the name screen, before anything is saved.
  const [ageConfirmed, setAgeConfirmed]   = useState(false);
  // Accessibility/setup screen done (Continue or Skip for now) → the setup questions.
  const [setupDone, setSetupDone]         = useState(false);
  const [sitesAdded, setSitesAdded]       = useState(false);
  const [batteryExempt, setBatteryExempt] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(
    () => new Set(SITE_SUGGESTIONS.map((s) => s.domain))
  );

  // Slide animation — translates the slide container left/right
  const slideX = useRef(new Animated.Value(0)).current;

  const goNext = () => {
    if (step < SLIDES.length - 1) {
      // Animate to next slide
      Animated.timing(slideX, {
        toValue: -(step + 1) * SCREEN_WIDTH,
        duration: 300,
        useNativeDriver: true,
      }).start();
      setStep(step + 1);
    } else {
      // Move to name input step
      setStep(SLIDES.length);
    }
  };

  const goBack = () => {
    if (step === 0) return;
    if (step <= SLIDES.length - 1) {
      Animated.timing(slideX, {
        toValue: -(step - 1) * SCREEN_WIDTH,
        duration: 300,
        useNativeDriver: true,
      }).start();
      setStep(step - 1);
    } else {
      setStep(SLIDES.length - 1);
    }
  };

  const handleFinish = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Please enter your name.');
      return;
    }
    if (!ageConfirmed) {
      setNameError('Please confirm you are 18 or older.');
      return;
    }
    setNameError('');
    setNameSaved(true);
    AsyncStorage.setItem('@nogoon_age_confirmed', new Date().toISOString()).catch(() => {});

    // Save name to local store. NOTE: completeOnboarding() is deliberately
    // NOT called here — it flips hasOnboarded, which _layout.tsx watches to
    // redirect straight to /(tabs). Calling it this early used to race the
    // setup screen and questions still to come, sometimes bouncing
    // brand-new users into the main app before they ever saw the
    // Accessibility Service setup instructions. It's called once, for real,
    // when the setup screen's "Continue"/"Skip" buttons actually finish
    // onboarding — see handleExitSetup below.
    setName(trimmed);

    // Fire-and-forget Supabase profile name sync
    if (user) {
      import('@/lib/supabase').then(({ supabase }) => {
        // Supabase query builders only run once awaited/then'd — without this the
        // name was never actually sent. Upsert also creates the row if sign-up
        // couldn't (no session until the email was confirmed).
        supabase.from('profiles').upsert({ id: user.id, name: trimmed })
          .then(({ error }) => { if (error) console.warn('profile name sync failed:', error.message); });
      });
    }

    // The setup screen renders next (name is now saved, nameSaved=true).
    // Navigation to /(tabs) happens from the setup screen's Continue button.
  };

  // With a name already on file, move on as soon as the 18+ box is ticked.
  const autoNamedRef = useRef(false);
  useEffect(() => {
    if (!knownName || !ageConfirmed || nameSaved || autoNamedRef.current) return;
    autoNamedRef.current = true;
    handleFinish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameSaved, ageConfirmed]);

  // Adds all selected domains from the chip grid.
  // The chips are named after apps ("TikTok", "Instagram"), and people expect
  // the app itself to be blocked — but the service only matches website domains
  // inside browsers. So also add the matching app packages, otherwise "Blocking
  // active" would be shown while the real app opens freely.
  const handleAddSelected = () => {
    selectedDomains.forEach((domain) => addSite(domain));
    const pkgs = appPackagesForDomains(selectedDomains);
    if (pkgs.length > 0) setBlockedApps(Array.from(new Set([...blockedApps, ...pkgs])));
    setSitesAdded(true);
  };

  // ── Leaving the setup screen ──────────────────────────────────────────────
  // "Continue" applies the site chips the user can see selected (otherwise they landed
  // on "Nothing blocked yet" despite a screen full of ticked chips). "Skip for now"
  // deliberately leaves everything untouched. Both go on to the setup questions.
  const handleContinueSetup = () => {
    if (!sitesAdded && selectedDomains.size > 0) handleAddSelected();
    if (serviceEnabled) track('accessibility_on');
    setSetupDone(true);
  };

  // ── Actually finish onboarding ────────────────────────────────────────────
  // The one place hasOnboarded flips to true: after the setup questions (answered
  // or skipped), so the user has been through the Accessibility instructions first.
  const handleExitSetup = () => {
    track('onboarded');
    completeOnboarding();
    router.replace('/(tabs)');
  };

  // ── Name input step ────────────────────────────────────────────────────────

  if (step === SLIDES.length) {
    // ── Setup questions (after the setup screen) ────────────────────────────
    if (nameSaved && setupDone) {
      return <SetupQuestions onFinish={handleExitSetup} onBack={() => setSetupDone(false)} />;
    }

    // ── Setup step (shown after name is saved) ──────────────────────────────
    if (nameSaved && step === SLIDES.length) {
      if (showDemo) return <GateDemo c={c} btn={btn} onDone={() => setShowDemo(false)} />;
      return (
        <SafeAreaView style={styles.safe}>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.setupScreen}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >

            {/* Title */}
            <Text style={styles.title} accessibilityRole="header">Set it up in{'\n'}30 seconds</Text>
            <Text style={styles.sub}>Turn on blocking first, then pick what to block. The rest is optional.</Text>
            {!serviceEnabled && (
              <Pressable onPress={() => setShowDemo(true)} style={{ alignSelf: 'center' }} accessibilityRole="button">
                <Text style={[styles.setupSkipText, { color: btn.bg }]}>See what it does first (20 seconds)</Text>
              </Pressable>
            )}

            {/* Setup card with action rows */}
            <View style={styles.setupCard}>

              {/* Why first: Android only lets NoGoon block after this, so it leads the setup. */}
              {!serviceEnabled && (
                <View style={styles.whyBox}>
                  <Text style={styles.whyTitle}>Why NoGoon needs Accessibility</Text>
                  {[
                    ['eye', 'To notice the moment you open a blocked app or site, so the pause shows up before it loads.'],
                    ['list', 'It only sees which app is in front and the address bar of your browser, to match the list you choose.'],
                    ['layers', 'To show the gate on top of that app: a breath, a quick game, or a walk with your pal.'],
                    ['lock', 'It never reads what you type, your passwords or messages, and nothing leaves your phone.'],
                    ['toggle-right', 'Android makes you switch it on yourself, and you can switch it off any time in Settings.'],
                  ].map(([icon, text]) => (
                    <View key={text} style={styles.whyRow}>
                      <Feather name={icon as any} size={15} color={c.accentBright} style={{ marginTop: 3 }} />
                      <Text style={styles.whyText}>{text}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Row 2 — Enable accessibility / app blocking */}
              <View style={styles.setupRow}>
                <View style={styles.setupRowLeft}>
                  <View style={styles.setupRowIcon}><Feather name="smartphone" size={20} color={c.accentBright} /></View>
                  <View style={styles.setupRowText}>
                    <Text style={styles.setupRowTitle}>Enable app blocking</Text>
                    <Text style={styles.setupRowSub}>Blocks apps like TikTok</Text>
                  </View>
                </View>

                {/* Turns into a checkmark automatically when permission is granted */}
                {serviceEnabled ? (
                  <Feather name="check-circle" size={28} color={c.success} />
                ) : (
                  <EnableButton delay={0} label="Enable" onPress={openSettings} bg={btn.bg} fg={btn.fg}
                    style={styles.setupEnableButton} textStyle={styles.setupEnableButtonText} />
                )}
              </View>

              {/* Step-by-step instructions — only shown before permission is granted */}
              {!serviceEnabled && (
                <View style={styles.accessibilitySteps}>
                  <Text style={styles.accessibilityStepsTitle}>How to enable:</Text>
                  {[
                    'Tap "Enable" above',
                    'Tap "Installed apps" or scroll to find NoGoon',
                    'Tap NoGoon, then toggle it ON',
                    'Tap "Allow" on the confirmation dialog',
                    'Come back here — the checkmark will appear automatically',
                  ].map((instruction, i) => (
                    <View key={i} style={styles.accessibilityStep}>
                      <Text style={styles.accessibilityStepNum}>{i + 1}</Text>
                      <Text style={styles.accessibilityStepText}>{instruction}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Divider */}
              <View style={styles.setupDivider} />

              {/* Row 1 — Block sites */}
              <View style={styles.setupRow}>
                <View style={styles.setupRowLeft}>
                  <View style={styles.setupRowIcon}><Feather name="shield" size={20} color={c.accentBright} /></View>
                  <View style={styles.setupRowText}>
                    <Text style={styles.setupRowTitle}>Block sites</Text>
                    <Text style={styles.setupRowSub}>
                      {sitesAdded
                        ? `${selectedDomains.size} site${selectedDomains.size === 1 ? '' : 's'} blocked`
                        : 'Pick the ones that get you'}
                    </Text>
                  </View>
                </View>
                {sitesAdded && <Feather name="check-circle" size={28} color={c.success} />}
              </View>

              {/* Chip grid — shown before sites are added */}
              {!sitesAdded && (
                <View style={styles.chipSection}>
                  <View style={styles.chipGrid}>
                    {SITE_SUGGESTIONS.map(({ domain, name, emoji }) => {
                      const selected = selectedDomains.has(domain);
                      return (
                        <Pressable
                          key={domain}
                          style={[styles.chip, selected && { borderColor: btn.bg, backgroundColor: btn.bg + '22' }]}
                          onPress={() =>
                            setSelectedDomains((prev) => {
                              const next = new Set(prev);
                              if (next.has(domain)) next.delete(domain);
                              else next.add(domain);
                              return next;
                            })
                          }
                        >
                          <Glyph name={emoji} size={15} color={selected ? btn.bg : c.textSecondary} />
                          <Text style={[styles.chipName, selected && { color: btn.bg }]}>
                            {name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Pressable
                    style={[styles.chipAddBtn, { backgroundColor: btn.bg }, selectedDomains.size === 0 && { opacity: 0.4 }]}
                    disabled={selectedDomains.size === 0}
                    onPress={handleAddSelected}
                  >
                    <Text style={[styles.chipAddBtnText, { color: btn.fg }]}>
                      Block {selectedDomains.size} site{selectedDomains.size === 1 ? '' : 's'}
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* Divider */}
              <View style={styles.setupDivider} />

              {/* Row 3 — Battery optimization exemption */}
              <View style={styles.setupRow}>
                <View style={styles.setupRowLeft}>
                  <View style={styles.setupRowIcon}><Feather name="zap" size={20} color={c.accentBright} /></View>
                  <View style={styles.setupRowText}>
                    <Text style={styles.setupRowTitle}>Keep NoGoon always on</Text>
                    <Text style={styles.setupRowSub}>Recommended — stops Android from turning it off</Text>
                  </View>
                </View>

                {batteryExempt ? (
                  <Feather name="check-circle" size={28} color={c.success} />
                ) : (
                  <EnableButton delay={450} label="Enable" bg={btn.bg} fg={btn.fg}
                    style={styles.setupEnableButton} textStyle={styles.setupEnableButtonText}
                    onPress={() => {
                      // Opens the real exemption dialog (native module, with an
                      // expo-intent-launcher fallback baked into the hook).
                      // We don't assume success here — the AppState listener
                      // above re-checks checkBatteryOptimized() the moment the
                      // user comes back, so the checkmark only appears once
                      // Android confirms the exemption actually took.
                      openBatterySettings();
                    }} />
                )}
              </View>

              <View style={styles.setupDivider} />

              {/* Extra layers stay out of the first screen: three permission asks in a row feels like a
                  gauntlet. They live behind one tap and are also in Me > Protection. */}
              <Pressable onPress={() => setShowMore((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: showMore }} style={styles.setupRow}>
                <View style={styles.setupRowLeft}>
                  <View style={styles.setupRowIcon}><Feather name={showMore ? 'chevron-up' : 'chevron-down'} size={20} color={c.accentBright} /></View>
                  <View style={styles.setupRowText}>
                    <Text style={styles.setupRowTitle}>More protection (optional)</Text>
                    <Text style={styles.setupRowSub}>Network and notification filters. You can add these any time.</Text>
                  </View>
                </View>
              </Pressable>
              {showMore && (
              <>
              {NETWORK_SHIELD_ENABLED && (
              <>
              {/* Row 4 — VPN filter (network-level layer). Optional: full
                  protection works without it, but it catches things the
                  Accessibility Service alone can miss (in-app browser tabs,
                  background requests). Previously this only ever got
                  mentioned in the separate auto-tutorial, several screens
                  after onboarding, with no link back to actually enable it. */}
              <View style={styles.setupRow}>
                <View style={styles.setupRowLeft}>
                  <View style={styles.setupRowIcon}><Feather name="globe" size={20} color={c.accentBright} /></View>
                  <View style={styles.setupRowText}>
                    <Text style={styles.setupRowTitle}>Network filter</Text>
                    <Text style={styles.setupRowSub}>Optional — catches blocked sites at the network level too</Text>
                  </View>
                </View>
                {vpnActive ? (
                  <Feather name="check-circle" size={28} color={c.success} />
                ) : (
                  <EnableButton delay={900} label={vpnLoading ? '…' : 'Enable'} onPress={startVpn} disabled={vpnLoading}
                    bg={btn.bg} fg={btn.fg} style={styles.setupEnableButton} textStyle={styles.setupEnableButtonText} />
                )}
              </View>

              <View style={styles.setupDivider} />
              </>
              )}

              {/* Row 5 — Notification listener (push-level layer). Also optional —
                  filters distracting notifications from blocked apps/sites. */}
              <View style={styles.setupRow}>
                <View style={styles.setupRowLeft}>
                  <View style={styles.setupRowIcon}><Feather name="bell-off" size={20} color={c.accentBright} /></View>
                  <View style={styles.setupRowText}>
                    <Text style={styles.setupRowTitle}>Notification filter</Text>
                    <Text style={styles.setupRowSub}>Optional — quiets notifications from blocked apps</Text>
                  </View>
                </View>
                {notifGranted && notifEnabled ? (
                  <Feather name="check-circle" size={28} color={c.success} />
                ) : (
                  <EnableButton delay={1350} label={notifLoading ? '…' : 'Enable'}
                    onPress={() => (notifGranted ? toggleNotif(true) : openNotifSettings())} disabled={notifLoading}
                    bg={btn.bg} fg={btn.fg} style={styles.setupEnableButton} textStyle={styles.setupEnableButtonText} />
                )}
              </View>

              </>
              )}

              {/* Row 6 — OEM autostart/battery manager. Only shown on manufacturers
                  known to run a second, separate killer on top of Android's own —
                  no checkmark here since there's no way to verify the setting. */}
              {isKnownOemOffender && (
                <>
                  <View style={styles.setupDivider} />
                  <View style={styles.setupRow}>
                    <View style={styles.setupRowLeft}>
                      <Feather name="alert-triangle" size={20} color={c.textSecondary} />
                      <View style={styles.setupRowText}>
                        <Text style={styles.setupRowTitle}>Check your phone's battery manager</Text>
                        <Text style={styles.setupRowSub}>Your device brand has its own, separate from Android's. Also try locking NoGoon in your recent apps.</Text>
                      </View>
                    </View>
                    <EnableButton delay={1800} label="Open" onPress={openOemAutostartSettings}
                      bg={btn.bg} fg={btn.fg} style={styles.setupEnableButton} textStyle={styles.setupEnableButtonText} />
                  </View>
                </>
              )}

            </View>

            {/* Continue button — moves into the main app. This is where
                onboarding actually completes (see handleExitSetup above). */}
            <Pressable
              style={styles.primary}
              onPress={handleContinueSetup}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>Continue to NoGoon</Text>
            </Pressable>

            {/* Skip link for users who want to configure later — still
                counts as "done" so they land on the main app, not back here. */}
            <Pressable onPress={() => setSetupDone(true)} accessibilityRole="button">
              <Text style={styles.setupSkipText}>Skip for now</Text>
            </Pressable>

          </ScrollView>
        </SafeAreaView>
      );
    }

    // ── Name input screen (shown before name is saved) ──────────────────────

    return (
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView contentContainerStyle={styles.nameScreen} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.iconBubble}><Feather name="user" size={30} color={c.accentBright} /></View>
            <Text style={styles.title} accessibilityRole="header">What should{'\n'}we call you?</Text>
            <Text style={styles.sub}>
              This shows on your profile and streak badges.
            </Text>

            <TextInput
              style={[styles.nameInput, nameError ? styles.nameInputError : null]}
              placeholder="Your first name"
              accessibilityLabel="Your first name"
              placeholderTextColor={c.textMuted}
              value={name}
              onChangeText={(t) => { setNameLocal(t); setNameError(''); }}
              autoCapitalize="words"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleFinish}
            />

            <Pressable
              style={styles.ageRow}
              onPress={() => { setAgeConfirmed((v) => !v); setNameError(''); }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: ageConfirmed }}
            >
              <Feather
                name={ageConfirmed ? 'check-square' : 'square'}
                size={22}
                color={ageConfirmed ? c.success : c.textMuted}
              />
              <Text style={styles.ageText}>I am 18 or older.</Text>
            </Pressable>

            {nameError ? (
              <Text style={styles.nameErrorText}>{nameError}</Text>
            ) : null}

            <Pressable style={[styles.primary, !ageConfirmed && { opacity: 0.5 }]} onPress={handleFinish} accessibilityRole="button" accessibilityLabel="Let's go">
              <Text style={styles.primaryText}>Let's go</Text>
            </Pressable>

            <BackLink onPress={goBack} styles={styles} color={c.textMuted} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Slides ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.flex}>

        {/* Skip — straight to the name step; setup (and the Accessibility
            instructions) still happens later, so nothing essential is skipped. */}
        {step < SLIDES.length - 1 && (
          <Pressable style={styles.skipButton} onPress={() => {
            // Park the slide strip on the last slide so "Back" from the
            // name screen lands on a slide that matches the step.
            slideX.setValue(-(SLIDES.length - 1) * SCREEN_WIDTH);
            setStep(SLIDES.length);
          }} hitSlop={10} accessibilityRole="button" accessibilityLabel="Skip intro">
            <Text style={styles.skipButtonText}>Skip</Text>
          </Pressable>
        )}

        {/* Slide container — all slides side by side, animated left/right */}
        <View style={styles.slidesWrapper}>
          <Animated.View
            style={[
              styles.slidesRow,
              { width: SCREEN_WIDTH * SLIDES.length, transform: [{ translateX: slideX }] },
            ]}
          >
            {SLIDES.map((slide, i) => (
              <View key={i} style={[styles.slide, { width: SCREEN_WIDTH }]}>
                <View style={[styles.slideIconWrap, { backgroundColor: c[slide.tone] + '22', borderWidth: card.borderWidth, borderColor: c[slide.tone] + '55' }]}>
                  <Feather name={slide.icon} size={42} color={c[slide.tone]} />
                </View>
                <Text style={styles.slideTitle} accessibilityRole="header">
                  {slide.title}
                </Text>
                <Text style={styles.slideBody}>{slide.body}</Text>
              </View>
            ))}
          </Animated.View>
        </View>

        {/* Dot indicators */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === step && styles.dotActive,
              ]}
            />
          ))}
        </View>

        {/* Navigation buttons */}
        <View style={styles.nav}>
          {step > 0 ? (
            <Pressable style={styles.backButton} onPress={goBack} accessibilityRole="button" accessibilityLabel="Back">
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
          ) : (
            <View style={styles.backButton} /> // spacer
          )}

          <Pressable style={styles.nextButton} onPress={goNext} accessibilityRole="button">
            <Text style={styles.nextButtonText}>
              {step === SLIDES.length - 1 ? "Let's start" : 'Next'}
            </Text>
          </Pressable>
        </View>

      </View>
    </SafeAreaView>
  );
}
