// What the gate shows from your pack: your own note, and (Tokyo) a torii and an
// omikuji fortune line in the voice you chose. Core with no note renders nothing,
// so the gate looks exactly as before until someone writes a note or picks a skin.

import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useTheme } from '@/hooks/useTheme';
import { useActivePack } from '@/hooks/usePack';
import { usePackStore } from '@/stores/usePackStore';
import { useUserStore } from '@/stores/useUserStore';
import { getGoonStage } from '@/components/home/GoonMascot';
import { FORTUNES } from '@/constants/packs/tokyo';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';
import { PackSprite } from './PackSprite';
import { GlyphIcon } from './GlyphIcon';
import { useCharacter } from './useCharacter';

export function PackGateCard() {
  const { colors, cardStyle } = useTheme();
  const pack = useActivePack();
  const note = usePackStore((s) => s.gateNote.trim());
  const voice = usePackStore((s) => s.gateVoice);
  const char = useCharacter();
  const walkAways = useUserStore((s) => s.walkAwayCount);
  const fortune = useMemo(() => FORTUNES[Math.floor(Math.random() * FORTUNES.length)], []);
  const look = pack.parts.page.look;
  const gate = pack.parts.page.gate;

  if (gate === 'plain') {
    if (!note) return null;
    return (
      <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
        <Text style={[styles.label, { color: colors.textMuted }]}>A note from you</Text>
        <Text style={[styles.note, { color: colors.text }]}>{note}</Text>
      </View>
    );
  }

  if (gate === 'sticky') {
    return (
      <View style={[styles.sticky, { backgroundColor: look.sticky ?? '#FFE98A' }]}>
        <Text style={[styles.stickyText, { color: look.stickyInk ?? '#4A3F10' }]}>{note || 'Note to self: you made this gate for a reason.'}</Text>
      </View>
    );
  }

  if (gate === 'dialog') {
    const hi = look.hi ?? '#fff';
    const lo = look.lo ?? '#808080';
    return (
      <View style={[styles.win, { backgroundColor: look.winBg ?? '#C0C0C0', borderTopColor: hi, borderLeftColor: hi }]}>
        <View style={[styles.winTitle, { backgroundColor: look.winTitle ?? '#000080' }]}>
          <Text style={[styles.winTitleText, { color: look.winTitleText ?? '#fff' }]}>Hold on a moment</Text>
          <Text style={[styles.winTitleText, { color: look.winTitleText ?? '#fff' }]}>×</Text>
        </View>
        <View style={styles.winBody}>
          <Text style={[styles.winIcon, { color: look.winTitle ?? '#000080' }]}>?</Text>
          <Text style={styles.winText}>{note || 'You made this gate. Are you sure you want to open it?'}</Text>
        </View>
        <View style={[styles.winOk, { borderTopColor: hi, borderLeftColor: hi, borderRightColor: lo, borderBottomColor: lo }]}>
          <Text style={styles.winOkText}>OK</Text>
        </View>
      </View>
    );
  }

  // shrine
  const mark = look.mark ?? '#D3382C';
  const wood = look.wood ?? '#E4BE8E';
  const woodInk = look.woodInk ?? '#4B3220';
  return (
    <View style={styles.shrine}>
      <Svg width={84} height={70} viewBox="0 0 120 100">
        <Path d="M2 24 Q60 10 118 24 L114 35 Q60 23 6 35 Z" fill={mark} />
        <Rect x={19} y={43} width={82} height={7} fill={mark} />
        <Rect x={26} y={33} width={10} height={64} fill={mark} />
        <Rect x={84} y={33} width={10} height={64} fill={mark} />
      </Svg>
      <View style={styles.shrineRow}>
        <View style={[styles.ema, { backgroundColor: wood }]}>
          <GlyphIcon name="torii" size={20} color={woodInk} weight={4} />
          <PackSprite char={char} stage={getGoonStage(walkAways)} cell={4} />
          <Text style={[styles.emaNote, { color: woodInk }]}>{note || 'Write a note to future you in Customize.'}</Text>
        </View>
        <View style={styles.omi}>
          <View style={[styles.omiStripe, { backgroundColor: mark }]} />
          <GlyphIcon name={fortune.glyph} size={34} color={mark} />
          <Text style={styles.omiMeaning}>{fortune.meaning}</Text>
        </View>
      </View>
      <Text style={[styles.fortuneLine, { color: colors.textSecondary }]}>{fortune.lines[voice]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card:  { padding: SPACING.md, gap: 4, alignSelf: 'stretch' },
  label: { fontFamily: FONTS.bodyMedium, fontSize: 11.5, letterSpacing: 0.4 },
  note:  { fontFamily: FONTS.body, fontSize: 15, lineHeight: 21 },

  sticky:  { alignSelf: 'stretch', padding: SPACING.lg, borderRadius: 2, transform: [{ rotate: '-1.5deg' }], shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  stickyText: { fontFamily: FONTS.body, fontSize: 16, lineHeight: 23 },

  win:     { alignSelf: 'stretch', borderWidth: 2, borderRightColor: '#404040', borderBottomColor: '#404040', padding: 3, gap: 6 },
  winTitle:{ height: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6 },
  winTitleText: { fontFamily: FONTS.monoBold, fontSize: 12 },
  winBody: { flexDirection: 'row', gap: 10, padding: 8, alignItems: 'center' },
  winIcon: { fontFamily: FONTS.monoBold, fontSize: 28 },
  winText: { flex: 1, fontFamily: FONTS.mono, fontSize: 12.5, color: '#111', lineHeight: 18 },
  winOk:   { alignSelf: 'center', width: 70, borderWidth: 2, borderRightColor: '#404040', borderBottomColor: '#404040', alignItems: 'center', paddingVertical: 3, marginBottom: 4 },
  winOkText: { fontFamily: FONTS.monoBold, fontSize: 12, color: '#111' },

  shrine:    { alignItems: 'center', gap: 8, alignSelf: 'stretch' },
  shrineRow: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  ema:       { flex: 1, borderRadius: 8, padding: 10, alignItems: 'center', gap: 4 },
  emaLabel:  { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 2 },
  emaNote:   { fontFamily: FONTS.body, fontSize: 13.5, textAlign: 'center', lineHeight: 19 },
  omi:       { width: 64, backgroundColor: '#fbf7ee', borderRadius: 3, borderWidth: 1, borderColor: '#d9d0bd', alignItems: 'center', paddingBottom: 8, overflow: 'hidden' },
  omiStripe: { height: 8, alignSelf: 'stretch', marginBottom: 6 },
  omiMeaning:{ fontFamily: FONTS.body, fontSize: 8.5, color: '#6a5d4b', textAlign: 'center', marginTop: 4, paddingHorizontal: 3 },
  fortuneLine: { fontFamily: FONTS.body, fontSize: 13.5, textAlign: 'center', lineHeight: 19, paddingHorizontal: SPACING.sm },
});
