// ─── Dead Reckoning ───────────────────────────────────────────────────────────
//
// Named after the navigation technique: estimate where you are based on
// where you started and how far you've traveled. Applied to phone use:
// predict your usage, then compare it to reality.
//
// FLOW:
//   Morning (before noon):
//     → Prediction screen: "How many times will you check [app] today?"
//     → User sets a number with a slider
//     → Saved to AsyncStorage
//
//   Evening (after 5pm):
//     → Comparison screen: actual opens vs your morning prediction
//     → Visual diff with honest framing
//
// WHY IT WORKS:
//   People consistently underestimate how often they reach for their phone.
//   The act of predicting forces a conscious estimate — which itself reduces
//   usage. The evening reveal creates accountability without punishment.

import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUserStore } from '@/stores/useUserStore';
import { getLocalDateKey } from '@/utils/date';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

const PREDICTION_KEY = 'dead_reckoning_prediction';
const PREDICTION_DATE_KEY = 'dead_reckoning_date';

type Phase = 'predict' | 'reveal' | 'already_predicted';

export default function DeadReckoningScreen() {
  const { openCounts, openCountDate } = useUserStore();

  const [phase,      setPhase]      = useState<Phase>('predict');
  const [prediction, setPrediction] = useState(5);
  const [saved,      setSaved]      = useState(false);
  const [prevPred,   setPrevPred]   = useState<number | null>(null);

  // Count actual opens today
  const today = getLocalDateKey();
  const actualOpens = openCountDate === today
    ? Object.values(openCounts).reduce((sum, n) => sum + n, 0)
    : 0;

  // Re-derive phase each time the screen gains focus (handles crossing 5pm mid-session)
  const loadPhase = useCallback(async () => {
    const hour      = new Date().getHours();
    const isEvening = hour >= 17;
    try {
      const date = await AsyncStorage.getItem(PREDICTION_DATE_KEY);
      const pred = await AsyncStorage.getItem(PREDICTION_KEY);
      if (date === today && pred !== null) {
        setPrevPred(parseInt(pred, 10));
        setPhase(isEvening ? 'reveal' : 'already_predicted');
      } else if (isEvening) {
        setPhase('reveal');
      } else {
        setPhase('predict');
      }
    } catch { /* ignore */ }
  }, [today]);

  useFocusEffect(useCallback(() => { loadPhase(); }, [loadPhase]));

  const savePrediction = async () => {
    try {
      await AsyncStorage.setItem(PREDICTION_KEY, String(prediction));
      await AsyncStorage.setItem(PREDICTION_DATE_KEY, today);
      setPrevPred(prediction);
      setSaved(true);
      setTimeout(() => router.back(), 1200);
    } catch { /* ignore */ }
  };

  // Diff framing
  const diff = prevPred !== null ? actualOpens - prevPred : 0;
  const diffLabel =
    diff === 0 ? 'Exactly on target.' :
    diff > 0   ? `${diff} more than you predicted.` :
                 `${Math.abs(diff)} fewer than you predicted.`;

  const diffColor =
    diff > 5  ? '#ef4444' :
    diff > 0  ? '#f59e0b' :
    diff < 0  ? COLORS.green :
                COLORS.textSecondary;

  // ── Prediction Phase ──────────────────────────────────────────────────────

  if (phase === 'predict') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable style={styles.backBtn} onPress={() => router.back()}>
              <Feather name="x" size={20} color={COLORS.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.main}>
            <Text style={styles.eyebrow}>DEAD RECKONING</Text>
            <Text style={styles.title}>How many times will you try to open a blocked app today?</Text>
            <Text style={styles.subtitle}>Be honest. Your morning self is a better judge than your evening self.</Text>

            {/* Number picker */}
            <View style={styles.pickerRow}>
              <Pressable
                style={styles.pickerBtn}
                onPress={() => setPrediction(Math.max(0, prediction - 1))}
              >
                <Feather name="minus" size={22} color={COLORS.textPrimary} />
              </Pressable>
              <Text style={styles.pickerNum}>{prediction}</Text>
              <Pressable
                style={styles.pickerBtn}
                onPress={() => setPrediction(Math.min(50, prediction + 1))}
              >
                <Feather name="plus" size={22} color={COLORS.textPrimary} />
              </Pressable>
            </View>

            {/* Calibration hint */}
            <Text style={styles.hint}>
              {prediction === 0 ? "Bold. Adjust tonight if reality disagrees." :
               prediction < 3  ? "Optimistic — but that's fine." :
               prediction < 8  ? "Realistic." :
               prediction < 15 ? "That's a lot. What's driving it?" :
               "That many? Worth investigating."}
            </Text>
          </View>

          <Pressable
            style={[styles.actionBtn, saved && { opacity: 0.5 }]}
            onPress={savePrediction}
            disabled={saved}
          >
            <Text style={styles.actionBtnText}>
              {saved ? 'Locked in ✓' : 'Lock in my prediction'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Already predicted, come back tonight ────────────────────────────────

  if (phase === 'already_predicted') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable style={styles.backBtn} onPress={() => router.back()}>
              <Feather name="x" size={20} color={COLORS.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.main}>
            <Text style={styles.eyebrow}>PREDICTION LOCKED</Text>
            <Text style={styles.title}>Your prediction: {prevPred}</Text>
            <Text style={styles.subtitle}>
              Come back tonight to see how close you were.{'\n'}
              Current count: {actualOpens}
            </Text>
          </View>
          <Pressable style={styles.actionBtn} onPress={() => router.back()}>
            <Text style={styles.actionBtnText}>Got it</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Reveal Phase (evening) ────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="x" size={20} color={COLORS.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.main}>
          <Text style={styles.eyebrow}>DEAD RECKONING</Text>
          <Text style={styles.title}>Today's results</Text>

          {/* The comparison */}
          <View style={styles.compareCard}>
            <View style={styles.compareRow}>
              <View style={styles.compareCol}>
                <Text style={styles.compareNum}>{prevPred ?? '—'}</Text>
                <Text style={styles.compareLabel}>You predicted</Text>
              </View>
              <Feather name="arrow-right" size={20} color={COLORS.textMuted} style={{ marginTop: 8 }} />
              <View style={styles.compareCol}>
                <Text style={[styles.compareNum, { color: diffColor }]}>{actualOpens}</Text>
                <Text style={styles.compareLabel}>Actual opens</Text>
              </View>
            </View>

            <View style={styles.compareDivider} />

            <Text style={[styles.diffLabel, { color: diffColor }]}>{diffLabel}</Text>
            {prevPred !== null && (
              <Text style={styles.reflectionText}>
                {diff > 10 ? "Your evening self is a different person. This is why you have NoGoon." :
                 diff > 3  ? "Closer than most days. Pattern awareness builds over time." :
                 diff >= 0 ? "You called it. That's genuine self-knowledge." :
                             "You over-predicted. That means something good is working."}
              </Text>
            )}
          </View>

          {prevPred === null && (
            <Text style={styles.subtitle}>No prediction was made this morning.</Text>
          )}
        </View>

        <Pressable style={styles.actionBtn} onPress={() => router.back()}>
          <Text style={styles.actionBtnText}>Close</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    padding: SPACING.lg,
  },
  header: {
    alignItems: 'flex-end',
    marginBottom: SPACING.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  main: {
    flex: 1,
    justifyContent: 'center',
  },
  eyebrow: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 2,
    marginBottom: SPACING.sm,
  },
  title: {
    fontFamily: FONTS.display || FONTS.bodyBold,
    fontSize: 28,
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
    lineHeight: 34,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },

  // ── Number picker ──
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xl,
    marginVertical: SPACING.xl,
  },
  pickerBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerNum: {
    fontFamily: FONTS.monoBold || FONTS.bodyBold,
    fontSize: 64,
    color: COLORS.textPrimary,
    letterSpacing: -3,
    width: 120,
    textAlign: 'center',
  },
  hint: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // ── Compare card ──
  compareCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginTop: SPACING.lg,
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    marginBottom: SPACING.md,
  },
  compareCol: {
    alignItems: 'center',
  },
  compareNum: {
    fontFamily: FONTS.monoBold || FONTS.bodyBold,
    fontSize: 52,
    color: COLORS.textPrimary,
    letterSpacing: -2,
  },
  compareLabel: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  compareDivider: {
    height: 1,
    backgroundColor: COLORS.cardBorder,
    marginBottom: SPACING.md,
  },
  diffLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  reflectionText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── Action button ──
  actionBtn: {
    backgroundColor: COLORS.green,
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  actionBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: COLORS.background,
  },
});
