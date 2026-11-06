// ─── Your kit ────────────────────────────────────────────────────────────────────────────────
// The words for each place, and the flyer. Share buttons open the phone's share sheet (which has Copy), so the
// host posts from their own accounts. Nothing is posted for them. The facts (title, when, area, cost, link)
// appear word for word in every caption; they are the host's, not ours.

import { useState } from 'react';
import { View, Text, Pressable, ScrollView, Share, StyleSheet, useWindowDimensions, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { usePostOnceStore } from '@/stores/usePostOnceStore';
import { OUTPUTS, X_LIMIT, xLength } from '@/lib/postOnce';
import { writeWithAI, TONE_LABEL, type Tone, type Drafts } from '@/lib/postOnceAI';
import { Flyer, LOOKS, type FlyerLook } from '@/components/postonce/Flyer';
import { Shell } from '@/components/stepout/Shell';
import { FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

export default function PostOnceKit() {
  const { colors, cardStyle } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const e = usePostOnceStore((s) => s.events.find((x) => x.id === id));
  const { width } = useWindowDimensions();
  const [look, setLook] = useState<FlyerLook>('bold');
  const [tone, setTone] = useState<Tone>('warm');
  const [drafts, setDrafts] = useState<Drafts>({});
  const [busy, setBusy] = useState(false);
  const [aiNote, setAiNote] = useState('');

  if (!e) {
    return <Shell title="Not found"><Text style={[styles.body, { color: colors.textSecondary }]}>That post is no longer here.</Text></Shell>;
  }
  const share = async (message: string) => {
    Haptics.selectionAsync().catch(() => {});
    try { await Share.share({ message }); } catch { /* closed the sheet */ }
  };

  const writeAI = async () => {
    if (busy) return;
    setBusy(true); setAiNote('');
    Haptics.selectionAsync().catch(() => {});
    const r = await writeWithAI(e, tone);
    setBusy(false);
    if (!r.ok) { setAiNote(r.message); return; }
    setDrafts((d) => ({ ...d, ...r.drafts }));
    setAiNote(r.rejected.length
      ? 'Some places kept your plain version, because the AI draft changed a fact or ran too long.'
      : 'Done. Read each one before you share it.');
  };
  const hasAI = Object.keys(drafts).length > 0;

  return (
    <Shell title="Your kit">
      <Text style={[styles.body, { color: colors.textSecondary }]}>
        Tap Share, then pick where it goes. Copy is in the share sheet too. Your facts are word for word in everything below.
      </Text>

      <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
        <Text style={[styles.h, { color: colors.text }]}>Write the words with AI</Text>
        <Text style={[styles.small, { color: colors.textMuted, textAlign: 'left' }]}>
          For checked hosts. AI changes the wording only. Your title, time, area, cost and link stay exactly as you typed them, and nothing is posted.
        </Text>
        <View style={styles.chipRow}>
          {(Object.keys(TONE_LABEL) as Tone[]).map((t) => (
            <Pressable
              key={t} onPress={() => setTone(t)} accessibilityRole="button" accessibilityState={{ selected: tone === t }}
              style={[styles.chip, { borderColor: tone === t ? colors.accent : colors.cardBorder, backgroundColor: tone === t ? colors.accentDim : colors.surface }]}
            >
              <Text style={[styles.chipText, { color: tone === t ? colors.accent : colors.textSecondary }]}>{TONE_LABEL[t]}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={writeAI} disabled={busy} accessibilityRole="button" accessibilityLabel="Write the words with AI"
          style={[styles.shareBtn, { backgroundColor: colors.accent, opacity: busy ? 0.6 : 1 }]}
        >
          {busy ? <ActivityIndicator color={colors.onAccent} /> : <Feather name="edit-3" size={16} color={colors.onAccent} />}
          <Text style={[styles.shareText, { color: colors.onAccent }]}>{busy ? 'Writing...' : hasAI ? 'Write again' : 'Write with AI'}</Text>
        </Pressable>
        {hasAI ? (
          <Pressable onPress={() => { setDrafts({}); setAiNote(''); }} hitSlop={8} accessibilityRole="button" style={{ alignItems: 'center' }}>
            <Text style={[styles.small, { color: colors.textSecondary }]}>Go back to the plain version</Text>
          </Pressable>
        ) : null}
        {aiNote ? <Text style={[styles.small, { color: colors.textSecondary, textAlign: 'left' }]} accessibilityLiveRegion="polite">{aiNote}</Text> : null}
      </View>

      {OUTPUTS.map((o) => {
        const ai = drafts[o.key];
        const text = ai ?? o.make(e);
        const over = o.key === 'x' && xLength(text) > X_LIMIT;
        return (
          <View key={o.key} style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
            <View style={styles.rowBetween}>
              <Text style={[styles.h, { color: colors.text }]}>{o.label}</Text>
              {o.key === 'x' ? (
                <Text style={[styles.small, { color: over ? '#C0392B' : colors.textMuted }]}>{xLength(text)} / {X_LIMIT}</Text>
              ) : null}
            </View>
            {ai ? <Text style={[styles.small, { color: colors.textMuted, textAlign: 'left' }]}>Written by AI. Check it before you share it.</Text> : null}
            <Text style={[styles.text, { color: colors.text }]} selectable>{text}</Text>
            <Pressable
              onPress={() => share(text)}
              accessibilityRole="button" accessibilityLabel={`Share the ${o.label} words`}
              style={[styles.shareBtn, { backgroundColor: colors.accent }]}
            >
              <Feather name="share" size={16} color={colors.onAccent} />
              <Text style={[styles.shareText, { color: colors.onAccent }]}>Share</Text>
            </Pressable>
          </View>
        );
      })}

      <View style={{ gap: SPACING.sm }}>
        <Text style={[styles.h, { color: colors.text }]}>Flyer</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.sm }}>
          {LOOKS.map((l) => (
            <Pressable
              key={l.key} onPress={() => setLook(l.key)} accessibilityRole="button" accessibilityState={{ selected: look === l.key }}
              style={[styles.chip, { borderColor: look === l.key ? colors.accent : colors.cardBorder, backgroundColor: look === l.key ? colors.accentDim : colors.surface }]}
            >
              <Text style={[styles.chipText, { color: look === l.key ? colors.accent : colors.textSecondary }]}>{l.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Flyer e={e} look={look} width={Math.min(width - SPACING.lg * 2, 420)} />
        <Text style={[styles.small, { color: colors.textMuted, textAlign: 'left' }]}>
          To print or send the flyer, take a screenshot of it. The QR code opens your own link{e.link ? '' : ' (add a link to your post to get one)'}.
        </Text>
      </View>

      <Text style={[styles.small, { color: colors.textMuted }]}>
        Not built yet: posting to your accounts for you, and listing this in Step Out. Each comes later and none will change your facts.
      </Text>
    </Shell>
  );
}

const styles = StyleSheet.create({
  body: { fontFamily: FONTS.body, fontSize: 15, lineHeight: 22 },
  h: { fontFamily: FONTS.display, fontSize: 18 },
  text: { fontFamily: FONTS.body, fontSize: 14, lineHeight: 21 },
  small: { fontFamily: FONTS.body, fontSize: 12.5, textAlign: 'center' },
  card: { padding: SPACING.md, gap: SPACING.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingVertical: SPACING.md, borderRadius: RADIUS.lg },
  shareText: { fontFamily: FONTS.bodyBold, fontSize: 15 },
  chipRow: { flexDirection: 'row', gap: SPACING.sm },
  chip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: SPACING.md, paddingVertical: 8 },
  chipText: { fontFamily: FONTS.bodyMedium, fontSize: 14 },
});
