// ─── Layout Picker ────────────────────────────────────────────────────────────
//
// Template picker modal — accessible from home edit mode ("Change template").
// Shows 5 presets with mini bubble previews; applying one replaces the layout.

import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useThemeStore } from '@/stores/useThemeStore';
import { TEMPLATES, WIDGET_CATALOG, newBubbleId, type Template } from '@/constants/HomeLayout';
import { FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

// Mini bubble preview — colored pill showing widget accent color
// Fraction of total row width each size takes (mirrors index.tsx bin-packing)
const MINI_FRAC = { small: 1 / 3, half: 1 / 2, full: 1 } as const;

function MiniRow({ template }: { template: Template }) {
  const { colors } = useTheme();

  // Bin-pack bubbles into rows the same way the home grid does
  type MR = { items: { color: string; frac: number }[] };
  const miniRows: MR[] = [];
  let row: MR['items'] = [];
  let used = 0;

  for (const b of template.bubbles) {
    const color = WIDGET_CATALOG.find((w) => w.id === b.widgetId)?.color ?? '#888';
    const frac = MINI_FRAC[b.size] ?? 0.5;
    if (used + frac > 1 + 0.001) {
      if (row.length) miniRows.push({ items: row });
      row = [{ color, frac }];
      used = frac;
    } else {
      row.push({ color, frac });
      used += frac;
    }
  }
  if (row.length) miniRows.push({ items: row });

  return (
    <View style={{ gap: 4 }}>
      {miniRows.map((mr, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 4 }}>
          {mr.items.map(({ color, frac }, j) => {
            const isSpacer = color === '#888888';
            return (
              <View
                key={j}
                style={[
                  miniStyles.pill,
                  { flex: frac },
                  isSpacer
                    ? { borderStyle: 'dashed', backgroundColor: 'transparent', borderColor: colors.border }
                    : { backgroundColor: color + '30', borderColor: color + '50' },
                ]}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

const miniStyles = StyleSheet.create({
  pill: { height: 14, borderRadius: 6, borderWidth: 0.5 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LayoutPickerScreen() {
  const { colors, cardStyle } = useTheme();
  const { homeLayout, setHomeLayout } = useThemeStore();

  function applyTemplate(template: Template) {
    setHomeLayout({
      templateId: template.id,
      bubbles: template.bubbles.map((b) => ({ ...b, id: newBubbleId() })),
    });
    router.back();
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.text} />
          </Pressable>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Choose a template</Text>
            <Text style={[styles.sub, { color: colors.textMuted }]}>You can customize it after</Text>
          </View>
        </View>

        {/* Template grid */}
        <View style={styles.grid}>
          {TEMPLATES.map((template) => {
            const active = homeLayout?.templateId === template.id;
            return (
              <Pressable
                key={template.id}
                style={[
                  styles.card,
                  cardStyle,
                  {
                    backgroundColor: colors.surface,
                    borderColor: active ? colors.accent : colors.cardBorder,
                    borderWidth: active ? 1.5 : 0.5,
                  },
                ]}
                onPress={() => applyTemplate(template)}
              >
                {active && (
                  <View style={[styles.activeBadge, { backgroundColor: colors.accentDim }]}>
                    <Feather name="check" size={10} color={colors.accent} />
                    <Text style={[styles.activeTxt, { color: colors.accent }]}>Active</Text>
                  </View>
                )}

                <Text style={[styles.cardName, { color: colors.text }]}>{template.name}</Text>
                <Text style={[styles.cardDesc, { color: colors.textMuted }]}>{template.desc}</Text>

                <View style={styles.preview}>
                  <MiniRow template={template} />
                </View>

                <View style={[styles.applyBtn, { backgroundColor: active ? colors.accentDim : colors.surfaceHigh }]}>
                  <Text style={[styles.applyTxt, { color: active ? colors.accent : colors.textSecondary }]}>
                    {active ? 'Current layout' : 'Use this'}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.footer, { color: colors.textMuted }]}>
          Choosing a template replaces your current layout. Your changes are saved automatically.
        </Text>

        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1 },
  content: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, gap: SPACING.md },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: FONTS.bodyBold, fontSize: 18, letterSpacing: -0.3 },
  sub:   { fontFamily: FONTS.body, fontSize: 12, marginTop: 2 },

  grid: { gap: SPACING.md },

  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.sm,
    position: 'relative',
  },
  activeBadge: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  activeTxt: { fontFamily: FONTS.bodyMedium, fontSize: 10 },

  cardName: { fontFamily: FONTS.bodyBold, fontSize: 15 },
  cardDesc: { fontFamily: FONTS.body, fontSize: 12 },

  preview: {
    marginVertical: SPACING.sm,
  },

  applyBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  applyTxt: { fontFamily: FONTS.bodyMedium, fontSize: 12 },

  footer: {
    fontFamily: FONTS.body,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: SPACING.md,
  },
});
