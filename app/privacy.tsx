import { useMemo } from 'react';
// ─── Privacy Policy ───────────────────────────────────────────────────────────
//
// Required by Google Play for apps using:
//   - Accessibility Service (watches app switches)
//   - VPN Service (intercepts DNS queries)
//   - Notification Listener (cancels notifications from blocked apps)
//
// Blocking itself runs on-device. Signed-in accounts sync progress and lists to Supabase.

import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { FONTS } from '@/constants/Colors';
import { NETWORK_SHIELD_ENABLED } from '@/constants/features';
import { useThemedColors, type ArcadeColors } from '@/hooks/useThemedColors';
import { SPACING } from '@/constants/Spacing';

const LAST_UPDATED = 'October 2026';

function Section({ title, body }: { title: string; body: string }) {
  const COLORS = useThemedColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{body}</Text>
    </View>
  );
}

export default function PrivacyScreen() {
  const COLORS = useThemedColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={COLORS.textSecondary} />
        </Pressable>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.updated}>Last updated: {LAST_UPDATED}</Text>

        <Text style={styles.intro}>
          NoGoon is a focus and app-blocking tool. We believe your data is yours.
          Blocking happens entirely on your device. If you create an account, your progress and
          lists are also saved to our servers so you can restore them — this policy explains exactly what.
        </Text>

        <Section
          title="What NoGoon can access"
          body={
            `NoGoon requests ${NETWORK_SHIELD_ENABLED ? 'three' : 'two'} special permissions, each used for a single purpose:\n\n` +
            '• Accessibility Service — detects when you open a blocked app and shows the gate screen. ' +
            'NoGoon does not read the content of other apps, does not record keystrokes, and does not ' +
            'log which apps you use.\n\n' +
            (NETWORK_SHIELD_ENABLED
              ? '• VPN Service (Network Shield) — intercepts DNS queries only, allowing NoGoon to block ' +
                'blocked apps at the network layer. NoGoon does not inspect, log, or transmit the content ' +
                'of your internet traffic. Non-DNS traffic bypasses the VPN entirely.\n\n'
              : '') +
            '• Notification Access — silences notifications from blocked apps. NoGoon reads only the ' +
            'package name of each notification to check if it is from a blocked app. Notification ' +
            'content is never read or stored.'
          }
        />

        <Section
          title="Data stored on your device"
          body={
            'NoGoon stores the following on your device using Android SharedPreferences and AsyncStorage:\n\n' +
            '• Your blocked app and website lists, and your Modes\n' +
            '• Your game scores, streak count, and walk-away counts\n' +
            '• Your journal entries, brain-bubble notes, daily intention and nightly rule\n' +
            '• Your companion, theme and protection settings\n\n' +
            'If you are signed in, some of this is also copied to your account — see the next section. ' +
            'Brain-bubble notes and the content of other apps never leave your device.'
          }
        />

        <Section
          title="Account data (optional sign-in)"
          body={
            'If you create an account, we store your email address and name, and sync the following to our ' +
            'database (Supabase): points, XP, level, streak, game and walk-away counts; the websites and ' +
            'apps on your blocklist; the date and score of each game you play; and the journal entries ' +
            'you write. If you set an accountability partner, we store their name and email and use them ' +
            'only to send the notifications you turned on (the email names the site you tried to open). ' +
            'We do not sell this data and do not share it with advertisers. We use it solely to ' +
            'restore your progress across reinstalls and devices and to run the features above. ' +
            'Journal entries are never shared with your partner or anyone else.'
          }
        />

        <Section
          title="Advertising"
          body={
            'NoGoon shows ads via Google AdMob. AdMob may use the Android Advertising ID to ' +
            'serve relevant ads. You can opt out of personalized ads in your Android Settings under ' +
            'Privacy → Ads. NoGoon itself does not pass personal data to AdMob beyond what ' +
            'the AdMob SDK collects automatically.'
          }
        />

        <Section
          title="Data retention and deletion"
          body={
            'Local data is deleted when you uninstall the app. You can delete your account at ' +
            'any time from Me → Delete account; this immediately erases your profile, progress, ' +
            'blocklist and sessions from our servers. If you can no longer open the app, email ' +
            'jtshibao@gmail.com with a deletion request and we will delete your account data ' +
            'within 30 days.'
          }
        />

        <Section
          title="Children"
          body={
            'NoGoon is for adults aged 18 and over and asks you to confirm your age when you set it up. ' +
            'We do not knowingly collect data from anyone under 18. If you believe someone under 18 ' +
            'has used NoGoon, contact us and we will delete their data.'
          }
        />

        <Section
          title="Changes to this policy"
          body={
            'If we make material changes to this policy, we will update the "Last updated" date ' +
            'above. Continued use of the app after changes constitutes acceptance of the new policy.'
          }
        />

        <Section
          title="Contact"
          body={'Questions? Email us at jtshibao@gmail.com'}
        />

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (COLORS: ArcadeColors) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  backBtn: {
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
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  updated: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
  },
  intro: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 23,
    marginBottom: SPACING.xl,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  sectionBody: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
});
