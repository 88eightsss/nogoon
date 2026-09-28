// ─── Forgot Password — Step 2: enter code + new password ─────────────────────
//
// Takes the 6-digit code emailed by Supabase plus a new password. Verifying
// the code (supabase.auth.verifyOtp with type 'recovery') establishes a real
// session for that user, so once the password is updated the user is already
// signed in — _layout.tsx's normal redirect logic takes it from there.

import { useState } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/stores/useAuthStore';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

export default function ResetPasswordScreen() {
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const { confirmPasswordReset } = useAuthStore();

  const [email, setEmail]         = useState(emailParam ?? '');
  const [code, setCode]           = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const handleReset = async () => {
    setError(null);

    if (!email.trim() || !code.trim()) {
      setError('Please enter your email and the 6-digit code.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const err = await confirmPasswordReset(email.trim(), code.trim(), password);
    setLoading(false);

    if (err) {
      if (err.message.toLowerCase().includes('invalid') || err.message.toLowerCase().includes('expired')) {
        setError('That code is wrong or has expired. Request a new one.');
      } else {
        setError(err.message);
      }
      return;
    }

    // Success — the user now has a live session with the new password.
    // Don't navigate manually here: _layout.tsx's own auth listener reacts to
    // the session change and redirects to onboarding or the main app on its
    // own (same pattern as app/auth.tsx's sign-in/sign-up — see its comment).
    // Calling router.replace here too would just race that redirect.
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
              <Feather name="lock" size={30} color={COLORS.indigo} />
            </View>
            <Text style={styles.title}>Enter your code</Text>
            <Text style={styles.subtitle}>Check your email for the 6-digit code, then choose a new password.</Text>
          </View>

          <View style={styles.form}>
            {!emailParam && (
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
                  returnKeyType="next"
                />
              </View>
            )}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>6-digit code</Text>
              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="123456"
                placeholderTextColor={COLORS.textMuted}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                returnKeyType="next"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>New password</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="At least 6 characters"
                  placeholderTextColor={COLORS.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
                <Pressable style={styles.eyeBtn} onPress={() => setShowPassword((v) => !v)} hitSlop={10}>
                  <Feather name={showPassword ? 'eye-off' : 'eye'} size={19} color={COLORS.textMuted} />
                </Pressable>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Confirm new password</Text>
              <TextInput
                style={styles.input}
                placeholder="Type it again"
                placeholderTextColor={COLORS.textMuted}
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleReset}
              />
            </View>

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Pressable
              style={[styles.submitButton, loading && styles.submitButtonLoading]}
              onPress={handleReset}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.background} />
              ) : (
                <Text style={styles.submitButtonText}>Reset password</Text>
              )}
            </Pressable>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  codeInput: {
    letterSpacing: 6,
    fontFamily: FONTS.mono,
  },
  passwordWrap: { position: 'relative', justifyContent: 'center' },
  passwordInput: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: SPACING.lg,
    paddingRight: SPACING.xl + SPACING.lg,
    paddingVertical: SPACING.md,
    fontFamily: FONTS.body,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  eyeBtn: { position: 'absolute', right: SPACING.md, padding: 4 },

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
});
