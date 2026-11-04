// ─── Today as a day plan ──────────────────────────────────────────────────────
//
// The beginner Today: a calm planner. A small companion badge in the top corner, one line on
// whether blocking is on, the day split into Morning / Afternoon / Evening (the current part is open),
// and one full-width "Calm" button. Every row opens a screen that already exists.
// Numbers only go up: "days gained" counts days with a walk-away and never resets (no punishing streaks).

import { useState } from 'react';
import { ScrollView, View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/hooks/useTheme';
import { useUserStore } from '@/stores/useUserStore';
import { getLocalDateKey } from '@/utils/date';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';
import { PackSprite } from './PackSprite';
import { SlipCard } from './SlipCard';
import type { CharacterId } from '@/stores/usePetStore';
import type { GoonStage } from '@/constants/sprites';

type FeatherName = React.ComponentProps<typeof Feather>['name'];
type Part = 'morning' | 'afternoon' | 'evening';

type Item = { icon: FeatherName; label: string; sub: string; path: string };

const PARTS: { id: Part; title: string; when: string; icon: FeatherName }[] = [
  { id: 'morning',   title: 'Morning',   when: 'Before noon',   icon: 'sunrise' },
  { id: 'afternoon', title: 'Afternoon', when: 'Noon to 5',     icon: 'sun' },
  { id: 'evening',   title: 'Evening',   when: 'After 5',       icon: 'moon' },
];

const ITEMS: Record<Part, Item[]> = {
  morning: [
    { icon: 'file-text', label: "Read today's briefing", sub: 'A short read with an end',          path: '/(tabs)/feed' },
  ],
  afternoon: [
    { icon: 'zap',      label: 'Take a short break',  sub: 'A quick game for your hands',        path: '/(tabs)/arcade' },
    { icon: 'map-pin',  label: 'Step out',            sub: 'One thing to do nearby',             path: '/(tabs)/local' },
    { icon: 'activity', label: 'Walk together',       sub: 'Count steps with your companion',    path: '/walk' },
  ],
  evening: [
    { icon: 'moon',      label: 'Wind down',           sub: 'Slow the evening down',             path: '/(tabs)/calm' },
    { icon: 'book-open', label: 'Write one line',      sub: 'What was today like?',              path: '/journal' },
    { icon: 'list',      label: 'My plans',            sub: 'When it gets hard, I will...',      path: '/plans' },
  ],
};

function currentPart(): Part {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}

export function PlannerToday({ char, stage, petName, statusLabel, statusColor, protectionOff, onProtection, onCalm }: {
  char: CharacterId;
  stage: GoonStage;
  petName: string;
  statusLabel: string;
  statusColor: string;
  protectionOff: boolean;
  onProtection: () => void;
  onCalm: () => void;
}) {
  const { colors, cardStyle } = useTheme();
  const name = useUserStore((s) => s.name);
  const walkAways = useUserStore((s) => s.walkAwayCount);
  const daysGained = useUserStore((s) => s.totalActiveDays);
  const storeIntention = useUserStore((s) => s.dailyIntention);
  const intentionDate = useUserStore((s) => s.intentionDate);
  const setDailyIntention = useUserStore((s) => s.setDailyIntention);

  const now = currentPart();
  const [open, setOpen] = useState<Part | null>(now);
  const [draft, setDraft] = useState<string | null>(null);
  const intention = intentionDate === getLocalDateKey() ? storeIntention : '';

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const progress = walkAways === 0
    ? 'Your first walk-away starts the count.'
    : `${daysGained} day${daysGained === 1 ? '' : 's'} gained · ${walkAways} walk-away${walkAways === 1 ? '' : 's'}`;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {/* Header: greeting on the left, small companion badge in the corner */}
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.hello, { color: colors.text }]}>{name ? `${greet}, ${name}` : greet}</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>{progress}</Text>
        </View>
        <Pressable
          onPress={() => router.push('/customize' as any)}
          style={[styles.badge, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
          accessibilityRole="button"
          accessibilityLabel={`${petName || 'Your companion'}. Open Customize.`}
        >
          <PackSprite char={char} stage={stage} cell={3} />
        </Pressable>
      </View>

      {/* Protection strip */}
      <Pressable
        onPress={onProtection}
        style={[styles.strip, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
        accessibilityRole="button"
        accessibilityLabel={statusLabel}
      >
        <View style={[styles.dot, { backgroundColor: statusColor }]} />
        <Text style={[styles.stripText, { color: colors.text }]} numberOfLines={1}>{statusLabel}</Text>
        <Feather name={protectionOff ? 'alert-circle' : 'chevron-right'} size={16} color={protectionOff ? statusColor : colors.textMuted} />
      </Pressable>

      <SlipCard />

      {/* The day */}
      {PARTS.map((p) => {
        const isNow = p.id === now;
        const isOpen = open === p.id;
        return (
          <View key={p.id} style={[styles.block, cardStyle, { backgroundColor: colors.surface, borderColor: isNow ? colors.accent + '88' : colors.cardBorder }]}>
            <Pressable
              onPress={() => { Haptics.selectionAsync().catch(() => {}); setOpen(isOpen ? null : p.id); }}
              style={styles.blockHead}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              accessibilityLabel={`${p.title}, ${p.when}`}
            >
              <Feather name={p.icon} size={18} color={isNow ? colors.accent : colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.blockTitle, { color: colors.text }]}>{p.title}</Text>
                <Text style={[styles.blockWhen, { color: colors.textMuted }]}>{isNow ? 'Now' : p.when}</Text>
              </View>
              <Feather name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
            </Pressable>

            {isOpen && (
              <View style={styles.blockBody}>
                {p.id === 'morning' && (
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                    value={draft ?? intention}
                    onChangeText={setDraft}
                    onBlur={() => { if (draft !== null) { setDailyIntention(draft.trim()); setDraft(null); } }}
                    placeholder="What are you choosing instead today?"
                    placeholderTextColor={colors.textMuted}
                    returnKeyType="done"
                    maxLength={120}
                    accessibilityLabel="Today's intention"
                  />
                )}
                {ITEMS[p.id].map((it) => (
                  <Pressable
                    key={it.label}
                    onPress={() => router.push(it.path as any)}
                    style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
                    accessibilityRole="button"
                  >
                    <Feather name={it.icon} size={18} color={colors.accent} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowLabel, { color: colors.text }]}>{it.label}</Text>
                      <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{it.sub}</Text>
                    </View>
                    <Feather name="chevron-right" size={16} color={colors.textMuted} />
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        );
      })}

      {/* Calm: the one button for the moment the urge shows up */}
      <Pressable
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onCalm(); }}
        style={({ pressed }) => [styles.calm, { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel="Calm. Breathe, play, or write a line."
      >
        <Feather name="wind" size={20} color={colors.background} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.calmTitle, { color: colors.background }]}>Calm</Text>
          <Text style={[styles.calmSub, { color: colors.background }]}>Breathe, play, or write a line</Text>
        </View>
      </Pressable>

      <Pressable onPress={() => router.push('/customize' as any)} hitSlop={8} style={styles.layoutLink} accessibilityRole="button">
        <Text style={[styles.layoutText, { color: colors.textMuted }]}>Change how Today looks</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.huge },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },
  hello: { fontFamily: FONTS.display, fontSize: 26 },
  sub: { fontFamily: FONTS.body, fontSize: 13, marginTop: 2 },
  badge: { width: 52, height: 60, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  strip: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 12, paddingHorizontal: SPACING.md, minHeight: 44 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  stripText: { flex: 1, fontFamily: FONTS.bodyMedium, fontSize: 14 },
  block: { borderWidth: 1 },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, minHeight: 56 },
  blockTitle: { fontFamily: FONTS.bodyBold, fontSize: 16 },
  blockWhen: { fontFamily: FONTS.body, fontSize: 12 },
  blockBody: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md, gap: SPACING.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: 10, minHeight: 48 },
  rowLabel: { fontFamily: FONTS.bodyMedium, fontSize: 15 },
  rowSub: { fontFamily: FONTS.body, fontSize: 12.5 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontFamily: FONTS.body, fontSize: 14 },
  calm: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, borderRadius: 16, paddingVertical: 16, paddingHorizontal: SPACING.lg, minHeight: 64 },
  calmTitle: { fontFamily: FONTS.display, fontSize: 22 },
  calmSub: { fontFamily: FONTS.body, fontSize: 13, opacity: 0.9 },
  layoutLink: { alignSelf: 'center', paddingVertical: 6 },
  layoutText: { fontFamily: FONTS.body, fontSize: 12, textDecorationLine: 'underline' },
});
