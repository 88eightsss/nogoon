// ─── Onboarding styles ────────────────────────────────────────────────────────
// Shared by app/onboarding.tsx, the setup questions and their pickers, so every
// first-run screen uses the same type, spacing and theme tokens.

import { StyleSheet } from 'react-native';
import { useMemo } from 'react';
import { FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import type { ThemePalette } from '@/constants/Themes';
import { useTheme } from '@/hooks/useTheme';
import { isLightColor, readableOn } from '@/utils/colorLuminance';

/** Button fill: the theme accent, nudged until it clearly stands out from the card it sits on;
 *  label color flips black/white to match. */
export function onboardingButton(c: ThemePalette): { bg: string; fg: string } {
  const bg = readableOn(c.accent, c.surface, 3);
  return { bg, fg: isLightColor(bg) ? '#111111' : '#FFFFFF' };
}

/** Theme colors, card style, button colors and the shared stylesheet in one call. */
export function useOnboardingStyles() {
  const { colors: c, cardStyle: card } = useTheme();
  const btn = useMemo(() => onboardingButton(c), [c]);
  const styles = useMemo(() => makeOnboardingStyles(c, card, btn), [c, card, btn]);
  return { c, card, btn, styles };
}

export const makeOnboardingStyles = (c: ThemePalette, card: ReturnType<typeof useTheme>['cardStyle'], btn: { bg: string; fg: string }) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  flex: { flex: 1 },

  // Shared bits
  title: { fontFamily: FONTS.display, fontSize: 34, color: c.text, textAlign: 'center', lineHeight: 42, letterSpacing: -0.5 },
  sub: { fontFamily: FONTS.body, fontSize: 15, color: c.textSecondary, textAlign: 'center', lineHeight: 22 },
  primary: { width: '100%', minHeight: 52, backgroundColor: btn.bg, borderRadius: 999, paddingVertical: 14, paddingHorizontal: SPACING.lg, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.sm },
  primaryText: { fontFamily: FONTS.bodyBold, fontSize: 16, color: btn.fg },
  backRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, paddingHorizontal: SPACING.md },
  backLink: { fontFamily: FONTS.bodyMedium, fontSize: 14, color: c.textMuted },
  iconBubble: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentDim, marginBottom: SPACING.sm },

  // ── Slides ──
  skipButton: { position: 'absolute', top: SPACING.md, right: SPACING.lg, zIndex: 5, minHeight: 44, justifyContent: 'center', paddingHorizontal: SPACING.sm },
  skipButtonText: { fontFamily: FONTS.bodyMedium, fontSize: 15, color: c.textMuted },
  slidesWrapper: { flex: 1, overflow: 'hidden' },
  slidesRow: { flexDirection: 'row', flex: 1 },   // width set by the screen (slides x screen width)
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl },
  slideIconWrap: { width: 96, height: 96, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.xl },
  slideTitle: { fontFamily: FONTS.display, fontSize: 36, textAlign: 'center', lineHeight: 44, letterSpacing: -0.5, marginBottom: SPACING.lg, color: c.text },
  slideBody: { fontFamily: FONTS.body, fontSize: 17, color: c.textSecondary, textAlign: 'center', lineHeight: 26 },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: SPACING.sm, paddingVertical: SPACING.xl },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.border },
  dotActive: { width: 22, backgroundColor: c.accent },

  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.md },
  backButton: { width: 80, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  backButtonText: { fontFamily: FONTS.bodyMedium, fontSize: 15, color: c.textMuted },
  nextButton: { flex: 1, minHeight: 52, backgroundColor: btn.bg, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  nextButtonText: { fontFamily: FONTS.bodyBold, fontSize: 16, color: btn.fg },

  // ── Companion screen ──
  companionScreen: { flexGrow: 1, alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.xl, gap: SPACING.md },
  sectionLabel: { alignSelf: 'flex-start', fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1.2, color: c.textMuted, textTransform: 'uppercase', marginTop: SPACING.sm },
  starterRow: { flexDirection: 'row', gap: SPACING.sm, width: '100%' },
  starterCard: { flex: 1, alignItems: 'center', backgroundColor: c.surface, borderRadius: card.borderRadius, borderWidth: 2, borderColor: c.cardBorder, paddingVertical: SPACING.lg, paddingHorizontal: SPACING.xs, gap: SPACING.xs, minHeight: 150 },
  companionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, width: '100%' },
  companionCard: { flexBasis: '22%', flexGrow: 1, alignItems: 'center', backgroundColor: c.surface, borderRadius: card.borderRadius, borderWidth: 2, borderColor: c.cardBorder, paddingVertical: SPACING.md, paddingHorizontal: SPACING.xs, gap: SPACING.xs },
  companionCardName: { fontFamily: FONTS.bodyBold, fontSize: 13, color: c.text },
  starterName: { fontFamily: FONTS.display, fontSize: 17, color: c.text },
  companionCardTag: { fontFamily: FONTS.body, fontSize: 10, color: c.textMuted, textAlign: 'center', lineHeight: 14 },
  starterTag: { fontFamily: FONTS.body, fontSize: 11, color: c.textSecondary, textAlign: 'center', lineHeight: 15 },
  companionNameLabel: { fontFamily: FONTS.bodyBold, fontSize: 11, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1.2, alignSelf: 'flex-start', marginTop: SPACING.sm, marginBottom: -SPACING.xs },
  companionNameInput: { width: '100%', minHeight: 52, backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.cardBorder, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, fontFamily: FONTS.body, fontSize: 16, color: c.text, textAlign: 'center' },

  // ── Palette screen ──
  paletteScreen: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.xl, gap: SPACING.md },
  modeSwitch: { flexDirection: 'row', alignSelf: 'center', backgroundColor: c.surfaceHigh, borderRadius: 999, borderWidth: 1, borderColor: c.cardBorder, padding: 3, marginBottom: SPACING.sm },
  modeOption: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 20, borderRadius: 999 },
  modeOptionText: { fontFamily: FONTS.bodyBold, fontSize: 14 },
  paletteGrid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: SPACING.md },
  paletteCard: { width: '48%', borderRadius: card.borderRadius, borderWidth: 1.5, padding: SPACING.sm, gap: SPACING.sm },
  paletteSurface: { borderRadius: 10, padding: SPACING.sm, gap: SPACING.sm },
  paletteBar: { height: 8, borderRadius: 4, width: '60%' },
  paletteDots: { flexDirection: 'row', gap: 6 },
  paletteDot: { width: 12, height: 12, borderRadius: 6 },
  paletteName: { fontFamily: FONTS.bodyBold, fontSize: 14, paddingHorizontal: 2 },
  paletteCheck: { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },

  // ── Name screen ──
  nameScreen: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.lg, gap: SPACING.md },
  nameInput: { width: '100%', minHeight: 56, backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.cardBorder, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, fontFamily: FONTS.body, fontSize: 18, color: c.text, textAlign: 'center', marginTop: SPACING.sm },
  nameInputError: { borderColor: c.danger },
  ageRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, alignSelf: 'flex-start', minHeight: 44 },
  ageText: { fontFamily: FONTS.body, fontSize: 15, color: c.textSecondary },
  nameErrorText: { fontFamily: FONTS.body, fontSize: 13, color: c.danger, alignSelf: 'flex-start' },

  // ── Setup step ──
  setupScreen: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.xl, gap: SPACING.lg },
  setupCard: { width: '100%', backgroundColor: c.surface, borderRadius: card.borderRadius, borderWidth: card.borderWidth, borderColor: c.cardBorder, overflow: 'hidden' },
  setupRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.lg, gap: SPACING.md },
  setupRowLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flex: 1 },
  setupRowIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentDim },
  setupRowText: { flex: 1, gap: 2 },
  setupRowTitle: { fontFamily: FONTS.bodyBold, fontSize: 15, color: c.text },
  setupRowSub: { fontFamily: FONTS.body, fontSize: 13, color: c.textSecondary, lineHeight: 18 },
  setupDivider: { height: 1, backgroundColor: c.cardBorder, marginHorizontal: SPACING.lg },
  setupEnableButton: { minHeight: 44, justifyContent: 'center', borderRadius: 999, paddingHorizontal: SPACING.lg },
  setupEnableButtonText: { fontFamily: FONTS.bodyBold, fontSize: 14, color: btn.fg },
  setupContinueText: { fontFamily: FONTS.bodyBold, fontSize: 16, color: btn.fg },
  setupSkipText: { fontFamily: FONTS.bodyMedium, fontSize: 14, color: c.textMuted, minHeight: 44, textAlignVertical: 'center', paddingTop: 10 },

  // Site chips
  chipSection: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg, gap: SPACING.md },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: SPACING.md, borderRadius: 999, borderWidth: 1, borderColor: c.cardBorder, backgroundColor: c.background },
  chipName: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: c.textSecondary },
  chipAddBtn: { minHeight: 48, backgroundColor: btn.bg, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  chipAddBtnText: { fontFamily: FONTS.bodyBold, fontSize: 15, color: btn.fg },

  whyBox: { marginHorizontal: SPACING.lg, marginTop: SPACING.lg, backgroundColor: c.background, borderRadius: 12, padding: SPACING.md, gap: SPACING.sm },
  whyTitle: { fontFamily: FONTS.bodyBold, fontSize: 12, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  whyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  whyText: { fontFamily: FONTS.body, fontSize: 13.5, color: c.textSecondary, flex: 1, lineHeight: 20 },
  accessibilitySteps: { marginHorizontal: SPACING.lg, marginBottom: SPACING.lg, backgroundColor: c.background, borderRadius: 12, padding: SPACING.md, gap: SPACING.xs },
  accessibilityStepsTitle: { fontFamily: FONTS.bodyBold, fontSize: 12, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: SPACING.xs },
  accessibilityStep: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  accessibilityStepNum: { fontFamily: FONTS.monoBold, fontSize: 12, color: c.accentBright, width: 16, marginTop: 1 },
  accessibilityStepText: { fontFamily: FONTS.body, fontSize: 13, color: c.textSecondary, flex: 1, lineHeight: 20 },
  // ── Setup questions (components/onboarding/SetupQuestions.tsx) ──
  qScreen: { flexGrow: 1, paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.xl, gap: SPACING.md },
  qTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  qTopBtn: { minWidth: 64, minHeight: 44, justifyContent: 'center' },
  qTopText: { fontFamily: FONTS.bodyMedium, fontSize: 15, color: c.textMuted },
  qCount: { fontFamily: FONTS.monoBold, fontSize: 12, letterSpacing: 1, color: c.textMuted },
  qBars: { flexDirection: 'row', gap: 6 },
  qBar: { flex: 1, height: 4, borderRadius: RADIUS.xs, backgroundColor: c.border },
  qBarOn: { backgroundColor: c.accent },
  qTitle: { fontFamily: FONTS.display, fontSize: 30, color: c.text, lineHeight: 36, letterSpacing: -0.5, marginTop: SPACING.sm },
  qSub: { fontFamily: FONTS.body, fontSize: 15, color: c.textSecondary, lineHeight: 22 },
  qList: { gap: SPACING.sm },
  qGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: SPACING.sm },
  qChoice: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, minHeight: 60, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, backgroundColor: c.surface, borderRadius: card.borderRadius, borderWidth: 2, borderColor: c.cardBorder },
  qTile: { width: '48.5%', minHeight: 112, padding: SPACING.lg, gap: SPACING.xs, backgroundColor: c.surface, borderRadius: card.borderRadius, borderWidth: 2, borderColor: c.cardBorder },
  qChoiceOn: { borderColor: btn.bg, backgroundColor: c.accentDim },
  qChoiceText: { flex: 1, gap: 2 },
  qChoiceTitle: { fontFamily: FONTS.bodyBold, fontSize: 16, color: c.text },
  qChoiceSub: { fontFamily: FONTS.body, fontSize: 13, color: c.textSecondary, lineHeight: 18 },
  qNote: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: c.surface },
  qNoteText: { flex: 1, fontFamily: FONTS.body, fontSize: 13.5, color: c.textSecondary, lineHeight: 20 },
  qCheckRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, minHeight: 52, paddingHorizontal: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.cardBorder },
  qSpacer: { flex: 1, minHeight: SPACING.md },
  qSkipAll: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  qGroupLabel: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1.2, color: c.textMuted, textTransform: 'uppercase', marginTop: SPACING.sm },
});

