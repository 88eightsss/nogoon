// ─── Forgot Password — Step 1: request a reset code ──────────────────────────
//
// Asks for the account email, then asks Supabase to email a 6-digit recovery
// code (no deep links / universal links needed — the code is typed back in
// on the next screen, which works reliably even without a configured
// custom-scheme redirect).

import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/useAuthStore';
import { FONTS } from '@/constants/Colors';
import { useThemedColors, type ArcadeColors } from '@/hooks/useThemedColors';
import { SPACING, RADIUS } from '@/constants/Spacing';

export default function ForgotPasswordScreen() {
  const COLORS = useThemedColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { requestPasswordReset } = useAuthStore();

  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [sent, setSent]       = useState(false);

  const handleSend = async () => {
    setError(null);
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    const err = await requestPasswordReset(email.trim());
    setLoading(false);

    if (err) {
      setError(err.message);
      return;
    }

    setSent(true);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
            <Feather name="arrow-left" size={22} color={COLORS.textSecondary} />
          </Pressable>

          <View style={styles.header}>
            <View style={styles.iconBadge}>
              <Feather name="key" size={30} color={COLORS.indigo} />
            </View>
            <Text style={styles.title}>Reset your password</Text>
            <Text style={styles.subtitle}>
              {sent
                ? `We sent a 6-digit code to ${email.trim()}. Enter it on the next screen.`
                : "Enter the email on your account and we'll send you a code to reset your password."}
            </Text>
          </View>

          {!sent ? (
            <View style={styles.form}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={COLORS.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleSend}
                  autoFocus
                />
              </View>

              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Pressable
                style={[styles.submitButton, loading && styles.submitButtonLoading]}
                onPress={handleSend}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.background} />
                ) : (
                  <Text style={styles.submitButtonText}>Send reset code</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <View style={styles.form}>
              <Pressable
                style={styles.submitButton}
                onPress={() => router.replace({ pathname: '/reset-password', params: { email: email.trim() } } as any)}
              >
                <Text style={styles.submitButtonText}>I have my code</Text>
              </Pressable>

              <Pressable style={styles.resendBtn} onPress={handleSend} hitSlop={8}>
                <Text style={styles.resendText}>Didn't get it? Send again</Text>
              </Pressable>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (COLORS: ArcadeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl },
  backBtn: { marginTop: SPACING.sm, alignSelf: 'flex-start', padding: SPACING.xs },

  header: { alignItems: 'center', paddingTop: SPACING.lg, paddingBottom: SPACING.xxxl },
  iconBadge: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: COLORS.indigoDim,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 24,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: SPACING.md,
  },

  form: { gap: SPACING.md },
  fieldGroup: { gap: SPACING.xs },
  label: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginLeft: 2,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontFamily: FONTS.body,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  errorBox: {
    backgroundColor: COLORS.danger + '18',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.danger + '44',
    padding: SPACING.md,
  },
  errorText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.danger },

  submitButton: {
    backgroundColor: COLORS.indigo,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  submitButtonLoading: { opacity: 0.7 },
  submitButtonText: { fontFamily: FONTS.bodyBold, fontSize: 16, color: COLORS.background },

  resendBtn: { alignSelf: 'center', marginTop: SPACING.sm, padding: SPACING.xs },
  resendText: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.indigoBright },
});
