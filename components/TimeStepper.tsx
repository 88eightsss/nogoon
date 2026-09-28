// ─── TimeStepper ──────────────────────────────────────────────────────────────
//
// A compact hour/minute stepper for "HH:MM" time-of-day values. Shared by
// anything that needs a simple start/end time picker without pulling in a
// native date/time picker dependency — currently the Mode editor and the
// Digital Curfew control on the Me screen.

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { FONTS } from '@/constants/Colors';

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

export function TimeStepper({
  label, value, onChange, colors,
}: {
  label: string;
  value: string; // 'HH:MM'
  onChange: (val: string) => void;
  colors: any;
}) {
  const [h, m] = value.split(':').map(Number);

  const setHour = (delta: number) => {
    const next = (h + delta + 24) % 24;
    onChange(`${pad2(next)}:${pad2(m)}`);
  };
  const setMinute = (delta: number) => {
    const next = (m + delta + 60) % 60;
    onChange(`${pad2(h)}:${pad2(next)}`);
  };

  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <View style={styles.row}>
        <View style={styles.unit}>
          <Pressable hitSlop={8} onPress={() => setHour(-1)}>
            <Feather name="chevron-down" size={16} color={colors.textSecondary} />
          </Pressable>
          <Text style={[styles.value, { color: colors.text }]}>{pad2(h)}</Text>
          <Pressable hitSlop={8} onPress={() => setHour(1)}>
            <Feather name="chevron-up" size={16} color={colors.textSecondary} />
          </Pressable>
        </View>
        <Text style={[styles.colon, { color: colors.textMuted }]}>:</Text>
        <View style={styles.unit}>
          <Pressable hitSlop={8} onPress={() => setMinute(-15)}>
            <Feather name="chevron-down" size={16} color={colors.textSecondary} />
          </Pressable>
          <Text style={[styles.value, { color: colors.text }]}>{pad2(m)}</Text>
          <Pressable hitSlop={8} onPress={() => setMinute(15)}>
            <Feather name="chevron-up" size={16} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: FONTS.bodyMedium, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 },
  row:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  unit:  { alignItems: 'center', gap: 2 },
  value: { fontFamily: FONTS.bodyBold, fontSize: 18, width: 28, textAlign: 'center' },
  colon: { fontFamily: FONTS.bodyBold, fontSize: 18 },
});
