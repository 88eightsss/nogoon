// ─── Ride it out: a watched urge, not a wait ──────────────────────────────────
//
// The gate's "Ride it out" screen (spec: claude/nogoon-urge-timer-spec). A slow ring and a quiet clock that
// counts UP. It never unlocks anything, so it is offered in every mode, including Hard Mode and Cold Turkey.
//
//   It passed     -> if at least URGE_MIN_SECONDS went by: counts as a walk-away (the parent's onCredit),
//                    stores the duration, says how long it took. Under that: kind line, nothing recorded.
//   Still strong  -> keeps going; after 15 minutes offers something else.
//   I'm going in  -> hands back to the normal unlock flow (parent's onGoIn). No shame screen.
//
// Stores counts and durations only (useRecoveryStore). Never which app or site.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing, AccessibilityInfo, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { useRecoveryStore, URGE_MIN_SECONDS } from '@/stores/useRecoveryStore';

export type RideColors = {
  background: string; surface: string; surfaceHigh: string; border: string; cardBorder: string;
  textPrimary: string; textSecondary: string; textMuted: string; green: string; indigoBright: string;
};

interface Props {
  C: RideColors;
  onGreen: string;
  /** Called once when a ridden-out urge earns its walk-away credit. */
  onCredit: () => void;
  /** Leave the gate (the blocked app stays closed). */
  onDone: () => void;
  /** Continue into the normal unlock flow. */
  onGoIn: () => void;
  /** False in Hard Mode, Cold Turkey and walk gates, where there is no way in from here. */
  canGoIn?: boolean;
  /** Back to the instead-list. */
  onOther: () => void;
}

const PROMPT_AT = [180, 360, 600];   // seconds: "How is it now?" at 3, 6 and 10 minutes
const OFFER_OTHER_AT = 900;          // 15 minutes

