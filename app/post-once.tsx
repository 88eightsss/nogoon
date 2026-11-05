// ─── Post once: the host's form ──────────────────────────────────────────────────────────────
// A host fills this in one time and gets the words for every place (Facebook, Instagram, X, a neighborhood
// group, a bulletin) plus a QR flyer. Under construction: nothing is posted for anyone and nothing is sent.
// Saved on this phone only. The AI "write the words" step comes after this one and may never change a fact.

import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Switch, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { usePostOnceStore } from '@/stores/usePostOnceStore';
import { blankEvent, problems, whenText, DAYS, type PostOnceEvent } from '@/lib/postOnce';
import { readFlyer, pickFlyerPhoto } from '@/lib/postOnceAI';
import { Shell } from '@/components/stepout/Shell';
import { ConstructionSign } from '@/components/ui/Construction';
import { UNDER_CONSTRUCTION } from '@/constants/construction';
import { FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

export default function PostOnce() {
  const { colors, cardStyle } = useTheme();
  const events = usePostOnceStore((s) => s.events);
  const save = usePostOnceStore((s) => s.save);
  const remove = usePostOnceStore((s) => s.remove);
  const [draft, setDraft] = useState<PostOnceEvent | null>(events.length === 0 ? blankEvent() : null);
  const [errors, setErrors] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const [readNote, setReadNote] = useState('');
  const [check, setCheck] = useState<string[]>([]);   // fields the AI was unsure about: shown amber until edited

  const banner = UNDER_CONSTRUCTION.postOnce ? (
    <ConstructionSign note="A trial of the host tool. It makes the words and a flyer for you to share yourself. It does not post for anyone or send anything." />
  ) : null;

  // ── List ──────────────────────────────────────────────────────────────────
  if (!draft) {
    return (
      <Shell title="Post once">
        {banner}
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Fill in your event one time. Get the words for each place you share it, and a flyer with a QR code.
        </Text>
        <Pressable onPress={() => { setErrors([]); setDraft(blankEvent()); }} accessibilityRole="button" style={[styles.btn, { backgroundColor: colors.accent }]}>
          <Feather name="plus" size={18} color={colors.background} />
          <Text style={[styles.btnText, { color: colors.background }]}>New post</Text>
        </Pressable>
        {events.map((e) => (
          <View key={e.id} style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
            <Pressable onPress={() => router.push({ pathname: '/post-once-kit', params: { id: e.id } } as any)} accessibilityRole="button" style={{ gap: 2 }}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{e.title}</Text>
              <Text style={[styles.small, { color: colors.textSecondary }]}>{whenText(e)} · {e.area}</Text>
              <Text style={[styles.link, { color: colors.accent }]}>Open the kit</Text>
            </Pressable>
            <View style={styles.rowEnd}>
              <Pressable onPress={() => { setErrors([]); setDraft(e); }} hitSlop={8} accessibilityRole="button"><Text style={[styles.small, { color: colors.textSecondary }]}>Edit</Text></Pressable>
              <Pressable onPress={() => remove(e.id)} hitSlop={8} accessibilityRole="button"><Text style={[styles.small, { color: colors.textMuted }]}>Delete</Text></Pressable>
            </View>
          </View>
        ))}
      </Shell>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  const set = <K extends keyof PostOnceEvent>(k: K, v: PostOnceEvent[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const input = (label: string, key: keyof PostOnceEvent, opts?: { placeholder?: string; multiline?: boolean; max?: number; keyboard?: 'default' | 'url' }) => (
    <View style={{ gap: 4 }}>
      <Text style={[styles.label, { color: check.includes(key as string) ? '#D68910' : colors.textMuted }]}>
        {label}{check.includes(key as string) ? '  (check this one)' : ''}
      </Text>
      <TextInput
        style={[styles.input, opts?.multiline && { minHeight: 84, textAlignVertical: 'top' }, { color: colors.text, borderColor: check.includes(key as string) ? '#D68910' : colors.border, backgroundColor: colors.surface }]}
        value={String(draft[key] ?? '')}
        onChangeText={(t) => { set(key, t as never); if (check.includes(key as string)) setCheck((c) => c.filter((x) => x !== key)); }}
        placeholder={opts?.placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={opts?.multiline}
        maxLength={opts?.max ?? 120}
        autoCapitalize={opts?.keyboard === 'url' ? 'none' : 'sentences'}
        autoCorrect={opts?.keyboard !== 'url'}
        keyboardType={opts?.keyboard === 'url' ? 'url' : 'default'}
        accessibilityLabel={label}
      />
    </View>
  );
  const chip = (label: string, on: boolean, press: () => void) => (
    <Pressable
      key={label} onPress={press} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={[styles.chip, { borderColor: on ? colors.accent : colors.cardBorder, backgroundColor: on ? colors.accentDim : colors.surface }]}
    >
      <Text style={[styles.chipText, { color: on ? colors.accent : colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );

  const fromPhoto = async () => {
    if (reading) return;
    setReading(true); setReadNote(''); setCheck([]);
    try {
      const photo = await pickFlyerPhoto();
      if (!photo) { setReading(false); return; }
      const r = await readFlyer(photo);
      if (!r.ok) { setReadNote(r.message); setReading(false); return; }
      const f = r.fields;
      const filled: string[] = [];
      setDraft((d) => {
        if (!d) return d;
        const next = { ...d };
        // Fill only what is still empty: what the host already typed is never overwritten.
        (['title', 'host', 'when', 'area', 'ask', 'smallest', 'details', 'link'] as const).forEach((k) => {
          if (!String(next[k] ?? '').trim() && f[k]) { next[k] = f[k]; filled.push(k); }
        });
        if (next.cost.trim() === 'Free' && f.cost && f.cost !== 'Free') { next.cost = f.cost; filled.push('cost'); }
        if (!d.title.trim()) next.kind = f.kind;
        return next;
      });
      // Everything read from a photo is unconfirmed until the host looks at it; the ones the AI was unsure of are marked.
      setCheck(f.guessed);
      setReadNote(filled.length === 0
        ? 'Nothing new was found on that photo.'
        : 'Filled in what the flyer shows. Read every line. Anything marked "check this one" was hard to read.');
    } catch (err) {
      setReadNote(err instanceof Error ? err.message : 'Could not use that photo.');
    }
    setReading(false);
  };

  return (
    <Shell title={events.some((x) => x.id === draft.id) ? 'Edit post' : 'New post'}>
      {banner}
      <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Already have a flyer?</Text>
        <Text style={[styles.small, { color: colors.textMuted, textAlign: 'left' }]}>
          For checked hosts. Pick a photo of it from your library and we fill the form from what it shows. The photo is read once and not kept. You check every line.
        </Text>
        <Pressable onPress={fromPhoto} disabled={reading} accessibilityRole="button" accessibilityLabel="Fill the form from a flyer photo" style={[styles.btn, { backgroundColor: colors.accent, opacity: reading ? 0.6 : 1, paddingVertical: SPACING.md }]}>
          {reading ? <ActivityIndicator color={colors.background} /> : <Feather name="image" size={16} color={colors.background} />}
          <Text style={[styles.btnText, { color: colors.background }]}>{reading ? 'Reading...' : 'Fill from a flyer photo'}</Text>
        </Pressable>
        {readNote ? <Text style={[styles.small, { color: colors.textSecondary, textAlign: 'left' }]} accessibilityLiveRegion="polite">{readNote}</Text> : null}
      </View>
      <View style={styles.chips}>
        {chip('Asking for help', draft.kind === 'hand', () => set('kind', 'hand'))}
        {chip('An event', draft.kind === 'happening', () => set('kind', 'happening'))}
      </View>
      {input('Title', 'title', { placeholder: 'Serve lunch at the community kitchen', max: 80 })}
      {input('Who is hosting', 'host', { placeholder: 'Harbor Street Kitchen', max: 60 })}

      <View style={styles.rowBetween}>
        <Text style={[styles.label, { color: colors.text, flex: 1 }]}>Happens every week</Text>
        <Switch value={draft.mode === 'weekly'} onValueChange={(v) => set('mode', v ? 'weekly' : 'once')} trackColor={{ false: colors.border, true: colors.accent }} thumbColor="#fff" />
      </View>
      {draft.mode === 'weekly' ? (
        <>
          <View style={styles.chips}>{DAYS.map((d, i) => chip(d.slice(0, 3), draft.weekday === i, () => set('weekday', i)))}</View>
          {input('Time', 'time', { placeholder: '9:00 am to 12:00 pm', max: 40 })}
        </>
      ) : (
        input('When', 'when', { placeholder: 'Sat Nov 7, 9:00 am to 12:00 pm', max: 60 })
      )}

      {input('Area (a town, not a home address)', 'area', { placeholder: 'Kahului', max: 50 })}
      {input('Cost', 'cost', { placeholder: 'Free', max: 40 })}
      {input('What is needed (optional)', 'ask', { placeholder: '6 hands needed', max: 60 })}
      {input('Smallest way in (optional)', 'smallest', { placeholder: 'Come for the first hour', max: 80 })}
      {input('A few more details (optional)', 'details', { multiline: true, max: 400, placeholder: 'What to wear, where to meet, anything people should know.' })}
      {input('Your own link (optional)', 'link', { placeholder: 'https://yourgroup.org/volunteer', keyboard: 'url', max: 300 })}
      <Text style={[styles.small, { color: colors.textMuted }]}>If you add a link, the flyer gets a QR code that opens it. Short links like bit.ly are not accepted.</Text>

      {errors.length > 0 && (
        <View style={[styles.err, { borderColor: '#C0392B' }]} accessibilityRole="alert">
          {errors.map((m) => <Text key={m} style={[styles.small, { color: colors.text, textAlign: 'left' }]}>{m}</Text>)}
        </View>
      )}

      <Pressable
        onPress={() => {
          const bad = problems(draft);
          setErrors(bad);
          if (bad.length) return;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          const clean = { ...draft, link: draft.link.trim() };
          save(clean);
          setDraft(null);
          router.push({ pathname: '/post-once-kit', params: { id: clean.id } } as any);
        }}
        accessibilityRole="button"
        style={[styles.btn, { backgroundColor: colors.accent }]}
      >
        <Text style={[styles.btnText, { color: colors.background }]}>Make my kit</Text>
      </Pressable>
      {events.length > 0 ? (
        <Pressable onPress={() => setDraft(null)} hitSlop={8} accessibilityRole="button" style={{ paddingVertical: SPACING.sm }}>
          <Text style={[styles.small, { color: colors.textMuted }]}>Cancel</Text>
        </Pressable>
      ) : null}
    </Shell>
  );
}

const styles = StyleSheet.create({
  body: { fontFamily: FONTS.body, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: FONTS.body, fontSize: 12.5, textAlign: 'center' },
  label: { fontFamily: FONTS.bodyMedium, fontSize: 13 },
  input: { borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, fontFamily: FONTS.body, fontSize: 15 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingVertical: SPACING.lg, borderRadius: RADIUS.lg },
  btnText: { fontFamily: FONTS.bodyBold, fontSize: 16 },
  card: { padding: SPACING.md, gap: SPACING.sm },
  cardTitle: { fontFamily: FONTS.bodyBold, fontSize: 16 },
  link: { fontFamily: FONTS.bodyBold, fontSize: 13 },
  rowEnd: { flexDirection: 'row', gap: SPACING.lg, justifyContent: 'flex-end' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: SPACING.md, paddingVertical: 8 },
  chipText: { fontFamily: FONTS.bodyMedium, fontSize: 14 },
  err: { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.md, gap: 4 },
});
