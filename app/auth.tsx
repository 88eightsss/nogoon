// ─── Auth Screen ─────────────────────────────────────────────────────────────
//
// Sign in / create account. Shown when there is no session. After success, _layout.tsx moves the
// person on (onboarding for new users, the tabs for returning ones).
//
// Looks like the rest of the app: the person's theme, a companion to greet them, and the same
// promise as the Today tab: NoGoon is a way in to better habits, not just a block.

import { useState, useMemo, useRef, useEffect } from 'react';
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
  Animated,
  Easing,
  Linking,
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
import { PackSprite } from '@/components/page/PackSprite';
import type { CharacterId } from '@/stores/usePetStore';

type AuthMode = 'signin' | 'signup';
type FeatherName = React.ComponentProps<typeof Feather>['name'];

const TERMS_URL = 'https://88eightsss.github.io/nogoon-legal/terms-of-service.html';
const PRIVACY_URL = 'https://88eightsss.github.io/nogoon-legal/privacy-policy.html';

// Companions that greet a new visitor (the first few starters).
const GREETERS: CharacterId[] = [0, 1, 2];

const PROMISES: { icon: FeatherName; text: string }[] = [
  { icon: 'pause-circle', text: 'Pause before the scroll starts' },
  { icon: 'sun',          text: 'Swap it for something better' },
  { icon: 'heart',        text: 'Grow a companion as you go' },
];

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export default function AuthScreen() {
  const { colors, cardStyle } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { signIn, signUp } = useAuthStore();

  const [mode, setMode]         = useState<AuthMode>('signin');
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [info, setInfo]         = useState<string | null>(null);

  const emailRef = useRef<TextInput>(null);
  const passRef = useRef<TextInput>(null);

  // A different companion each time the screen opens; it bobs gently.
  const greeter = useMemo(() => GREETERS[Math.floor(Math.random() * GREETERS.length)], []);
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);

  const switchMode = (m: AuthMode) => { setMode(m); setError(null); setInfo(null); };

  const handleSubmit = async () => {
    if (loading) return;
    setError(null);
    setInfo(null);

    if (mode === 'signup' && !name.trim()) { setError('What should we call you?'); return; }
    if (!isEmail(email.trim())) { setError('That email does not look right. Check it and try again.'); return; }
    if (password.length < 6) { setError('Pick a password with at least 6 characters.'); return; }

    setLoading(true);
    let err: { message: string } | null = null;
    let needsConfirmation = false;
    try {
      if (mode === 'signup') {
        const res = await signUp(email.trim(), password, name.trim());
        err = res.error;
        needsConfirmation = res.needsConfirmation;
      } else {
        err = await signIn(email.trim(), password);
      }
    } catch {
      err = { message: 'network' };
    }
    setLoading(false);

    if (!err && needsConfirmation) {
      // The account exists but there is no session until the email is confirmed.
      setMode('signin');
      setPassword('');
      setInfo('Account created. Check your email to confirm it, then sign in.');
      return;
    }

    if (err) {
      const m = err.message.toLowerCase();
      if (m.includes('invalid login credentials')) setError('Wrong email or password. Try again.');
      else if (m.includes('already registered')) setError('An account with this email already exists. Sign in instead.');
      else if (m.includes('email not confirmed')) setError('Confirm your email first. Check your inbox for the link.');
      else if (m.includes('network') || m.includes('fetch')) setError('Could not reach NoGoon. Check your connection and try again.');
      else setError(err.message);
    }
    // On success, _layout.tsx's auth listener redirects automatically.
  };

  const field = (label: string, node: React.ReactNode) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      {node}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* ── Welcome ── */}
          <View style={styles.hero}>
            <Animated.View
              style={{ transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <PackSprite char={greeter} stage={1} cell={8} />
            </Animated.View>
            <Text style={styles.wordmark} accessibilityRole="header">NoGoon</Text>
            <Text style={styles.tagline}>
              {mode === 'signin' ? 'Welcome back. Your companion kept your spot.' : 'A gateway to better habits.'}
            </Text>
          </View>

          {/* ── What it is, in three lines (create-account only, so sign-in stays quick) ── */}
          {mode === 'signup' && (
            <View style={styles.promises}>
              {PROMISES.map((p) => (
                <View key={p.text} style={styles.promiseRow}>
                  <View style={styles.promiseIcon}><Feather name={p.icon} size={15} color={colors.accent} /></View>
                  <Text style={styles.promiseText}>{p.text}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Mode toggle ── */}
          <View style={styles.modeTabs} accessibilityRole="tablist">
            {(['signin', 'signup'] as const).map((m) => {
              const on = mode === m;
              return (
                <Pressable
                  key={m}
                  style={[styles.modeTab, on && styles.modeTabActive]}
                  onPress={() => switchMode(m)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.modeTabText, on && styles.modeTabTextActive]}>
                    {m === 'signin' ? 'Sign in' : 'Create account'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* ── Form ── */}
          <View style={[styles.form, cardStyle, { borderColor: colors.cardBorder, backgroundColor: colors.surface }]}>
            {mode === 'signup' && field('Your name', (
              <TextInput
                style={styles.input}
                placeholder="e.g. Alex"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoComplete="given-name"
                textContentType="givenName"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                blurOnSubmit={false}
                maxLength={40}
              />
            ))}

            {field('Email', (
              <TextInput
                ref={emailRef}
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                onSubmitEditing={() => passRef.current?.focus()}
                blurOnSubmit={false}
              />
            ))}

            {field('Password', (
              <>
                <View style={styles.passwordWrap}>
                  <TextInput
                    ref={passRef}
                    style={[styles.input, { paddingRight: 52 }]}
                    placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
                    placeholderTextColor={colors.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    textContentType={mode === 'signup' ? 'newPassword' : 'password'}
                    returnKeyType="go"
                    onSubmitEditing={handleSubmit}
                  />
                  <Pressable
                    style={styles.eyeBtn}
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Feather name={showPassword ? 'eye-off' : 'eye'} size={19} color={colors.textMuted} />
                  </Pressable>
                </View>
                {mode === 'signin' && (
                  <Pressable
                    style={styles.forgotLink}
                    onPress={() => router.push('/forgot-password' as any)}
                    hitSlop={8}
                    accessibilityRole="link"
                  >
                    <Text style={styles.forgotLinkText}>Forgot password?</Text>
                  </Pressable>
                )}
              </>
            ))}

            {info && (
              <View style={[styles.notice, { backgroundColor: colors.successDim, borderColor: colors.success + '55' }]} accessibilityLiveRegion="polite">
                <Feather name="check-circle" size={16} color={colors.success} />
                <Text style={[styles.noticeText, { color: colors.success }]}>{info}</Text>
              </View>
            )}
            {error && (
              <View style={[styles.notice, { backgroundColor: colors.dangerDim, borderColor: colors.danger + '55' }]} accessibilityLiveRegion="polite">
                <Feather name="alert-circle" size={16} color={colors.danger} />
                <Text style={[styles.noticeText, { color: colors.danger }]}>{error}</Text>
              </View>
            )}

            <Pressable
              style={[styles.submitButton, loading && styles.submitButtonLoading]}
              onPress={handleSubmit}
              disabled={loading}
              accessibilityRole="button"
              accessibilityState={{ disabled: loading, busy: loading }}
            >
              {loading ? (
                <ActivityIndicator color={isLightColor(readableOn(colors.accent, colors.surface, 3)) ? '#111111' : '#FFFFFF'} />
              ) : (
                <Text style={styles.submitButtonText}>{mode === 'signin' ? 'Sign in' : 'Create my account'}</Text>
              )}
            </Pressable>
          </View>

          <Text style={styles.why}>
            {mode === 'signup'
              ? 'An account keeps your streak, companion and settings safe if you change phones.'
              : 'New here? Tap Create account above.'}
          </Text>

          {/* ── Fine print ── */}
          <Text style={styles.finePrint}>
            By continuing you agree to our{' '}
            <Text style={styles.finePrintLink} onPress={() => Linking.openURL(TERMS_URL).catch(() => {})} accessibilityRole="link">Terms of Service</Text>
            {' '}and{' '}
            <Text style={styles.finePrintLink} onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})} accessibilityRole="link">Privacy Policy</Text>.
          </Text>

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

  // Welcome
  hero: { alignItems: 'center', paddingTop: SPACING.xl, paddingBottom: SPACING.lg, gap: 4 },
  wordmark: { fontFamily: FONTS.display, fontSize: 34, color: c.text, letterSpacing: -0.5, marginTop: SPACING.sm },
  tagline: { fontFamily: FONTS.body, fontSize: 15, color: c.textSecondary, textAlign: 'center', paddingHorizontal: SPACING.lg },

  promises: { gap: 8, marginBottom: SPACING.lg, paddingHorizontal: SPACING.sm },
  promiseRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  promiseIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.accentDim, alignItems: 'center', justifyContent: 'center' },
  promiseText: { fontFamily: FONTS.bodyMedium, fontSize: 14, color: c.text, flex: 1 },

  // Mode tabs
  modeTabs: {
    flexDirection: 'row', backgroundColor: c.surfaceHigh, borderRadius: 999,
    borderWidth: 1, borderColor: c.cardBorder, padding: 3, marginBottom: SPACING.md,
  },
  modeTab: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center' },
  modeTabActive: { backgroundColor: c.accent },
  modeTabText: { fontFamily: FONTS.bodyMedium, fontSize: 14, color: c.textSecondary },
  modeTabTextActive: { color: isLightColor(c.accent) ? '#111111' : '#FFFFFF', fontFamily: FONTS.bodyBold },

  // Form card
  form: { padding: SPACING.lg, gap: SPACING.md },
  fieldGroup: { gap: 6 },
  label: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: c.textSecondary, marginLeft: 2 },
  input: {
    backgroundColor: c.background, borderRadius: 14, borderWidth: 1, borderColor: c.cardBorder,
    paddingHorizontal: SPACING.md, paddingVertical: 13, fontFamily: FONTS.body, fontSize: 16, color: c.text,
  },
  passwordWrap: { position: 'relative', justifyContent: 'center' },
  eyeBtn: { position: 'absolute', right: 6, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  forgotLink: { alignSelf: 'flex-end', paddingVertical: 4 },
  forgotLinkText: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: c.accentBright },

  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, borderWidth: 1, padding: SPACING.md },
  noticeText: { fontFamily: FONTS.body, fontSize: 14, flex: 1, lineHeight: 19 },

  submitButton: { backgroundColor: btnBg, borderRadius: 999, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  submitButtonLoading: { opacity: 0.7 },
  submitButtonText: { fontFamily: FONTS.bodyBold, fontSize: 16, color: btnFg },

  why: { fontFamily: FONTS.body, fontSize: 13, color: c.textMuted, textAlign: 'center', marginTop: SPACING.md, paddingHorizontal: SPACING.md },
  finePrint: { fontFamily: FONTS.body, fontSize: 11.5, color: c.textMuted, textAlign: 'center', marginTop: SPACING.lg, lineHeight: 18 },
  finePrintLink: { color: c.accentBright, textDecorationLine: 'underline' },
});
};
