// ─── TimeField ────────────────────────────────────────────────────────────────
// A tappable time ("9:00 AM") that opens the clock wheels in a sheet.

import { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { FONTS } from '@/constants/Colors';
import { format12 } from '@/utils/schedule';
import { ClockTimePicker } from './ClockTimePicker';

export function TimeField({ label, value, onChange, colors, big = false }: {
  label: string; value: string; onChange: (v: string) => void; colors: any; big?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  return (
    <View style={{ gap: 4 }}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <Pressable
        onPress={() => { setDraft(value); setOpen(true); }}
        accessibilityRole="button"
        accessibilityLabel={`${label} time, ${format12(value)}. Tap to change.`}
        style={[styles.pill, { backgroundColor: colors.surfaceHigh, borderColor: colors.cardBorder }]}
      >
        <Text style={[big ? styles.big : styles.time, { color: colors.text }]}>{format12(value)}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sheetTitle, { color: colors.textSecondary }]}>{label}</Text>
            <ClockTimePicker value={draft} onChange={setDraft} colors={colors} />
            <View style={styles.actions}>
              <Pressable onPress={() => setOpen(false)} style={styles.btn} accessibilityRole="button">
                <Text style={[styles.btnText, { color: colors.textMuted }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => { onChange(draft); setOpen(false); }}
                style={[styles.btn, { backgroundColor: colors.accent }]}
                accessibilityRole="button"
              >
                <Text style={[styles.btnText, { color: '#fff' }]}>Set time</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: FONTS.bodyMedium, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 },
  pill: { borderRadius: 12, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 14, alignSelf: 'flex-start' },
  time: { fontFamily: FONTS.bodyBold, fontSize: 18 },
  big: { fontFamily: FONTS.display, fontSize: 30 },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, gap: 16, paddingBottom: 28 },
  sheetTitle: { fontFamily: FONTS.bodyMedium, fontSize: 13, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.6 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  btn: { paddingVertical: 11, paddingHorizontal: 22, borderRadius: 999 },
  btnText: { fontFamily: FONTS.bodyBold, fontSize: 14 },
});
