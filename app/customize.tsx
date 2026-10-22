// ─── Customize ────────────────────────────────────────────────────────────────
//
// One place for: the new My Page switch , skins (packs), a pack code, and the
// personal note shown at the gate. Hidden packs only appear after they are unlocked.

import { useState, useCallback, type ComponentProps } from 'react';
import { PackSprite } from '@/components/page/PackSprite';
import { ALL_CHARACTER_IDS, CHARACTER_NAMES, CHAR_COLORS } from '@/constants/sprites';
import { View, Text, TextInput, Pressable, ScrollView, Switch, StyleSheet, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { usePackStore, GATE_NOTE_MAX, DEFAULT_COMPANION_POS, type GateVoice, type FloatMode, type CompanionSize, type PaperChoice, type DayDisplay } from '@/stores/usePackStore';
import { availablePacks } from '@/constants/packs';
import { FONTS } from '@/constants/Colors';
import type { CharacterId } from '@/stores/usePetStore';
import type { GoonStage } from '@/constants/sprites';
import { BUNDLES, CUSTOM_LEN, CUSTOM_MAX } from '@/constants/offers';
import { useOfferStore } from '@/stores/useOfferStore';
import { useBriefingPrefs } from '@/stores/useBriefingPrefs';
import { setBriefingReminder } from '@/utils/notifications';
import { TimeField } from '@/components/TimeField';
import { useWalkStore, GATE_GOALS } from '@/stores/useWalkStore';
import { useRoomStore, ROOM_NAME_MAX, type TodayLayout, type TabStyle } from '@/stores/useRoomStore';
import { RoomScene } from '@/components/page/RoomScene';
import { LOOK_PARTS, ROOM_SWATCHES, DECOR_UNLOCK, type DecorKey } from '@/constants/room';
import { useUserStore } from '@/stores/useUserStore';
import { useMascotStore, stageOf, nextStageAt, STAGE_AT } from '@/stores/useMascotStore';
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

type CustSection = 'room' | 'layout' | 'skins' | 'companion' | 'gate' | 'colour';
const HUB: { id: CustSection; icon: ComponentProps<typeof Feather>['name']; title: string; sub: string }[] = [
  { id: 'room',      icon: 'home',       title: 'Your room',            sub: 'Name, colours, decor' },
  { id: 'skins',     icon: 'package',    title: 'Skins & codes',        sub: 'Enter a code for extras' },
  { id: 'companion', icon: 'smile',      title: 'Your companion',       sub: 'Which one, how it floats, how big' },
  { id: 'colour',    icon: 'droplet',    title: 'Colour & paper',       sub: 'Accent colour and page background' },
  { id: 'gate',      icon: 'shield',     title: 'At the gate',          sub: 'Instead bundles, your own list, your note' },
  { id: 'layout',    icon: 'layout',     title: 'Layout & news',        sub: 'Today page, tab bar, news, sponsors' },
];

const STAGE_LABELS = ['Dormant', 'Awakening', 'Standing', 'Powered', 'Legendary'];

// All five stages of one companion in a row. Stages you have reached are in colour, the ones
// still ahead are dimmed with the feedings they need, and a bar shows how far to the next.
function EvolutionPanel({ char, fed, isActive, onChoose, colors }: {
  char: CharacterId; fed: number; isActive: boolean; onChoose: () => void;
  colors: { accent: string; accentDim: string; border: string; text: string; textSecondary: string; textMuted: string; background: string };
}) {
  const stage = stageOf(fed);
  const next = nextStageAt(fed);
  const prev = stage === 0 ? 0 : STAGE_AT[stage - 1];
  const pct = next === null ? 100 : Math.max(0, Math.min(100, ((fed - prev) / (next - prev)) * 100));
  const name = CHARACTER_NAMES[char];
  return (
    <View style={{ gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
      <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: colors.text }}>{name}</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {STAGE_LABELS.map((label, i) => {
          const reached = i <= stage;
          const needs = i === 0 ? 0 : STAGE_AT[i - 1];
          // Evolutions stay a surprise until they are reached.
          return (
            <View key={label} style={{ flex: 1, alignItems: 'center', gap: 2 }} accessibilityLabel={reached ? label : 'Hidden evolution, not reached yet'}>
              {reached ? (
                <PackSprite char={char} stage={i as GoonStage} cell={3} />
              ) : (
                <View style={{ width: 30, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border }}>
                  <Feather name="help-circle" size={16} color={colors.textMuted} />
                </View>
              )}
              <Text style={{ fontFamily: FONTS.body, fontSize: 10, color: i === stage ? colors.accent : reached ? colors.textSecondary : colors.textMuted }}>{reached ? label : '???'}</Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 9, color: colors.textMuted }}>{reached ? (i === 0 ? 'start' : `${needs} fed`) : ' '}</Text>
            </View>
          );
        })}
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: 8, backgroundColor: colors.accent }} />
      </View>
      <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: colors.textSecondary }}>
        {next === null
          ? `${fed} fed. ${name} is fully evolved.`
          : `${fed} fed. ${next - fed} more feedings to reveal the next evolution.`}
      </Text>
      {isActive ? (
        <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: colors.accent }}>This is who you're feeding.</Text>
      ) : (
        <Pressable
          onPress={onChoose}
          accessibilityRole="button"
          style={{ alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.accent }}
        >
          <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: colors.background }}>Feed {name} from now on</Text>
        </Pressable>
      )}
    </View>
  );
}

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

