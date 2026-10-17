// ─── ClockTimePicker ──────────────────────────────────────────────────────────
// Three snapping wheels (hour, minute, AM/PM) like the Clock app's alarm picker.
// Value is 'HH:MM' in 24-hour form; the wheels show 12-hour time.

import { useEffect, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { FONTS } from '@/constants/Colors';

const ITEM_H = 46;
const ROWS = 5;

function Wheel({ items, index, onIndex, width, colors, label }: {
  items: string[]; index: number; onIndex: (i: number) => void; width: number; colors: any; label: string;
}) {
  const ref = useRef<FlatList<string>>(null);
  const settled = useRef(index);

  useEffect(() => {
    const t = setTimeout(() => ref.current?.scrollToOffset({ offset: index * ITEM_H, animated: false }), 0);
    return () => clearTimeout(t);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.max(0, Math.min(items.length - 1, Math.round(e.nativeEvent.contentOffset.y / ITEM_H)));
    if (i !== settled.current) { settled.current = i; onIndex(i); }
  };

  return (
    <View
      style={{ width, height: ITEM_H * ROWS }}
      accessible
      accessibilityLabel={label}
      accessibilityRole="adjustable"
      accessibilityValue={{ text: items[index] }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const next = e.nativeEvent.actionName === 'increment' ? index + 1 : index - 1;
        const i = Math.max(0, Math.min(items.length - 1, next));
        settled.current = i; onIndex(i);
        ref.current?.scrollToOffset({ offset: i * ITEM_H, animated: true });
      }}
    >
      <FlatList
        ref={ref}
        data={items}
        keyExtractor={(x) => x}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        nestedScrollEnabled
        ListHeaderComponent={<View style={{ height: ITEM_H * 2 }} />}
        ListFooterComponent={<View style={{ height: ITEM_H * 2 }} />}
        getItemLayout={(_, i) => ({ length: ITEM_H, offset: ITEM_H * 2 + ITEM_H * i, index: i })}
        onMomentumScrollEnd={settle}
        onScrollEndDrag={settle}
        renderItem={({ item }) => (
          <View style={{ height: ITEM_H, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: FONTS.display, fontSize: 28, color: colors.text }}>{item}</Text>
          </View>
        )}
      />
      {/* fade the rows above and below the selected one */}
      <View pointerEvents="none" style={[styles.fade, { top: 0, height: ITEM_H * 2, backgroundColor: colors.surface + 'B8' }]} />
      <View pointerEvents="none" style={[styles.fade, { bottom: 0, height: ITEM_H * 2, backgroundColor: colors.surface + 'B8' }]} />
    </View>
  );
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const MERIDIEM = ['AM', 'PM'];

export function ClockTimePicker({ value, onChange, colors }: { value: string; onChange: (v: string) => void; colors: any }) {
  const [h24, m] = value.split(':').map(Number);
  const hr12 = h24 % 12 || 12;
  const pm = h24 >= 12;

  const emit = (nextHr12: number, nextMin: number, nextPm: boolean) => {
    const h = (nextHr12 % 12) + (nextPm ? 12 : 0);
    onChange(`${String(h).padStart(2, '0')}:${String(nextMin).padStart(2, '0')}`);
  };

  return (
    <View style={styles.wrap}>
      <View pointerEvents="none" style={[styles.band, { borderColor: colors.accent, backgroundColor: colors.accentDim }]} />
      <Wheel items={HOURS} index={hr12 - 1} width={74} colors={colors} label="Hour" onIndex={(i) => emit(i + 1, m, pm)} />
      <Text style={[styles.colon, { color: colors.text }]}>:</Text>
      <Wheel items={MINUTES} index={m} width={74} colors={colors} label="Minute" onIndex={(i) => emit(hr12, i, pm)} />
      <Wheel items={MERIDIEM} index={pm ? 1 : 0} width={74} colors={colors} label="AM or PM" onIndex={(i) => emit(hr12, m, i === 1)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  band: { position: 'absolute', left: 10, right: 10, top: ITEM_H * 2, height: ITEM_H, borderRadius: 14, borderWidth: 1.5 },
  colon: { fontFamily: FONTS.display, fontSize: 28, marginTop: -2 },
  fade: { position: 'absolute', left: 0, right: 0 },
});
