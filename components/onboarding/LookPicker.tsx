// ─── Look picker: Dark/Light switch + the six palettes ────────────────────────
// Moved out of app/onboarding.tsx (the old "Pick your palette" step) so the setup
// questions use the same picker. Taps apply at once through useThemeStore, so a
// choice sticks even if the app is closed mid-way. Changed later in Me / Customize.

import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { THEMES, THEME_ORDER } from '@/constants/Themes';
import { useThemeStore } from '@/stores/useThemeStore';
import { useOnboardingStyles } from './onboardingStyles';

export function LookPicker() {
  const { c, btn, styles } = useOnboardingStyles();
  const themeId = useThemeStore((s) => s.themeId);
  const setTheme = useThemeStore((s) => s.setTheme);
  const setThemeBrightness = useThemeStore((s) => s.setThemeBrightness);
  // Starts from what the app shows now (new installs start light, see onboarding).
  const [mode, setMode] = useState<'dark' | 'light'>(() => (useThemeStore.getState().themeBrightness >= 50 ? 'light' : 'dark'));
  const chooseMode = (m: 'dark' | 'light') => {
    setMode(m);
    setThemeBrightness(m === 'light' ? 100 : 0);
  };

  return (
    <View style={{ width: '100%', gap: 12 }}>
      {/* Dark / Light switch, flips the whole screen live */}
      <View style={styles.modeSwitch}>
        {(['dark', 'light'] as const).map((m) => {
          const on = mode === m;
          return (
            <Pressable
              key={m}
              style={[styles.modeOption, on && { backgroundColor: btn.bg }]}
              onPress={() => chooseMode(m)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={m === 'dark' ? 'Dark' : 'Light'}
            >
              <Feather name={m === 'dark' ? 'moon' : 'sun'} size={16} color={on ? btn.fg : c.textSecondary} />
              <Text style={[styles.modeOptionText, { color: on ? btn.fg : c.textSecondary }]}>
                {m === 'dark' ? 'Dark' : 'Light'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.paletteGrid}>
        {THEME_ORDER.map((id) => {
          const triad = THEMES[id];
          const pal = triad[mode];
          const active = id === themeId;
          return (
            <Pressable
              key={id}
              style={[
                styles.paletteCard,
                { backgroundColor: pal.background, borderColor: active ? pal.accent : pal.surfaceHigh },
                active && { borderWidth: 3 },
              ]}
              onPress={() => setTheme(id)}
              accessibilityRole="button"
              accessibilityLabel={`${triad.name} palette`}
              accessibilityState={{ selected: active }}
            >
              <View style={[styles.paletteSurface, { backgroundColor: pal.surface }]}>
                <View style={[styles.paletteBar, { backgroundColor: pal.accent }]} />
                <View style={styles.paletteDots}>
                  {[pal.protect, pal.calm, pal.arcade, pal.me].map((dot, i) => (
                    <View key={i} style={[styles.paletteDot, { backgroundColor: dot }]} />
                  ))}
                </View>
              </View>
              <Text style={[styles.paletteName, { color: pal.text }]}>{triad.name}</Text>
              {active && (
                <View style={[styles.paletteCheck, { backgroundColor: pal.accent }]}>
                  <Feather name="check" size={12} color={pal.background} />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
