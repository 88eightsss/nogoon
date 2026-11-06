// ─── "Need a minute" sheet ──────────────────────────────────────────────────────
//
// The moment the app exists for: someone is about to open a scroll hole. One tap from
// Home, five ways out: breathe, ground, make something small, a quick game, my plan.

import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

const OPTIONS: { icon: FeatherName; label: string; body: string; path: string }[] = [
  { icon: 'wind',      label: 'Breathe for a minute', body: 'Let the urge pass.',               path: '/breathe?mode=breathing' },
  { icon: 'anchor',    label: 'Ground yourself',      body: 'Five things you can see.',         path: '/breathe?mode=grounding' },
  { icon: 'edit-3',    label: 'Make something small', body: 'Draw or write for two minutes.',   path: '/make' },
  { icon: 'zap',       label: 'Play a quick game',    body: 'Give your hands something to do.', path: '/(tabs)/arcade' },
  { icon: 'list',      label: 'Open my plan',         body: 'What you decided to do instead.',  path: '/plans' },
];

export function TemptedSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors, cardStyle } = useTheme();
  const go = (path: string) => { onClose(); router.push(path as any); };
  const options = OPTIONS;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <View style={[styles.grab, { backgroundColor: colors.border }]} />
        <Text style={[styles.title, { color: colors.text }]}>Need a minute. Pick one.</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>The urge is loudest for about ten minutes.</Text>
        <View style={[styles.list, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          {options.map((o, i) => (
            <Pressable
              key={o.label}
              onPress={() => go(o.path)}
              accessibilityRole="button"
              accessibilityLabel={`${o.label}. ${o.body}`}
              style={({ pressed }) => [
                styles.row,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                i === 0 && { backgroundColor: colors.accentDim },
                { opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Feather name={o.icon} size={22} color={i === 0 ? colors.accentBright : colors.text} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.text }]}>{o.label}</Text>
                <Text style={[styles.body, { color: colors.textSecondary }]}>{o.body}</Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
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
  title: { fontFamily: FONTS.display, fontSize: 24, letterSpacing: -0.3 },
  sub:   { fontFamily: FONTS.body, fontSize: 13, marginBottom: SPACING.xs },
  list:  { overflow: 'hidden' },
  row:   { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8, paddingHorizontal: SPACING.lg, minHeight: 60 },
  label: { fontFamily: FONTS.bodyBold, fontSize: 15 },
  body:  { fontFamily: FONTS.body, fontSize: 12.5 },
  cancel:{ alignSelf: 'center', paddingVertical: SPACING.sm },
});
