// ─── Pages gallery ────────────────────────────────────────────────────────────
// Search, filter by mood, pinned pages first. "New page" opens the template picker.

import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, StyleSheet, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';
import { MOOD_TAGS } from '@/constants/moods';
import { TEMPLATES, stickerTint, type PageTemplate } from '@/constants/journalStyles';
import { Glyph } from '@/components/ui/Glyph';
import { useJournalStore, type JournalPage } from '@/stores/useJournalStore';
import { paperOf, inkOf } from './PageCanvas';

function whenLabel(t: number) {
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function PageCard({ p, onOpen }: { p: JournalPage; onOpen: () => void }) {
  const paper = paperOf(p);
  const ink = inkOf(p);
  const mood = MOOD_TAGS.find((m) => m.id === p.mood);
  const glyphs = p.stickers.filter((s) => (s.glyph.startsWith('i:') || s.glyph.startsWith('e:'))).slice(0, 4).map((s) => s.glyph.slice(2));
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${p.title || 'Untitled page'}, ${whenLabel(p.updatedAt)}`}
      style={({ pressed }) => [styles.card, { backgroundColor: paper.color, opacity: pressed ? 0.85 : 1 }]}
    >
      {p.frame === 'tape' ? <View style={[styles.tape, { backgroundColor: 'rgba(255,170,200,0.8)' }]} /> : null}
      {p.pinned ? <Feather name="bookmark" size={14} color={ink} style={styles.pin} /> : null}
      <Text style={[styles.cardTitle, { color: ink }]} numberOfLines={2}>{p.title || 'Untitled'}</Text>
      <Text style={[styles.cardBody, { color: ink + 'CC' }]} numberOfLines={4}>{p.body || (p.strokes.length ? 'A drawing.' : 'Empty page')}</Text>
      <View style={styles.cardFoot}>
        <Text style={[styles.cardDate, { color: ink + '99' }]}>{whenLabel(p.updatedAt)}</Text>
        <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
          {mood ? <Glyph name={mood.emoji} size={15} color={ink} /> : null}
          {glyphs.map((g, i) => <Glyph key={i} name={g} size={15} color={stickerTint(g)} />)}
        </View>
      </View>
    </Pressable>
  );
}

export function PagesGallery({ onOpen }: { onOpen: (id: string) => void }) {
  const { colors } = useTheme();
  const pages = useJournalStore((s) => s.pages);
  const addPage = useJournalStore((s) => s.addPage);
  const [q, setQ] = useState('');
  const [moodFilter, setMoodFilter] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return pages
      .filter((p) => (!moodFilter || p.mood === moodFilter)
        && (!needle || p.title.toLowerCase().includes(needle) || p.body.toLowerCase().includes(needle)))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
  }, [pages, q, moodFilter]);

  const start = (t: PageTemplate) => {
    setPicker(false);
    const stickers = t.stickers.map((g, i) => ({
      id: `st_${Date.now()}_${i}`, glyph: `i:${g}`, x: 0.82 - i * 0.14, y: 0.07, size: 1, rot: i % 2 ? 8 : -8,
    }));
    const id = addPage({ title: t.id === 'blank' ? '' : t.label, body: t.body, paper: t.paper, pattern: t.pattern, stickers });
    onOpen(id);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        {pages.length > 0 && (
          <>
            <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
              <Feather name="search" size={16} color={colors.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                value={q} onChangeText={setQ}
                placeholder="Search your pages" placeholderTextColor={colors.textMuted}
                accessibilityLabel="Search pages"
              />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {MOOD_TAGS.map((m) => {
                const on = moodFilter === m.id;
                return (
                  <Pressable
                    key={m.id} onPress={() => setMoodFilter(on ? null : m.id)}
                    accessibilityRole="button" accessibilityState={{ selected: on }}
                    style={[styles.chip, { borderColor: on ? colors.accent : colors.cardBorder, backgroundColor: on ? colors.accentDim : colors.surfaceHigh }]}
                  >
                    <Text style={[styles.chipText, { color: on ? colors.accent : colors.textSecondary }]}>{m.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}

        {pages.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="book" size={46} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Your journal starts here</Text>
            <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
              Pick a paper colour, add stickers, doodle in the margins. Make it yours. Only you can see it.
            </Text>
          </View>
        ) : list.length === 0 ? (
          <Text style={[styles.emptyBody, { color: colors.textMuted, textAlign: 'center', marginTop: 24 }]}>Nothing matches that.</Text>
        ) : (
          <View style={styles.grid}>
            {list.map((p) => <PageCard key={p.id} p={p} onOpen={() => onOpen(p.id)} />)}
          </View>
        )}
      </ScrollView>

      <Pressable
        onPress={() => setPicker(true)}
        accessibilityRole="button" accessibilityLabel="New page"
        style={[styles.fab, { backgroundColor: colors.accent }]}
      >
        <Feather name="plus" size={20} color="#fff" />
        <Text style={styles.fabText}>New page</Text>
      </Pressable>

      <Modal visible={picker} transparent animationType="slide" onRequestClose={() => setPicker(false)}>
        <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={() => setPicker(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.background }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>What kind of page?</Text>
            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 10 }}>
              {TEMPLATES.map((t) => {
                const paper = paperOf({ paper: t.paper });
                return (
                  <Pressable
                    key={t.id} onPress={() => start(t)}
                    accessibilityRole="button" accessibilityLabel={`${t.label}. ${t.blurb}`}
                    style={[styles.tpl, { backgroundColor: paper.color }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.tplTitle, { color: paper.ink }]}>{t.label}</Text>
                      <Text style={[styles.tplBlurb, { color: paper.ink + 'CC' }]}>{t.blurb}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      {(t.stickers.length ? t.stickers : ['edit-3']).map((g) => <Glyph key={g} name={g} size={22} color={stickerTint(g)} />)}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 110 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  searchInput: { flex: 1, paddingVertical: 10, fontFamily: FONTS.body, fontSize: 14 },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  chipText: { fontFamily: FONTS.bodyMedium, fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '47.5%', flexGrow: 1, minHeight: 150, borderRadius: 16, padding: 14, gap: 6, justifyContent: 'space-between' },
  tape: { position: 'absolute', top: -5, left: 14, width: 54, height: 16, transform: [{ rotate: '-6deg' }] },
  pin: { position: 'absolute', top: 8, right: 8 },
  cardTitle: { fontFamily: FONTS.bodyBold, fontSize: 15 },
  cardBody: { fontFamily: FONTS.body, fontSize: 12.5, lineHeight: 17, flex: 1 },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardDate: { fontFamily: FONTS.mono, fontSize: 11 },
  empty: { alignItems: 'center', gap: 8, marginTop: 40, paddingHorizontal: 20 },
  emptyTitle: { fontFamily: FONTS.display, fontSize: 22 },
  emptyBody: { fontFamily: FONTS.body, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  fab: { position: 'absolute', right: 20, bottom: 24, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 13, paddingHorizontal: 20, borderRadius: 999, elevation: 4 },
  fabText: { fontFamily: FONTS.bodyBold, fontSize: 14, color: '#fff' },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACING.lg, gap: SPACING.md },
  sheetTitle: { fontFamily: FONTS.display, fontSize: 22 },
  tpl: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16 },
  tplTitle: { fontFamily: FONTS.bodyBold, fontSize: 15 },
  tplBlurb: { fontFamily: FONTS.body, fontSize: 13, marginTop: 2 },
});
