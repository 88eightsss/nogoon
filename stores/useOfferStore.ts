// ─── Offer Store ──────────────────────────────────────────────────────────────
//
// Which "instead" bundles the gate draws from, and the user's own list of things they
// would rather do. Personal and local, persisted to AsyncStorage; reset on sign-out.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BUNDLES, CUSTOM_LEN, CUSTOM_MAX, type BundleId } from '@/constants/offers';
import { PLACE_MAX } from '@/constants/elsewhere';

const VALID = new Set<string>(BUNDLES.map((b) => b.id));

interface OfferState {
  bundleIds: BundleId[];     // never empty; ['smart'] is the default
  custom: string[];          // the user's own "instead I will…" lines
  place: string;             // optional town or neighbourhood for the Beyond the screen links
  setPlace: (text: string) => void;
  showSponsors: boolean;     // false hides The Wall row and the sponsor tiles in Beyond the screen
  setShowSponsors: (on: boolean) => void;
  toggleBundle: (id: BundleId) => void;
  addCustom: (text: string) => boolean;   // false when empty, duplicate, or the list is full
  removeCustom: (index: number) => void;
}

export const useOfferStore = create<OfferState>()(
  persist(
    (set, get) => ({
      bundleIds: ['smart'],
      custom: [],
      place: '',
      showSponsors: true,
      setShowSponsors: (on) => set({ showSponsors: on }),
      setPlace: (text) => set({ place: text.slice(0, PLACE_MAX) }),

      toggleBundle: (id) => {
        const cur = get().bundleIds;
        let next: BundleId[];
        if (id === 'smart') next = ['smart'];
        else {
          const without = cur.filter((b) => b !== 'smart');
          next = without.includes(id) ? without.filter((b) => b !== id) : [...without, id];
        }
        set({ bundleIds: next.length ? next : ['smart'] });
      },

      addCustom: (text) => {
        const t = text.trim().slice(0, CUSTOM_LEN);
        const { custom, bundleIds } = get();
        if (!t || custom.length >= CUSTOM_MAX || custom.some((c) => c.toLowerCase() === t.toLowerCase())) return false;
        // Adding your own idea means you want to see it: switch "My own list" on.
        const withMine = bundleIds.includes('mine') ? bundleIds : [...bundleIds.filter((b) => b !== 'smart'), 'mine' as BundleId];
        set({ custom: [...custom, t], bundleIds: withMine });
        return true;
      },

      removeCustom: (index) => {
        const custom = get().custom.filter((_, i) => i !== index);
        let bundleIds = get().bundleIds;
        if (custom.length === 0) {
          bundleIds = bundleIds.filter((b) => b !== 'mine');
          if (bundleIds.length === 0) bundleIds = ['smart'];
        }
        set({ custom, bundleIds });
      },
    }),
    {
      name: 'nogoon-offers-v1',
      storage: createJSONStorage(() => AsyncStorage),
      // Drop anything unknown so an old or edited value can never break the gate.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<OfferState>;
        const ids = (p.bundleIds ?? []).filter((b): b is BundleId => VALID.has(b));
        const custom = (p.custom ?? []).filter((c): c is string => typeof c === 'string').slice(0, CUSTOM_MAX);
        const place = typeof p.place === 'string' ? p.place.slice(0, PLACE_MAX) : '';
        return { ...current, bundleIds: ids.length ? ids : current.bundleIds, custom, place, showSponsors: p.showSponsors !== false };
      },
    },
  ),
);
