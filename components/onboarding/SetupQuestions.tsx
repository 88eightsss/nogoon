// ─── "Make it yours" setup questions ──────────────────────────────────────────
//
// Four one-tap questions, one per screen, each with a visible Skip:
//   1. What to cut back on (multi)   → starter sites + installed apps added to the blocklist
//   2. When it's hardest (single)    → Wind-down default, optional Briefing reminder
//   3. What replaces the scroll      → what Need a minute and Unwind put first
//   4. Companion and look            → the same pickers the old onboarding steps used
// Shown after the Accessibility step in onboarding, and again from
// Me > Account & help > Setup & fixes (app/setup-questions.tsx).
//
// Answers live in this component's state only. On finish they are turned into
// changes in the existing stores (utils/setupDefaults.ts), then dropped. A skipped
// question changes nothing; nothing is removed or switched off, so a re-run never
// wipes settings. Copy and mapping: constants/setupQuestions.ts.

import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CUT_BACK_CHOICES, HARD_TIME_CHOICES, HARD_TIME_DEFAULTS, REPLACE_CHOICES, planSetupDefaults,
  type CutBackId, type HardTimeId, type SetupAnswers,
} from '@/constants/setupQuestions';
import { useBriefingPrefs } from '@/stores/useBriefingPrefs';
import { useThemeStore } from '@/stores/useThemeStore';
import type { ThemeId } from '@/constants/Themes';
import { useMascotStore } from '@/stores/useMascotStore';
import type { CharacterId } from '@/stores/usePetStore';
import { applySetupAnswers } from '@/utils/setupDefaults';
import { useOnboardingStyles } from './onboardingStyles';
import { LookPicker } from './LookPicker';
import { CompanionPicker, saveCompanion } from './CompanionPicker';

const TOTAL = 4;

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

type Ui = ReturnType<typeof useOnboardingStyles>;

/** One big tappable row: a checkbox (multi) or a radio. */
function Choice({ ui, on, icon, title, sub, onPress, multi }: {
  ui: Ui; on: boolean; icon: React.ComponentProps<typeof Feather>['name']; title: string; sub?: string;
  onPress: () => void; multi?: boolean;
}) {
  const { c, btn, styles } = ui;
  return (
    <Pressable
      style={[styles.qChoice, on && styles.qChoiceOn]}
      onPress={onPress}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={multi ? { checked: on } : { selected: on }}
      accessibilityLabel={sub ? `${title}. ${sub}` : title}
    >
      <Feather name={icon} size={20} color={on ? btn.bg : c.textSecondary} />
      <View style={styles.qChoiceText}>
        <Text style={styles.qChoiceTitle}>{title}</Text>
        {sub ? <Text style={styles.qChoiceSub}>{sub}</Text> : null}
      </View>
      <Feather
        name={multi ? (on ? 'check-square' : 'square') : (on ? 'check-circle' : 'circle')}
        size={22}
        color={on ? btn.bg : c.textMuted}
      />
    </Pressable>
  );
}

