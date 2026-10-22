// ─── PerkCard ─────────────────────────────────────────────────────────────────
//
// A small thank-you from one local sponsor, shown AFTER someone finishes a walk (never in the gate, never
// before an action). Labelled Sponsored, can be reported, and respects Customize > "Show sponsors".
// At most one a day. The perk is used in person: the app sends nothing about the viewer.

import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Linking, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useOfferStore } from '@/stores/useOfferStore';
import { usePerkStore } from '@/stores/usePerkStore';
import { getWall, pickPerk, reportTile, tapTile, type WallTile } from '@/lib/wall';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function PerkCard() {
  const { colors, cardStyle } = useTheme();
  const showSponsors = useOfferStore((s) => s.showSponsors);
  const place = useOfferStore((s) => s.place);
  const [tile, setTile] = useState<WallTile | null>(null);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    if (!showSponsors) return;
    const day = today();
    if (usePerkStore.getState().lastShownDay === day) return;
    let live = true;
    getWall().then((w) => {
      if (!live) return;
      const pick = pickPerk(w.tiles, place, Math.floor(Date.now() / 86400000));
      if (pick) { setTile(pick); usePerkStore.getState().markShown(day); }
    }).catch(() => {});
    return () => { live = false; };
  }, [showSponsors, place]);

  if (!tile || !tile.perk) return null;

  const see = () => {
    tapTile(tile.id);
    Linking.openURL(tile.url).catch(() => Alert.alert("Couldn't open that", 'Check your connection and try again.'));
  };
  const report = async () => { if (await reportTile(tile.id, 'Reported perk after a walk')) setReported(true); };

  return (
    <View
      style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
      accessibilityLabel={`Sponsored thank-you from ${tile.company}: ${tile.perk}`}
    >
      <Text style={[styles.label, { color: colors.textMuted }]}>SPONSORED · A THANK-YOU FOR YOUR WALK</Text>
      <Text style={[styles.company, { color: colors.text }]}>{tile.company}</Text>
      <Text style={[styles.perk, { color: colors.textSecondary }]}>{tile.perk}</Text>
      <View style={styles.row}>
        <Pressable onPress={see} style={[styles.btn, { borderColor: colors.accent }]} accessibilityRole="button" accessibilityLabel={`See the offer from ${tile.company}`}>
          <Feather name="external-link" size={15} color={colors.accent} />
          <Text style={[styles.btnText, { color: colors.accent }]}>See the offer</Text>
        </Pressable>
        <Pressable onPress={report} disabled={reported} hitSlop={8} accessibilityRole="button" accessibilityLabel="Report this sponsor">
          <Text style={[styles.report, { color: colors.textMuted }]}>{reported ? 'Reported, thanks' : 'Report'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card:    { alignSelf: 'stretch', borderWidth: 1, borderRadius: 16, padding: SPACING.md, gap: 6 },
  label:   { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 0.8 },
  company: { fontFamily: FONTS.display, fontSize: 18 },
  perk:    { fontFamily: FONTS.body, fontSize: 15, lineHeight: 21 },
  row:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  btn:     { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  btnText: { fontFamily: FONTS.bodyBold, fontSize: 14 },
  report:  { fontFamily: FONTS.body, fontSize: 13 },
});
