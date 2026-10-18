// ─── Take your pal for a walk ─────────────────────────────────────────────────
// Pick a goal, put the phone in your hand or pocket and go. Steps come from the phone's step
// sensor when it is allowed, and from the motion sensor (the shakes of walking) when it is not,
// so it always counts something. The companion trots along while you move and waits when you
// stop. A real walk (500+ steps) feeds the companion, up to twice a day. No location, nothing
// leaves the phone.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, AppState, BackHandler, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';
import { CHARACTER_LABELS, useMascot } from '@/components/page/useCharacter';
import { WalkScene } from '@/components/walk/WalkScene';
import { useMascotStore } from '@/stores/useMascotStore';
import { useUserStore } from '@/stores/useUserStore';
import { exitGate } from '@/utils/exitGate';
import { useWalkStore, METRES_PER_STEP, WALK_MIN_STEPS_TO_FEED, WALK_MAX_FEEDS_PER_DAY } from '@/stores/useWalkStore';

type Phase = 'ready' | 'walking' | 'done';
type Sub = { remove: () => void };

const GOALS = [500, 1000, 2000] as const;
const RING = 168;
const STROKE = 12;
const MOVING_WINDOW_MS = 3000;

// expo-sensors / expo-keep-awake are loaded lazily so the screen still opens (and counts nothing
// rather than crashing) on a build that was made before they were installed.
function loadSensors(): { Pedometer?: any; Accelerometer?: any } {
  try { return require('expo-sensors'); } catch { return {}; }
}
function setAwake(on: boolean) {
  try {
    const k = require('expo-keep-awake');
    if (on) k.activateKeepAwakeAsync?.('nogoon-walk'); else k.deactivateKeepAwake?.('nogoon-walk');
  } catch { /* optional */ }
}

