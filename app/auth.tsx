// ─── Auth Screen ─────────────────────────────────────────────────────────────
//
// The sign in / sign up screen. Shown when the user has no active session.
// After successful auth, _layout.tsx redirects to onboarding (new users)
// or the main tabs (returning users).
//
// Two modes toggled by a tab at the top:
//   Sign In — email + password for existing accounts
//   Sign Up — email + password + name for new accounts

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
import { useAuthStore } from '@/stores/useAuthStore';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

type AuthMode = 'signin' | 'signup';

export default function AuthScreen() {
  const { signIn, signUp } = useAuthStore();

  const [mode, setMode]         = useState<AuthMode>('signin');
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);

    // Basic validation
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    if (mode === 'signup' && !name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    const err = mode === 'signup'
      ? await signUp(email.trim(), password, name.trim())
      : await signIn(email.trim(), password);

    setLoading(false);

    if (err) {
      // Make Supabase error messages friendlier
      if (err.message.includes('Invalid login credentials')) {
        setError('Wrong email or password. Try again.');
      } else if (err.message.includes('already registered')) {
        setError('An account with this email already exists. Sign in instead.');
      } else {
        setError(err.message);
      }
    }
    // On success, _layout.tsx's auth listener will redirect automatically
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Logo / wordmark ── */}
          <View style={styles.logoArea}>
            <Text style={styles.logoText}>GATE</Text>
            <Text style={styles.tagline}>Take back your attention.</Text>
          </View>

          {/* ── Mode toggle ── */}
          <View style={styles.modeTabs}>
            <Pressable
              style={[styles.modeTab, mode === 'signin' && styles.modeTabActive]}
              onPress={() => { setMode('signin'); setError(null); }}
            >
              <Text style={[styles.modeTabText, mode === 'signin' && styles.modeTabTextActive]}>
                Sign In
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modeTab, mode === 'signup' && styles.modeTabActive]}
              onPress={() => { setMode('signup'); setError(null); }}
            >
              <Text style={[styles.modeTabText, mode === 'signup' && styles.modeTabTextActive]}>
                Create Account
              </Text>
            </Pressable>
          </View>

          {/* ── Form ── */}
          <View style={styles.form}>

            {/* Name field — only shown for sign up */}
            {mode === 'signup' && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Your Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Alex"
                  placeholderTextColor={COLORS.textMuted}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>
            )}

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

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                placeholderTextColor={COLORS.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
            </View>

            {/* Error message */}
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Submit button */}
            <Pressable
              style={[styles.submitButton, loading && styles.submitButtonLoading]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.background} />
              ) : (
                <Text style={styles.submitButtonText}>
                  {mode === 'signin' ? 'Sign In' : 'Create Account'}
                </Text>
              )}
            </Pressable>
          </View>

          {/* ── Fine print ── */}
          <Text style={styles.finePrint}>
            By continuing you agree to our Terms of Service and Privacy Policy.
          </Text>

        </ScrollView>
      </KeyboardAvoidingView>
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
  scroll: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },

  // ── Logo ──
  logoArea: {
    alignItems: 'center',
    paddingTop: SPACING.huge,
    paddingBottom: SPACING.xxxl,
  },
  logoText: {
    fontFamily: FONTS.display,
    fontSize: 56,
    color: COLORS.green,
    letterSpacing: 8,
  },
  tagline: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },

  // ── Mode tabs ──
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 4,
    marginBottom: SPACING.xl,
  },
  modeTab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
  },
  modeTabActive: {
    backgroundColor: COLORS.green,
  },
  modeTabText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  modeTabTextActive: {
    color: COLORS.background,
    fontFamily: FONTS.bodyBold,
  },

  // ── Form ──
  form: {
    gap: SPACING.md,
  },
  fieldGroup: {
    gap: SPACING.xs,
  },
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
  errorText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.danger,
  },
  submitButton: {
    backgroundColor: COLORS.green,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  submitButtonLoading: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: COLORS.background,
  },

  // ── Fine print ──
  finePrint: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.xl,
    lineHeight: 17,
  },
});
