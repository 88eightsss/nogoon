// ─── Journal page editor ──────────────────────────────────────────────────────
// The page up top, four tool tabs underneath: Write (mood + prompts), Style (paper, lines, frame,
// font, text size, easy-read, ink), Stickers (icons and your companions) and Draw (pens, undo).
// Everything saves as you go; leaving the screen never loses a page.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, TextInput, StyleSheet, Alert, Keyboard,
  KeyboardAvoidingView, Platform, Switch, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';
import { MOOD_TAGS } from '@/constants/moods';
import {
  PAPERS, PATTERNS, FRAMES, FONT_CHOICES, INKS, PEN_WIDTHS, STICKER_GROUPS, MASCOT_STICKERS, PROMPTS, stickerTint,
} from '@/constants/journalStyles';
import { Glyph } from '@/components/ui/Glyph';
import { useJournalStore, type JournalPage } from '@/stores/useJournalStore';
import { PageCanvas, PAGE_RATIO, paperOf, type CanvasMode } from './PageCanvas';
import { PackSprite } from '@/components/page/PackSprite';
import { CHARACTER_NAMES } from '@/constants/sprites';

type FeatherName = React.ComponentProps<typeof Feather>['name'];
const TABS: { id: CanvasMode; label: string; icon: FeatherName }[] = [
  { id: 'write',    label: 'Write',    icon: 'edit-3' },
  { id: 'style',    label: 'Style',    icon: 'droplet' },
  { id: 'stickers', label: 'Stickers', icon: 'smile' },
  { id: 'draw',     label: 'Draw',     icon: 'pen-tool' },
];

