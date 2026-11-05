// ─── Look picker: Match phone, Light or Dark ──────────────────────────────────
// The only colour choice in the app (the six palettes are gone). Taps apply at once through
// useThemeStore, so a choice sticks even if the app is closed mid-way. Changed later in Me > Look.

import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useThemeStore, type Appearance } from '@/stores/useThemeStore';
import { useOnboardingStyles } from './onboardingStyles';

const OPTIONS: { id: Appearance; label: string; icon: React.ComponentProps<typeof Feather>['name'] }[] = [
  { id: 'system', label: 'Match phone', icon: 'smartphone' },
  { id: 'light', label: 'Light', icon: 'sun' },
  { id: 'dark', label: 'Dark', icon: 'moon' },
];

export function LookPicker() {
  const { c, btn, styles } = useOnboardingStyles();
  const appearance = useThemeStore((s) => s.appearance);
  const setAppearance = useThemeStore((s) => s.setAppearance);

  return (
    <View style={{ width: '100%', gap: 12 }}>
      <View style={styles.modeSwitch}>
        {OPTIONS.map((o) => {
          const on = appearance === o.id;
          return (
            <Pressable
              key={o.id}
              style={[styles.modeOption, on && { backgroundColor: btn.bg }]}
              onPress={() => setAppearance(o.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={o.label}
            >
              <Feather name={o.icon} size={16} color={on ? btn.fg : c.textSecondary} />
              <Text style={[styles.modeOptionText, { color: on ? btn.fg : c.textSecondary }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
