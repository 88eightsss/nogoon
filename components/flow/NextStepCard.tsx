// ─── Next-step card (top of Today) ────────────────────────────────────────────
// One card, one thing to do. Hidden when there is nothing to suggest, when the person chose
// "Show me everything", or after "Not now" (back tomorrow). See utils/nextStep.ts for the order.

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/hooks/useTheme';
import { useUserStore } from '@/stores/useUserStore';
import { usePackStore } from '@/stores/usePackStore';
import { useFlowStore } from '@/stores/useFlowStore';
import { pickNextStep, type NextStep } from '@/utils/nextStep';
import type { BlockingStatus } from '@/utils/blockingStatus';
import { getLocalDateKey } from '@/utils/date';
import { UNDER_CONSTRUCTION } from '@/constants/construction';
import { FONTS } from '@/constants/Colors';

export function NextStepCard({ blockingStatus, onOpenSettings, onPause }: {
  blockingStatus: BlockingStatus;
  onOpenSettings: () => void;
  onPause: () => void;
}) {
  const { colors, cardStyle } = useTheme();
  const walkAways = useUserStore((s) => s.walkAwayCount);
  const blocklist = useUserStore((s) => s.blocklist);
  const blockedApps = useUserStore((s) => s.blockedApps);
  const gateNote = usePackStore((s) => s.gateNote);
  const { pauseSeen, briefingOpened, localVisited, stepOutSeen, cardHiddenOn, showEverything, hideCardFor } = useFlowStore();

  if (showEverything || cardHiddenOn === getLocalDateKey()) return null;

  const step: NextStep | null = pickNextStep({
    blockingStatus,
    blockedCount: blocklist.length + blockedApps.length,
    walkAways,
    pauseSeen,
    briefingOpened,
    localVisited,
    hasGateNote: gateNote.trim().length > 0,
    stepOutLive: !UNDER_CONSTRUCTION.stepOutFeed,
    stepOutSeen,
  });
  if (!step) return null;

  const go = () => {
    Haptics.selectionAsync().catch(() => {});
    if (step.action.kind === 'settings') onOpenSettings();
    else if (step.action.kind === 'pause') onPause();
    else router.push(step.action.to as any);
  };

  return (
    <View
      style={[s.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.accent }]}
      accessibilityRole="summary"
    >
      <View style={s.head}>
        <View style={[s.iconWrap, { backgroundColor: colors.accentDim }]}>
          <Feather name={step.icon} size={18} color={colors.accent} />
        </View>
        <Text style={[s.kicker, { color: colors.accent }]}>Next step</Text>
      </View>
      <Text style={[s.title, { color: colors.text }]}>{step.title}</Text>
      <Text style={[s.body, { color: colors.textSecondary }]}>{step.body}</Text>
      <View style={s.row}>
        <Pressable onPress={() => hideCardFor(getLocalDateKey())} hitSlop={8} accessibilityRole="button" accessibilityLabel="Not now, show this tomorrow">
          <Text style={[s.later, { color: colors.textMuted }]}>Not now, show this tomorrow</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={go} style={[s.cta, { backgroundColor: colors.accent }]} accessibilityRole="button" accessibilityLabel={step.cta}>
          <Text style={s.ctaText}>{step.cta}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1.5, borderRadius: 18, padding: 16, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconWrap: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontFamily: FONTS.display, fontSize: 20, marginTop: 2 },
  body: { fontFamily: FONTS.body, fontSize: 14.5, lineHeight: 21 },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  later: { fontFamily: FONTS.bodyMedium, fontSize: 14, paddingVertical: 6 },
  cta: { paddingHorizontal: 22, height: 42, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: FONTS.bodyBold, fontSize: 14.5, color: '#fff' },
});
