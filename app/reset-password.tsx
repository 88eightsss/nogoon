// ─── Forgot Password — Step 2: enter code + new password ─────────────────────
//
// Takes the 6-digit code emailed by Supabase plus a new password. Verifying
// the code (supabase.auth.verifyOtp with type 'recovery') establishes a real
// session for that user, so once the password is updated the user is already
// signed in; this screen then sends them on to the app itself.

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
import { router, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/stores/useAuthStore';
import { useUserStore } from '@/stores/useUserStore';
import { isLightColor, readableOn } from '@/utils/colorLuminance';
import { FONTS } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import type { ThemePalette } from '@/constants/Themes';
import { SPACING } from '@/constants/Spacing';

export default function ResetPasswordScreen() {
  const { colors: c, cardStyle } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const { confirmPasswordReset, requestPasswordReset } = useAuthStore();

  const [email, setEmail]         = useState(emailParam ?? '');
  const [code, setCode]           = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [resent, setResent]       = useState(false);
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    setError(null);
    setResent(false);
    if (!email.trim() || !email.includes('@')) {
      setError('Enter your email above so we know where to send a new code.');
      return;
    }
    setResending(true);
    const err = await requestPasswordReset(email.trim());
    setResending(false);
    if (err) {
      setError(err.message);
      return;
    }
    setResent(true);
  };

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

    // Success — verifying the code signed the user in, and the password is now
    // updated. Navigate explicitly: the root layout deliberately leaves this
    // screen alone until the password update has finished (so a failed update
    // above is shown here instead of being hidden by a redirect).
    router.replace(useUserStore.getState().hasOnboarded ? '/(tabs)' : '/onboarding');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
            <Feather name="arrow-left" size={22} color={c.textSecondary} />
          </Pressable>

          <View style={styles.header}>
            <View style={styles.iconBadge}>
              <Feather name="lock" size={30} color={c.accent} />
            </View>
            <Text style={styles.title} accessibilityRole="header">Enter your code</Text>
            <Text style={styles.subtitle}>Check your email for the 6-digit code, then choose a new password.</Text>
          </View>

          <View style={[styles.form, cardStyle, { borderColor: c.cardBorder, backgroundColor: c.surface }]}>
            {!emailParam && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={c.textMuted}
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
                placeholderTextColor={c.textMuted}
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
                  placeholderTextColor={c.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
                <Pressable style={styles.eyeBtn} onPress={() => setShowPassword((v) => !v)} hitSlop={10} accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
                  <Feather name={showPassword ? 'eye-off' : 'eye'} size={19} color={c.textMuted} />
                </Pressable>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Confirm new password</Text>
              <TextInput
                style={styles.input}
                placeholder="Type it again"
                placeholderTextColor={c.textMuted}
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
              <View style={styles.errorBox} accessibilityLiveRegion="polite">
                <Feather name="alert-circle" size={16} color={c.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Pressable
              style={[styles.submitButton, loading && styles.submitButtonLoading]}
              onPress={handleReset}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={isLightColor(readableOn(c.accent, c.surface, 3)) ? '#111111' : '#FFFFFF'} />
              ) : (
                <Text style={styles.submitButtonText}>Reset password</Text>
              )}
            </Pressable>

            <Pressable style={styles.resendBtn} onPress={handleResend} disabled={resending} hitSlop={8}>
              <Text style={styles.resendText}>
                {resending ? 'Sending...' : resent ? 'New code sent. Check your email.' : "Didn't get a code? Send a new one"}
              </Text>
            </Pressable>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemePalette) => {
  const btnBg = readableOn(c.accent, c.surface, 3);
  const btnFg = isLightColor(btnBg) ? '#111111' : '#FFFFFF';
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl },
  backBtn: { marginTop: SPACING.sm, alignSelf: 'flex-start', width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -SPACING.sm },

  header: { alignItems: 'center', paddingTop: SPACING.md, paddingBottom: SPACING.xl, gap: 6 },
  iconBadge: { width: 72, height: 72, borderRadius: 24, backgroundColor: c.accentDim, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm },
  title: { fontFamily: FONTS.display, fontSize: 30, color: c.text, letterSpacing: -0.5, textAlign: 'center' },
  subtitle: { fontFamily: FONTS.body, fontSize: 15, color: c.textSecondary, textAlign: 'center', lineHeight: 22, paddingHorizontal: SPACING.md },

  form: { padding: SPACING.lg, gap: SPACING.md },
  fieldGroup: { gap: 6 },
  label: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: c.textSecondary, marginLeft: 2 },
  input: { minHeight: 52, backgroundColor: c.background, borderRadius: 14, borderWidth: 1, borderColor: c.cardBorder, paddingHorizontal: SPACING.md, paddingVertical: 13, fontFamily: FONTS.body, fontSize: 16, color: c.text },
  codeInput: { letterSpacing: 6, fontFamily: FONTS.mono, textAlign: 'center', fontSize: 20 },
  passwordWrap: { position: 'relative', justifyContent: 'center' },
  passwordInput: { minHeight: 52, backgroundColor: c.background, borderRadius: 14, borderWidth: 1, borderColor: c.cardBorder, paddingHorizontal: SPACING.md, paddingRight: 52, paddingVertical: 13, fontFamily: FONTS.body, fontSize: 16, color: c.text },
  eyeBtn: { position: 'absolute', right: 6, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: c.dangerDim, borderRadius: 12, borderWidth: 1, borderColor: c.danger + '55', padding: SPACING.md },
  errorText: { fontFamily: FONTS.body, fontSize: 14, color: c.danger, flex: 1, lineHeight: 19 },
  okBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: c.successDim, borderRadius: 12, borderWidth: 1, borderColor: c.success + '55', padding: SPACING.md },
  okText: { fontFamily: FONTS.body, fontSize: 14, color: c.success, flex: 1, lineHeight: 19 },

  submitButton: { minHeight: 52, backgroundColor: btnBg, borderRadius: 999, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  submitButtonLoading: { opacity: 0.7 },
  submitButtonText: { fontFamily: FONTS.bodyBold, fontSize: 16, color: btnFg },
  resendBtn: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: SPACING.sm },
  resendText: { fontFamily: FONTS.bodyMedium, fontSize: 14, color: c.accentBright },
});
};
