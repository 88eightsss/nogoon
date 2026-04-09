// ─── Accountability Partner Screen ────────────────────────────────────────────
//
// A Pro feature screen that lets the user set up an accountability partner.
// When active, the partner receives email notifications whenever the user:
//   - Spends points to unlock a blocked site ("Notify on Unlock")
//   - Dismisses the game without playing ("Notify on Bypass")
//
// The partner doesn't need to download the app — they just receive emails.
//
// Route: /partner
// Navigated to from: Profile screen → "Accountability Partner" settings row
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Switch,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { useUserStore } from '@/stores/useUserStore';

// ─── Main component ────────────────────────────────────────────────────────────

export default function PartnerScreen() {
  // Pull partner data and actions from the global user store
  const {
    partnerName,
    partnerEmail,
    partnerNotifyOnUnlock,
    partnerNotifyOnBypass,
    setPartner,
    setPartnerNotifications,
  } = useUserStore();

  // Local state for the text inputs — starts pre-filled with whatever is
  // already saved in the store (so edits feel like editing, not starting fresh)
  const [nameInput,  setNameInput]  = useState(partnerName);
  const [emailInput, setEmailInput] = useState(partnerEmail);

  // ── Save handler ─────────────────────────────────────────────────────────────
  // Writes the name + email into the store, which persists them to SecureStore
  // and syncs to Supabase on next syncToSupabase() call.
  const handleSave = () => {
    setPartner(emailInput.trim(), nameInput.trim());
  };

  // ── Notification toggle handlers ─────────────────────────────────────────────
  // Each toggle calls setPartnerNotifications with the new value for that toggle
  // and the existing value for the other toggle, so neither gets reset.
  const handleToggleUnlock = (value: boolean) => {
    setPartnerNotifications(value, partnerNotifyOnBypass);
  };

  const handleToggleBypass = (value: boolean) => {
    setPartnerNotifications(partnerNotifyOnUnlock, value);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Header ── */}
      {/* Back arrow on the left + centered title */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Accountability Partner</Text>
        {/* Empty view balances the flex row so the title centers properly */}
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Hero section ── */}
        {/* Big emoji + heading + short explainer */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>👥</Text>
          <Text style={styles.heroHeading}>Your Partner</Text>
          <Text style={styles.heroSubtitle}>
            Your partner gets notified when you unlock a blocked site.
            Accountability makes habits stick.
          </Text>
        </View>

        {/* ── Partner Details card ── */}
        {/* Text inputs for name and email, plus a save button */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Partner Details</Text>

          {/* Partner name input */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Partner's Name</Text>
            <TextInput
              style={styles.textInput}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="e.g. Alex"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          {/* Partner email input */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Partner's Email</Text>
            <TextInput
              style={styles.textInput}
              value={emailInput}
              onChangeText={setEmailInput}
              placeholder="partner@example.com"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="done"
            />
          </View>

          {/* Save button — green to match the app's primary CTA color */}
          <Pressable
            style={styles.saveButton}
            onPress={handleSave}
            // Dim the button slightly if the email field is empty
            disabled={!emailInput.trim()}
          >
            <Text style={styles.saveButtonText}>Save Partner</Text>
          </Pressable>
        </View>

        {/* ── Notification Settings card ── */}
        {/* Two toggles controlling when the partner gets emailed */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Notification Settings</Text>

          {/* Toggle: Notify when user spends points to unlock a site */}
          <View style={styles.switchRow}>
            <View style={styles.switchRowLeft}>
              <Ionicons name="notifications-outline" size={20} color={COLORS.cyan} />
              <View style={styles.switchRowText}>
                <Text style={styles.switchLabel}>Notify on Unlock</Text>
                <Text style={styles.switchSub}>
                  When you spend points to access a blocked site
                </Text>
              </View>
            </View>
            <Switch
              value={partnerNotifyOnUnlock}
              onValueChange={handleToggleUnlock}
              trackColor={{ false: COLORS.border, true: COLORS.green + '55' }}
              thumbColor={partnerNotifyOnUnlock ? COLORS.green : COLORS.textMuted}
            />
          </View>

          <View style={styles.divider} />

          {/* Toggle: Notify when user dismisses the game and visits site anyway */}
          <View style={styles.switchRow}>
            <View style={styles.switchRowLeft}>
              <Ionicons name="warning-outline" size={20} color={COLORS.warning} />
              <View style={styles.switchRowText}>
                <Text style={styles.switchLabel}>Notify on Bypass</Text>
                <Text style={styles.switchSub}>
                  When you dismiss the game and access the site anyway
                </Text>
              </View>
            </View>
            <Switch
              value={partnerNotifyOnBypass}
              onValueChange={handleToggleBypass}
              trackColor={{ false: COLORS.border, true: COLORS.warning + '55' }}
              thumbColor={partnerNotifyOnBypass ? COLORS.warning : COLORS.textMuted}
            />
          </View>
        </View>

        {/* ── Footer note ── */}
        {/* Reassure the user that their partner doesn't need to install anything */}
        <Text style={styles.footerNote}>
          Your partner will receive an email invite. They don't need to download NoGoon.
        </Text>

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.background },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, gap: SPACING.md },

  // ── Header bar ──
  // A manual flex-row header since this is a modal (no native nav bar)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.background,
  },
  backButton: {
    padding: SPACING.xs,
    // Makes the tap target a little bigger than the icon alone
    marginLeft: -SPACING.xs,
  },
  headerTitle: {
    flex: 1,
    fontFamily: FONTS.display,
    fontSize: 20,
    color: COLORS.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  // Invisible view the same width as the back button to keep title truly centered
  headerSpacer: {
    width: 22 + SPACING.xs * 2,
  },

  // ── Hero section ──
  hero: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
  },
  heroEmoji: {
    fontSize: 52,
    marginBottom: SPACING.xs,
  },
  heroHeading: {
    fontFamily: FONTS.display,
    fontSize: 28,
    color: COLORS.textPrimary,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: SPACING.lg,
  },

  // ── Cards ──
  // Shared card base — dark surface, rounded corners, subtle border
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  cardTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.xs,
  },

  // ── Text input fields ──
  fieldGroup: { gap: SPACING.xs },
  fieldLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  textInput: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textPrimary,
    // Tinted focus style is handled by the OS; no extra styling needed here
  },

  // ── Save button ──
  saveButton: {
    backgroundColor: COLORS.green,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  saveButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    // Text sits on green bg — use the dark background color for contrast
    color: COLORS.background,
  },

  // ── Switch rows ──
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  switchRowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  switchRowText: { flex: 1, gap: 2 },
  switchLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  switchSub: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 17,
  },

  // ── Divider between switch rows ──
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: -SPACING.lg, // bleed to card edges
  },

  // ── Footer note ──
  footerNote: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
});
