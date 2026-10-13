// Pack registry. Bundled packs are validated once at load; an invalid one is
// dropped (so a bad pack can never break the app) and Core is always present.

import type { PackManifest } from './types';
import { validatePack } from './validate';
import { CORE_PACK } from './core';
import { WEBCORE_PACK } from './webcore';
import { TOKYO_PACK } from './tokyo';

export * from './types';
export { CORE_PACK, WEBCORE_PACK, TOKYO_PACK };
export { packTriad } from './theme';
export { validatePack };

export const PACKS: PackManifest[] = [CORE_PACK, WEBCORE_PACK, TOKYO_PACK]
  .map((p) => (p.id === 'core' ? p : validatePack(p)))
  .filter((p): p is PackManifest => p !== null);

export function getPack(id: string): PackManifest {
  return PACKS.find((p) => p.id === id) ?? CORE_PACK;
}

// Packs the user can see and pick right now.
export function availablePacks(unlockedIds: string[]): PackManifest[] {
  return PACKS.filter((p) => !p.hidden || unlockedIds.includes(p.id));
}

export function findPackByCode(code: string): PackManifest | null {
  const c = code.trim().toLowerCase();
  if (!c) return null;
  return PACKS.find((p) => p.unlock?.code?.toLowerCase() === c) ?? null;
}

export function packsUnlockedByStreak(streak: number): PackManifest[] {
  return PACKS.filter((p) => p.unlock?.streak !== undefined && streak >= p.unlock.streak);
}

export function packUnlockedByTap(): PackManifest[] {
  return PACKS.filter((p) => p.unlock?.tap);
}