export function formatClock(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function RideItOut({ C, onGreen, onCredit, onDone, onGoIn, onOther, canGoIn = true }: Props) {
  const startedAt = useRef(Date.now());
  const startedCounted = useRef(false);
  const credited = useRef(false);   // a fast double tap on "It passed" must count once

  const [secs, setSecs] = useState(0);
  const [stillStrong, setStillStrong] = useState(false);
  const [promptIdx, setPromptIdx] = useState(-1);          // index into PROMPT_AT currently asked, -1 none
  const [answeredIdx, setAnsweredIdx] = useState(-1);      // last prompt answered or dismissed
  const [result, setResult] = useState<null | { credited: boolean; seconds: number }>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  // Count this urge once.
  useEffect(() => {
    if (startedCounted.current) return;
    startedCounted.current = true;
    useRecoveryStore.getState().recordUrgeStart();
  }, []);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  // Clock: derived from the start time, so it stays right if the screen sleeps for a moment.
  useEffect(() => {
    if (result) return;
    const id = setInterval(() => setSecs(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [result]);

  // Ask "How is it now?" at 3, 6 and 10 minutes.
  useEffect(() => {
    if (result) return;
    for (let i = PROMPT_AT.length - 1; i >= 0; i--) {
      if (secs >= PROMPT_AT[i] && i > answeredIdx && i > promptIdx) { setPromptIdx(i); break; }
    }
  }, [secs, result, answeredIdx, promptIdx]);

  // Slow ring. Static when reduced motion is on.
  useEffect(() => {
    if (reduceMotion || result) { scale.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.14, duration: 4500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 4500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, result, scale]);

  const passed = useCallback(() => {
    const seconds = Math.floor((Date.now() - startedAt.current) / 1000);
    if (seconds >= URGE_MIN_SECONDS) {
      if (credited.current) return;
      credited.current = true;
      useRecoveryStore.getState().recordUrgePassed(seconds);
      onCredit();
      setResult({ credited: true, seconds });
    } else {
      setResult({ credited: false, seconds });
    }
  }, [onCredit]);

  const keepWatching = () => {
    // Resume: the clock keeps counting from the original start.
    setResult(null);
  };

  const askingPrompt = promptIdx >= 0 && promptIdx > answeredIdx;
  const minutesWord = (s: number) => {
    const m = Math.max(1, Math.round(s / 60));
    return `${m} minute${m === 1 ? '' : 's'}`;
  };

  // ── Result ────────────────────────────────────────────────────────────────
  if (result) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
        <ScrollView contentContainerStyle={styles.center}>
          <View style={[styles.ring, { borderColor: C.green }]}>
            <Feather name="check" size={44} color={C.green} />
          </View>
          {result.credited ? (
            <>
              <Text style={[styles.title, { color: C.textPrimary }]}>
                That one passed in {minutesWord(result.seconds)}.
              </Text>
              <Text style={[styles.line, { color: C.textSecondary }]}>
                You watched it instead of following it. That counts as a walk-away.
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.title, { color: C.textPrimary }]}>Nice.</Text>
              <Text style={[styles.line, { color: C.textSecondary }]}>
                Give it a little longer next time. Urges usually ease with a minute or two.
              </Text>
            </>
          )}
          <Pressable
            style={[styles.primary, { backgroundColor: C.green }]}
            onPress={onDone}
            accessibilityRole="button"
          >
            <Text style={[styles.primaryText, { color: onGreen }]}>Done</Text>
          </Pressable>
          {!result.credited && (
            <Pressable onPress={keepWatching} style={styles.textRow} accessibilityRole="button">
              <Text style={[styles.textBtn, { color: C.textSecondary }]}>Keep watching</Text>
            </Pressable>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Watching ──────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
      <ScrollView contentContainerStyle={styles.center} showsVerticalScrollIndicator={false}>
        <Animated.View
          style={[styles.ring, { borderColor: C.indigoBright, transform: [{ scale }] }]}
          accessible
          accessibilityLabel={`Watching this urge. ${formatClock(secs)} so far.`}
        >
          <Text style={[styles.clock, { color: C.textPrimary }]}>{formatClock(secs)}</Text>
        </Animated.View>

        <Text style={[styles.title, { color: C.textPrimary }]}>
          Urges rise, peak and fade.
        </Text>
        <Text style={[styles.line, { color: C.textSecondary }]}>
          Let's watch this one.
        </Text>

        {askingPrompt && (
          <View style={[styles.promptCard, { backgroundColor: C.surface, borderColor: C.cardBorder }]}>
            <Text style={[styles.promptTitle, { color: C.textPrimary }]}>How is it now?</Text>
            <View style={styles.promptRow}>
              {([['Same', 'same'], ['Less', 'less'], ['Gone', 'gone']] as const).map(([label, key]) => (
                <Pressable
                  key={key}
                  style={[styles.promptBtn, { backgroundColor: C.surfaceHigh, borderColor: C.border }]}
                  onPress={() => {
                    setAnsweredIdx(promptIdx);
                    if (key === 'gone') passed();
                  }}
                  accessibilityRole="button"
                >
                  <Text style={[styles.promptBtnText, { color: C.textPrimary }]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {stillStrong && (
          <Text style={[styles.line, { color: C.textSecondary }]}>
            Still here is normal. Urges usually ease with time.
          </Text>
        )}

        {secs >= OFFER_OTHER_AT && (
          <Pressable
            style={[styles.secondary, { backgroundColor: C.surface, borderColor: C.cardBorder }]}
            onPress={onOther}
            accessibilityRole="button"
          >
            <Feather name="compass" size={18} color={C.indigoBright} />
            <Text style={[styles.secondaryText, { color: C.textPrimary }]}>Try something else for a while</Text>
          </Pressable>
        )}

        <Pressable
          style={[styles.primary, { backgroundColor: C.green }]}
          onPress={passed}
          accessibilityRole="button"
        >
          <Text style={[styles.primaryText, { color: onGreen }]}>It passed</Text>
        </Pressable>
        <Pressable
          style={[styles.secondary, { backgroundColor: C.surface, borderColor: C.cardBorder }]}
          onPress={() => setStillStrong(true)}
          accessibilityRole="button"
        >
          <Text style={[styles.secondaryText, { color: C.textPrimary }]}>Still strong</Text>
        </Pressable>
        {canGoIn ? (
          <Pressable onPress={onGoIn} style={styles.textRow} accessibilityRole="button">
            <Text style={[styles.textBtn, { color: C.textMuted }]}>I'm going in</Text>
          </Pressable>
        ) : (
          <Pressable onPress={onOther} style={styles.textRow} accessibilityRole="button">
            <Text style={[styles.textBtn, { color: C.textMuted }]}>Back</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
    gap: SPACING.lg,
  },
  ring: {
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  clock: { fontFamily: FONTS.display, fontSize: 40, letterSpacing: 1 },
  title: { fontFamily: FONTS.display, fontSize: 26, lineHeight: 34, textAlign: 'center' },
  line: { fontFamily: FONTS.body, fontSize: 17, lineHeight: 26, textAlign: 'center', paddingHorizontal: SPACING.md },
  primary: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
    marginTop: SPACING.sm,
  },
  primaryText: { fontFamily: FONTS.bodyBold, fontSize: 17, letterSpacing: 0.2 },
  secondary: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    paddingVertical: SPACING.md,
  },
  secondaryText: { fontFamily: FONTS.bodyBold, fontSize: 16 },
  textRow: { paddingVertical: SPACING.sm, alignItems: 'center' },
  textBtn: { fontFamily: FONTS.body, fontSize: 14, textAlign: 'center' },
  promptCard: {
    alignSelf: 'stretch',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  promptTitle: { fontFamily: FONTS.bodyBold, fontSize: 16, textAlign: 'center' },
  promptRow: { flexDirection: 'row', gap: SPACING.sm },
  promptBtn: {
    flex: 1,
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingVertical: SPACING.md,
  },
  promptBtnText: { fontFamily: FONTS.bodyBold, fontSize: 15 },
});
