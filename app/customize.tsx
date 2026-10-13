// ─── Customize ────────────────────────────────────────────────────────────────
//
// One place for: the new My Page switch (beta), skins (packs), a pack code, and the
// personal note shown at the gate. Hidden packs only appear after they are unlocked.

import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Switch, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { usePackStore, GATE_NOTE_MAX, type GateVoice } from '@/stores/usePackStore';
import { availablePacks } from '@/constants/packs';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';

const VOICES: { id: GateVoice; label: string }[] = [
  { id: 'gentle', label: 'Gentle' }, { id: 'hype', label: 'Hype' }, { id: 'dry', label: 'Dry' },
];

export default function CustomizeScreen() {
  const { colors, cardStyle } = useTheme();
  const newHome       = usePackStore((s) => s.newHome);
  const setNewHome    = usePackStore((s) => s.setNewHome);
  const activePackId  = usePackStore((s) => s.activePackId);
  const unlockedIds   = usePackStore((s) => s.unlockedIds);
  const setActivePack = usePackStore((s) => s.setActivePack);
  const redeemCode    = usePackStore((s) => s.redeemCode);
  const gateNote      = usePackStore((s) => s.gateNote);
  const setGateNote   = usePackStore((s) => s.setGateNote);
  const gateVoice     = usePackStore((s) => s.gateVoice);
  const setGateVoice  = usePackStore((s) => s.setGateVoice);

  const [code, setCode] = useState('');
  const [codeMsg, setCodeMsg] = useState('');
  const packs = availablePacks(unlockedIds);

  const redeem = () => {
    const p = redeemCode(code);
    if (p) { setCodeMsg(`Unlocked: ${p.name}`); setCode(''); }
    else setCodeMsg("That code isn't valid.");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Customize</Text>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Close">
          <Feather name="x" size={24} color={colors.textMuted} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>New My Page (beta)</Text>
              <Text style={[styles.body, { color: colors.textSecondary }]}>
                Your page, a Feed tab, and Protect. Calm and Arcade move into "Take a break" on My Page. Turn it off any time.
              </Text>
            </View>
            <Switch
              value={newHome}
              onValueChange={setNewHome}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <Text style={[styles.section, { color: colors.textMuted }]}>Skins</Text>
        {packs.map((p) => {
          const active = p.id === activePackId || (p.id === 'core' && !packs.some((x) => x.id === activePackId));
          const swatch = p.parts.theme ? p.parts.theme[p.parts.theme.nativeMode].accent : colors.accent;
          return (
            <Pressable
              key={p.id}
              onPress={() => setActivePack(p.id)}
              style={[styles.pack, cardStyle, { backgroundColor: colors.surface, borderColor: active ? colors.accent : colors.cardBorder }]}
            >
              <View style={[styles.swatch, { backgroundColor: swatch }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{p.name}</Text>
                <Text style={[styles.body, { color: colors.textSecondary }]}>{p.tagline}</Text>
              </View>
              {active && <Feather name="check-circle" size={20} color={colors.accent} />}
            </Pressable>
          );
        })}
        {!newHome && (
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Skins recolor the whole app. Frames, counters and stamps show on the new My Page.
          </Text>
        )}

        <Text style={[styles.section, { color: colors.textMuted }]}>Pack code</Text>
        <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <View style={styles.rowBetween}>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, flex: 1 }]}
              value={code}
              onChangeText={(t) => { setCode(t); setCodeMsg(''); }}
              placeholder="Got a code?"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              onSubmitEditing={redeem}
              returnKeyType="done"
            />
            <Pressable onPress={redeem} style={[styles.btn, { backgroundColor: colors.accent }]}>
              <Text style={[styles.btnText, { color: colors.background }]}>Redeem</Text>
            </Pressable>
          </View>
          {codeMsg ? <Text style={[styles.body, { color: colors.textSecondary }]}>{codeMsg}</Text> : null}
        </View>

        <Text style={[styles.section, { color: colors.textMuted }]}>Your note at the gate</Text>
        <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Write to yourself. It shows up when you're about to open something you blocked.
          </Text>
          <TextInput
            style={[styles.input, styles.noteInput, { color: colors.text, borderColor: colors.border }]}
            value={gateNote}
            onChangeText={setGateNote}
            placeholder="I want to be present for…"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={GATE_NOTE_MAX}
          />
          <Text style={[styles.hint, { color: colors.textMuted, alignSelf: 'flex-end' }]}>{gateNote.length}/{GATE_NOTE_MAX}</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>Voice for fortune lines (Tokyo skin)</Text>
          <View style={styles.voices}>
            {VOICES.map((v) => (
              <Pressable
                key={v.id}
                onPress={() => setGateVoice(v.id)}
                style={[styles.voice, { borderColor: gateVoice === v.id ? colors.accent : colors.border, backgroundColor: gateVoice === v.id ? colors.accentDim : 'transparent' }]}
              >
                <Text style={[styles.btnText, { color: gateVoice === v.id ? colors.accent : colors.textSecondary }]}>{v.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  title:   { fontFamily: FONTS.display, fontSize: 24 },
  content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.huge },
  card:    { padding: SPACING.md, gap: SPACING.sm },
  cardTitle:{ fontFamily: FONTS.bodyBold, fontSize: 15 },
  body:    { fontFamily: FONTS.body, fontSize: 13, lineHeight: 19 },
  hint:    { fontFamily: FONTS.body, fontSize: 12 },
  section: { fontFamily: FONTS.bodyMedium, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: SPACING.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  pack:    { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md },
  swatch:  { width: 28, height: 28, borderRadius: 14 },
  input:   { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontFamily: FONTS.body, fontSize: 14 },
  noteInput: { minHeight: 76, textAlignVertical: 'top' },
  btn:     { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999 },
  btnText: { fontFamily: FONTS.bodyBold, fontSize: 13 },
  voices:  { flexDirection: 'row', gap: SPACING.sm },
  voice:   { borderWidth: 1.5, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 16 },
});
