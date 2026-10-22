// ─── Companion picker: starters, more companions, optional nickname ───────────
// Moved out of app/onboarding.tsx (the old "Choose your companion" step) so the
// setup questions use the same picker. Controlled: the screen keeps the choice and
// calls saveCompanion() when the person moves on. Changed later in Customize.

import { View, Text, Pressable, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoonSprite, CHAR_COLORS } from '@/components/home/GoonMascot';
import { CHARACTER_NAMES, CHARACTER_TAGS, STARTER_IDS, MORE_IDS } from '@/constants/sprites';
import { useMascotStore } from '@/stores/useMascotStore';
import type { CharacterId } from '@/stores/usePetStore';
import { useOnboardingStyles } from './onboardingStyles';

/** Same writes the onboarding companion step always made. */
export async function saveCompanion(id: CharacterId, nickname: string): Promise<void> {
  const nameToSave = nickname.trim() || CHARACTER_NAMES[id];
  await AsyncStorage.setItem('@nogoon_goon_character', String(id));
  useMascotStore.getState().setActive(id);
  await AsyncStorage.setItem(`@nogoon_pet_name_${id}`, nameToSave);
}

export function CompanionPicker({ selected, onSelect, nickname, onNickname }: {
  selected: CharacterId | null;
  onSelect: (id: CharacterId) => void;
  nickname: string;
  onNickname: (name: string) => void;
}) {
  const { c, styles } = useOnboardingStyles();

  // Picking a new companion swaps in its name, unless a custom nickname was typed.
  const pick = (id: CharacterId) => {
    onSelect(id);
    if (!nickname || nickname === CHARACTER_NAMES[selected ?? id]) onNickname(CHARACTER_NAMES[id]);
  };

  return (
    <View style={{ width: '100%', gap: 12 }}>
      <View style={styles.starterRow}>
        {STARTER_IDS.map((id) => {
          const active = id === selected;
          const accent = CHAR_COLORS[id][0][1];
          return (
            <Pressable
              key={id}
              style={[styles.starterCard, active && { borderColor: accent, backgroundColor: accent + '14' }]}
              onPress={() => pick(id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${CHARACTER_NAMES[id]}, ${CHARACTER_TAGS[id]}`}
            >
              <GoonSprite char={id} stage={0} size={1.1} />
              <Text style={[styles.starterName, active && { color: accent }]}>{CHARACTER_NAMES[id]}</Text>
              <Text style={styles.starterTag}>{CHARACTER_TAGS[id]}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>More companions</Text>
      <View style={styles.companionRow}>
        {MORE_IDS.map((id) => {
          const active = id === selected;
          const accent = CHAR_COLORS[id][0][1];
          return (
            <Pressable
              key={id}
              style={[styles.companionCard, active && { borderColor: accent, backgroundColor: accent + '14' }]}
              onPress={() => pick(id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${CHARACTER_NAMES[id]}, ${CHARACTER_TAGS[id]}`}
            >
              <GoonSprite char={id} stage={0} size={0.9} />
              <Text style={[styles.companionCardName, active && { color: accent }]}>{CHARACTER_NAMES[id]}</Text>
              <Text style={styles.companionCardTag}>{CHARACTER_TAGS[id]}</Text>
            </Pressable>
          );
        })}
      </View>

      {selected !== null && (
        <>
          <Text style={styles.companionNameLabel}>Give them a nickname (optional)</Text>
          <TextInput
            style={styles.companionNameInput}
            value={nickname}
            onChangeText={onNickname}
            placeholder={CHARACTER_NAMES[selected]}
            placeholderTextColor={c.textMuted}
            maxLength={20}
            returnKeyType="done"
            accessibilityLabel="Companion nickname"
          />
        </>
      )}
    </View>
  );
}
