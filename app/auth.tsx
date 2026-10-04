// ─── Auth Screen ─────────────────────────────────────────────────────────────
//
// The sign in / sign up screen. Shown when the user has no active session.
// After successful auth, _layout.tsx redirects to onboarding (new users)
// or the main tabs (returning users).
//
// Two modes toggled by a tab at the top:
//   Sign In — email + password for existing accounts
//   Sign Up — email + password + name for new accounts

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

type AuthMode = 'signin' | 'signup';

export default function AuthScreen() {
  const COLORS = useThemedColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { signIn, signUp } = useAuthStore();

  const [mode, setMode]         = useState<AuthMode>('signin');
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

    let err: { message: string } | null = null;
    let needsConfirmation = false;
    if (mode === 'signup') {
      const res = await signUp(email.trim(), password, name.trim());
      err = res.error;
      needsConfirmation = res.needsConfirmation;
    } else {
      err = await signIn(email.trim(), password);
    }

    setLoading(false);

    if (!err && needsConfirmation) {
      // Account exists but there's no session until the email is confirmed —
      // without this message the screen just sat there looking broken.
      setMode('signin');
      setError('Account created. Check your email to confirm it, then sign in.');
      return;
    }

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
            <View style={styles.logoBadge}>
              <Feather name="shield" size={34} color={COLORS.background} />
            </View>
            <Text style={styles.logoText}>NoGoon</Text>
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
              <View style={styles.passwordWrap}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                  placeholderTextColor={COLORS.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
                <Pressable
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={10}
                >
                  <Feather
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={19}
                    color={COLORS.textMuted}
                  />
                </Pressable>
              </View>
              {mode === 'signin' && (
                <Pressable
                  style={styles.forgotLink}
                  onPress={() => router.push('/forgot-password' as any)}
                  hitSlop={8}
                >
                  <Text style={styles.forgotLinkText}>Forgot password?</Text>
                </Pressable>
              )}
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

const makeStyles = (COLORS: ArcadeColors) => StyleSheet.create({
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
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: COLORS.indigo,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  logoText: {
    fontFamily: FONTS.display,
    fontSize: 36,
    color: COLORS.indigo,
    letterSpacing: 0.5,
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
    backgroundColor: COLORS.indigo,
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
  passwordWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
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
  eyeBtn: {
    position: 'absolute',
    right: SPACING.md,
    padding: 4,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: SPACING.xs,
  },
  forgotLinkText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.indigoBright,
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
    backgroundColor: COLORS.indigo,
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
