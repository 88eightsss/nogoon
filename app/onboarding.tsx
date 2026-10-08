// ─── Onboarding Screen ────────────────────────────────────────────────────────
//
// Shown once, right after a user creates their account. Walks the user
// through NoGoon in order:
//   1–4. Slides — what NoGoon does, the pause/game/choice loop, the tab
//        layout, and a heads-up that a phone setting comes next. No emoji —
//        Feather icons only (see SLIDES below).
//   5.   Palette pick (6 themes; applied immediately, changeable in Me)
//   5b.  Name input (personalises the experience)
//   6.   Companion pick
//   7.   Setup step — add blocked sites, enable Accessibility Access
//        (step-by-step instructions), the battery-optimization exemption, and
//        two optional rows (VPN filter, notification listener) for the other
//        two of the "three layers of protection" — previously these were
//        only ever mentioned in the separate auto-tutorial, with no link
//        back to where to actually turn them on.
//
// After completing, completeOnboarding() is called on the store,
// which sets hasOnboarded = true so this screen never shows again.
//
// Per-tab first-visit explainers (Today/Protect/Arcade/Calm/Me) are a
// separate, later mechanism — see components/PageGuide.tsx — shown once each
// the first time a new user actually lands on that tab.

import { useState, useRef, useEffect, useMemo } from 'react';
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
import { useUserStore } from '@/stores/useUserStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useThemeStore } from '@/stores/useThemeStore';
import { THEMES, THEME_ORDER } from '@/constants/Themes';
import { useAppBlocker, appPackagesForDomains } from '@/hooks/useAppBlocker';
import { useVpn } from '@/hooks/useVpn';
import { NETWORK_SHIELD_ENABLED } from '@/constants/features';
import { useNotificationListener } from '@/hooks/useNotificationListener';
import { COLORS as SLIDE_COLORS, FONTS } from '@/constants/Colors';
import { useThemedColors, type ArcadeColors } from '@/hooks/useThemedColors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { GoonSprite, CHAR_COLORS } from '@/components/home/GoonMascot';
import type { CharacterId } from '@/stores/usePetStore';

const COMPANION_NAMES: Record<CharacterId, string> = { 0: 'Buddy', 1: 'Nova', 2: 'Rex' };
const COMPANION_TAGS: Record<CharacterId, string> = {
  0: 'Friendly · Grows with you',
  1: 'Cosmic · Floats above it all',
  2: 'Bold · Dragon energy',
};

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

const SLIDES: { icon: FeatherName; title: string; body: string; color: string }[] = [
  {
    icon: 'shield',
    title: 'NoGoon blocks the\napps that pull you in',
    body: "Open a blocked app and NoGoon steps in before the scroll starts. No willpower needed.",
    color: SLIDE_COLORS.green,
  },
  {
    icon: 'refresh-cw',
    title: 'Pause. Play.\nThen choose.',
    body: "A quick game breaks the urge. Most people walk away. If you still want in, a short wait unlocks it.",
    color: SLIDE_COLORS.purple,
  },
  {
    icon: 'grid',
    title: 'Five tabs,\none home',
    body: "Protect, Calm, Today, Arcade and Me. Each one explains itself the first time you open it.",
    color: SLIDE_COLORS.cyan,
  },
  {
    icon: 'settings',
    title: 'One setting\nturns it on',
    body: "Next, turn on Accessibility Access in Settings so NoGoon can block app opens. About 30 seconds, and we'll guide every tap.",
    color: SLIDE_COLORS.arcade,
  },
];

