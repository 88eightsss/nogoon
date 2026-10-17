// ─── Journal ──────────────────────────────────────────────────────────────────
//
// One creative space instead of two. Three tabs:
//   Pages   — colourful journal pages: paper, stickers, doodles, templates, prompts
//   Canvas  — Brain Bubbles: an open canvas to dump and arrange thoughts
//   Moments — the quick one-line notes written during an urge
//
// Route: /journal            (?tab=pages | canvas | moments to open a specific tab)
// /bubbles redirects here with ?tab=canvas.

import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';
import { useJournalStore } from '@/stores/useJournalStore';
import { PagesGallery } from '@/components/journal/PagesGallery';
import { PageEditor } from '@/components/journal/PageEditor';
import { BubblesCanvas } from '@/components/journal/BubblesCanvas';
import { MomentsView } from '@/components/journal/MomentsView';

type Tab = 'pages' | 'canvas' | 'moments';
const TABS: { id: Tab; label: string }[] = [
  { id: 'pages',   label: 'Pages' },
  { id: 'canvas',  label: 'Canvas' },
  { id: 'moments', label: 'Moments' },
];

export default function JournalScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ tab?: string }>();
  const initial: Tab = params.tab === 'canvas' || params.tab === 'moments' ? params.tab : 'pages';
  const [tab, setTab] = useState<Tab>(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const exists = useJournalStore((s) => (editing ? s.pages.some((p) => p.id === editing) : false));

  // A link that targets a tab (e.g. /bubbles) switches to it even if the screen was already open.
  useEffect(() => {
    if (params.tab === 'canvas' || params.tab === 'moments' || params.tab === 'pages') setTab(params.tab);
  }, [params.tab]);
  useEffect(() => { if (editing && !exists) setEditing(null); }, [editing, exists]);

  // Hardware back closes the open page (back to the gallery) instead of leaving Journal.
  useEffect(() => {
    if (!editing) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { setEditing(null); return true; });
    return () => sub.remove();
  }, [editing]);

  if (editing && exists) return <PageEditor id={editing} onClose={() => setEditing(null)} />;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Journal</Text>
        <View style={styles.back} />
      </View>

      <View style={[styles.seg, { backgroundColor: colors.surfaceHigh, borderColor: colors.cardBorder }]}>
        {TABS.map((t) => {
          const on = tab === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={[styles.segBtn, on && { backgroundColor: colors.accent }]}
            >
              <Text style={[styles.segText, { color: on ? '#fff' : colors.textSecondary }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flex: 1 }}>
        {tab === 'pages' ? <PagesGallery onOpen={setEditing} /> : null}
        {tab === 'canvas' ? <BubblesCanvas embedded /> : null}
        {tab === 'moments' ? <MomentsView /> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: FONTS.display, fontSize: 22, letterSpacing: -0.3 },
  seg: { flexDirection: 'row', marginHorizontal: SPACING.lg, marginBottom: SPACING.sm, borderRadius: 999, borderWidth: 1, padding: 3 },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 999 },
  segText: { fontFamily: FONTS.bodyBold, fontSize: 13 },
});