export function SetupQuestions({ onFinish, onBack, rerun = false }: {
  /** Called after the answers are applied. */
  onFinish: () => void;
  /** Back from the first question (onboarding: back to the Accessibility step). */
  onBack?: () => void;
  /** Opened again from Setup & fixes: start from the current companion. */
  rerun?: boolean;
}) {
  const ui = useOnboardingStyles();
  const { c, btn, styles } = ui;
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  // Q1
  const [cutBack, setCutBack] = useState<Set<CutBackId>>(() => new Set());
  // Q2
  const [hardTime, setHardTime] = useState<HardTimeId | null>(null);
  const remindAt = useBriefingPrefs((s) => s.remindAt);
  const initialRemind = useRef(useBriefingPrefs.getState().remind).current;
  const [remind, setRemind] = useState(initialRemind);
  // True while the box is ticked only because Morning was picked (undone if the pick changes).
  const [autoRemind, setAutoRemind] = useState(false);
  // Q3
  const [replace, setReplace] = useState<SetupAnswers['replace'] | null>(null);
  // Q4
  const [char, setChar] = useState<CharacterId | null>(() => (rerun ? useMascotStore.getState().active : null));
  const [nickname, setNickname] = useState('');
  const [charTouched, setCharTouched] = useState(false);
  // Look changes apply live; Skip on Q4 puts the look back the way it was.
  const lookAtStart = useRef<{ themeId: ThemeId; themeBrightness: number } | null>(null);

  useEffect(() => {
    if (!rerun || char === null) return;
    AsyncStorage.getItem(`@nogoon_pet_name_${char}`).then((n) => { if (n) setNickname(n); }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (step === 3 && !lookAtStart.current) {
      const t = useThemeStore.getState();
      lookAtStart.current = { themeId: t.themeId, themeBrightness: t.themeBrightness };
    }
  }, [step]);

  // Answers given so far. `upTo` = the last question that counts (Skip all stops early).
  const answersUpTo = (upTo: number): SetupAnswers => {
    const a: SetupAnswers = {};
    if (upTo >= 0 && cutBack.size > 0) a.cutBack = [...cutBack];
    if (upTo >= 1) {
      if (hardTime) a.hardTime = hardTime;
      if (remind !== initialRemind) a.briefingReminder = remind;
    }
    if (upTo >= 2 && replace) a.replace = replace;
    return a;
  };

  const finish = async (upTo: number, keepCompanion: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      await applySetupAnswers(answersUpTo(upTo));
      if (keepCompanion && char !== null && charTouched) await saveCompanion(char, nickname);
    } catch (e) {
      console.warn('[setup questions] apply failed:', e);
    }
    onFinish();
  };

  const next = () => (step < TOTAL - 1 ? setStep(step + 1) : finish(TOTAL - 1, true));
  const back = () => (step > 0 ? setStep(step - 1) : onBack?.());
  // Skip = this question counts as unanswered.
  const skip = () => {
    if (step === 0) setCutBack(new Set());
    if (step === 1) { setHardTime(null); setRemind(initialRemind); setAutoRemind(false); }
    if (step === 2) setReplace(null);
    if (step === 3) {
      const t = lookAtStart.current;
      if (t) {
        useThemeStore.getState().setTheme(t.themeId);
        useThemeStore.getState().setThemeBrightness(t.themeBrightness);
      }
      finish(2, false);
      return;
    }
    setStep(step + 1);
  };
  const skipAll = () => finish(step - 1, false);

  const plan = useMemo(() => planSetupDefaults({ cutBack: [...cutBack] }), [cutBack]);

  const toggleCut = (id: CutBackId) => setCutBack((prev) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const pickTime = (id: HardTimeId) => {
    setHardTime(id);
    if (HARD_TIME_DEFAULTS[id].briefingReminder) {
      if (!remind) { setRemind(true); setAutoRemind(true); }
    } else if (autoRemind) {
      setRemind(initialRemind);
      setAutoRemind(false);
    }
  };

  const timeNote = hardTime ? HARD_TIME_CHOICES.find((t) => t.id === hardTime)?.effect : null;
  const sitesN = plan.addDomains.length;
  const appsN = plan.addApps.length;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.qScreen} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Back · n of 4 · Skip */}
          <View style={styles.qTop}>
            {step > 0 || onBack ? (
              <Pressable style={styles.qTopBtn} onPress={back} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8}>
                <Text style={styles.qTopText}>Back</Text>
              </Pressable>
            ) : <View style={styles.qTopBtn} />}
            <Text style={styles.qCount} accessibilityLabel={`Question ${step + 1} of ${TOTAL}`}>{step + 1} OF {TOTAL}</Text>
            <Pressable style={[styles.qTopBtn, { alignItems: 'flex-end' }]} onPress={skip} disabled={busy} accessibilityRole="button" accessibilityLabel="Skip this question" hitSlop={8}>
              <Text style={styles.qTopText}>Skip</Text>
            </Pressable>
          </View>
          <View style={styles.qBars}>
            {Array.from({ length: TOTAL }, (_, i) => <View key={i} style={[styles.qBar, i <= step && styles.qBarOn]} />)}
          </View>

          {step === 0 && (
            <>
              <Text style={styles.qTitle} accessibilityRole="header">What are you here to cut back on?</Text>
              <Text style={styles.qSub}>Pick any. We'll add a starter list to what NoGoon blocks. We don't keep your answers.</Text>
              <View style={styles.qList}>
                {CUT_BACK_CHOICES.map((o) => (
                  <Choice key={o.id} ui={ui} multi on={cutBack.has(o.id)} icon={o.icon} title={o.label} sub={o.sub} onPress={() => toggleCut(o.id)} />
                ))}
              </View>
              {cutBack.size > 0 && (
                <View style={styles.qNote}>
                  <Feather name="shield" size={16} color={c.accentBright} style={{ marginTop: 2 }} />
                  <Text style={styles.qNoteText}>
                    {sitesN > 0 || appsN > 0
                      ? `Adds ${sitesN} site${sitesN === 1 ? '' : 's'}${appsN > 0 ? ` and the matching apps you have installed` : ''}. Change the list any time in Me, under Protection.`
                      : 'Add your own in Me, under Protection > Apps & sites.'}
                  </Text>
                </View>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <Text style={styles.qTitle} accessibilityRole="header">When is it hardest to put the phone down?</Text>
              <Text style={styles.qSub}>Pick one.</Text>
              <View style={styles.qList} accessibilityRole="radiogroup">
                {HARD_TIME_CHOICES.map((o) => (
                  <Choice key={o.id} ui={ui} on={hardTime === o.id} icon={o.icon} title={o.label} onPress={() => pickTime(o.id)} />
                ))}
              </View>
              {timeNote ? (
                <View style={styles.qNote}>
                  <Feather name="info" size={16} color={c.accentBright} style={{ marginTop: 2 }} />
                  <Text style={styles.qNoteText}>{timeNote} You can change it in Me, under Protection.</Text>
                </View>
              ) : null}
              <Pressable
                style={styles.qCheckRow}
                onPress={() => { setRemind((v) => !v); setAutoRemind(false); }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: remind }}
                accessibilityLabel={`Remind me when the Briefing is ready, at ${formatTime(remindAt)}`}
              >
                <Feather name={remind ? 'check-square' : 'square'} size={22} color={remind ? btn.bg : c.textMuted} />
                <View style={styles.qChoiceText}>
                  <Text style={styles.qChoiceTitle}>Remind me when the Briefing is ready</Text>
                  <Text style={styles.qChoiceSub}>Once a day at {formatTime(remindAt)}. Change it in Customize.</Text>
                </View>
              </Pressable>
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.qTitle} accessibilityRole="header">What should replace the scroll?</Text>
              <Text style={styles.qSub}>We'll offer it first when you tap Need a minute, and put it first in Unwind. Nothing else goes away.</Text>
              <View style={styles.qGrid} accessibilityRole="radiogroup">
                {REPLACE_CHOICES.map((o) => {
                  const on = replace === o.id;
                  return (
                    <Pressable
                      key={o.id}
                      style={[styles.qTile, on && styles.qChoiceOn]}
                      onPress={() => setReplace(o.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`${o.label}. ${o.sub}`}
                    >
                      <Feather name={o.icon} size={24} color={on ? btn.bg : c.textSecondary} />
                      <Text style={styles.qChoiceTitle}>{o.label}</Text>
                      <Text style={styles.qChoiceSub}>{o.sub}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {step === 3 && (
            <>
              <Text style={styles.qTitle} accessibilityRole="header">Pick a companion and a look</Text>
              <Text style={styles.qSub}>They grow as you walk away. Change either any time in Customize.</Text>
              <Text style={styles.qGroupLabel}>Companion</Text>
              <CompanionPicker
                selected={char}
                onSelect={(id) => { setChar(id); setCharTouched(true); }}
                nickname={nickname}
                onNickname={(n) => { setNickname(n); setCharTouched(true); }}
              />
              <Text style={styles.qGroupLabel}>Look</Text>
              <LookPicker />
            </>
          )}

          <View style={styles.qSpacer} />

          <Pressable
            style={[styles.primary, busy && { opacity: 0.6 }]}
            onPress={next}
            disabled={busy}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>{step < TOTAL - 1 ? 'Next' : 'Finish'}</Text>
          </Pressable>
          {step < TOTAL - 1 && (
            <Pressable style={styles.qSkipAll} onPress={skipAll} disabled={busy} accessibilityRole="button">
              <Text style={styles.setupSkipText}>{step === 0 ? 'Skip all questions' : 'Skip the rest'}</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
