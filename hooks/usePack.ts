// Resolves the active pack, falling back to Core if the saved one is missing or
// still locked.

import { useMemo } from 'react';
import { usePackStore } from '@/stores/usePackStore';
import { getPack, CORE_PACK, type PackManifest } from '@/constants/packs';

export function useActivePack(): PackManifest {
  const id = usePackStore((s) => s.activePackId);
  const unlocked = usePackStore((s) => s.unlockedIds);
  return useMemo(() => {
    const p = getPack(id);
    if (p.hidden && !unlocked.includes(p.id)) return CORE_PACK;
    return p;
  }, [id, unlocked]);
}
