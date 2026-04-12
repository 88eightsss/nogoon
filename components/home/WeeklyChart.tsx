// WeeklyChart — a bar chart showing how many games the user played each day
// over the last 7 days. Bars animate upward when the screen loads.
//
// Built with plain React Native Views + the built-in Animated API.
// No chart library needed — keeping dependencies lean.

import { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Card } from '@/components/ui/Card';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';
import { TYPE } from '@/constants/Typography';

// The day labels shown under each bar
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// The tallest a bar can be in pixels — other bars scale relative to this
const MAX_BAR_HEIGHT = 60;

interface WeeklyChartProps {
  // 7 numbers — one per day, Mon through Sun. Today is the last element (index 6).
  data: [number, number, number, number, number, number, number];
}

function Bar({
  value,
  maxValue,
  isToday,
  label,
}: {
  value: number;
  maxValue: number;
  isToday: boolean;
  label: string;
}) {
  // animHeight starts at 0 and animates up to the target height
  const animHeight = useRef(new Animated.Value(0)).current;

  // The actual pixel height for this bar (proportional to the tallest day)
  const targetHeight = maxValue === 0 ? 0 : (value / maxValue) * MAX_BAR_HEIGHT;

  useEffect(() => {
    // Animate from 0 to the target height when the component mounts
    Animated.timing(animHeight, {
      toValue: targetHeight,
      duration: 600,
      useNativeDriver: false, // Height changes can't use native driver
    }).start();
  }, [targetHeight, animHeight]);

  return (
    <View style={styles.barWrapper}>
      {/* Show the count above the bar (but only if > 0) */}
      {value > 0 && (
        <Text style={styles.barValue}>{value}</Text>
      )}

      {/* The bar itself — animates from 0 height to target */}
      <View style={styles.barTrack}>
        <Animated.View
          style={[
            styles.barFill,
            {
              height: animHeight,
              // Today's bar is green; other days use a dimmer purple
              backgroundColor: isToday ? COLORS.green : COLORS.purple + '88',
            },
          ]}
        />
      </View>

      {/* Day label underneath */}
      <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
        {label}
      </Text>
    </View>
  );
}

export function WeeklyChart({ data }: WeeklyChartProps) {
  // Find the highest value so all bars scale relative to it
  const maxValue = Math.max(...data, 1); // Min 1 to avoid division by zero

  return (
    <Card>
      {/* Section header */}
      <View style={styles.header}>
        <Text style={TYPE.label}>This Week</Text>
        <Text style={styles.totalLabel}>
          {data.reduce((a, b) => a + b, 0)} games played
        </Text>
      </View>

      {/* Bar chart row */}
      <View style={styles.chartRow}>
        {data.map((value, index) => (
          <Bar
            key={index}
            value={value}
            maxValue={maxValue}
            isToday={index === 6} // Last element is today
            label={DAY_LABELS[index]}
          />
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  totalLabel: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',     // Bars grow upward from the baseline
    justifyContent: 'space-between',
    height: MAX_BAR_HEIGHT + 32, // Extra space for value labels and day labels
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barValue: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.textSecondary,
    marginBottom: 3,
  },
  barTrack: {
    width: 20,
    height: MAX_BAR_HEIGHT,
    justifyContent: 'flex-end', // Bar grows up from the bottom
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: COLORS.border,
  },
  barFill: {
    width: '100%',
    borderRadius: 4,
  },
  dayLabel: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  dayLabelToday: {
    color: COLORS.indigoBright, // Today's label is green to match the bar
  },
});
