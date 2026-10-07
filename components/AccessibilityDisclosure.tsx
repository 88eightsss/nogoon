// ─── AccessibilityDisclosure ─────────────────────────────────────────────────
//
// The in-app "prominent disclosure" Google Play requires before NoGoon sends a
// user to Android's Accessibility settings. Mounted once in app/_layout.tsx and
// driven by useDisclosureStore. Wording is deliberately plain and matches the
// Play Data safety form: everything stays on the device.

import React, { useMemo } from 'react';
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useDisclosureStore } from '@/stores/useDisclosureStore';
import { useThemedColors, type ArcadeColors } from '@/hooks/useThemedColors';
import { FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

export function AccessibilityDisclosure() {
  const COLORS = useThemedColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const visible = useDisclosureStore((s) => s.visible);
  const accept  = useDisclosureStore((s) => s.accept);
  const decline = useDisclosureStore((s) => s.decline);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={decline} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Feather name="shield" size={26} color={COLORS.indigoBright} />
          </View>
          <Text style={styles.title}>Before you enable app blocking</Text>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.body}>
              NoGoon uses Android's Accessibility Service to block the apps and sites you choose.
            </Text>
            <Text style={styles.lead}>What it does</Text>
            <Text style={styles.body}>
              It notices which app is in the foreground and, in supported browsers, which website
              address you're visiting. If that app or site is on your blocklist, NoGoon shows the
              gate screen instead.
            </Text>
            <Text style={styles.lead}>What it doesn't do</Text>
            <Text style={styles.body}>
              It doesn't read your messages, passwords or anything you type, and it doesn't record
              or keep a history of your browsing or app use. Nothing it sees is sold or shared, and
              this checking happens on your phone.
            </Text>
            <Text style={styles.body}>
              You stay in control: you can turn the service off at any time in Android Settings
              &gt; Accessibility.
            </Text>
          </ScrollView>

          <Pressable style={styles.agree} onPress={accept} accessibilityRole="button">
            <Text style={styles.agreeText}>Agree and continue</Text>
          </Pressable>
          <Pressable style={styles.decline} onPress={decline} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.declineText}>No thanks</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (COLORS: ArcadeColors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    maxHeight: '88%',
  },
  iconWrap: { alignSelf: 'center', marginBottom: SPACING.sm },
  title: {
    fontFamily: FONTS.bodyBold,
    fontSize: 19,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  scroll: { flexGrow: 0, marginBottom: SPACING.md },
  lead: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: COLORS.textPrimary,
    marginTop: SPACING.sm,
    marginBottom: 2,
  },
  body: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
  },
  agree: {
    backgroundColor: COLORS.indigoBright,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  agreeText: { fontFamily: FONTS.bodyBold, fontSize: 16, color: COLORS.background },
  decline: { alignItems: 'center', paddingTop: SPACING.md, paddingBottom: 2 },
  declineText: { fontFamily: FONTS.bodyMedium, fontSize: 14, color: COLORS.textMuted },
});
