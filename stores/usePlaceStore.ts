// The place picked in Local. Stays on the phone: nothing here is sent anywhere.
// Also mirrors the name into useOfferStore.place so "Beyond the screen" searches keep working.
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NO_PLACE, type Place } from '@/constants/places';
import { useOfferStore } from '@/stores/useOfferStore';

interface PlaceState {
  place: Place;
  setPlace: (p: Place) => void;
  clearPlace: () => void;
}

const s = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

export const usePlaceStore = create<PlaceState>()(
  persist(
    (set) => ({
      place: NO_PLACE,
      setPlace: (p) => {
        const place: Place = {
          name: s(p.name, 60), admin: s(p.admin, 60), country: s(p.country, 60),
          regionKey: typeof p.regionKey === 'string' ? p.regionKey.slice(0, 40) : null,
        };
        set({ place });
        useOfferStore.getState().setPlace(place.name);
      },
      clearPlace: () => { set({ place: NO_PLACE }); useOfferStore.getState().setPlace(''); },
    }),
    {
      name: 'nogoon-place',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PlaceState>;
        const pl = (p.place ?? {}) as Partial<Place>;
        return {
          ...current,
          place: {
            name: s(pl.name, 60), admin: s(pl.admin, 60), country: s(pl.country, 60),
            regionKey: typeof pl.regionKey === 'string' ? pl.regionKey : null,
          },
        };
      },
    },
  ),
);
