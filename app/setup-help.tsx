// ─── Setup & fixes ────────────────────────────────────────────────────────────
// The same switches the first-run setup walks through, available any time from Me > Account & help.
// If blocking stops working (Android turned the service off, a phone update, a battery manager),
// everything needed to put it back is on this one screen, with the reasons for each.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, AppState, Platform, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useAppBlocker } from '@/hooks/useAppBlocker';
import { useNotificationListener } from '@/hooks/useNotificationListener';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';
import { crashReportingOn, setCrashReportingOn } from '@/lib/crashReport';
import { isLightColor, readableOn } from '@/utils/colorLuminance';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

const WHY: [FeatherName, string][] = [
  ['eye', 'To notice the moment you open a blocked app or site, so the pause shows up before it loads.'],
  ['list', 'It only sees which app is in front and the address bar of your browser, to match the list you choose.'],
  ['layers', 'To show the gate on top of that app: a breath, a quick game, or a walk with your pal.'],
  ['lock', 'It never reads what you type, your passwords or messages, and nothing leaves your phone.'],
  ['toggle-right', 'Android makes you switch it on yourself, and you can switch it off any time in Settings.'],
];

const STEPS = [
  'Tap "Turn on" above',
  'Tap "Installed apps" or scroll to find NoGoon',
  'Tap NoGoon, then switch it ON',
  'Tap "Allow" on the confirmation',
  'Come back here. The check mark appears by itself',
];

const FIXES: [string, string][] = [
  ['Blocking stopped after a phone update or restart', 'Android sometimes switches accessibility services off. Turn NoGoon back on with the button at the top of this screen.'],
  ['It works for a while, then quits', 'Your phone\'s battery manager is closing NoGoon. Use "Keep NoGoon always on" below, and on Samsung also remove NoGoon from Settings > Battery > Background usage limits > Sleeping apps.'],
  ['The switch is greyed out in Settings', 'Android blocks it while the app was installed from a file. Open the app\'s info, tap the three dots, then "Allow restricted settings", and try again.'],
  ['Still nothing', 'Open Last crash report, tap Share, and send it over. It has the error and your phone model, nothing personal.'],
];

type Colors = ReturnType<typeof useTheme>['colors'];

function Btn({ label, onPress, disabled, bg, fg }: { label: string; onPress: () => void; disabled?: boolean; bg: string; fg: string }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={[s.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : 1 }]}>
      <Text style={[s.btnText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}
function Done({ c }: { c: Colors }) { return <Feather name="check-circle" size={26} color={c.success} />; }
function Divider({ c }: { c: Colors }) { return <View style={[s.divider, { backgroundColor: c.cardBorder }]} />; }
function Row({ c, icon, title, sub, right }: { c: Colors; icon: FeatherName; title: string; sub: string; right: React.ReactNode }) {
  return (
    <View style={s.row}>
      <View style={[s.rowIcon, { backgroundColor: c.accentDim }]}><Feather name={icon} size={19} color={c.accentBright} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[s.rowTitle, { color: c.text }]}>{title}</Text>
        <Text style={[s.rowSub, { color: c.textSecondary }]}>{sub}</Text>
      </View>
      {right}
    </View>
  );
}

