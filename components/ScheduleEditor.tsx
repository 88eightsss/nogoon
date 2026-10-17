// ─── ScheduleEditor ───────────────────────────────────────────────────────────
// Days + start/end for one mode's schedule, laid out like an alarm: quick presets, round day
// chips, then two big tappable times that open the clock wheels. Used by the Modes list (inline)
// and the mode editor, so both behave the same.

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { FONTS } from '@/constants/Colors';
import type { ModeSchedule } from '@/stores/useModesStore';
import { DAY_SHORT, DAY_FULL, daysLabel } from '@/utils/schedule';
import { TimeField } from './TimeField';

const PRESETS: { label: string; days: number[] }[] = [
  { label: 'Every day', days: [] },
  { label: 'Weekdays',  days: [1, 2, 3, 4, 5] },
  { label: 'Weekends',  days: [0, 6] },
];

export function ScheduleEditor({ schedule, onChange, colors }: {
  schedule: ModeSchedule; onChange: (s: ModeSchedule) => void; colors: any;
}) {
  const everyDay = schedule.days.length === 0 || schedule.days.length === 7;
  const same = (a: number[], b: number[]) => a.length === b.length && a.every((d) => b.includes(d));

  const toggleDay = (d: number) => {
    // Starting from "every day", tapping a day narrows to just that day.
    const base = everyDay ? [] : schedule.days;
    const next = base.includes(d) ? base.filter((x) => x !== d) : [...base, d].sort();
    onChange({ ...schedule, days: next.length === 7 ? [] : next });
  };

  const [sh, sm] = schedule.start.split(':').map(Number);
  const [eh, em] = schedule.end.split(':').map(Number);
  const overnight = eh * 60 + em <= sh * 60 + sm;

  return (
    <View style={{ gap: 14 }}>
      <View style={styles.row}>
        {PRESETS.map((p) => {
          const on = p.days.length === 0 ? everyDay : same(schedule.days, p.days);
          return (
            <Pressable
              key={p.label}
              onPress={() => onChange({ ...schedule, days: p.days })}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.preset, { borderColor: on ? colors.accent : colors.cardBorder, backgroundColor: on ? colors.accentDim : colors.surfaceHigh }]}
            >
              <Text style={[styles.presetText, { color: on ? colors.accent : colors.textSecondary }]}>{p.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        {DAY_SHORT.map((label, i) => {
          const on = everyDay || schedule.days.includes(i);
          return (
            <Pressable
              key={i}
              onPress={() => toggleDay(i)}
              accessibilityRole="button"
              accessibilityLabel={DAY_FULL[i]}
              accessibilityState={{ selected: on }}
              style={[styles.day, { backgroundColor: on ? colors.accent : colors.surfaceHigh, borderColor: on ? colors.accent : colors.cardBorder }]}
            >
              <Text style={[styles.dayText, { color: on ? '#fff' : colors.textMuted }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.times}>
        <TimeField label="Starts" big value={schedule.start} onChange={(v) => onChange({ ...schedule, start: v })} colors={colors} />
        <Text style={[styles.dash, { color: colors.textMuted }]}>to</Text>
        <TimeField label="Ends" big value={schedule.end} onChange={(v) => onChange({ ...schedule, end: v })} colors={colors} />
      </View>

      <Text style={[styles.hint, { color: colors.textMuted }]}>
        {daysLabel(schedule.days)}{overnight ? ' · ends the next morning' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1 },
  presetText: { fontFamily: FONTS.bodyMedium, fontSize: 13 },
  day: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontFamily: FONTS.bodyBold, fontSize: 13 },
  times: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' },
  dash: { fontFamily: FONTS.body, fontSize: 14, paddingBottom: 14 },
  hint: { fontFamily: FONTS.body, fontSize: 12 },
});