// ── Layout previews: tiny phone sketches so you can see the layout before choosing it ──────────
const LAYOUT_CHOICES: { id: TodayLayout; title: string; sub: string }[] = [
  { id: 'roomlast', title: 'Room last',    sub: 'Everything on top, then the room, then Need a minute' },
  { id: 'room',  title: 'Room',           sub: 'Your companion in its room' },
  { id: 'cards', title: 'Room and cards', sub: 'Smaller room, your numbers, good news' },
  { id: 'plain', title: 'Plain page',     sub: 'Paper, companion and stamps' },
  { id: 'focus', title: 'Just the button', sub: 'Streak, button, nothing else' },
];

function LayoutSketch({ kind, colors }: { kind: TodayLayout; colors: { accent: string; accentDim: string; border: string; surfaceHigh: string; textMuted: string } }) {
  const line = { height: 4, borderRadius: 2, backgroundColor: colors.border };
  const yellow = { height: 12, borderRadius: 5, backgroundColor: '#FFC21A' };
  const card = { height: 9, borderRadius: 3, backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.border };
  return (
    <View style={{ width: 62, height: 96, borderRadius: 9, borderWidth: 1.5, borderColor: colors.border, padding: 5, gap: 4, backgroundColor: colors.surfaceHigh + '88' }}>
      <View style={[line, { width: '55%' }]} />
      {kind === 'roomlast' && (
        <>
          <View style={card} />
          <View style={card} />
          <View style={{ height: 24, borderRadius: 4, backgroundColor: colors.accentDim }} />
        </>
      )}
      {kind === 'room' && <View style={{ height: 36, borderRadius: 4, backgroundColor: colors.accentDim }} />}
      {kind === 'cards' && (
        <>
          <View style={{ height: 22, width: '72%', alignSelf: 'center', borderRadius: 4, backgroundColor: colors.accentDim }} />
          <View style={{ flexDirection: 'row', gap: 2 }}>
            {[0, 1, 2].map((i) => <View key={i} style={[card, { flex: 1, height: 10 }]} />)}
          </View>
          <View style={card} />
        </>
      )}
      {kind === 'plain' && (
        <>
          <View style={[line, { width: '40%', height: 8, backgroundColor: colors.textMuted }]} />
          <View style={[line, { width: '85%' }]} />
          <View style={[line, { width: '70%' }]} />
        </>
      )}
      {kind === 'focus' && (
        <>
          <View style={{ width: 16, height: 16, borderRadius: 8, alignSelf: 'center', backgroundColor: colors.accentDim }} />
          <View style={[line, { width: 20, height: 10, alignSelf: 'center', backgroundColor: colors.textMuted }]} />
        </>
      )}
      <View style={yellow} />
      {kind !== 'focus' && kind !== 'roomlast' && <View style={card} />}
      {kind === 'plain' && <View style={card} />}
    </View>
  );
}

function TabSketch({ kind, colors }: { kind: TabStyle; colors: { accent: string; border: string; textMuted: string; surfaceHigh: string } }) {
  return (
    <View style={{ width: 118, height: 40, borderRadius: 8, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surfaceHigh + '88', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', paddingBottom: 6, paddingHorizontal: 4 }}>
      {[0, 1, 2, 3, 4].map((i) =>
        i === 2 && kind === 'raised'
          ? <View key={i} style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accent, marginBottom: 5, borderWidth: 2, borderColor: colors.surfaceHigh }} />
          : <View key={i} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: i === 2 ? colors.accent : colors.textMuted }} />
      )}
    </View>
  );
}

