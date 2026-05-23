// ─── Setup Guide Screen ─────────────────────────────────────────────────────── //
// Standalone screen that shows the Accessibility Service setup instructions.
// Reachable from the home screen help button so users can re-enable the
// service anytime — not just during onboarding.
//
// Uses the same useAppBlocker hook as onboarding, so the checkmark appears
// automatically once the user grants permission and returns to the app.

import { useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAppBlocker } from '@/hooks/useAppBlocker';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

export default function SetupGuideScreen() {
  const { openSettings, serviceEnabled, checkServiceStatus } = useAppBlocker();

  // Poll for accessibility service status + listen for app returning to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkServiceStatus();
    });
    return () => subscription.remove();
  }, [checkServiceStatus]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color={COLORS.textSecondary} />
          </Pressable>
          <Text style={styles.headerTitle}>Setup Guide</Text>
          <View style={styles.backButton} />
        </View>

        {/* Status card */}
        <View style={styles.statusCard}>
          <Feather
            name={serviceEnabled ? 'check-circle' : 'alert-circle'}
            size={32}
            color={serviceEnabled ? COLORS.green : COLORS.hotPink}
          />
          <View style={styles.statusText}>
            <Text style={styles.statusTitle}>
              {serviceEnabled
                ? 'Blocking is active'
                : 'Blocking is not enabled'}
            </Text>
            <Text style={styles.statusSub}>
              {serviceEnabled
                ? 'NoGoon is intercepting blocked apps and sites.'
                : 'Enable the Accessibility Service to start blocking.'}
            </Text>
          </View>
        </View>

        {/* Setup card */}
        <View style={styles.setupCard}>
          <View style={styles.setupRow}>
            <View style={styles.setupRowLeft}>
              <Text style={styles.setupRowEmoji}>📱</Text>
              <View style={styles.setupRowText}>
                <Text style={styles.setupRowTitle}>
                  Accessibility Service
                </Text>
                <Text style={styles.setupRowSub}>
                  Required for app & website blocking
                </Text>
              </View>
            </View>
            {serviceEnabled ? (
              <Feather name="check-circle" size={28} color={COLORS.green} />
            ) : (
              <Pressable style={styles.enableButton} onPress={openSettings}>
                <Text style={styles.enableButtonText}>Enable</Text>
              </Pressable>
            )}
          </View>

          {/* Step-by-step instructions — only shown when not yet enabled */}
          {!serviceEnabled && (
            <View style={styles.steps}>
              <Text style={styles.stepsTitle}>How to enable:</Text>
              {[
                'Tap "Enable" above to open Android Settings',
                'Tap "Installed apps" or scroll to find NoGoon',
                'Tap NoGoon \u2192 toggle it ON',
                'Tap "Allow" on the confirmation dialog',
                'Come back here \u2014 the checkmark will appear automatically',
              ].map((text, i) => (
                <View key={i} style={styles.step}>
                  <Text style={styles.stepNum}>{i + 1}</Text>
                  <Text style={styles.stepText}>{text}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Privacy note */}
        <View style={styles.privacyNote}>
          <Feather name="lock" size={14} color={COLORS.textMuted} />
          <Text style={styles.privacyText}>
            NoGoon only checks which app is in the foreground. It never reads
            your screen content, keystrokes, or personal data.
          </Text>
        </View>

        {/* Done button */}
        <Pressable style={styles.doneButton} onPress={() => router.back()}>
          <Text style={styles.doneButtonText}>
            {serviceEnabled ? 'Done' : 'Go Back'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxxl,
    gap: SPACING.lg,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 17,
    color: COLORS.textPrimary,
  },

  // ── Status card ──
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  statusText: {
    flex: 1,
    gap: 4,
  },
  statusTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  statusSub: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },

  // ── Setup card ──
  setupCard: {
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
  enableButton: {
    backgroundColor: COLORS.purple,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  enableButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: COLORS.background,
  },

  // ── Step-by-step instructions ──
  steps: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  stepsTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.xs,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  stepNum: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.purple,
    width: 16,
    marginTop: 1,
  },
  stepText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 20,
  },

  // ── Privacy note ──
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  privacyText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
    flex: 1,
    lineHeight: 18,
  },

  // ── Done button ──
  doneButton: {
    backgroundColor: COLORS.indigo,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  doneButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: COLORS.background,
  },
});