function miles(steps: number) {
  const m = steps * METRES_PER_STEP;
  return (m / 1609.34).toFixed(2);
}
function km(steps: number) {
  return ((steps * METRES_PER_STEP) / 1000).toFixed(2);
}
function clock(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export default function WalkScreen() {
  const { colors, cardStyle } = useTheme();
  const { char, stage } = useMascot();
  const name = CHARACTER_LABELS[char];
  const fedToday = useWalkStore((s) => s.todayFed());
  // Opened from the gate (only when the person switched "Walk to get in" on): the goal is fixed,
  // and reaching it is what lets them through (or, in hard modes, counts as walking away).
  const params = useLocalSearchParams<{ gate?: string; app?: string; domain?: string; isBricked?: string; isColdTurkey?: string }>();
  const inGate = params.gate === '1' && !!params.app;
  const hardMode = params.isBricked === '1' || params.isColdTurkey === '1';
  const gateGoalSteps = useWalkStore((s) => s.gateGoal);
  const recordWalkAway = useUserStore((s) => s.recordWalkAway);

  const [phase, setPhase] = useState<Phase>('ready');
  const [goal, setGoal] = useState<number>(inGate ? gateGoalSteps : 1000);
  const [steps, setSteps] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [moving, setMoving] = useState(false);
  const [source, setSource] = useState<'step sensor' | 'motion' | 'none'>('none');
  const [earned, setEarned] = useState(false);
  const [goalHit, setGoalHit] = useState(false);

  // Live counters live in refs so sensor callbacks never go stale.
  const pedSteps = useRef(0);
  const accelSteps = useRef(0);
  const stepsRef = useRef(0);        // the number on screen, readable from callbacks
  const goalHitRef = useRef(false);
  const runId = useRef(0);           // bumped on every start/stop so a late async start can bail out
  const lastTick = useRef(0);
  const lastBuzz = useRef(0);
  const goalRef = useRef(goal);
  goalRef.current = goal;
  const subs = useRef<Sub[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopSensors = useCallback(() => {
    runId.current += 1;
    subs.current.forEach((s) => { try { s.remove(); } catch { /* already gone */ } });
    subs.current = [];
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    setAwake(false);
  }, []);
  useEffect(() => stopSensors, [stopSensors]);

  // Folds the sensors into one number that can only go up. Once the phone's step sensor has
  // reported, it is the source of truth (motion can over-count); until then motion counts.
  const bump = useCallback(() => {
    const next = pedSteps.current > 0 ? Math.max(pedSteps.current, stepsRef.current) : Math.max(accelSteps.current, stepsRef.current);
    lastTick.current = Date.now();
    const prev = stepsRef.current;
    if (next <= prev) return;
    stepsRef.current = next;
    setSteps(next);
    // light tap every 250 steps, a stronger buzz when the goal is reached (once)
    if (Math.floor(next / 250) > Math.floor(prev / 250)) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (!goalHitRef.current && next >= goalRef.current) {
      goalHitRef.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setGoalHit(true);
    }
  }, []);

  const start = useCallback(async () => {
    stopSensors(); // clears anything from a previous run and invalidates it
    const myRun = runId.current;
    pedSteps.current = 0;
    accelSteps.current = 0;
    stepsRef.current = 0;
    goalHitRef.current = false;
    lastTick.current = 0;
    lastBuzz.current = 0;
    setSteps(0);
    setSeconds(0);
    setGoalHit(false);
    setEarned(false);
    setMoving(false);
    setSource('none');
    setPhase('walking');
    setAwake(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    const { Pedometer, Accelerometer } = loadSensors();
    let usingPed = false;

    // 1) The phone's own step sensor (needs the Physical activity permission on Android).
    try {
      if (Pedometer?.isAvailableAsync) {
        const ok = await Pedometer.isAvailableAsync();
        let granted = ok;
        if (ok && Platform.OS === 'android' && Pedometer.requestPermissionsAsync) {
          const p = await Pedometer.requestPermissionsAsync();
          granted = !!p?.granted;
        }
        if (runId.current !== myRun) return; // left the screen or finished while the permission prompt was up
        if (ok && granted) {
          const sub = Pedometer.watchStepCount((r: { steps: number }) => {
            pedSteps.current = r.steps;
            bump();
          });
          subs.current.push(sub);
          usingPed = true;
          setSource('step sensor');
        }
      }
    } catch { /* fall through to motion */ }

    if (runId.current !== myRun) { subs.current.forEach((s) => { try { s.remove(); } catch { /* gone */ } }); subs.current = []; return; }

    // 2) The shakes of walking, always running as backup so it counts even with no step sensor.
    try {
      if (Accelerometer?.isAvailableAsync && (await Accelerometer.isAvailableAsync()) && runId.current === myRun) {
        Accelerometer.setUpdateInterval(50);
        let smooth = 1;
        let above = false;
        let lastStep = 0;
        const sub = Accelerometer.addListener(({ x, y, z }: { x: number; y: number; z: number }) => {
          const g = Math.sqrt(x * x + y * y + z * z);
          smooth = smooth * 0.7 + g * 0.3;
          const now = Date.now();
          if (!above && smooth > 1.18 && now - lastStep > 300) {
            above = true;
            lastStep = now;
            accelSteps.current += 1;
            bump();
          } else if (above && smooth < 1.05) {
            above = false;
          }
        });
        subs.current.push(sub);
        if (!usingPed) setSource('motion');
      }
    } catch { /* nothing to count with */ }

    if (runId.current !== myRun) { subs.current.forEach((s) => { try { s.remove(); } catch { /* gone */ } }); subs.current = []; return; }
    const began = Date.now();
    timer.current = setInterval(() => {
      setSeconds(Math.round((Date.now() - began) / 1000));
      setMoving(Date.now() - lastTick.current < MOVING_WINDOW_MS && lastTick.current > 0);
    }, 500);
  }, [bump, stopSensors]);

  const finish = useCallback(() => {
    stopSensors();
    setMoving(false);
    const final = stepsRef.current;
    const got = useWalkStore.getState().finishWalk(final);
    if (got) useMascotStore.getState().feed(1);
    setEarned(got);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (inGate) {
      if (hardMode) {
        // Hard modes never unlock: the walk counts as walking away.
        recordWalkAway();
        exitGate();
      } else {
        router.replace({
          pathname: '/post-game',
          params: { pointsEarned: '0', gameName: 'Walk', app: params.app, domain: params.domain, isBricked: params.isBricked, isColdTurkey: params.isColdTurkey },
        });
      }
      return;
    }
    setPhase('done');
  }, [stopSensors, inGate, hardMode, recordWalkAway, params.app, params.domain, params.isBricked, params.isColdTurkey]);

  // If the app is sent away mid-walk the step sensor keeps counting but motion pauses; nothing to do
  // except make sure the timer does not run on after the screen is gone.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active' && phase === 'walking') bump();
    });
    return () => sub.remove();
  }, [phase, bump]);

  // Opened from the gate there is nothing behind this screen but the blocked app, so Back = walk away.
  const leaveRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!inGate) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { leaveRef.current(); return true; });
    return () => sub.remove();
  }, [inGate]);

  const pct = Math.min(1, steps / goal);
  const r = (RING - STROKE) / 2;
  const circ = 2 * Math.PI * r;

  const line = useMemo(() => {
    if (phase === 'ready') return 'Ready when you are!';
    if (phase === 'done') return earned ? 'That was great. Thank you!' : 'Nice little stroll.';
    if (goalHit) return 'We made it!';
    if (!moving) return steps === 0 ? 'Start moving!' : 'Waiting for you…';
    if (pct > 0.75) return 'Almost there!';
    if (pct > 0.4) return 'This is fun!';
    return 'Off we go!';
  }, [phase, earned, goalHit, moving, steps, pct]);

  const leave = () => {
    stopSensors();
    if (inGate) { recordWalkAway(); exitGate(); return; }
    router.back();
  };
  leaveRef.current = leave;

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]}>
      <View style={s.header}>
        <Pressable onPress={leave} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={[s.title, { color: colors.text }]}>Walk with {name}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <WalkScene char={char} stage={stage} moving={phase === 'walking' && moving} line={line} />

        {phase === 'ready' && (
          <>
            <Text style={[s.h, { color: colors.text }]}>Take {name} for a walk</Text>
            {inGate && (
              <Text style={[s.p, { color: colors.textSecondary }]}>
                {hardMode
                  ? `Walk ${goal} steps with ${name}. This app stays closed, but the walk counts as walking away.`
                  : `Walk ${goal} steps with ${name} and you can go in. Stopping here counts as walking away.`}
              </Text>
            )}
            <Text style={[s.p, { color: colors.textSecondary }]}>
              Hold your phone or keep it in a pocket and walk. {name} trots along while you move and waits when you stop.
              A walk of {WALK_MIN_STEPS_TO_FEED}+ steps feeds {name}, up to {WALK_MAX_FEEDS_PER_DAY} times a day.
            </Text>
            {!inGate && <Text style={[s.label, { color: colors.textMuted }]}>GOAL</Text>}
            {!inGate && <View style={s.chips}>
              {GOALS.map((g) => {
                const on = g === goal;
                return (
                  <Pressable
                    key={g}
                    onPress={() => setGoal(g)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${g} steps`}
                    style={[s.chip, { backgroundColor: on ? colors.accent : colors.surface, borderColor: on ? colors.accent : colors.cardBorder }]}
                  >
                    <Text style={[s.chipNum, { color: on ? colors.background : colors.text }]}>{g.toLocaleString()}</Text>
                    <Text style={[s.chipSub, { color: on ? colors.background : colors.textMuted }]}>steps</Text>
                  </Pressable>
                );
              })}
            </View>}
            <Pressable onPress={start} style={[s.btn, { backgroundColor: colors.accent }]} accessibilityRole="button" accessibilityLabel="Start walking">
              <Feather name="play" size={18} color={colors.background} />
              <Text style={[s.btnText, { color: colors.background }]}>Start walking</Text>
            </Pressable>
            <Text style={[s.fine, { color: colors.textMuted }]}>
              Counts steps with your phone's motion sensors. No location is used and nothing leaves your phone. Keep this screen open while you walk.
              {fedToday >= WALK_MAX_FEEDS_PER_DAY ? `\n${name} is full for today, but you can still walk.` : ''}
            </Text>
          </>
        )}

        {phase === 'walking' && (
          <>
            <View style={s.ringWrap}>
              <Svg width={RING} height={RING}>
                <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={colors.border} strokeWidth={STROKE} fill="none" />
                <Circle
                  cx={RING / 2} cy={RING / 2} r={r} stroke={goalHit ? colors.success : colors.accent} strokeWidth={STROKE} fill="none"
                  strokeLinecap="round" strokeDasharray={`${circ} ${circ}`} strokeDashoffset={circ * (1 - pct)}
                  transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
                />
              </Svg>
              <View style={s.ringCenter} accessible accessibilityLabel={`${steps} of ${goal} steps`}>
                <Text style={[s.big, { color: colors.text }]}>{steps.toLocaleString()}</Text>
                <Text style={[s.small, { color: colors.textMuted }]}>of {goal.toLocaleString()} steps</Text>
              </View>
            </View>

            <View style={[s.stats, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
              <Stat label="TIME" value={clock(seconds)} colors={colors} />
              <Stat label="MILES" value={miles(steps)} colors={colors} />
              <Stat label="KM" value={km(steps)} colors={colors} />
            </View>

            {source === 'none' && (
              <Text style={[s.fine, { color: colors.warning }]}>
                This phone is not giving NoGoon a motion sensor, so steps cannot be counted here.
              </Text>
            )}
            {source === 'motion' && steps === 0 && (
              <Text style={[s.fine, { color: colors.textMuted }]}>
                Counting from your phone's motion. Walk with it in your hand or pocket. For the step sensor, allow Physical activity when asked.
              </Text>
            )}

            <Pressable
              onPress={finish}
              disabled={inGate && !goalHit}
              style={[s.btn, { backgroundColor: goalHit ? colors.success : colors.surface, borderWidth: goalHit ? 0 : 1, borderColor: colors.cardBorder, opacity: inGate && !goalHit ? 0.6 : 1 }]}
              accessibilityRole="button"
              accessibilityState={{ disabled: inGate && !goalHit }}
              accessibilityLabel={inGate ? (goalHit ? 'Finish the walk' : `${Math.max(0, goal - steps)} steps to go`) : 'Finish walk'}
            >
              <Feather name={inGate && !goalHit ? 'lock' : 'flag'} size={18} color={goalHit ? colors.background : colors.text} />
              <Text style={[s.btnText, { color: goalHit ? colors.background : colors.text }]}>
                {inGate && !goalHit
                  ? `${Math.max(0, goal - steps).toLocaleString()} steps to go`
                  : goalHit ? (inGate ? (hardMode ? 'We did it' : `We did it, go in`) : 'We did it, finish') : 'Finish walk'}
              </Text>
            </Pressable>
            {inGate && (
              <Pressable onPress={leave} hitSlop={8} accessibilityRole="button" accessibilityLabel="Never mind, walk away">
                <Text style={[s.link, { color: colors.textMuted }]}>Never mind</Text>
              </Pressable>
            )}
          </>
        )}

        {phase === 'done' && (
          <>
            <Text style={[s.h, { color: colors.text }]}>{steps >= goal ? 'Goal reached!' : steps >= 50 ? 'Nice walk' : 'Short one'}</Text>
            <View style={[s.stats, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
              <Stat label="STEPS" value={steps.toLocaleString()} colors={colors} />
              <Stat label="MILES" value={miles(steps)} colors={colors} />
              <Stat label="TIME" value={clock(seconds)} colors={colors} />
            </View>
            <View style={[s.note, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
              <Feather name={earned ? 'heart' : 'info'} size={18} color={earned ? colors.accent : colors.textMuted} />
              <Text style={[s.noteText, { color: colors.textSecondary }]}>
                {earned
                  ? `${name} was fed from this walk and grew a little.`
                  : steps < WALK_MIN_STEPS_TO_FEED
                    ? `Walks of ${WALK_MIN_STEPS_TO_FEED}+ steps feed ${name}. This one was ${WALK_MIN_STEPS_TO_FEED - steps} short.`
                    : `${name} is full for today. Walk again tomorrow to feed them.`}
              </Text>
            </View>
            <Pressable onPress={() => router.replace('/journal')} style={[s.btn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder }]} accessibilityRole="button" accessibilityLabel="Write about it">
              <Feather name="edit-3" size={18} color={colors.text} />
              <Text style={[s.btnText, { color: colors.text }]}>Write about it</Text>
            </Pressable>
            <Pressable onPress={() => setPhase('ready')} style={[s.btn, { backgroundColor: colors.accent }]} accessibilityRole="button" accessibilityLabel="Walk again">
              <Feather name="rotate-cw" size={18} color={colors.background} />
              <Text style={[s.btnText, { color: colors.background }]}>Walk again</Text>
            </Pressable>
            <Pressable onPress={leave} hitSlop={8} accessibilityRole="button"><Text style={[s.link, { color: colors.textMuted }]}>Done</Text></Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, colors }: { label: string; value: string; colors: { text: string; textMuted: string } }) {
  return (
    <View style={s.stat}>
      <Text style={[s.statVal, { color: colors.text }]}>{value}</Text>
      <Text style={[s.statLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  title: { fontFamily: FONTS.display, fontSize: 18 },
  content: { padding: SPACING.lg, gap: SPACING.lg, paddingBottom: 48 },
  h: { fontFamily: FONTS.display, fontSize: 22 },
  p: { fontFamily: FONTS.body, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1.2, marginBottom: -6 },
  chips: { flexDirection: 'row', gap: SPACING.sm },
  chip: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 1 },
  chipNum: { fontFamily: FONTS.display, fontSize: 20 },
  chipSub: { fontFamily: FONTS.body, fontSize: 12 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, borderRadius: 14, paddingHorizontal: SPACING.lg },
  btnText: { fontFamily: FONTS.bodyBold, fontSize: 16 },
  fine: { fontFamily: FONTS.body, fontSize: 12.5, lineHeight: 18, textAlign: 'center' },
  ringWrap: { alignSelf: 'center', width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  big: { fontFamily: FONTS.display, fontSize: 40, fontVariant: ['tabular-nums'] },
  small: { fontFamily: FONTS.body, fontSize: 13 },
  stats: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, paddingVertical: SPACING.md },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statVal: { fontFamily: FONTS.monoBold, fontSize: 18 },
  statLabel: { fontFamily: FONTS.bodyBold, fontSize: 10.5, letterSpacing: 1 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md, borderRadius: 14, borderWidth: 1, padding: SPACING.md },
  noteText: { flex: 1, fontFamily: FONTS.body, fontSize: 14, lineHeight: 20 },
  link: { fontFamily: FONTS.bodyMedium, fontSize: 14, textAlign: 'center', paddingVertical: 4 },
});
