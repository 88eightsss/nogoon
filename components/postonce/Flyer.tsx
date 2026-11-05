// ─── The flyer ───────────────────────────────────────────────────────────────────────────────
// Four looks, same facts. Fixed colors so it prints and photographs the same on every theme.
// Only the host's own words and link appear. The QR is the host's link; with no link there is no code.

import { View, Text, StyleSheet } from 'react-native';
import { FONTS } from '@/constants/Colors';
import { QrView } from './QrView';
import { fitsInQR, QR_MAX_BYTES } from '@/lib/qr';
import { whenText, type PostOnceEvent } from '@/lib/postOnce';

export type FlyerLook = 'plain' | 'bold' | 'night' | 'warm';
export const LOOKS: { key: FlyerLook; label: string }[] = [
  { key: 'plain', label: 'Plain' }, { key: 'bold', label: 'Bold' }, { key: 'night', label: 'Night' }, { key: 'warm', label: 'Warm' },
];

const PALETTE: Record<FlyerLook, { bg: string; band: string; ink: string; sub: string; accent: string; qrBg: string; qrFg: string; onBand: string }> = {
  plain: { bg: '#FFFFFF', band: '#FFFFFF', ink: '#14202B', sub: '#4A5A68', accent: '#1F6F5C', qrBg: '#FFFFFF', qrFg: '#000000', onBand: '#14202B' },
  bold:  { bg: '#FFFFFF', band: '#1F6F5C', ink: '#14202B', sub: '#4A5A68', accent: '#1F6F5C', qrBg: '#FFFFFF', qrFg: '#000000', onBand: '#FFFFFF' },
  night: { bg: '#10202B', band: '#10202B', ink: '#F4F7F9', sub: '#B7C4CE', accent: '#7FD6B8', qrBg: '#FFFFFF', qrFg: '#000000', onBand: '#F4F7F9' },
  warm:  { bg: '#FFF4E2', band: '#D9822B', ink: '#2B1A08', sub: '#6B4A25', accent: '#B5651D', qrBg: '#FFFFFF', qrFg: '#000000', onBand: '#FFFFFF' },
};

export function Flyer({ e, look, width }: { e: PostOnceEvent; look: FlyerLook; width: number }) {
  const p = PALETTE[look];
  const link = e.link.trim();
  const canQr = !!link && fitsInQR(link);
  const s = width / 360;   // everything scales from a 360-wide design
  return (
    <View style={[styles.page, { width, backgroundColor: p.bg, borderColor: look === 'plain' ? '#D5DDE3' : p.bg }]} accessible accessibilityLabel={`Flyer: ${e.title}`}>
      <View style={[styles.band, { backgroundColor: p.band, paddingVertical: 18 * s, paddingHorizontal: 20 * s }]}>
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12 * s, letterSpacing: 1.2, color: p.onBand, opacity: 0.85 }}>
          {e.kind === 'hand' ? 'HANDS NEEDED' : 'ALL ARE WELCOME'}
        </Text>
        <Text style={{ fontFamily: FONTS.display, fontSize: 30 * s, lineHeight: 36 * s, color: p.onBand, marginTop: 6 * s }}>{e.title.trim()}</Text>
      </View>
      <View style={{ padding: 20 * s, gap: 10 * s }}>
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 20 * s, color: p.ink }}>{whenText(e)}</Text>
        <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 16 * s, color: p.ink }}>{e.area.trim()}</Text>
        <Text style={{ fontFamily: FONTS.body, fontSize: 15 * s, color: p.sub }}>{e.cost.trim() || 'Free'}</Text>
        {e.ask.trim() ? <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 16 * s, color: p.accent }}>{e.ask.trim()}</Text> : null}
        {e.smallest.trim() ? <Text style={{ fontFamily: FONTS.body, fontSize: 15 * s, color: p.sub }}>Smallest way in: {e.smallest.trim()}</Text> : null}
        {e.details.trim() ? <Text style={{ fontFamily: FONTS.body, fontSize: 14 * s, lineHeight: 20 * s, color: p.sub }}>{e.details.trim()}</Text> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 * s, marginTop: 8 * s }}>
          {canQr ? (
            <View style={{ borderRadius: 6 * s, overflow: 'hidden' }}>
              <QrView text={link} size={110 * s} fg={p.qrFg} bg={p.qrBg} />
            </View>
          ) : null}
          <View style={{ flex: 1, gap: 4 * s }}>
            {canQr ? <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14 * s, color: p.ink }}>Scan for details</Text> : null}
            {link ? <Text style={{ fontFamily: FONTS.body, fontSize: 11 * s, color: p.sub }} numberOfLines={3}>{link}</Text> : null}
            <Text style={{ fontFamily: FONTS.body, fontSize: 12 * s, color: p.sub }}>Hosted by {e.host.trim()}</Text>
          </View>
        </View>
        {link && !canQr ? (
          <Text style={{ fontFamily: FONTS.body, fontSize: 11 * s, color: p.sub }}>(The link is too long for a code. Max {QR_MAX_BYTES} characters.)</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { borderWidth: 1, borderRadius: 4, overflow: 'hidden' },
  band: {},
});
