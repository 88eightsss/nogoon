// Webcore window chrome, modernised: rounded glass-gloss windows with a soft shadow,
// still recognisably an early-2000s desktop window (title bar, _ □ × buttons, status bar).
// Used by the Webcore habitat and the Webcore gate dialog.

import type { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FONTS } from '@/constants/Colors';
import type { PackLook } from '@/constants/packs';

export function WinFrame({ look, title, buttons = 'all', children }: {
  look: PackLook;
  title: string;
  buttons?: 'all' | 'close';
  children: ReactNode;
}) {
  const bar = look.winTitle ?? '#1B3FA0';
  return (
    <View style={[styles.frame, { backgroundColor: look.winBg ?? '#C9DCF6' }]}>
      <View style={[styles.bar, { backgroundColor: bar }]}>
        <View style={styles.gloss} pointerEvents="none" />
        <View style={styles.shade} pointerEvents="none" />
        <Text style={[styles.title, { color: look.winTitleText ?? '#ffffff' }]} numberOfLines={1}>{title}</Text>
        <View style={styles.btns}>
          {(buttons === 'all' ? ['_', '□', '×'] : ['×']).map((g) => (
            <View key={g} style={[styles.btn, g === '×' && { backgroundColor: '#E8503A', borderColor: 'rgba(255,255,255,0.7)' }]}>
              <Text style={styles.btnText}>{g}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

// Content pane with a soft top light, like glass.
export function WinPane({ color, children, style }: { color: string; children: ReactNode; style?: object }) {
  return (
    <View style={[styles.pane, { backgroundColor: color }, style]}>
      <View style={styles.paneLight} pointerEvents="none" />
      {children}
    </View>
  );
}

// Inset status strip.
export function WinStatus({ text }: { text: string }) {
  return (
    <View style={styles.status}>
      <Text style={styles.statusText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignSelf: 'stretch', borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.8)',
    overflow: 'hidden', shadowColor: '#0B1B4A', shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 5,
  },
  bar:   { height: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 10, paddingRight: 5, overflow: 'hidden' },
  gloss: { position: 'absolute', left: 0, right: 0, top: 0, height: '50%', backgroundColor: 'rgba(255,255,255,0.22)' },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '35%', backgroundColor: 'rgba(0,0,30,0.12)' },
  title: { flex: 1, fontFamily: FONTS.monoBold, fontSize: 12.5, letterSpacing: 0.3 },
  btns:  { flexDirection: 'row', gap: 4 },
  btn:   { width: 24, height: 20, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)', backgroundColor: 'rgba(255,255,255,0.28)', alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: FONTS.monoBold, fontSize: 11, color: '#ffffff', lineHeight: 13 },
  body:  { padding: 6, gap: 6 },
  pane:  { borderRadius: 10, overflow: 'hidden', alignItems: 'center', paddingVertical: 16, gap: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.14)' },
  paneLight: { position: 'absolute', left: 0, right: 0, top: 0, height: '45%', backgroundColor: 'rgba(255,255,255,0.16)' },
  status: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  statusText: { fontFamily: FONTS.mono, fontSize: 11, color: '#0F1730' },
});