export function PageEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const { colors } = useTheme();
  const page = useJournalStore((s) => s.pages.find((p) => p.id === id));
  const updatePage = useJournalStore((s) => s.updatePage);
  const deletePage = useJournalStore((s) => s.deletePage);
  const togglePin = useJournalStore((s) => s.togglePin);
  const { width } = useWindowDimensions();

  const [mode, setMode] = useState<CanvasMode>('write');
  const [busy, setBusy] = useState(false);            // a sticker is being dragged or the pen is down
  const [selected, setSelected] = useState<string | null>(null);
  const [penColor, setPenColor] = useState(INKS[5]);
  const [penWidth, setPenWidth] = useState<number>(PEN_WIDTHS[1]);
  const [group, setGroup] = useState(STICKER_GROUPS[0].id);
  const [keyboard, setKeyboard] = useState(false);
  // Title: typed into local state, saved after a short pause and on leaving (not on every key).
  const [titleDraft, setTitleDraft] = useState(page?.title ?? '');
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleLatest = useRef(titleDraft);
  const onTitle = (t: string) => {
    setTitleDraft(t);
    titleLatest.current = t;
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => updatePage(id, { title: t }), 400);
  };
  useEffect(() => () => {
    if (titleTimer.current) { clearTimeout(titleTimer.current); updatePage(id, { title: titleLatest.current }); }
  }, [id, updatePage]);

  useEffect(() => {
    const a = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const b = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => { a.remove(); b.remove(); };
  }, []);

  const W = Math.min(width - 32, 520);
  const H = Math.round(W * PAGE_RATIO);
  const change = useMemo(() => (patch: Partial<JournalPage>) => updatePage(id, patch), [id, updatePage]);

  if (!page) return null;   // the hub closes the editor when its page is gone
  const sel = page.stickers.find((s) => s.id === selected) ?? null;

  const addSticker = (glyph: string) => {
    Haptics.selectionAsync().catch(() => {});
    const n = page.stickers.length;
    const s = {
      id: `st_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      glyph, x: 0.25 + ((n * 0.17) % 0.55), y: 0.2 + ((n * 0.13) % 0.6), size: 1, rot: 0,
    };
    change({ stickers: [...page.stickers, s] });
    setSelected(s.id);
  };
  const patchSticker = (patch: Partial<{ size: number; rot: number }>) => {
    if (!sel) return;
    change({ stickers: page.stickers.map((s) => (s.id === sel.id ? { ...s, ...patch } : s)) });
  };
  const removeSticker = () => {
    if (!sel) return;
    change({ stickers: page.stickers.filter((s) => s.id !== sel.id) });
    setSelected(null);
  };

  const confirmDelete = () => {
    Alert.alert('Delete this page?', 'It will be gone for good.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deletePage(id); onClose(); } },
    ]);
  };

  const addPrompt = () => {
    const p = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
    change({ body: `${page.body}${page.body && !page.body.endsWith('\n') ? '\n\n' : ''}${p}\n` });
  };

  const chip = (label: string, on: boolean, press: () => void, key?: string) => (
    <Pressable
      key={key ?? label}
      onPress={press}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[styles.chip, { borderColor: on ? colors.accent : colors.cardBorder, backgroundColor: on ? colors.accentDim : colors.surfaceHigh }]}
    >
      <Text style={[styles.chipText, { color: on ? colors.accent : colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );
  const swatch = (color: string, on: boolean, press: () => void, label: string) => (
    <Pressable
      key={label + color}
      onPress={press}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      style={[styles.swatch, { backgroundColor: color, borderColor: on ? colors.text : colors.cardBorder, borderWidth: on ? 3 : 1 }]}
    />
  );

  const group_ = STICKER_GROUPS.find((g) => g.id === group);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back to pages">
            <Feather name="arrow-left" size={22} color={colors.text} />
          </Pressable>
          <TextInput
            style={[styles.title, { color: colors.text, borderBottomColor: colors.cardBorder }]}
            value={titleDraft}
            onChangeText={onTitle}
            accessibilityLabel="Page title"
            placeholder="Page title"
            placeholderTextColor={colors.textMuted}
            maxLength={60}
          />
          <Pressable onPress={() => togglePin(id)} hitSlop={10} accessibilityRole="button" accessibilityLabel={page.pinned ? 'Unpin page' : 'Pin page'}>
            <Feather name="bookmark" size={19} color={page.pinned ? colors.accent : colors.textMuted} />
          </Pressable>
          <Pressable onPress={confirmDelete} hitSlop={10} accessibilityRole="button" accessibilityLabel="Delete page">
            <Feather name="trash-2" size={19} color={colors.textMuted} />
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ alignItems: 'center', paddingVertical: SPACING.md, paddingHorizontal: 16 }}
          scrollEnabled={!busy && mode !== 'draw'}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          <PageCanvas
            page={page} W={W} H={H} mode={mode} penColor={penColor} penWidth={penWidth}
            selectedSticker={selected} onSelectSticker={setSelected} onDragState={setBusy} onChange={change}
          />
          {mode === 'draw' ? (
            <Text style={[styles.note, { color: colors.textMuted }]}>Drawing on. Switch tabs to scroll or type again.</Text>
          ) : null}
        </ScrollView>

        {/* ── tool panel ── */}
        <View style={[styles.panel, { backgroundColor: colors.surface, borderTopColor: colors.cardBorder }]}>
          {!keyboard ? (
            <ScrollView style={{ maxHeight: 190 }} contentContainerStyle={{ padding: SPACING.md, gap: SPACING.sm }} keyboardShouldPersistTaps="handled">
              {mode === 'write' && (
                <>
                  <Text style={[styles.label, { color: colors.textMuted }]}>How are you feeling?</Text>
                  <View style={styles.row}>
                    {MOOD_TAGS.map((m) => chip(m.label, page.mood === m.id, () => change({ mood: page.mood === m.id ? null : m.id }), m.id))}
                  </View>
                  <View style={styles.row}>
                    <Pressable onPress={addPrompt} style={[styles.action, { borderColor: colors.accent }]} accessibilityRole="button">
                      <Feather name="help-circle" size={15} color={colors.accent} />
                      <Text style={[styles.actionText, { color: colors.accent }]}>Give me a prompt</Text>
                    </Pressable>
                  </View>
                </>
              )}

              {mode === 'style' && (
                <>
                  <Text style={[styles.label, { color: colors.textMuted }]}>Paper</Text>
                  <View style={styles.row}>{PAPERS.map((p) => swatch(p.color, page.paper === p.id, () => change({ paper: p.id }), `${p.label} paper`))}</View>
                  <Text style={[styles.label, { color: colors.textMuted }]}>Lines</Text>
                  <View style={styles.row}>{PATTERNS.map((p) => chip(p.label, page.pattern === p.id, () => change({ pattern: p.id })))}</View>
                  <Text style={[styles.label, { color: colors.textMuted }]}>Frame</Text>
                  <View style={styles.row}>{FRAMES.map((p) => chip(p.label, page.frame === p.id, () => change({ frame: p.id })))}</View>
                  <Text style={[styles.label, { color: colors.textMuted }]}>Ink</Text>
                  <View style={styles.row}>
                    {chip('Auto', page.ink === null, () => change({ ink: null }))}
                    {INKS.map((c) => swatch(c, page.ink === c, () => change({ ink: c }), `Ink ${c}`))}
                  </View>
                  <Text style={[styles.label, { color: colors.textMuted }]}>Writing style</Text>
                  <View style={styles.row}>{FONT_CHOICES.map((p) => chip(p.label, page.font === p.id, () => change({ font: p.id })))}</View>
                  <Text style={[styles.label, { color: colors.textMuted }]}>Text size</Text>
                  <View style={styles.row}>
                    {['Small', 'Medium', 'Large', 'Extra large'].map((l, i) => chip(l, page.sizeIdx === i, () => change({ sizeIdx: i })))}
                  </View>
                  <View style={[styles.row, { alignItems: 'center', justifyContent: 'space-between' }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.actionText, { color: colors.text }]}>Easy-read spacing</Text>
                      <Text style={[styles.note, { color: colors.textMuted, textAlign: 'left' }]}>Wider letters and lines, kinder on tired eyes.</Text>
                    </View>
                    <Switch value={page.easyRead} onValueChange={(v) => change({ easyRead: v })} accessibilityLabel="Easy-read spacing" />
                  </View>
                </>
              )}

              {mode === 'stickers' && (
                <>
                  <View style={styles.row}>
                    {STICKER_GROUPS.map((g) => chip(g.label, group === g.id, () => setGroup(g.id)))}
                    {chip('Companions', group === 'mascots', () => setGroup('mascots'))}
                  </View>
                  <View style={styles.row}>
                    {group === 'mascots'
                      ? MASCOT_STICKERS.map((c) => (
                          <Pressable key={c} onPress={() => addSticker(`m:${c}`)} style={styles.stickerBtn} accessibilityRole="button" accessibilityLabel={`Add ${CHARACTER_NAMES[c]} sticker`}>
                            <PackSprite char={c} stage={2} cell={3} />
                          </Pressable>
                        ))
                      : (group_?.items ?? []).map((e) => (
                          <Pressable key={e} onPress={() => addSticker(`i:${e}`)} style={styles.stickerBtn} accessibilityRole="button" accessibilityLabel={`Add ${e.replace(/-/g, ' ')} sticker`}>
                            <Glyph name={e} size={28} color={stickerTint(e)} />
                          </Pressable>
                        ))}
                  </View>
                  {sel ? (
                    <View style={styles.row}>
                      <Pressable onPress={() => patchSticker({ size: Math.max(0.6, sel.size - 0.25) })} style={[styles.action, { borderColor: colors.border }]} accessibilityLabel="Smaller"><Feather name="minus" size={16} color={colors.text} /></Pressable>
                      <Pressable onPress={() => patchSticker({ size: Math.min(3, sel.size + 0.25) })} style={[styles.action, { borderColor: colors.border }]} accessibilityLabel="Bigger"><Feather name="plus" size={16} color={colors.text} /></Pressable>
                      <Pressable onPress={() => patchSticker({ rot: (sel.rot + 15) % 360 })} style={[styles.action, { borderColor: colors.border }]} accessibilityLabel="Rotate"><Feather name="rotate-cw" size={16} color={colors.text} /></Pressable>
                      <Pressable onPress={removeSticker} style={[styles.action, { borderColor: colors.border }]} accessibilityLabel="Remove sticker"><Feather name="trash-2" size={16} color={colors.text} /></Pressable>
                    </View>
                  ) : (
                    <Text style={[styles.note, { color: colors.textMuted, textAlign: 'left' }]}>Tap one to add it, then drag it anywhere. Tap a sticker on the page to resize or remove it.</Text>
                  )}
                </>
              )}

              {mode === 'draw' && (
                <>
                  <View style={styles.row}>{INKS.map((c) => swatch(c, penColor === c, () => setPenColor(c), `Pen ${c}`))}</View>
                  <View style={styles.row}>
                    {['Fine', 'Medium', 'Bold'].map((l, i) => chip(l, penWidth === PEN_WIDTHS[i], () => setPenWidth(PEN_WIDTHS[i])))}
                    <Pressable onPress={() => change({ strokes: page.strokes.slice(0, -1) })} disabled={!page.strokes.length} style={[styles.action, { borderColor: colors.border, opacity: page.strokes.length ? 1 : 0.4 }]} accessibilityRole="button" accessibilityLabel="Undo last stroke">
                      <Feather name="corner-up-left" size={15} color={colors.text} /><Text style={[styles.actionText, { color: colors.text }]}>Undo</Text>
                    </Pressable>
                    <Pressable onPress={() => change({ strokes: [] })} disabled={!page.strokes.length} style={[styles.action, { borderColor: colors.border, opacity: page.strokes.length ? 1 : 0.4 }]} accessibilityRole="button" accessibilityLabel="Clear all drawing">
                      <Feather name="x" size={15} color={colors.text} /><Text style={[styles.actionText, { color: colors.text }]}>Clear</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </ScrollView>
          ) : null}

          <View style={[styles.tabs, { borderTopColor: colors.cardBorder }]}>
            {TABS.map((t) => {
              const on = mode === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => { Keyboard.dismiss(); setMode(t.id); if (t.id !== 'stickers') setSelected(null); }}
                  style={styles.tab}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={t.label}
                >
                  <Feather name={t.icon} size={20} color={on ? colors.accent : colors.textMuted} />
                  <Text style={[styles.tabText, { color: on ? colors.accent : colors.textMuted }]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  title: { flex: 1, fontFamily: FONTS.bodyBold, fontSize: 18, borderBottomWidth: 1, paddingBottom: 4 },
  panel: { borderTopWidth: 1 },
  label: { fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  chipText: { fontFamily: FONTS.bodyMedium, fontSize: 13 },
  swatch: { width: 34, height: 34, borderRadius: 17 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  actionText: { fontFamily: FONTS.bodyMedium, fontSize: 13 },
  stickerBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  note: { fontFamily: FONTS.body, fontSize: 12, textAlign: 'center', marginTop: 6 },
  tabs: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, gap: 2, minHeight: 52, justifyContent: 'center' },
  tabText: { fontFamily: FONTS.bodyMedium, fontSize: 11 },
});
