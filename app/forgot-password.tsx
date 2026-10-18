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
import { isLightColor, readableOn } from '@/utils/colorLuminance';
import { FONTS } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import type { ThemePalette } from '@/constants/Themes';
import { SPACING } from '@/constants/Spacing';

export default function ForgotPasswordScreen() {
  const { colors: c, cardStyle } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
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

          <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
            <Feather name="arrow-left" size={22} color={c.textSecondary} />
          </Pressable>

          <View style={styles.header}>
            <View style={styles.iconBadge}>
              <Feather name="key" size={30} color={c.accent} />
            </View>
            <Text style={styles.title} accessibilityRole="header">Reset your password</Text>
            <Text style={styles.subtitle}>
              {sent
                ? `We sent a 6-digit code to ${email.trim()}. Enter it on the next screen.`
                : "Enter the email on your account and we'll send you a code to reset your password."}
            </Text>
          </View>

          {!sent ? (
            <View style={[styles.form, cardStyle, { borderColor: c.cardBorder, backgroundColor: c.surface }]}>
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
                  returnKeyType="done"
                  onSubmitEditing={handleSend}
                  autoFocus
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
                onPress={handleSend}
                disabled={loading}
                accessibilityRole="button"
                accessibilityState={{ disabled: loading, busy: loading }}
              >
                {loading ? (
                  <ActivityIndicator color={isLightColor(readableOn(c.accent, c.surface, 3)) ? '#111111' : '#FFFFFF'} />
                ) : (
                  <Text style={styles.submitButtonText}>Send reset code</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <View style={[styles.form, cardStyle, { borderColor: c.cardBorder, backgroundColor: c.surface }]}>
              {error && (
                <View style={styles.errorBox} accessibilityLiveRegion="polite">
                  <Feather name="alert-circle" size={16} color={c.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
              <Pressable
                style={styles.submitButton}
                onPress={() => router.replace({ pathname: '/reset-password', params: { email: email.trim() } } as any)}
              >
                <Text style={styles.submitButtonText}>I have my code</Text>
              </Pressable>

              <Pressable style={styles.resendBtn} onPress={handleSend} disabled={loading} hitSlop={8} accessibilityRole="button">
                <Text style={styles.resendText}>Didn't get it? Send again</Text>
              </Pressable>
            </View>
          )}

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
