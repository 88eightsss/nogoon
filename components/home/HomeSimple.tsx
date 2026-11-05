// ─── New Home (Simple) ───────────────────────────────────────────────────────────────────────
//
// Plain and calm: greeting, days gained with a week strip, the protection row, "Need a minute", then the
// day's list. No room, no playing. The companion shows only as the small badge in the corner, which opens
// Me. Built from the existing day plan so nothing the person relies on moves. Behind the Lab switch
// (stores/useLabStore.ts) until it has been tested on a phone.

import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useAppBlocker } from '@/hooks/useAppBlocker';
import { describeBlockingStatus } from '@/utils/blockingStatus';
import { useFlowStore } from '@/stores/useFlowStore';
import { PlannerToday } from '@/components/page/PlannerToday';
import { TemptedSheet } from '@/components/page/TemptedSheet';
import { useMascot, CHARACTER_LABELS } from '@/components/page/useCharacter';
import { WeekStrip } from './WeekStrip';
import { UrgeLine } from './UrgeLine';

export function HomeSimple() {
  const { colors } = useTheme();
  const { char, stage } = useMascot();
  const petName = CHARACTER_LABELS[char];
  const { blockingStatus, openSettings } = useAppBlocker();
  const status = describeBlockingStatus(blockingStatus, colors);
  const markPauseSeen = useFlowStore((s) => s.markPauseSeen);
  const [sheet, setSheet] = useState(false);
  const off = blockingStatus === 'off' || blockingStatus === 'stalled';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <PlannerToday
        simple
        char={char} stage={stage} petName={petName}
        statusLabel={status.label} statusColor={status.color}
        protectionOff={off}
        onProtection={() => (off ? openSettings() : router.push('/(tabs)/blocklist' as any))}
        onCalm={() => { markPauseSeen(); setSheet(true); }}
        onBadge={() => router.push('/(tabs)/profile' as any)}
        headerExtra={
          <View style={{ gap: 12 }}>
            <WeekStrip />
            <UrgeLine />
          </View>
        }
      />
      <TemptedSheet visible={sheet} onClose={() => setSheet(false)} />
    </View>
  );
}
