// The box your companion lives in. The pack picks the frame:
//   box    — plain themed card (Core)
//   egg    — Tamagotchi-style shell with an LCD (Tokyo)
//   window — bevelled desktop window (Webcore)
// Tapping the sprite or the A/B/C buttons makes it hop and reports the action.

import { useRef } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import Svg, { Path, Ellipse } from 'react-native-svg';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';
import { PackSprite } from './PackSprite';
import type { PackManifest } from '@/constants/packs';
import type { CharacterId } from '@/stores/usePetStore';
import type { GoonStage } from '@/constants/sprites';

export type HabitatAction = 'feed' | 'play' | 'pet';

const STAGE_NAMES = ['Dormant', 'Awakening', 'Standing Guard', 'Battle-Ready', 'Legendary'];

type Props = {
  pack: PackManifest;
  char: CharacterId;
  stage: GoonStage;
  petName: string;
  streak: number;
  walkAways: number;
  onAction: (a: HabitatAction) => void;
};

export function Habitat(p: Props) {
  const hop = useRef(new Animated.Value(0)).current;
  const doHop = (a: HabitatAction) => {
    Animated.sequence([
      Animated.timing(hop, { toValue: -14, duration: 140, useNativeDriver: true }),
      Animated.timing(hop, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
    p.onAction(a);
  };
  const frame = p.pack.parts.page.frame;
  if (frame === 'egg')    return <Egg {...p} hop={hop} doHop={doHop} />;
  if (frame === 'window') return <Win {...p} hop={hop} doHop={doHop} />;
  return <Box {...p} hop={hop} doHop={doHop} />;
}

type Inner = Props & { hop: Animated.Value; doHop: (a: HabitatAction) => void };

// ── Core box ────────────────────────────────────────────────────────────────
function Box({ char, stage, petName, hop, doHop }: Inner) {
  const { colors, cardStyle } = useTheme();
  return (
    <View style={[styles.box, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
      <Pressable onPress={() => doHop('pet')} accessibilityLabel={`Pet ${petName}`}>
        <Animated.View style={{ transform: [{ translateY: hop }] }}>
          <PackSprite char={char} stage={stage} cell={10} />
        </Animated.View>
      </Pressable>
      <Text style={[styles.name, { color: colors.text }]}>{petName}</Text>
      <Text style={[styles.stage, { color: colors.textMuted }]}>{STAGE_NAMES[stage]}</Text>
    </View>
  );
}

// ── Tokyo egg ───────────────────────────────────────────────────────────────
function Egg({ pack, char, stage, streak, hop, doHop }: Inner) {
  const look = pack.parts.page.look;
  const shell = look.shell ?? '#F5A9C0';
  const ink = look.lcdInk ?? '#2C3B20';
  const hearts = '♥'.repeat(stage + 1) + '♡'.repeat(4 - stage);
  return (
    <View style={styles.eggWrap}>
      <View style={styles.eggLoop} />
      <View style={styles.eggBody}>
        <Svg width={236} height={272} style={StyleSheet.absoluteFill}>
          <Path
            d="M118 3 C186 3 233 112 233 172 C233 236 183 269 118 269 C53 269 3 236 3 172 C3 112 50 3 118 3 Z"
            fill={shell} stroke="rgba(0,0,0,0.14)" strokeWidth={3}
          />
          <Ellipse cx={80} cy={70} rx={34} ry={46} fill="#ffffff" opacity={0.28} />
        </Svg>
        <View style={[styles.bezel, { backgroundColor: look.bezel ?? '#FFF3EE' }]}>
          <View style={[styles.lcd, { backgroundColor: look.lcdBg ?? '#D9E6BC' }]}>
            <View style={styles.lcdRow}>
              <Text style={[styles.lcdText, { color: ink }]}>{hearts}</Text>
              <Text style={[styles.lcdText, { color: ink }]}>DAY {streak}</Text>
            </View>
            <Pressable style={styles.lcdSprite} onPress={() => doHop('pet')} accessibilityLabel="Pet your companion">
              <Animated.View style={{ transform: [{ translateY: hop }] }}>
                <PackSprite char={char} stage={stage} cell={7} mono ink={ink} />
              </Animated.View>
            </Pressable>
            <View style={[styles.lcdGround, { borderColor: ink }]} />
            <View style={styles.lcdRow}>
              <Text style={[styles.lcdText, { color: ink }]}>FEED</Text>
              <Text style={[styles.lcdText, { color: ink }]}>PLAY</Text>
              <Text style={[styles.lcdText, { color: ink }]}>PET</Text>
            </View>
          </View>
        </View>
        <View style={styles.eggBtns}>
          {(['feed', 'play', 'pet'] as HabitatAction[]).map((a, i) => (
            <Pressable
              key={a}
              onPress={() => doHop(a)}
              accessibilityLabel={a}
              style={({ pressed }) => [
                styles.eggBtn,
                { backgroundColor: look.bezel ?? '#FFF3EE', marginBottom: i === 1 ? -10 : 0, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={styles.eggBtnText}>{['A', 'B', 'C'][i]}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

// ── Webcore window ──────────────────────────────────────────────────────────
function Win({ pack, char, stage, petName, streak, walkAways, hop, doHop }: Inner) {
  const look = pack.parts.page.look;
  const hi = look.hi ?? '#ffffff';
  const lo = look.lo ?? '#808080';
  return (
    <View style={[styles.win, { backgroundColor: look.winBg ?? '#C0C0C0', borderTopColor: hi, borderLeftColor: hi }]}>
      <View style={[styles.winTitle, { backgroundColor: look.winTitle ?? '#000080' }]}>
        <Text style={[styles.winTitleText, { color: look.winTitleText ?? '#fff' }]}>{petName.toLowerCase()}.exe</Text>
        <View style={styles.winBtns}>
          {['_', '□', '×'].map((g) => (
            <View key={g} style={[styles.winBtn, { backgroundColor: look.winBg ?? '#C0C0C0', borderTopColor: hi, borderLeftColor: hi }]}>
              <Text style={styles.winBtnText}>{g}</Text>
            </View>
          ))}
        </View>
      </View>
      <Pressable
        onPress={() => doHop('pet')}
        style={[styles.winPane, { backgroundColor: look.pane ?? '#008080', borderTopColor: lo, borderLeftColor: lo, borderRightColor: hi, borderBottomColor: hi }]}
        accessibilityLabel={`Pet ${petName}`}
      >
        <Animated.View style={{ transform: [{ translateY: hop }] }}>
          <PackSprite char={char} stage={stage} cell={9} />
        </Animated.View>
        <Text style={styles.winPaneText}>{STAGE_NAMES[stage]}</Text>
      </Pressable>
      <View style={[styles.winStatus, { borderTopColor: lo, borderLeftColor: lo, borderRightColor: hi, borderBottomColor: hi }]}>
        <Text style={styles.winStatusText}>Day {streak}  |  {walkAways} walk-away{walkAways === 1 ? '' : 's'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box:    { alignItems: 'center', padding: SPACING.lg, gap: SPACING.xs },
  name:   { fontFamily: FONTS.bodyBold, fontSize: 18, marginTop: SPACING.sm },
  stage:  { fontFamily: FONTS.body, fontSize: 12.5 },

  eggWrap: { alignSelf: 'center', width: 236, height: 300, paddingTop: 28 },
  eggLoop: { position: 'absolute', top: 0, left: 96, width: 44, height: 40, borderWidth: 5, borderColor: '#c4c4d0', borderRadius: 22 },
  eggBody: { width: 236, height: 272 },
  bezel:   { position: 'absolute', left: 40, top: 46, width: 156, height: 142, borderRadius: 24, padding: 9, borderWidth: 2, borderColor: 'rgba(0,0,0,0.12)' },
  lcd:     { flex: 1, borderRadius: 9, overflow: 'hidden', paddingVertical: 4, paddingHorizontal: 6, justifyContent: 'space-between' },
  lcdRow:  { flexDirection: 'row', justifyContent: 'space-between' },
  lcdText: { fontFamily: FONTS.mono, fontSize: 9.5 },
  lcdSprite: { alignSelf: 'center', marginTop: -2 },
  lcdGround: { borderTopWidth: 2, borderStyle: 'dotted', opacity: 0.5, marginBottom: 2 },
  eggBtns: { position: 'absolute', bottom: 22, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 20 },
  eggBtn:  { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: 'rgba(0,0,0,0.22)', alignItems: 'center', justifyContent: 'center' },
  eggBtnText: { fontFamily: FONTS.monoBold, fontSize: 12, color: '#333' },

  win:      { borderWidth: 2, borderRightColor: '#404040', borderBottomColor: '#404040', padding: 3, gap: 3 },
  winTitle: { height: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 6, paddingRight: 2 },
  winTitleText: { fontFamily: FONTS.monoBold, fontSize: 12 },
  winBtns:  { flexDirection: 'row', gap: 2 },
  winBtn:   { width: 18, height: 16, borderWidth: 2, borderRightColor: '#404040', borderBottomColor: '#404040', alignItems: 'center', justifyContent: 'center' },
  winBtnText: { fontFamily: FONTS.monoBold, fontSize: 10, color: '#111', lineHeight: 12 },
  winPane:  { borderWidth: 2, alignItems: 'center', paddingVertical: 16, gap: 8 },
  winPaneText: { fontFamily: FONTS.mono, fontSize: 12, color: '#ffffff' },
  winStatus: { borderWidth: 1, paddingHorizontal: 6, paddingVertical: 3 },
  winStatusText: { fontFamily: FONTS.mono, fontSize: 11, color: '#111111' },
});
