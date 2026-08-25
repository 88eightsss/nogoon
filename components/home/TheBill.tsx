// ─── The Bill ────────────────────────────────────────────────────────────────
//
// Shows the economic cost of time spent on blocked apps.
//
// Math:
//   hourlyRate (user-set, defaults to US median $22/hr)
//   × minutesBlockedToday (tracked via daily open count × average session)
//   = money wasted today
//
// Why this frame works:
//   Framing lost time as lost money is more visceral than minutes.
//   "You wasted 47 minutes" is abstract. "$17.27" is specific and stings.
//   Research shows monetary framing significantly increases behavior change
//   compared to time-based framing alone.
//
// The estimate uses open counts as a proxy since we don't have exact
// session durations. Average social media session ≈ 11 minutes.

import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RATE_KEY = 'the_bill_hourly_rate';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useUserStore } from '@/stores/useUserStore';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

const AVG_SESSION_MINUTES = 11; // average social media session length (Statista)
const DEFAULT_HOURLY_RATE = 22; // US median hourly wage 2024

function formatMoney(dollars: number) {
  if (dollars < 0.01) return '$0.00';
  if (dollars < 10) return `$${dollars.toFixed(2)}`;
  return `$${Math.floor(dollars).toLocaleString()}`;
}

export function TheBill() {
  const { openCounts, openCountDate, dailyWalkAways, dailyWalkAwayGoal, setDailyWalkAwayGoal } = useUserStore();
  const [hourlyRate, setHourlyRate] = useState(DEFAULT_HOURLY_RATE);
  const [editing, setEditing]       = useState(false);
  const [inputVal, setInputVal]     = useState(String(DEFAULT_HOURLY_RATE));
  const [editingGoal, setEditingGoal] = useState(false);

  // Load persisted rate on mount
  useEffect(() => {
    AsyncStorage.getItem(RATE_KEY).then((val) => {
      if (val) {
        const parsed = parseFloat(val);
        if (!isNaN(parsed) && parsed > 0) {
          setHourlyRate(parsed);
          setInputVal(String(parsed));
        }
      }
    }).catch(() => {});
  }, []);

  // Count today's totals
  const today = new Date().toISOString().split('T')[0];
  const todayWalkAways = dailyWalkAways[today] ?? 0;
  const goalMet = todayWalkAways >= dailyWalkAwayGoal;

  const todayOpens = openCountDate === today
    ? Object.values(openCounts).reduce((sum, n) => sum + n, 0)
    : 0;

  // Estimate: each open = one attempted session = avg session minutes
  const estimatedMinutes = todayOpens * AVG_SESSION_MINUTES;
  const estimatedHours   = estimatedMinutes / 60;
  const dollarCost       = estimatedHours * hourlyRate;

  const handleSaveRate = useCallback(() => {
    const parsed = parseFloat(inputVal);
    if (!isNaN(parsed) && parsed > 0) {
      setHourlyRate(parsed);
      AsyncStorage.setItem(RATE_KEY, String(parsed)).catch(() => {});
    }
    setEditing(false);
  }, [inputVal]);

  // Zero-state: no intercepts yet today
  if (todayOpens === 0) {
    return (
      <View style={styles.zeroCard}>
        <Text style={styles.zeroEmoji}>✓</Text>
        <View style={styles.zeroText}>
          <Text style={styles.zeroTitle}>No attempts yet today</Text>
          <Text style={styles.zeroSub}>That's the goal. Keep it that way.</Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <View style={styles.card}>
        {/* Header — tap to edit hourly rate */}
        <Pressable style={styles.header} onPress={() => setEditing(true)}>
          <Text style={styles.emoji}>💸</Text>
          <View style={styles.headerText}>
            <Text style={styles.title}>The Bill</Text>
            <Text style={styles.subtitle}>
              {todayOpens} attempt{todayOpens === 1 ? '' : 's'} today
            </Text>
          </View>
          <Feather name="edit-2" size={14} color={COLORS.textMuted} />
        </Pressable>

        {/* Main number */}
        <View style={styles.main}>
          <Text style={styles.amount}>{formatMoney(dollarCost)}</Text>
          <Text style={styles.amountLabel}>
            ≈ {estimatedMinutes} min @ ${hourlyRate}/hr
          </Text>
        </View>

        {/* Walk-away goal progress */}
        <View style={styles.goalSection}>
          <View style={styles.goalRow}>
            <Feather name="shield" size={12} color={goalMet ? COLORS.green : COLORS.textMuted} />
            <Text style={[styles.goalLabel, { color: goalMet ? COLORS.green : COLORS.textSecondary }]}>
              Walk-aways today:{' '}
              <Text style={{ fontFamily: FONTS.bodyBold }}>{todayWalkAways}</Text>
              {' / '}
              {editingGoal ? (
                <Text style={{ color: COLORS.textMuted }}>{dailyWalkAwayGoal}</Text>
              ) : (
                <Text
                  style={{ color: COLORS.textMuted }}
                  onPress={() => setEditingGoal(true)}
                >
                  {dailyWalkAwayGoal} goal ✎
                </Text>
              )}
            </Text>
          </View>
          <View style={[styles.goalTrack, { backgroundColor: COLORS.border }]}>
            <View
              style={[
                styles.goalFill,
                {
                  width: `${Math.min(1, todayWalkAways / dailyWalkAwayGoal) * 100}%`,
                  backgroundColor: goalMet ? COLORS.green : COLORS.indigoBright,
                },
              ]}
            />
          </View>
          {editingGoal && (
            <View style={styles.goalEditRow}>
              <Pressable
                style={styles.goalAdjBtn}
                onPress={() => setDailyWalkAwayGoal(dailyWalkAwayGoal - 1)}
              >
                <Feather name="minus" size={14} color={COLORS.textSecondary} />
              </Pressable>
              <Text style={styles.goalEditNum}>{dailyWalkAwayGoal}</Text>
              <Pressable
                style={styles.goalAdjBtn}
                onPress={() => setDailyWalkAwayGoal(dailyWalkAwayGoal + 1)}
              >
                <Feather name="plus" size={14} color={COLORS.textSecondary} />
              </Pressable>
              <View style={{ flex: 1 }} />
              <Pressable style={styles.goalDoneBtn} onPress={() => setEditingGoal(false)}>
                <Text style={styles.goalDoneText}>Done</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Context */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {dollarCost < 5
              ? "Not bad. Keep walking away."
              : dollarCost < 20
              ? "That's lunch money. Walk away more."
              : dollarCost < 50
              ? "That's real money. Your time has value."
              : "Your attention is being bought cheap."}
          </Text>
        </View>
      </View>

      {/* Hourly rate editor modal */}
      <Modal
        visible={editing}
        transparent
        animationType="fade"
        onRequestClose={() => setEditing(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Your hourly rate</Text>
            <Text style={styles.modalSubtitle}>
              Used to calculate the economic cost of your time.
            </Text>
            <View style={styles.inputRow}>
              <Text style={styles.dollarSign}>$</Text>
              <TextInput
                style={styles.input}
                value={inputVal}
                onChangeText={setInputVal}
                keyboardType="decimal-pad"
                autoFocus
                selectTextOnFocus
                placeholderTextColor={COLORS.textMuted}
              />
              <Text style={styles.perHour}>/hr</Text>
            </View>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setEditing(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleSaveRate}>
                <Text style={styles.saveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  emoji: { fontSize: 20 },
  headerText: { flex: 1 },
  title: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
  },

  main: {
    marginBottom: SPACING.sm,
  },
  amount: {
    fontFamily: FONTS.monoBold,
    fontSize: 42,
    color: COLORS.textPrimary,
    letterSpacing: -2,
  },
  amountLabel: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  footer: {
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
    marginTop: SPACING.sm,
  },
  footerText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
  },

  // ── Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  modalTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 18,
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  modalSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
    lineHeight: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
  },
  dollarSign: {
    fontFamily: FONTS.bodyBold,
    fontSize: 20,
    color: COLORS.textPrimary,
    marginRight: 4,
  },
  input: {
    flex: 1,
    fontFamily: FONTS.monoBold,
    fontSize: 28,
    color: COLORS.textPrimary,
    paddingVertical: SPACING.md,
  },
  perHour: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  cancelText: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.green,
  },
  saveText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    color: COLORS.background,
  },

  // ── Walk-away goal ──
  goalSection: {
    paddingTop: SPACING.sm,
    gap: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
    marginTop: SPACING.sm,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  goalLabel: {
    fontFamily: FONTS.body,
    fontSize: 12,
    flex: 1,
  },
  goalTrack: {
    height: 4,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
    marginTop: 2,
  },
  goalFill: {
    height: '100%',
    borderRadius: RADIUS.full,
  },
  goalEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  goalAdjBtn: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalEditNum: {
    fontFamily: FONTS.monoBold,
    fontSize: 20,
    color: COLORS.textPrimary,
    minWidth: 30,
    textAlign: 'center',
  },
  goalDoneBtn: {
    backgroundColor: COLORS.green,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
  },
  goalDoneText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: COLORS.background,
  },

  // ── Zero state ──
  zeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  zeroEmoji: {
    fontSize: 28,
    color: COLORS.green,
  },
  zeroText: { flex: 1 },
  zeroTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  zeroSub: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
  },
});