// Suggested sites shown as toggleable chips during setup — all pre-selected
const SITE_SUGGESTIONS = [
  { domain: 'tiktok.com',    name: 'TikTok',     emoji: '🎵' },
  { domain: 'instagram.com', name: 'Instagram',  emoji: '📸' },
  { domain: 'youtube.com',   name: 'YouTube',    emoji: '▶️' },
  { domain: 'reddit.com',    name: 'Reddit',     emoji: '🤖' },
  { domain: 'twitter.com',   name: 'X',          emoji: '𝕏' },
  { domain: 'facebook.com',  name: 'Facebook',   emoji: '👥' },
  { domain: 'snapchat.com',  name: 'Snapchat',   emoji: '👻' },
  { domain: 'twitch.tv',     name: 'Twitch',     emoji: '🟣' },
  { domain: 'pornhub.com',   name: 'Pornhub',    emoji: '🔞' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const COLORS = useThemedColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
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
  const { themeId, setTheme, setThemeBrightness } = useThemeStore();
  // The palette cards preview each theme in its native look (Forest/Mocha are
  // light, the rest dark), but the app renders whatever the brightness dial
  // says — which defaults to Dark. Without syncing the dial, picking a light
  // card gave the user that theme's DARK variant, i.e. not what they picked.
  const applyPalette = (id: (typeof THEME_ORDER)[number]) => {
    setTheme(id);
    setThemeBrightness(THEMES[id].nativeMode === 'light' ? 100 : 0);
  };
  const [palettePicked, setPalettePicked] = useState(false);
  // The sign-up form already asked for a name — reuse it instead of asking again.
  const knownName = (useUserStore.getState().name || (user?.user_metadata?.name as string | undefined) || '').trim();
  const [name, setNameLocal]              = useState(knownName);
  const [nameError, setNameError]         = useState('');
  const [nameSaved, setNameSaved]         = useState(false);
  const [companionPicked, setCompanionPicked] = useState(false);
  const [selectedChar, setSelectedChar]   = useState<CharacterId | null>(null);
  const [companionName, setCompanionName] = useState('');
  const [sitesAdded, setSitesAdded]       = useState(false);
  const [batteryExempt, setBatteryExempt] = useState(false);
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
    } else if (palettePicked && !nameSaved) {
      // Name screen → back to the palette (not past it, to the last slide).
      setPalettePicked(false);
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
    setNameError('');
    setNameSaved(true);

    // Save name to local store. NOTE: completeOnboarding() is deliberately
    // NOT called here — it flips hasOnboarded, which _layout.tsx watches to
    // redirect straight to /(tabs). Calling it this early used to race the
    // companion-picker and setup screens still to come, sometimes bouncing
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

  // With a name already on file, skip the name screen once the palette is chosen.
  const autoNamedRef = useRef(false);
  useEffect(() => {
    if (!knownName || !palettePicked || nameSaved || autoNamedRef.current) return;
    autoNamedRef.current = true;
    handleFinish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palettePicked, nameSaved]);

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

  // ── Companion picker — save choice to AsyncStorage ────────────────────────

  const handlePickCompanion = async () => {
    if (selectedChar === null) return;
    const nameToSave = companionName.trim() || COMPANION_NAMES[selectedChar];
    await AsyncStorage.setItem('@nogoon_goon_character', String(selectedChar));
    await AsyncStorage.setItem(`@nogoon_pet_name_${selectedChar}`, nameToSave);
    setCompanionPicked(true);
  };

  // ── Actually finish onboarding ────────────────────────────────────────────
  // The one place hasOnboarded flips to true — from the setup screen's
  // "Continue" and "Skip for now" actions, once the user has been through
  // (or deliberately skipped) the companion pick and the Accessibility
  // Service instructions, not just the name step.
  // "Continue" applies the site chips the user can see selected (otherwise they landed
  // on "Nothing blocked yet" despite a screen full of ticked chips). "Skip for now"
  // deliberately leaves everything untouched.
  const handleContinueSetup = () => {
    if (!sitesAdded && selectedDomains.size > 0) handleAddSelected();
    handleExitSetup();
  };

  const handleExitSetup = () => {
    completeOnboarding();
    router.replace('/(tabs)');
  };

  // ── Name input step ────────────────────────────────────────────────────────

  if (step === SLIDES.length) {
    // ── Palette pick (after the slides, before the name input) ──────────────
    // Tapping a card applies the theme immediately (persisted by the theme
    // store), so the choice sticks even if the user force-quits mid-onboarding.
    // It can always be changed later under Me → Theme.
    if (!palettePicked) {
      return (
        <SafeAreaView style={styles.safe}>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.paletteScreen}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.paletteTitle}>Pick your{'\n'}palette</Text>
            <Text style={styles.paletteSub}>
              Choose the look that feels right. You can change it any time in Me.
            </Text>

            <View style={styles.paletteGrid}>
              {THEME_ORDER.map((id) => {
                const triad = THEMES[id];
                const pal = triad[triad.nativeMode];
                const active = id === themeId;
                return (
                  <Pressable
                    key={id}
                    style={[
                      styles.paletteCard,
                      { backgroundColor: pal.background, borderColor: active ? pal.accent : pal.surfaceHigh },
                      active && { borderWidth: 3 },
                    ]}
                    onPress={() => applyPalette(id)}
                  >
                    <View style={[styles.paletteSurface, { backgroundColor: pal.surface }]}>
                      <View style={[styles.paletteBar, { backgroundColor: pal.accent }]} />
                      <View style={styles.paletteDots}>
                        {[pal.protect, pal.calm, pal.arcade, pal.me].map((c, i) => (
                          <View key={i} style={[styles.paletteDot, { backgroundColor: c }]} />
                        ))}
                      </View>
                    </View>
                    <Text style={[styles.paletteName, { color: pal.text }]}>{triad.name}</Text>
                    {active && (
                      <View style={[styles.paletteCheck, { backgroundColor: pal.accent }]}>
                        <Feather name="check" size={12} color={pal.background} />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>

            <Pressable style={styles.finishButton} onPress={() => { applyPalette(themeId); setPalettePicked(true); }}>
              <Text style={styles.finishButtonText}>Continue →</Text>
            </Pressable>

            <Pressable onPress={goBack}>
              <Text style={styles.backLink}>← Back</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      );
    }

    // ── Companion selection (shown after name saved, before setup) ──────────
    if (nameSaved && !companionPicked) {
      return (
        <SafeAreaView style={styles.safe}>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.companionScreen}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.companionTitle}>Choose your{'\n'}companion</Text>
            <Text style={styles.companionSub}>
              They grow as you walk away from distractions. You can have all three — but pick your starter.
            </Text>

            <View style={styles.companionRow}>
              {([0, 1, 2] as CharacterId[]).map((id) => {
                const active = id === selectedChar;
                const accent = CHAR_COLORS[id][0][1];
                return (
                  <Pressable
                    key={id}
                    style={[
                      styles.companionCard,
                      active && { borderColor: accent, backgroundColor: accent + '12' },
                    ]}
                    onPress={() => {
                      setSelectedChar(id);
                      if (!companionName || companionName === COMPANION_NAMES[selectedChar ?? id]) {
                        setCompanionName(COMPANION_NAMES[id]);
                      }
                    }}
                  >
                    <GoonSprite char={id} stage={0} size={0.9} />
                    <Text style={[styles.companionCardName, active && { color: accent }]}>
                      {COMPANION_NAMES[id]}
                    </Text>
                    <Text style={styles.companionCardTag}>{COMPANION_TAGS[id]}</Text>
                  </Pressable>
                );
              })}
            </View>

            {selectedChar !== null && (
              <>
                <Text style={styles.companionNameLabel}>Give them a nickname (optional)</Text>
                <TextInput
                  style={styles.companionNameInput}
                  value={companionName}
                  onChangeText={setCompanionName}
                  placeholder={COMPANION_NAMES[selectedChar]}
                  placeholderTextColor={COLORS.textMuted}
                  maxLength={20}
                  returnKeyType="done"
                />
              </>
            )}

            <Pressable
              style={[styles.finishButton, selectedChar === null && { opacity: 0.4 }]}
              onPress={handlePickCompanion}
              disabled={selectedChar === null}
            >
              <Text style={styles.finishButtonText}>
                {selectedChar !== null
                  ? `Meet ${companionName || COMPANION_NAMES[selectedChar]} →`
                  : 'Pick a companion →'}
              </Text>
            </Pressable>

          </ScrollView>
        </SafeAreaView>
      );
    }

    // ── Setup step (shown after name is saved) ──────────────────────────────
    if (nameSaved && step === SLIDES.length) {
      return (
        <SafeAreaView style={styles.safe}>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.setupScreen}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >

            {/* Title */}
            <Text style={styles.setupTitle}>Set it up in{'\n'}30 seconds</Text>
            <Text style={styles.setupSubtitle}>Two quick steps and you're protected. The rest is optional.</Text>

            {/* Setup card with action rows */}
            <View style={styles.setupCard}>

              {/* Row 1 — Block sites */}
              <View style={styles.setupRow}>
                <View style={styles.setupRowLeft}>
                  <Text style={styles.setupRowEmoji}>🛡️</Text>
                  <View style={styles.setupRowText}>
                    <Text style={styles.setupRowTitle}>Block sites</Text>
                    <Text style={styles.setupRowSub}>
                      {sitesAdded
                        ? `${selectedDomains.size} site${selectedDomains.size === 1 ? '' : 's'} blocked`
                        : 'Pick the ones that get you'}
                    </Text>
                  </View>
                </View>
                {sitesAdded && <Feather name="check-circle" size={28} color={COLORS.green} />}
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
                          style={[styles.chip, selected && styles.chipSelected]}
                          onPress={() =>
                            setSelectedDomains((prev) => {
                              const next = new Set(prev);
                              if (next.has(domain)) next.delete(domain);
                              else next.add(domain);
                              return next;
                            })
                          }
                        >
                          <Text style={styles.chipEmoji}>{emoji}</Text>
                          <Text style={[styles.chipName, selected && styles.chipNameSelected]}>
                            {name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Pressable
                    style={[styles.chipAddBtn, selectedDomains.size === 0 && { opacity: 0.4 }]}
                    disabled={selectedDomains.size === 0}
                    onPress={handleAddSelected}
                  >
                    <Text style={styles.chipAddBtnText}>
                      Block {selectedDomains.size} site{selectedDomains.size === 1 ? '' : 's'} →
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* Divider */}
              <View style={styles.setupDivider} />

              {/* Row 2 — Enable accessibility / app blocking */}
              <View style={styles.setupRow}>
                <View style={styles.setupRowLeft}>
                  <Text style={styles.setupRowEmoji}>📱</Text>
                  <View style={styles.setupRowText}>
                    <Text style={styles.setupRowTitle}>Enable app blocking</Text>
                    <Text style={styles.setupRowSub}>Blocks apps like TikTok</Text>
                  </View>
                </View>

                {/* Turns into a checkmark automatically when permission is granted */}
                {serviceEnabled ? (
                  <Feather name="check-circle" size={28} color={COLORS.green} />
                ) : (
                  <Breathe>
                    <Pressable style={styles.setupEnableButton} onPress={openSettings}>
                      <Text style={styles.setupEnableButtonText}>Enable</Text>
                    </Pressable>
                  </Breathe>
                )}
              </View>

              {/* Step-by-step instructions — only shown before permission is granted */}
              {!serviceEnabled && (
                <View style={styles.accessibilitySteps}>
                  <Text style={styles.accessibilityStepsTitle}>How to enable:</Text>
                  {[
                    'Tap "Enable" above',
                    'Tap "Installed apps" or scroll to find NoGoon',
                    'Tap NoGoon → toggle it ON',
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

              {/* Row 3 — Battery optimization exemption */}
              <View style={styles.setupRow}>
                <View style={styles.setupRowLeft}>
                  <Text style={styles.setupRowEmoji}>⚡</Text>
                  <View style={styles.setupRowText}>
                    <Text style={styles.setupRowTitle}>Keep NoGoon always on</Text>
                    <Text style={styles.setupRowSub}>Recommended — stops Android from turning it off</Text>
                  </View>
                </View>

                {batteryExempt ? (
                  <Feather name="check-circle" size={28} color={COLORS.green} />
                ) : (
                  <Pressable
                    style={styles.setupEnableButton}
                    onPress={() => {
                      // Opens the real exemption dialog (native module, with an
                      // expo-intent-launcher fallback baked into the hook).
                      // We don't assume success here — the AppState listener
                      // above re-checks checkBatteryOptimized() the moment the
                      // user comes back, so the checkmark only appears once
                      // Android confirms the exemption actually took.
                      openBatterySettings();
                    }}
                  >
                    <Text style={styles.setupEnableButtonText}>Enable</Text>
                  </Pressable>
                )}
              </View>

              <View style={styles.setupDivider} />

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
                  <Text style={styles.setupRowEmoji}>🌐</Text>
                  <View style={styles.setupRowText}>
                    <Text style={styles.setupRowTitle}>Network filter</Text>
                    <Text style={styles.setupRowSub}>Optional — catches blocked sites at the network level too</Text>
                  </View>
                </View>
                {vpnActive ? (
                  <Feather name="check-circle" size={28} color={COLORS.green} />
                ) : (
                  <Pressable
                    style={styles.setupEnableButton}
                    onPress={startVpn}
                    disabled={vpnLoading}
                  >
                    <Text style={styles.setupEnableButtonText}>{vpnLoading ? '…' : 'Enable'}</Text>
                  </Pressable>
                )}
              </View>

              <View style={styles.setupDivider} />
              </>
              )}

              {/* Row 5 — Notification listener (push-level layer). Also optional —
                  filters distracting notifications from blocked apps/sites. */}
              <View style={styles.setupRow}>
                <View style={styles.setupRowLeft}>
                  <Text style={styles.setupRowEmoji}>🔕</Text>
                  <View style={styles.setupRowText}>
                    <Text style={styles.setupRowTitle}>Notification filter</Text>
                    <Text style={styles.setupRowSub}>Optional — quiets notifications from blocked apps</Text>
                  </View>
                </View>
                {notifGranted && notifEnabled ? (
                  <Feather name="check-circle" size={28} color={COLORS.green} />
                ) : (
                  <Pressable
                    style={styles.setupEnableButton}
                    onPress={() => (notifGranted ? toggleNotif(true) : openNotifSettings())}
                    disabled={notifLoading}
                  >
                    <Text style={styles.setupEnableButtonText}>{notifLoading ? '…' : 'Enable'}</Text>
                  </Pressable>
                )}
              </View>

              {/* Row 6 — OEM autostart/battery manager. Only shown on manufacturers
                  known to run a second, separate killer on top of Android's own —
                  no checkmark here since there's no way to verify the setting. */}
              {isKnownOemOffender && (
                <>
                  <View style={styles.setupDivider} />
                  <View style={styles.setupRow}>
                    <View style={styles.setupRowLeft}>
                      <Feather name="alert-triangle" size={20} color={COLORS.textSecondary} />
                      <View style={styles.setupRowText}>
                        <Text style={styles.setupRowTitle}>Check your phone's battery manager</Text>
                        <Text style={styles.setupRowSub}>Your device brand has its own, separate from Android's. Also try locking NoGoon in your recent apps.</Text>
                      </View>
                    </View>
                    <Pressable style={styles.setupEnableButton} onPress={openOemAutostartSettings}>
                      <Text style={styles.setupEnableButtonText}>Open</Text>
                    </Pressable>
                  </View>
                </>
              )}

            </View>

            {/* Continue button — moves into the main app. This is where
                onboarding actually completes (see handleExitSetup above). */}
            <Pressable
              style={styles.setupContinueButton}
              onPress={handleContinueSetup}
            >
              <Text style={styles.setupContinueText}>Continue to NoGoon →</Text>
            </Pressable>

            {/* Skip link for users who want to configure later — still
                counts as "done" so they land on the main app, not back here. */}
            <Pressable onPress={handleExitSetup}>
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
          <View style={styles.nameScreen}>
            <Text style={styles.nameEmoji}>👋</Text>
            <Text style={styles.nameTitle}>What should{'\n'}we call you?</Text>
            <Text style={styles.nameSubtitle}>
              This shows on your profile and streak badges.
            </Text>

            <TextInput
              style={[styles.nameInput, nameError ? styles.nameInputError : null]}
              placeholder="Your first name"
              placeholderTextColor={COLORS.textMuted}
              value={name}
              onChangeText={(t) => { setNameLocal(t); setNameError(''); }}
              autoCapitalize="words"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleFinish}
            />

            {nameError ? (
              <Text style={styles.nameErrorText}>{nameError}</Text>
            ) : null}

            <Pressable style={styles.finishButton} onPress={handleFinish}>
              <Text style={styles.finishButtonText}>Let's Go →</Text>
            </Pressable>

            <Pressable onPress={goBack}>
              <Text style={styles.backLink}>← Back</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Slides ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.flex}>

        {/* Skip — straight to the palette step; setup (and the Accessibility
            instructions) still happens later, so nothing essential is skipped. */}
        {step < SLIDES.length - 1 && (
          <Pressable style={styles.skipButton} onPress={() => {
            // Park the slide strip on the last slide so "Back" from the
            // palette screen lands on a slide that matches the step.
            slideX.setValue(-(SLIDES.length - 1) * SCREEN_WIDTH);
            setStep(SLIDES.length);
          }} hitSlop={10}>
            <Text style={styles.skipButtonText}>Skip</Text>
          </Pressable>
        )}

        {/* Slide container — all slides side by side, animated left/right */}
        <View style={styles.slidesWrapper}>
          <Animated.View
            style={[
              styles.slidesRow,
              { transform: [{ translateX: slideX }] },
            ]}
          >
            {SLIDES.map((slide, i) => (
              <View key={i} style={styles.slide}>
                <View style={[styles.slideIconWrap, { backgroundColor: slide.color + '1c' }]}>
                  <Feather name={slide.icon} size={40} color={slide.color} />
                </View>
                <Text style={[styles.slideTitle, { color: slide.color }]}>
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
            <Pressable style={styles.backButton} onPress={goBack}>
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
          ) : (
            <View style={styles.backButton} /> // spacer
          )}

          <Pressable style={styles.nextButton} onPress={goNext}>
            <Text style={styles.nextButtonText}>
              {step === SLIDES.length - 1 ? "Let's start" : 'Next'}
            </Text>
          </Pressable>
        </View>

      </View>
    </SafeAreaView>
  );
}

const makeStyles = (COLORS: ArcadeColors) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flex: {
    flex: 1,
  },

  // ── Slides ──
  skipButton: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.lg,
    zIndex: 5,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  skipButtonText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 15,
    color: COLORS.textMuted,
  },
  slidesWrapper: {
    flex: 1,
    overflow: 'hidden',
  },
  slidesRow: {
    flexDirection: 'row',
    width: SCREEN_WIDTH * SLIDES.length,
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  slideIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  slideTitle: {
    fontFamily: FONTS.display,
    fontSize: 36,
    textAlign: 'center',
    lineHeight: 44,
    letterSpacing: -0.5,
    marginBottom: SPACING.lg,
  },
  slideBody: {
    fontFamily: FONTS.body,
    fontSize: 17,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
  },

  // ── Dots ──
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xl,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.border,
  },
  dotActive: {
    width: 20,
    backgroundColor: COLORS.indigoBright,
  },

  // ── Nav buttons ──
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
    gap: SPACING.md,
  },
  backButton: {
    width: 80,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  backButtonText: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textMuted,
  },
  nextButton: {
    flex: 1,
    backgroundColor: COLORS.indigo,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  nextButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: COLORS.background,
  },

  // ── Companion screen ──
  companionScreen: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
    gap: SPACING.lg,
  },
  companionTitle: {
    fontFamily: FONTS.display,
    fontSize: 34,
    color: COLORS.textPrimary,
    textAlign: 'center',
    lineHeight: 42,
    letterSpacing: -0.5,
  },
  companionSub: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: -SPACING.sm,
  },
  companionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    width: '100%',
  },
  companionCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xs,
    gap: SPACING.xs,
  },
  companionCardName: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  companionCardTag: {
    fontFamily: FONTS.body,
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 14,
  },
  companionNameLabel: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    alignSelf: 'flex-start',
    marginBottom: -SPACING.sm,
  },
  companionNameInput: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontFamily: FONTS.body,
    fontSize: 16,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },

  // ── Palette screen ──
  paletteScreen: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xl,
    gap: SPACING.md,
  },
  paletteTitle: {
    fontFamily: FONTS.display,
    fontSize: 36,
    color: COLORS.textPrimary,
    textAlign: 'center',
    lineHeight: 44,
    letterSpacing: -0.5,
  },
  paletteSub: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  paletteGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: SPACING.md,
  },
  paletteCard: {
    width: '48%',
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  paletteSurface: {
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  paletteBar: { height: 8, borderRadius: 4, width: '60%' },
  paletteDots: { flexDirection: 'row', gap: 6 },
  paletteDot: { width: 12, height: 12, borderRadius: 6 },
  paletteName: { fontFamily: FONTS.bodyBold, fontSize: 14, paddingHorizontal: 2 },
  paletteCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Name screen ──
  nameScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },
  nameEmoji: {
    fontSize: 64,
    marginBottom: SPACING.sm,
  },
  nameTitle: {
    fontFamily: FONTS.display,
    fontSize: 36,
    color: COLORS.textPrimary,
    textAlign: 'center',
    lineHeight: 44,
    letterSpacing: -0.5,
  },
  nameSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  nameInput: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontFamily: FONTS.body,
    fontSize: 18,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  nameInputError: {
    borderColor: COLORS.danger,
  },
  nameErrorText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.danger,
  },
  finishButton: {
    width: '100%',
    backgroundColor: COLORS.indigo,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  finishButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: COLORS.background,
  },
  backLink: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
  },

  // ── Setup step ──
  // Shown after the name input. Guides the user to add blocked sites
  // and enable the Accessibility Service before entering the main app.
  setupScreen: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xl,
    gap: SPACING.lg,
  },

  // ── Site suggestion chips ──
  chipSection: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    gap: SPACING.md,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.background,
  },
  chipSelected: {
    borderColor: COLORS.green,
    backgroundColor: COLORS.green + '18',
  },
  chipEmoji: {
    fontSize: 14,
  },
  chipName: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  chipNameSelected: {
    color: COLORS.green,
  },
  chipAddBtn: {
    backgroundColor: COLORS.indigo,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  chipAddBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    color: COLORS.background,
  },
  setupTitle: {
    fontFamily: FONTS.display,
    fontSize: 36,
    color: COLORS.textPrimary,
    textAlign: 'center',
    lineHeight: 44,
    letterSpacing: -0.5,
  },
  setupSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: -SPACING.sm,
  },
  setupCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: 'hidden',
  },
  setupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  setupRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
  },
  setupRowEmoji: {
    fontSize: 26,
  },
  setupRowText: {
    flex: 1,
    gap: 2,
  },
  setupRowTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  setupRowSub: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  setupDivider: {
    height: 1,
    backgroundColor: COLORS.cardBorder,
    marginHorizontal: SPACING.lg,
  },
  // Green "Add" button — becomes a checkmark icon once tapped
  setupAddButton: {
    backgroundColor: COLORS.indigo,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  setupAddButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: COLORS.background,
  },
  // Purple "Enable" button for the accessibility row
  setupEnableButton: {
    backgroundColor: COLORS.purple,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  setupEnableButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: COLORS.background,
  },
  // Large green continue button at the bottom of the setup screen
  setupContinueButton: {
    width: '100%',
    backgroundColor: COLORS.indigo,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  setupContinueText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: COLORS.background,
  },
  // Small skip link below the continue button
  setupSkipText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
  },

  // ── Accessibility step-by-step instructions ──
  // Shown inside the setup card below the Enable row, only before permission granted
  accessibilitySteps: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  accessibilityStepsTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.xs,
  },
  accessibilityStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  accessibilityStepNum: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.purple,
    width: 16,
    marginTop: 1,
  },
  accessibilityStepText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
});
