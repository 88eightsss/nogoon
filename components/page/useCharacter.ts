// Which companion the user picked (stored by GoonMascot under STORAGE_KEY).

import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEY } from '@/components/home/GoonMascot';
import type { CharacterId } from '@/stores/usePetStore';
import { CHARACTER_NAMES, isCharacterId } from '@/constants/sprites';

export const CHARACTER_LABELS: Record<CharacterId, string> = CHARACTER_NAMES;

export function useCharacter(): CharacterId {
  const [char, setChar] = useState<CharacterId>(0);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      AsyncStorage.getItem(STORAGE_KEY)
        .then((v) => {
          const n = v === null ? NaN : parseInt(v, 10);
          if (live && isCharacterId(n)) setChar(n);
        })
        .catch(() => {});
      return () => { live = false; };
    }, [])
  );
  return char;
}
