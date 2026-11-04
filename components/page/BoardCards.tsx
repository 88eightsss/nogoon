// ─── Instead Board: cards inside a day block ────────────────────────────────

import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';
import { usePlannerStore, visibleCards, type CardKind, type DayPart } from '@/stores/usePlannerStore';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

const KINDS: { id: CardKind; label: string; icon: FeatherName; hint: string }[] = [
  { id: 'do',   label: 'Do',   icon: 'check-circle', hint: 'Something to get done' },
  { id: 'make', label: 'Make', icon: 'edit-3',       hint: 'Something small to create' },
  { id: 'hold', label: 'Hold', icon: 'anchor',       hint: 'A plan for a hard hour' },
];

export function BoardCards({ part, pickedId }: { part: DayPart; pickedId: string | null }) {
  const { colors } = useTheme();
  const cards = usePlannerStore((s) => s.cards);
  const toggle = usePlannerStore((s) => s.toggleCard);
  const remove = usePlannerStore((s) => s.removeCard);
  const add = usePlannerStore((s) => s.addCard);
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<CardKind>('do');
  const [text, setText] = useState('');
  const mine = visibleCards(cards, part);
  const save = () => { if (!text.trim()) return; add(kind, part, text); setText(''); setAdding(false); };

  return (
    <View style={{ gap: SPACING.sm }}>
      {mine.map((c) => {
        const k = KINDS.find((x) => x.id === c.kind)!;
        const done = !!c.doneOn;
        const picked = pickedId === c.id && !done;
        return (
          <View key={c.id} style={[styles.card, { borderColor: picked ? colors.accent : colors.border, backgroundColor: picked ? colors.accent + '14' : 'transparent' }]}>
            <Pressable
              onPress={() => toggle(c.id)}
              hitSlop={8}
              style={styles.check}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: done }}
              accessibilityLabel={c.text}
            >
              <Feather name={done ? 'check-square' : 'square'} size={22} color={done ? colors.success : colors.textMuted} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardText, { color: done ? colors.textMuted : colors.text, textDecorationLine: done ? 'line-through' : 'none' }]}>{c.text}</Text>
              <View style={styles.kindRow}>
                <Feather name={k.icon} size={11} color={colors.textMuted} />
                <Text style={[styles.kind, { color: colors.textMuted }]}>{picked ? 'Start with this one' : k.label}</Text>
              </View>
            </View>
            {c.kind === 'make' && !done && (
              <Pressable onPress={() => router.push('/make' as any)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Open Make">
                <Feather name="arrow-right" size={18} color={colors.accent} />
              </Pressable>
            )}
            <Pressable onPress={() => remove(c.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Remove card">
              <Feather name="x" size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        );
      })}

      {adding ? (
        <View style={[styles.composer, { borderColor: colors.border }]}>
          <View style={styles.kinds}>
            {KINDS.map((k) => (
              <Pressable
                key={k.id}
                onPress={() => setKind(k.id)}
                style={[styles.kindChip, { borderColor: kind === k.id ? colors.accent : colors.border, backgroundColor: kind === k.id ? colors.accent + '1A' : 'transparent' }]}
                accessibilityRole="radio"
                accessibilityState={{ selected: kind === k.id }}
              >
                <Feather name={k.icon} size={14} color={kind === k.id ? colors.accent : colors.textSecondary} />
                <Text style={[styles.kindChipText, { color: kind === k.id ? colors.accent : colors.textSecondary }]}>{k.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.kind, { color: colors.textMuted }]}>{KINDS.find((k) => k.id === kind)!.hint}</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            value={text}
            onChangeText={setText}
            placeholder={kind === 'hold' ? 'After dinner: walk, not phone' : kind === 'make' ? 'Draw my room' : 'Reply to the email'}
            placeholderTextColor={colors.textMuted}
            maxLength={80}
            returnKeyType="done"
            onSubmitEditing={save}
            autoFocus
            accessibilityLabel="Card text"
          />
          <View style={{ flexDirection: 'row', gap: SPACING.md }}>
            <Pressable onPress={save} hitSlop={8} accessibilityRole="button"><Text style={[styles.action, { color: colors.accent }]}>Add</Text></Pressable>
            <Pressable onPress={() => { setAdding(false); setText(''); }} hitSlop={8} accessibilityRole="button"><Text style={[styles.action, { color: colors.textMuted }]}>Cancel</Text></Pressable>
          </View>
        </View>
      ) : (
        <Pressable onPress={() => setAdding(true)} style={styles.addRow} accessibilityRole="button" accessibilityLabel="Add a card">
          <Feather name="plus" size={16} color={colors.accent} />
          <Text style={[styles.action, { color: colors.accent }]}>Add a card</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderWidth: 1, borderRadius: 12, padding: SPACING.sm, minHeight: 52 },
  check: { width: 28, alignItems: 'center' },
  cardText: { fontFamily: FONTS.bodyMedium, fontSize: 15 },
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  kind: { fontFamily: FONTS.body, fontSize: 11.5 },
  composer: { borderWidth: 1, borderRadius: 12, padding: SPACING.sm, gap: SPACING.sm },
  kinds: { flexDirection: 'row', gap: SPACING.sm },
  kindChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12, minHeight: 40 },
  kindChipText: { fontFamily: FONTS.bodyMedium, fontSize: 13.5 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontFamily: FONTS.body, fontSize: 14 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingVertical: 4 },
  action: { fontFamily: FONTS.bodyBold, fontSize: 14 },
});