export default function CustomizeScreen() {
  const { colors, cardStyle } = useTheme();
  const showWorldNews = usePackStore((s) => s.showWorldNews);
  const remind = useBriefingPrefs((s) => s.remind);
  const remindAt = useBriefingPrefs((s) => s.remindAt);
  const setRemind = useBriefingPrefs((s) => s.setRemind);
  const setRemindAt = useBriefingPrefs((s) => s.setRemindAt);
  const toggleRemind = async (on: boolean) => {
    const ok = await setBriefingReminder(on, remindAt);
    setRemind(on && ok);                       // stays off if notifications were refused
  };
  const changeRemindAt = (v: string) => { setRemindAt(v); if (remind) setBriefingReminder(true, v); };
  const setShowWorldNews = usePackStore((s) => s.setShowWorldNews);
  const activePackId  = usePackStore((s) => s.activePackId);
  const unlockedIds   = usePackStore((s) => s.unlockedIds);
  const setActivePack = usePackStore((s) => s.setActivePack);
  const redeemCode    = usePackStore((s) => s.redeemCode);
  const gateNote      = usePackStore((s) => s.gateNote);
  const bundleIds     = useOfferStore((s) => s.bundleIds);
  const gateWalk      = useWalkStore((s) => s.gateWalk);
  const gateGoal      = useWalkStore((s) => s.gateGoal);
  const setGateWalk   = useWalkStore((s) => s.setGateWalk);
  const setGateGoal   = useWalkStore((s) => s.setGateGoal);
  const myList        = useOfferStore((s) => s.custom);
  const toggleBundle  = useOfferStore((s) => s.toggleBundle);
  const todayLayout   = useRoomStore((s) => s.todayLayout);
  const setTodayLayout = useRoomStore((s) => s.setTodayLayout);
  const tabStyle       = useRoomStore((s) => s.tabStyle);
  const setTabStyle    = useRoomStore((s) => s.setTabStyle);
  const showSponsors  = useOfferStore((s) => s.showSponsors);
  const setShowSponsors = useOfferStore((s) => s.setShowSponsors);
  const addMine        = useOfferStore((s) => s.addCustom);
  const removeMine     = useOfferStore((s) => s.removeCustom);
  const [mineDraft, setMineDraft] = useState('');
  const params = useLocalSearchParams<{ section?: string }>();
  const [section, setSection] = useState<CustSection | null>(params.section === 'room' ? 'room' : null);
  const roomName      = useRoomStore((s) => s.roomName);
  const setRoomName   = useRoomStore((s) => s.setRoomName);
  const look          = useRoomStore((s) => s.look);
  const setLook       = useRoomStore((s) => s.setLook);
  const decor         = useRoomStore((s) => s.decor);
  const setDecor      = useRoomStore((s) => s.setDecor);
  const resetRoom     = useRoomStore((s) => s.resetRoom);
  const walkAways     = useUserStore((s) => s.walkAwayCount);
  const streakNow     = useUserStore((s) => s.streak);
  const [previewNight, setPreviewNight] = useState(false);
  // Only while this screen is on top, so Back still works on screens opened from here.
  useFocusEffect(useCallback(() => {
    const sub = section
      ? BackHandler.addEventListener('hardwareBackPress', () => { setSection(null); return true; })
      : null;
    return () => sub?.remove();
  }, [section]));
  const setGateNote   = usePackStore((s) => s.setGateNote);
  const gateVoice     = usePackStore((s) => s.gateVoice);
  const setGateVoice  = usePackStore((s) => s.setGateVoice);
  const dayDisplay       = usePackStore((s) => s.dayDisplay);
  const setDayDisplay    = usePackStore((s) => s.setDayDisplay);
  const activeChar       = useMascotStore((s) => s.active);
  const fedMap           = useMascotStore((s) => s.fed);
  const chooseChar       = useMascotStore((s) => s.setActive);
  const activeFed        = fedMap[activeChar] ?? 0;
  const activeNext       = nextStageAt(activeFed);
  // The companion whose full evolution is on show. Defaults to the one being fed; tapping a
  // tile previews it, and only the "Make … my companion" button actually switches.
  const [previewChar, setPreviewChar] = useState<CharacterId | null>(null);
  const shownChar        = previewChar ?? activeChar;
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
              const sub = h.id === 'skins' && packs.length > 1 ? `Now: ${packs.find((p) => p.id === activePackId)?.name ?? 'Core'}` : h.sub;
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

        {section === 'room' && (
        <>
        <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder, alignItems: 'center' }]}>
          <RoomScene
            char={activeChar} stage={stageOf(activeFed)} streak={streakNow} walkAways={walkAways}
            headline={null} showSponsors={false} petName="" interactive={false} showTicker={false}
            forceNight={previewNight} outerPad={96}
          />
          <Chips
            items={[{ id: 'day', label: 'Day' }, { id: 'night', label: 'Night' }]}
            value={previewNight ? 'night' : 'day'}
            onChange={(v) => setPreviewNight(v === 'night')}
            colors={colors}
          />
        </View>

        <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Name</Text>
          <TextInput
            value={roomName}
            onChangeText={setRoomName}
            maxLength={ROOM_NAME_MAX}
            placeholder="Your room"
            placeholderTextColor={colors.textMuted}
            autoCorrect={false}
            returnKeyType="done"
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />
        </View>

        <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Colours</Text>
          {LOOK_PARTS.map(({ part, label }) => (
            <View key={part} style={{ gap: 6 }}>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>{label}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {ROOM_SWATCHES[part].map((sw) => {
                  const on = look[part] === sw.key;
                  return (
                    <Pressable
                      key={sw.key}
                      onPress={() => setLook(part, sw.key)}
                      accessibilityRole="button"
                      accessibilityLabel={`${label}: ${sw.name}`}
                      accessibilityState={{ selected: on }}
                      hitSlop={4}
                      style={{
                        width: 34, height: 34, borderRadius: 17, backgroundColor: sw.a,
                        borderWidth: on ? 3 : 1, borderColor: on ? colors.accent : colors.border,
                      }}
                    />
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Decor</Text>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Pieces appear as you walk away. Once earned they stay, and you choose whether to show them.
          </Text>
          {(Object.keys(DECOR_UNLOCK) as DecorKey[]).map((k) => {
            const u = DECOR_UNLOCK[k];
            const locked = walkAways < u.at;
            return (
              <View key={k} style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.body, { color: locked ? colors.textMuted : colors.text }]}>{u.label}</Text>
                  {locked && <Text style={[styles.hint, { color: colors.textMuted }]}>Unlocks at {u.at} walk-aways ({Math.max(0, u.at - walkAways)} to go)</Text>}
                </View>
                <Switch
                  value={decor[k]}
                  disabled={locked}
                  onValueChange={(v) => setDecor(k, v)}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor="#fff"
                />
              </View>
            );
          })}
        </View>

        <Pressable
          onPress={resetRoom}
          accessibilityRole="button"
          style={[styles.btn, { borderColor: colors.border, borderWidth: 1, backgroundColor: 'transparent' }]}
        >
          <Text style={[styles.btnText, { color: colors.textSecondary }]}>Reset colours and decor</Text>
        </Pressable>
        </>
        )}

        {section === 'layout' && (
        <>
        <Text style={[styles.section, { color: colors.textMuted }]}>Today page</Text>
        <View style={styles.tileGrid}>
          {LAYOUT_CHOICES.map((l) => {
            const on = todayLayout === l.id;
            return (
              <Pressable
                key={l.id}
                onPress={() => setTodayLayout(l.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${l.title}. ${l.sub}`}
                style={[styles.tile, cardStyle, { backgroundColor: on ? colors.accentDim : colors.surface, borderColor: on ? colors.accent : colors.cardBorder }]}
              >
                <LayoutSketch kind={l.id} colors={colors} />
                <Text style={[styles.cardTitle, { color: colors.text, textAlign: 'center' }]}>{l.title}</Text>
                <Text style={[styles.hint, { color: colors.textSecondary, textAlign: 'center' }]}>{l.sub}</Text>
                {on && <Feather name="check-circle" size={16} color={colors.accent} />}
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.section, { color: colors.textMuted }]}>Tab bar</Text>
        <View style={styles.tileGrid}>
          {([['standard', 'Standard', 'Five equal tabs'], ['raised', 'Raised Today', 'Your companion in a round centre button']] as const).map(([id, title, sub]) => {
            const on = tabStyle === id;
            return (
              <Pressable
                key={id}
                onPress={() => setTabStyle(id)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${title}. ${sub}`}
                style={[styles.tile, cardStyle, { backgroundColor: on ? colors.accentDim : colors.surface, borderColor: on ? colors.accent : colors.cardBorder }]}
              >
                <TabSketch kind={id} colors={colors} />
                <Text style={[styles.cardTitle, { color: colors.text, textAlign: 'center' }]}>{title}</Text>
                <Text style={[styles.hint, { color: colors.textSecondary, textAlign: 'center' }]}>{sub}</Text>
                {on && <Feather name="check-circle" size={16} color={colors.accent} />}
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.section, { color: colors.textMuted }]}>Briefing and sponsors</Text>
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

        <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Daily briefing reminder</Text>
              <Text style={[styles.body, { color: colors.textSecondary }]}>
                One quiet notification a day when your briefing is ready, instead of reaching for a feed. Off by default.
              </Text>
            </View>
            <Switch
              value={remind}
              onValueChange={toggleRemind}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor="#fff"
            />
          </View>
          {remind ? <View style={{ marginTop: 8 }}><TimeField label="Remind me at" value={remindAt} onChange={changeRemindAt} colors={colors} /></View> : null}
        </View>

        <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Show sponsors</Text>
              <Text style={[styles.body, { color: colors.textSecondary }]}>
                The Wall and a few local sponsors in Beyond the screen. Sponsors keep NoGoon free. Never shown at the gate. Turn off to hide them completely.
              </Text>
            </View>
            <Switch
              value={showSponsors}
              onValueChange={setShowSponsors}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor="#fff"
            />
          </View>
        </View>
        </>
        )}

        {section === 'skins' && (
        <>
        {packs.length > 1 && <Text style={[styles.section, { color: colors.textMuted }]}>Skins</Text>}
        {packs.length > 1 && packs.map((p) => {
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
          <Text style={[styles.body, { color: colors.text }]}>
            Walk-aways and walks earn treats. Feed {CHARACTER_NAMES[activeChar]} from Today and they grow. Switch anytime: only the one you're feeding grows, and the others keep what they've earned.
          </Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            {activeNext === null
              ? `${activeFed} fed. Fully grown.`
              : `${activeFed} fed. ${activeNext - activeFed} more for the next stage.`}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ALL_CHARACTER_IDS.map((id) => {
              const on = id === activeChar;
              const idFed = fedMap[id] ?? 0;
              const idStage = stageOf(idFed);
              const tint = CHAR_COLORS[id][0][1];
              return (
                <Pressable
                  key={id}
                  onPress={() => setPreviewChar(id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: id === shownChar }}
                  accessibilityLabel={`${CHARACTER_NAMES[id]}${on ? ', your companion' : ''}. Tap to see its evolution.`}
                  style={{
                    flexBasis: '22%', flexGrow: 1, alignItems: 'center', paddingVertical: 8, gap: 4,
                    borderRadius: 14, borderWidth: id === shownChar ? 2 : 1,
                    borderColor: id === shownChar ? colors.accent : colors.border,
                    backgroundColor: on ? tint + '22' : 'transparent',
                  }}
                >
                  <PackSprite char={id} stage={idStage} cell={4} />
                  <Text style={[styles.body, { color: on ? colors.accent : colors.textSecondary, fontSize: 12 }]}>{CHARACTER_NAMES[id]}</Text>
                  <Text style={[styles.body, { color: colors.textMuted, fontSize: 10 }]}>{on ? 'Feeding' : idFed > 0 ? `Stage ${idStage + 1}` : 'New'}</Text>
                </Pressable>
              );
            })}
          </View>
          <EvolutionPanel
            char={shownChar}
            fed={fedMap[shownChar] ?? 0}
            isActive={shownChar === activeChar}
            onChoose={() => { chooseChar(shownChar); setPreviewChar(null); }}
            colors={colors}
          />
          <Text style={[styles.body, { color: colors.textSecondary }]}>Day count</Text>
          <Chips items={DAY_DISPLAYS} value={dayDisplay} onChange={setDayDisplay} colors={colors} />
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            A small floating buddy you can drag anywhere.
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
        <Text style={[styles.section, { color: colors.textMuted }]}>Walk to get in</Text>
        <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.body, { color: colors.text }]}>Take your pal for a walk</Text>
              <Text style={[styles.hint, { color: colors.textMuted }]}>
                Off by default. When on, the gate leads with a walk, and walking the steps is the way into a blocked app. Hard modes never unlock; the walk just counts as walking away.
              </Text>
            </View>
            <Switch
              value={gateWalk}
              onValueChange={setGateWalk}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor="#fff"
              accessibilityLabel="Walk to get in"
            />
          </View>
          {gateWalk && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              {GATE_GOALS.map((g) => {
                const on = g === gateGoal;
                return (
                  <Pressable
                    key={g}
                    onPress={() => setGateGoal(g)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${g} steps`}
                    style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1, backgroundColor: on ? colors.accent : colors.surfaceHigh, borderColor: on ? colors.accent : colors.cardBorder }}
                  >
                    <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: on ? colors.background : colors.text }}>{g}</Text>
                    <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: on ? colors.background : colors.textMuted }}>steps</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

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
          <Text style={[styles.body, { color: colors.textSecondary }]}>Voice for your gate note</Text>
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
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  tile: { width: '48%', flexGrow: 1, alignItems: 'center', gap: 6, padding: SPACING.md },
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
