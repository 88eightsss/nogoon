// ─── Onboarding Screen ────────────────────────────────────────────────────────
//
// Shown once, right after a user creates their account.
// Four steps walk the user through NoGoon:
//   1–3. Slides explaining what NoGoon does
//   4.   Name input (personalises the experience)
//   5.   Setup step — add blocked sites + enable accessibility
//
// After completing, completeOnboarding() is called on the store,
// which sets hasOnboarded = true so this screen never shows again.

import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUserStore } from '@/stores/useUserStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useAppBlocker } from '@/hooks/useAppBlocker';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Slide content ────────────────────────────────────────────────────────────

const SLIDES = [
  {
    emoji: '🛡️',
    title: 'NoGoon guards\nyour attention',
    body: 'When you try to open a flagged site, NoGoon intercepts it before the habit loop fires.',
    color: COLORS.green,
  },
  {
    emoji: '🎮',
    title: 'Play a game\ninstead',
    body: "A quick 30-second game reroutes your brain's craving. Most people find they don't want the site anymore after.",
    color: COLORS.purple,
  },
  {
    emoji: '🔥',
    title: 'Build a streak,\nearn rewards',
    body: 'Every time you walk away, your streak grows. Spend your points to unlock a site for 10 minutes if you really need it.',
    color: COLORS.cyan,
  },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const { setName, completeOnboarding, addSite } = useUserStore();
  const { user } = useAuthStore();
  const { openSettings, serviceEnabled, checkServiceStatus } = useAppBlocker();

  // ── Poll for accessibility service status ──────────────────────────────────
  // When the user taps "Enable" they're sent to Android Settings. When they
  // come back to the app we want the checkmark to appear automatically.
  // We poll every 1.5s AND listen to AppState so we check immediately on return.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkServiceStatus();
    });
    return () => subscription.remove();
  }, [checkServiceStatus]);

  const [step, setStep]           = useState(0);    // 0–2 = slides, 3 = name input
  const [name, setNameLocal]      = useState('');
  const [nameError, setNameError] = useState('');
  const [setupDone, setSetupDone] = useState(false); // tracks whether user passed the setup step
  const [sitesAdded, setSitesAdded] = useState(false); // tracks if default sites were added

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

  const handleFinish = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Please enter your name.');
      return;
    }
    setNameError('');

    // Save name to local store and mark onboarding complete
    setName(trimmed);
    completeOnboarding();

    // Also update Supabase profile name in the background
    if (user) {
      const { supabase } = await import('@/lib/supabase');
      await supabase.from('profiles').update({ name: trimmed }).eq('id', user.id);
    }

    // Instead of going straight to the app, show the setup step first.
    // setupDone starts false, so the setup screen will render next.
    // (Navigation to /(tabs) happens from the setup screen's Continue button.)
  };

  // Adds all the default blocked domains in one tap.
  // Called when the user presses "Add" on the setup screen.
  const DEFAULT_BLOCKED_SITES = [
    'tiktok.com',
    'instagram.com',
    'pornhub.com',
    'xhamster.com',
    'erome.com',
    'redgifs.com',
    'chaturbate.com',
  ];

  const handleAddDefaults = () => {
    DEFAULT_BLOCKED_SITES.forEach((domain) => addSite(domain));
    setSitesAdded(true);
  };

  // ── Name input step ────────────────────────────────────────────────────────

  if (step === SLIDES.length && setupDone) {
    // setupDone means the user already passed the setup screen — shouldn't
    // get here, but guard just in case.
    router.replace('/(tabs)');
    return null;
  }

  if (step === SLIDES.length && !setupDone) {
    // Check if the name has been saved (handleFinish was called successfully).
    // name state is still filled in, so we use it to determine which sub-step to show.
    const nameSaved = name.trim().length > 0 && !nameError;

    // ── Setup step (shown after name is saved) ──────────────────────────────
    if (nameSaved && step === SLIDES.length) {
      return (
        <SafeAreaView style={styles.safe}>
          <View style={styles.setupScreen}>

            {/* Title */}
            <Text style={styles.setupTitle}>Set it up in{'\n'}30 seconds</Text>
            <Text style={styles.setupSubtitle}>Two things and you're protected.</Text>

            {/* Setup card with two action rows */}
            <View style={styles.setupCard}>

              {/* Row 1 — Block default sites */}
              <View style={styles.setupRow}>
                <View style={styles.setupRowLeft}>
                  <Text style={styles.setupRowEmoji}>🛡️</Text>
                  <View style={styles.setupRowText}>
                    <Text style={styles.setupRowTitle}>Block default sites</Text>
                    <Text style={styles.setupRowSub}>TikTok, Instagram + 5 more</Text>
                  </View>
                </View>

                {/* Show green checkmark once sites are added, otherwise show Add button */}
                {sitesAdded ? (
                  <Ionicons name="checkmark-circle" size={28} color={COLORS.green} />
                ) : (
                  <Pressable style={styles.setupAddButton} onPress={handleAddDefaults}>
                    <Text style={styles.setupAddButtonText}>Add</Text>
                  </Pressable>
                )}
              </View>

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
                  <Ionicons name="checkmark-circle" size={28} color={COLORS.green} />
                ) : (
                  <Pressable style={styles.setupEnableButton} onPress={openSettings}>
                    <Text style={styles.setupEnableButtonText}>Enable</Text>
                  </Pressable>
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
                  ].map((step, i) => (
                    <View key={i} style={styles.accessibilityStep}>
                      <Text style={styles.accessibilityStepNum}>{i + 1}</Text>
                      <Text style={styles.accessibilityStepText}>{step}</Text>
                    </View>
                  ))}
                </View>
              )}

            </View>

            {/* Continue button — moves into the main app */}
            <Pressable
              style={styles.setupContinueButton}
              onPress={() => {
                setSetupDone(true);
                router.replace('/(tabs)');
              }}
            >
              <Text style={styles.setupContinueText}>Continue to NoGoon →</Text>
            </Pressable>

            {/* Skip link for users who want to configure later */}
            <Pressable onPress={() => router.replace('/(tabs)')}>
              <Text style={styles.setupSkipText}>Skip for now</Text>
            </Pressable>

          </View>
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
                <Text style={styles.slideEmoji}>{slide.emoji}</Text>
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

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flex: {
    flex: 1,
  },

  // ── Slides ──
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
  slideEmoji: {
    fontSize: 72,
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
    backgroundColor: COLORS.green,
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
    backgroundColor: COLORS.green,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  nextButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: COLORS.background,
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
    backgroundColor: COLORS.green,
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.lg,
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
    backgroundColor: COLORS.green,
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
    backgroundColor: COLORS.green,
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
