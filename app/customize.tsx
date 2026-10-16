// ─── Customize ────────────────────────────────────────────────────────────────
//
// One place for: the new My Page switch , skins (packs), a pack code, and the
// personal note shown at the gate. Hidden packs only appear after they are unlocked.

import { useState, useEffect, type ComponentProps } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEY } from '@/components/home/GoonMascot';
import { PackSprite } from '@/components/page/PackSprite';
import { useCharacter } from '@/components/page/useCharacter';
import { ALL_CHARACTER_IDS, CHARACTER_NAMES, CHAR_COLORS } from '@/constants/sprites';
import type { CharacterId } from '@/stores/usePetStore';
import { View, Text, TextInput, Pressable, ScrollView, Switch, StyleSheet, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { usePackStore, GATE_NOTE_MAX, DEFAULT_COMPANION_POS, type GateVoice, type FloatMode, type CompanionSize, type PaperChoice, type DayDisplay } from '@/stores/usePackStore';
import { availablePacks } from '@/constants/packs';
import { FONTS } from '@/constants/Colors';
import { BUNDLES, CUSTOM_LEN, CUSTOM_MAX } from '@/constants/offers';
import { useOfferStore } from '@/stores/useOfferStore';
import { SPACING } from '@/constants/Spacing';

const VOICES: { id: GateVoice; label: string }[] = [
  { id: 'gentle', label: 'Gentle' }, { id: 'hype', label: 'Hype' }, { id: 'dry', label: 'Dry' },
];
const FLOAT_MODES: { id: FloatMode; label: string }[] = [
  { id: 'auto', label: 'Auto' }, { id: 'on', label: 'On' }, { id: 'off', label: 'Off' },
];
const SIZES: { id: CompanionSize; label: string }[] = [
  { id: 'sm', label: 'S' }, { id: 'md', label: 'M' }, { id: 'lg', label: 'L' },
];
const DAY_DISPLAYS: { id: DayDisplay; label: string }[] = [
  { id: 'number', label: 'Big number' }, { id: 'mascot', label: 'On the mascot' }, { id: 'hidden', label: 'Hidden' },
];
const PAPERS: { id: PaperChoice; label: string }[] = [
  { id: 'auto', label: 'Skin default' }, { id: 'ruled', label: 'Ruled' }, { id: 'grid', label: 'Grid' },
  { id: 'dots', label: 'Dots' }, { id: 'none', label: 'Plain' },
];
const ACCENTS = ['#1B62C2', '#0B7A44', '#FF6F61', '#7A3FD1', '#12A37F', '#DB2777', '#C2410C', '#CA8A04'];

type CustSection = 'layout' | 'skins' | 'companion' | 'gate' | 'colour';
const HUB: { id: CustSection; icon: ComponentProps<typeof Feather>['name']; title: string; sub: string }[] = [
  { id: 'skins',     icon: 'package',    title: 'Skins & codes',        sub: 'Pick a look, enter a pack code' },
  { id: 'companion', icon: 'smile',      title: 'Your companion',       sub: 'Which one, how it floats, how big' },
  { id: 'colour',    icon: 'droplet',    title: 'Colour & paper',       sub: 'Accent colour and page background' },
  { id: 'gate',      icon: 'shield',     title: 'At the gate',          sub: 'Instead bundles, your own list, your note' },
  { id: 'layout',    icon: 'layout',     title: 'Layout & news',        sub: 'My Page layout, major news in the briefing' },
];

function Chips<T extends string>({ items, value, onChange, colors }: {
  items: { id: T; label: string }[]; value: T; onChange: (v: T) => void;
  colors: { accent: string; accentDim: string; border: string; textSecondary: string };
}) {
  return (
    <View style={styles.voices}>
      {items.map((v) => (
        <Pressable
          key={v.id}
          onPress={() => onChange(v.id)}
          style={[styles.voice, { borderColor: value === v.id ? colors.accent : colors.border, backgroundColor: value === v.id ? colors.accentDim : 'transparent' }]}
        >
          <Text style={[styles.btnText, { color: value === v.id ? colors.accent : colors.textSecondary }]}>{v.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function CustomizeScreen() {
  const { colors, cardStyle } = useTheme();
  const newHome       = usePackStore((s) => s.newHome);
  const showWorldNews = usePackStore((s) => s.showWorldNews);
  const setShowWorldNews = usePackStore((s) => s.setShowWorldNews);
  const setNewHome    = usePackStore((s) => s.setNewHome);
  const activePackId  = usePackStore((s) => s.activePackId);
  const unlockedIds   = usePackStore((s) => s.unlockedIds);
  const setActivePack = usePackStore((s) => s.setActivePack);
  const redeemCode    = usePackStore((s) => s.redeemCode);
  const gateNote      = usePackStore((s) => s.gateNote);
  const bundleIds     = useOfferStore((s) => s.bundleIds);
  const myList        = useOfferStore((s) => s.custom);
  const toggleBundle  = useOfferStore((s) => s.toggleBundle);
  const addMine        = useOfferStore((s) => s.addCustom);
  const removeMine     = useOfferStore((s) => s.removeCustom);
  const [mineDraft, setMineDraft] = useState('');
  const [section, setSection] = useState<CustSection | null>(null);
  useEffect(() => {
    if (!section) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { setSection(null); return true; });
    return () => sub.remove();
  }, [section]);
  const setGateNote   = usePackStore((s) => s.setGateNote);
  const gateVoice     = usePackStore((s) => s.gateVoice);
  const setGateVoice  = usePackStore((s) => s.setGateVoice);
  const dayDisplay       = usePackStore((s) => s.dayDisplay);
  const setDayDisplay    = usePackStore((s) => s.setDayDisplay);
  const savedChar        = useCharacter();
  const [pickedChar, setPickedChar] = useState<CharacterId | null>(null);
  const activeChar = pickedChar ?? savedChar;
  const chooseChar = (id: CharacterId) => {
    setPickedChar(id);
    AsyncStorage.setItem(STORAGE_KEY, String(id)).catch(() => {});
  };
  const floatMode        = usePackStore((s) => s.floatMode);
  const setFloatMode     = usePackStore((s) => s.setFloatMode);
  const companionSize    = usePackStore((s) => s.companionSize);
  const setCompanionSize = usePackStore((s) => s.setCompanionSize);
  const companionSnap    = usePackStore((s) => s.companionSnap);
  const setCompanionSnap = usePackStore((s) => s.setCompanionSnap);
  const setCompanionPos  = usePackStore((s) => s.setCompanionPos);
  const accentOverride   = usePackStore((s) => s.accentOverride);
  const setAccentOverride = usePackStore((s) => s.setAccentOverride);
  const paperOverride    = usePackStore((s) => s.paperOverride);
  const setPaperOverride = usePackStore((s) => s.setPaperOverride);

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

        {!section && (
          <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder, padding: 0 }]}>
            {HUB.map((h, i) => {
              const sub = h.id === 'skins' ? `Now: ${packs.find((p) => p.id === activePackId)?.name ?? 'Core'}` : h.sub;
              return (
                <Pressable
                  key={h.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${h.title}. ${sub}`}
                  onPress={() => { setSection(h.id); }}
                  style={[styles.pack, i < HUB.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
                >
                  <Feather name={h.icon} size={20} color={colors.accent} style={{ width: 28, textAlign: 'center' }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{h.title}</Text>
                    <Text style={[styles.hint, { color: colors.textSecondary }]}>{sub}</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.textMuted} />
                </Pressable>
              );
            })}
          </View>
        )}

        {!!section && (
          <Pressable onPress={() => setSection(null)} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} accessibilityRole="button" accessibilityLabel="Back to Customize">
            <Feather name="chevron-left" size={20} color={colors.accent} />
            <Text style={[styles.btnText, { color: colors.accent }]}>Customize</Text>
            <Text style={[styles.cardTitle, { color: colors.text, marginLeft: SPACING.sm }]}>{HUB.find((h) => h.id === section)?.title}</Text>
          </Pressable>
        )}

        {section === 'layout' && (
        <>
        <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>New My Page</Text>
              <Text style={[styles.body, { color: colors.textSecondary }]}>
                Protection and "I'm tempted" up top, your companion below, and good news and journaling in the Feed tab. Turn it off any time for the classic home.
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

        <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Major news in your briefing</Text>
              <Text style={[styles.body, { color: colors.textSecondary }]}>
                A short, calm summary of the biggest stories, a few items a day, then it ends. Off by default.
              </Text>
            </View>
            <Switch
              value={showWorldNews}
              onValueChange={setShowWorldNews}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor="#fff"
            />
          </View>
        </View>

        </>
        )}

        {section === 'skins' && (
        <>
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
            Skins recolor the whole app. Frames, counters, stamps and paper show on the new My Page. Hidden skins show a hatching egg on Home once you unlock one.
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

        </>
        )}

        {section === 'companion' && (
        <>
        <Text style={[styles.section, { color: colors.textMuted }]}>Your companion</Text>
        <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ALL_CHARACTER_IDS.map((id) => {
              const on = id === activeChar;
              const tint = CHAR_COLORS[id][0][1];
              return (
                <Pressable
                  key={id}
                  onPress={() => chooseChar(id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={CHARACTER_NAMES[id]}
                  style={{
                    flexBasis: '22%', flexGrow: 1, alignItems: 'center', paddingVertical: 8, gap: 4,
                    borderRadius: 14, borderWidth: on ? 2 : 1,
                    borderColor: on ? colors.accent : colors.border,
                    backgroundColor: on ? tint + '22' : 'transparent',
                  }}
                >
                  <PackSprite char={id} stage={2} cell={4} />
                  <Text style={[styles.body, { color: on ? colors.accent : colors.textSecondary, fontSize: 12 }]}>{CHARACTER_NAMES[id]}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.body, { color: colors.textSecondary }]}>Day count</Text>
          <Chips items={DAY_DISPLAYS} value={dayDisplay} onChange={setDayDisplay} colors={colors} />
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            A small floating buddy you can drag anywhere. Auto turns it on with the Notebook skin and keeps the big habitat off your page.
          </Text>
          <Chips items={FLOAT_MODES} value={floatMode} onChange={setFloatMode} colors={colors} />
          <Text style={[styles.body, { color: colors.textSecondary }]}>Size</Text>
          <Chips items={SIZES} value={companionSize} onChange={setCompanionSize} colors={colors} />
          <View style={styles.rowBetween}>
            <Text style={[styles.body, { color: colors.textSecondary, flex: 1 }]}>Snap to the nearest corner when you let go</Text>
            <Switch value={companionSnap} onValueChange={setCompanionSnap} trackColor={{ false: colors.border, true: colors.accent }} thumbColor="#fff" />
          </View>
          <Pressable onPress={() => setCompanionPos(DEFAULT_COMPANION_POS)} hitSlop={8}>
            <Text style={[styles.btnText, { color: colors.accent }]}>Reset position</Text>
          </Pressable>
        </View>

        </>
        )}

        {section === 'gate' && (
        <>
        <Text style={[styles.section, { color: colors.textMuted }]}>Instead bundles</Text>
        <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            When you reach for a blocked app, NoGoon offers a few things to do instead. Pick the bundles that fit you. Pick several and they mix.
          </Text>
          {BUNDLES.map((b) => {
            const on = bundleIds.includes(b.id);
            return (
              <Pressable
                key={b.id}
                onPress={() => toggleBundle(b.id)}
                accessibilityRole="switch"
                accessibilityState={{ checked: on }}
                style={[styles.pack, { borderWidth: 1.5, borderRadius: 12, borderColor: on ? colors.accent : colors.border, backgroundColor: on ? colors.accentDim : 'transparent' }]}
              >
                <Feather name={b.icon} size={20} color={on ? colors.accent : colors.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{b.name}</Text>
                  <Text style={[styles.hint, { color: colors.textSecondary }]}>{b.tagline}</Text>
                </View>
                <Feather name={on ? 'check-circle' : 'circle'} size={20} color={on ? colors.accent : colors.textMuted} />
              </Pressable>
            );
          })}
          <Text style={[styles.cardTitle, { color: colors.text, marginTop: SPACING.sm }]}>My own list</Text>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Things only you would pick: "call mum", "play guitar", "go see the ocean". Up to {CUSTOM_MAX}.
          </Text>
          {myList.map((t, i) => (
            <View key={`${t}-${i}`} style={styles.rowBetween}>
              <Text style={[styles.body, { color: colors.text, flex: 1 }]}>{t}</Text>
              <Pressable onPress={() => removeMine(i)} hitSlop={10} accessibilityLabel={`Remove ${t}`}>
                <Feather name="x" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
          ))}
          {myList.length < CUSTOM_MAX && (
            <View style={styles.rowBetween}>
              <TextInput
                value={mineDraft}
                onChangeText={setMineDraft}
                maxLength={CUSTOM_LEN}
                placeholder="Instead I will…"
                placeholderTextColor={colors.textMuted}
                onSubmitEditing={() => { if (addMine(mineDraft)) setMineDraft(''); }}
                returnKeyType="done"
                style={[styles.input, { flex: 1, color: colors.text, borderColor: colors.border }]}
              />
              <Pressable
                onPress={() => { if (addMine(mineDraft)) setMineDraft(''); }}
                style={[styles.btn, { backgroundColor: colors.accent }]}
              >
                <Text style={[styles.btnText, { color: '#fff' }]}>Add</Text>
              </Pressable>
            </View>
          )}
        </View>

        </>
        )}

        {section === 'colour' && (
        <>
        <Text style={[styles.section, { color: colors.textMuted }]}>Colour & paper</Text>
        <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <Text style={[styles.body, { color: colors.textSecondary }]}>Accent colour</Text>
          <View style={styles.voices}>
            <Pressable
              onPress={() => setAccentOverride('')}
              style={[styles.voice, { borderColor: accentOverride === '' ? colors.accent : colors.border }]}
              accessibilityLabel="Use the skin's own accent"
            >
              <Text style={[styles.btnText, { color: accentOverride === '' ? colors.accent : colors.textSecondary }]}>Skin</Text>
            </Pressable>
            {ACCENTS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setAccentOverride(c)}
                accessibilityLabel={`Accent ${c}`}
                style={[styles.dot, { backgroundColor: c, borderColor: accentOverride === c ? colors.text : 'transparent' }]}
              />
            ))}
          </View>
          <Text style={[styles.body, { color: colors.textSecondary }]}>Page paper</Text>
          <Chips items={PAPERS} value={paperOverride} onChange={setPaperOverride} colors={colors} />
        </View>

        </>
        )}

        {section === 'gate' && (
        <>
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
          </>
        )}

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
  voices:  { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, alignItems: 'center' },
  dot:     { width: 30, height: 30, borderRadius: 15, borderWidth: 2 },
  voice:   { borderWidth: 1.5, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 16 },
});
