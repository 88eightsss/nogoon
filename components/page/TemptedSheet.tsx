// ─── "Need a minute" sheet ──────────────────────────────────────────────────────
//
// The moment the app exists for: someone is about to open a scroll hole. One tap from
// My Page, four ways out. Every option is an existing screen.

import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';
import { useRoomStore } from '@/stores/useRoomStore';
import { TEMPTED_ORDER, type TemptedOptionId } from '@/constants/setupQuestions';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

const OPTIONS: Record<TemptedOptionId, { icon: FeatherName; label: string; body: string; path: string }> = {
  briefing: { icon: 'file-text', label: "Read today's briefing", body: 'A short read with an end.',      path: '/(tabs)/feed' },
  breathe:  { icon: 'wind',      label: 'Breathe for a minute', body: 'Let the urge pass.',           path: '/breathe' },
  game:     { icon: 'zap',       label: 'Play a quick game',    body: 'Give your hands something to do.', path: '/(tabs)/arcade' },
  calm:     { icon: 'moon',      label: 'Calm down',            body: 'Slow the whole thing down.',   path: '/(tabs)/calm' },
  write:    { icon: 'book-open', label: 'Write it out',         body: 'Say what you are really after.', path: '/journal' },
};

export function TemptedSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors, cardStyle } = useTheme();
  const go = (path: string) => { onClose(); router.push(path as any); };
  // "What helps first" (setup questions / Customize) picks the first option; nothing is hidden.
  const helpFirst = useRoomStore((s) => s.helpFirst);
  const options = TEMPTED_ORDER[helpFirst].map((id) => OPTIONS[id]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <View style={[styles.grab, { backgroundColor: colors.border }]} />
        <Text style={[styles.title, { color: colors.text }]}>Pause. Pick one.</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>The urge is loudest for about ten minutes.</Text>
        {options.map((o) => (
          <Pressable
            key={o.label}
            onPress={() => go(o.path)}
            style={({ pressed }) => [styles.row, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder, opacity: pressed ? 0.75 : 1 }]}
          >
            <Feather name={o.icon} size={20} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.text }]}>{o.label}</Text>
              <Text style={[styles.body, { color: colors.textSecondary }]}>{o.body}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </Pressable>
        ))}
        <Pressable onPress={onClose} style={styles.cancel} hitSlop={8}>
          <Text style={[styles.body, { color: colors.textMuted }]}>I'm okay, close this</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { padding: SPACING.lg, paddingBottom: SPACING.xl, gap: SPACING.sm, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: 1 },
  grab:  { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: SPACING.sm },
  title: { fontFamily: FONTS.display, fontSize: 24 },
  sub:   { fontFamily: FONTS.body, fontSize: 13, marginBottom: SPACING.xs },
  row:   { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md },
  label: { fontFamily: FONTS.bodyBold, fontSize: 15 },
  body:  { fontFamily: FONTS.body, fontSize: 12.5 },
  cancel:{ alignSelf: 'center', paddingVertical: SPACING.sm },
});
