// Which companion the user picked (stored by GoonMascot under STORAGE_KEY).

import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEY } from '@/components/home/GoonMascot';
import type { CharacterId } from '@/stores/usePetStore';

export const CHARACTER_LABELS: Record<CharacterId, string> = { 0: 'Buddy', 1: 'Nova', 2: 'Rex' };

export function useCharacter(): CharacterId {
  const [char, setChar] = useState<CharacterId>(0);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      AsyncStorage.getItem(STORAGE_KEY)
        .then((v) => {
          const n = v === null ? NaN : parseInt(v, 10);
          if (live && (n === 0 || n === 1 || n === 2)) setChar(n);
        })
        .catch(() => {});
      return () => { live = false; };
    }, [])
  );
  return char;
}