export default function SetupHelpScreen() {
  const { colors, cardStyle } = useTheme();
  const bg = useMemo(() => readableOn(colors.accent, colors.surface, 3), [colors.accent, colors.surface]);
  const fg = isLightColor(bg) ? '#111111' : '#FFFFFF';

  const {
    openSettings, serviceEnabled, checkServiceStatus, checkBatteryOptimized, openBatterySettings,
    isKnownOemOffender, openOemAutostartSettings,
  } = useAppBlocker();
  const { isGranted: notifGranted, isFilterEnabled: notifEnabled, isLoading: notifLoading, toggleFilter: toggleNotif, openSettings: openNotifSettings } = useNotificationListener();
  const [batteryExempt, setBatteryExempt] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [crashOn, setCrashOn] = useState(true);
  useEffect(() => { crashReportingOn().then(setCrashOn); }, []);

  const refresh = useCallback(() => {
    checkServiceStatus();
    checkBatteryOptimized().then((opt) => setBatteryExempt(!opt)).catch(() => {});
  }, [checkServiceStatus, checkBatteryOptimized]);

  // Re-check the moment you come back from Android Settings.
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') refresh(); });
    return () => sub.remove();
  }, [refresh]);

  const android = Platform.OS === 'android';
  const allGood = serviceEnabled && batteryExempt;

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={[s.title, { color: colors.text }]}>Setup & fixes</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {!android ? (
          <View style={[s.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder, padding: SPACING.lg }]}>
            <Text style={[s.rowTitle, { color: colors.text }]}>Blocking setup is for Android</Text>
            <Text style={[s.rowSub, { color: colors.textSecondary }]}>There is nothing to switch on here.</Text>
          </View>
        ) : (
          <>
            {/* Status */}
            <View style={[s.status, { backgroundColor: allGood ? colors.successDim : colors.accentDim, borderColor: allGood ? colors.success : colors.accent }]}>
              <Feather name={allGood ? 'check-circle' : 'alert-circle'} size={22} color={allGood ? colors.success : colors.accentBright} />
              <View style={{ flex: 1 }}>
                <Text style={[s.rowTitle, { color: colors.text }]}>{serviceEnabled ? (allGood ? 'Blocking is on and protected' : 'Blocking is on') : 'Blocking is off'}</Text>
                <Text style={[s.rowSub, { color: colors.textSecondary }]}>
                  {serviceEnabled
                    ? (batteryExempt ? 'Everything below is set.' : 'One more switch below keeps it from being closed in the background.')
                    : 'NoGoon cannot pause blocked apps until Accessibility is switched on.'}
                </Text>
              </View>
            </View>

            <View style={[s.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
              <Row
                c={colors}
                icon="smartphone"
                title="App blocking"
                sub="Accessibility access, so NoGoon can pause blocked apps"
                right={serviceEnabled ? <Done c={colors} /> : <Btn bg={bg} fg={fg} label="Turn on" onPress={openSettings} />}
              />

              {!serviceEnabled && (
                <View style={[s.inset, { backgroundColor: colors.background }]}>
                  <Text style={[s.insetTitle, { color: colors.textMuted }]}>How to turn it on</Text>
                  {STEPS.map((t, i) => (
                    <View key={t} style={s.stepRow}>
                      <Text style={[s.stepNum, { color: colors.accentBright }]}>{i + 1}</Text>
                      <Text style={[s.stepText, { color: colors.textSecondary }]}>{t}</Text>
                    </View>
                  ))}
                </View>
              )}

              <Pressable onPress={() => setShowWhy((v) => !v)} accessibilityRole="button" style={s.whyToggle}>
                <Feather name="help-circle" size={16} color={colors.accentBright} />
                <Text style={[s.whyToggleText, { color: colors.accentBright }]}>{showWhy || !serviceEnabled ? 'Why NoGoon needs Accessibility' : 'Why does NoGoon need Accessibility?'}</Text>
                {serviceEnabled && <Feather name={showWhy ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accentBright} />}
              </Pressable>
              {(showWhy || !serviceEnabled) && (
                <View style={[s.inset, { backgroundColor: colors.background, marginTop: 0 }]}>
                  {WHY.map(([icon, text]) => (
                    <View key={text} style={s.stepRow}>
                      <Feather name={icon} size={15} color={colors.accentBright} style={{ marginTop: 3 }} />
                      <Text style={[s.stepText, { color: colors.textSecondary }]}>{text}</Text>
                    </View>
                  ))}
                </View>
              )}

              <Divider c={colors} />
              <Row
                c={colors}
                icon="zap"
                title="Keep NoGoon always on"
                sub="Stops Android from closing it to save battery"
                right={batteryExempt ? <Done c={colors} /> : <Btn bg={bg} fg={fg} label="Turn on" onPress={openBatterySettings} />}
              />

              {isKnownOemOffender && (
                <>
                  <Divider c={colors} />
                  <Row
                c={colors}
                    icon="alert-triangle"
                    title="Your phone's battery manager"
                    sub="Your brand has its own, separate from Android's. Also try locking NoGoon in your recent apps."
                    right={<Btn bg={bg} fg={fg} label="Open" onPress={openOemAutostartSettings} />}
                  />
                </>
              )}

              <Divider c={colors} />
              <Row
                c={colors}
                icon="bell-off"
                title="Notification filter"
                sub="Optional. Quiets notifications from blocked apps"
                right={notifGranted && notifEnabled ? <Done c={colors} /> : <Btn bg={bg} fg={fg} label={notifLoading ? '...' : 'Turn on'} disabled={notifLoading} onPress={() => (notifGranted ? toggleNotif(true) : openNotifSettings())} />}
              />

              <Divider c={colors} />
              <Pressable onPress={() => router.push('/(tabs)/blocklist' as any)} accessibilityRole="button" style={s.linkRow}>
                <Feather name="shield" size={18} color={colors.textMuted} />
                <Text style={[s.rowTitle, { color: colors.text, flex: 1 }]}>Choose what to block</Text>
                <Feather name="chevron-right" size={18} color={colors.textMuted} />
              </Pressable>
            </View>

            {/* Troubleshooting */}
            <Text style={[s.section, { color: colors.textMuted }]}>If something is not working</Text>
            <View style={[s.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
              {FIXES.map(([q, a], i) => (
                <View key={q}>
                  {i > 0 && <Divider c={colors} />}
                  <View style={{ padding: SPACING.md, gap: 4 }}>
                    <Text style={[s.rowTitle, { color: colors.text }]}>{q}</Text>
                    <Text style={[s.rowSub, { color: colors.textSecondary }]}>{a}</Text>
                  </View>
                </View>
              ))}
              <Divider c={colors} />
              <View style={s.linkRow}>
                <Feather name="send" size={18} color={colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.rowTitle, { color: colors.text }]}>Send anonymous crash reports and usage counts</Text>
                  <Text style={[s.rowSub, { color: colors.textSecondary }]}>If the app crashes, it sends the error, the app version and your phone model. It also sends plain totals (how many times the gate opened, walk-aways, outings) with a random code that changes every day. No account, name or contents.</Text>
                </View>
                <Switch
                  value={crashOn}
                  onValueChange={(v) => { setCrashOn(v); setCrashReportingOn(v); }}
                  accessibilityLabel="Send anonymous crash reports and usage counts"
                  trackColor={{ true: colors.accent, false: colors.cardBorder }}
                />
              </View>
              <Divider c={colors} />
              <Pressable onPress={() => router.push('/crash-report' as any)} accessibilityRole="button" style={s.linkRow}>
                <Feather name="alert-triangle" size={18} color={colors.textMuted} />
                <Text style={[s.rowTitle, { color: colors.text, flex: 1 }]}>Last crash report</Text>
                <Feather name="chevron-right" size={18} color={colors.textMuted} />
              </Pressable>
              <Divider c={colors} />
              <Pressable onPress={() => router.push('/tutorial' as any)} accessibilityRole="button" style={s.linkRow}>
                <Feather name="map" size={18} color={colors.textMuted} />
                <Text style={[s.rowTitle, { color: colors.text, flex: 1 }]}>Replay the tour</Text>
                <Feather name="chevron-right" size={18} color={colors.textMuted} />
              </Pressable>
              <Divider c={colors} />
              <Pressable onPress={() => router.push('/setup-questions' as any)} accessibilityRole="button" style={s.linkRow}>
                <Feather name="sliders" size={18} color={colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.rowTitle, { color: colors.text }]}>Answer the setup questions again</Text>
                  <Text style={[s.rowSub, { color: colors.textSecondary }]}>Adds to your settings. Nothing is removed.</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  title: { fontFamily: FONTS.display, fontSize: 20 },
  content: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl ?? 48, gap: SPACING.md },
  status: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, borderRadius: 16, borderWidth: 1 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md },
  rowIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: FONTS.bodyBold, fontSize: 15 },
  rowSub: { fontFamily: FONTS.body, fontSize: 13, lineHeight: 18 },
  btn: { minHeight: 40, paddingHorizontal: 16, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: FONTS.bodyBold, fontSize: 14 },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: SPACING.md },
  inset: { marginHorizontal: SPACING.md, marginBottom: SPACING.md, borderRadius: 12, padding: SPACING.md, gap: SPACING.sm },
  insetTitle: { fontFamily: FONTS.bodyBold, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  stepRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  stepNum: { fontFamily: FONTS.bodyBold, fontSize: 14, width: 16 },
  stepText: { flex: 1, fontFamily: FONTS.body, fontSize: 13.5, lineHeight: 19 },
  whyToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, minHeight: 44 },
  whyToggleText: { fontFamily: FONTS.bodyBold, fontSize: 13.5, flex: 1 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, minHeight: 52 },
  section: { fontFamily: FONTS.bodyBold, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginTop: SPACING.sm },
});
