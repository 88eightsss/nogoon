// ─── Places near you: the list ────────────────────────────────────────────────
// Public places worth a visit: parks, beaches, trails, museums, zoos and aquariums, gardens and public
// buildings. This first list is hand-picked names only, for Oahu and Maui. It has NO hours, prices or
// conditions on purpose: we do not show a fact we have not checked. The screen sends people to Maps and
// says so. Later this comes from a database (official state and county layers plus OpenStreetMap), with a
// "checked on" date on every place. See claude/nogoon-step-out-places in the project docs.
//
// (Named "spots" in code because "place" already means the town a person picked in Local.)

import type { ComponentProps } from 'react';
import type { MaterialCommunityIcons } from '@expo/vector-icons';

export type SpotKind = 'park' | 'beach' | 'trail' | 'museum' | 'zoo' | 'aquarium' | 'garden' | 'public';
export type SpotGroup = 'park' | 'beach' | 'trail' | 'museum' | 'animals' | 'garden' | 'public';
type McIcon = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type Spot = {
  id: string;
  name: string;
  kind: SpotKind;
  region: 'Oahu' | 'Maui';   // matches CURATED_REGIONS in constants/places.ts
  area: string;              // the town or district
};

export const SPOT_GROUPS: { key: SpotGroup; label: string; icon: McIcon }[] = [
  { key: 'park', label: 'Parks', icon: 'tree' },
  { key: 'beach', label: 'Beaches', icon: 'beach' },
  { key: 'trail', label: 'Trails', icon: 'hiking' },
  { key: 'museum', label: 'Museums', icon: 'bank' },
  { key: 'animals', label: 'Zoo and aquarium', icon: 'fish' },
  { key: 'garden', label: 'Gardens', icon: 'flower' },
  { key: 'public', label: 'Public places', icon: 'city-variant-outline' },
];

export const KIND_LABEL: Record<SpotKind, string> = {
  park: 'Park', beach: 'Beach', trail: 'Trail', museum: 'Museum', zoo: 'Zoo', aquarium: 'Aquarium', garden: 'Garden', public: 'Public place',
};
export const KIND_ICON: Record<SpotKind, McIcon> = {
  park: 'tree', beach: 'beach', trail: 'hiking', museum: 'bank', zoo: 'paw', aquarium: 'fish', garden: 'flower', public: 'city-variant-outline',
};
export const groupOf = (k: SpotKind): SpotGroup => (k === 'zoo' || k === 'aquarium' ? 'animals' : k);

const s = (id: string, name: string, kind: SpotKind, region: Spot['region'], area: string): Spot => ({ id, name, kind, region, area });

export const SPOTS: Spot[] = [
  // Oahu
  s('oa-zoo', 'Honolulu Zoo', 'zoo', 'Oahu', 'Waikīkī'),
  s('oa-aquarium', 'Waikīkī Aquarium', 'aquarium', 'Oahu', 'Waikīkī'),
  s('oa-bishop', 'Bishop Museum', 'museum', 'Oahu', 'Kalihi'),
  s('oa-moa', 'Honolulu Museum of Art', 'museum', 'Oahu', 'Honolulu'),
  s('oa-iolani', 'ʻIolani Palace', 'public', 'Oahu', 'Honolulu'),
  s('oa-pearl', 'Pearl Harbor National Memorial', 'public', 'Oahu', 'Pearl Harbor'),
  s('oa-foster', 'Foster Botanical Garden', 'garden', 'Oahu', 'Honolulu'),
  s('oa-lyon', 'Lyon Arboretum', 'garden', 'Oahu', 'Mānoa'),
  s('oa-hoomaluhia', 'Hoʻomaluhia Botanical Garden', 'garden', 'Oahu', 'Kāneʻohe'),
  s('oa-waimea', 'Waimea Valley', 'garden', 'Oahu', 'Haleʻiwa'),
  s('oa-kapiolani', 'Kapiʻolani Park', 'park', 'Oahu', 'Waikīkī'),
  s('oa-alamoana', 'Ala Moana Beach Park', 'beach', 'Oahu', 'Honolulu'),
  s('oa-kuhio', 'Kūhiō Beach Park', 'beach', 'Oahu', 'Waikīkī'),
  s('oa-kailua', 'Kailua Beach Park', 'beach', 'Oahu', 'Kailua'),
  s('oa-diamondhead', 'Diamond Head (Lēʻahi) State Monument', 'trail', 'Oahu', 'Honolulu'),
  s('oa-manoafalls', 'Mānoa Falls Trail', 'trail', 'Oahu', 'Mānoa'),
  s('oa-makapuu', 'Makapuʻu Point Lighthouse Trail', 'trail', 'Oahu', 'Waimānalo'),
  // Maui
  s('mu-ocean', 'Maui Ocean Center', 'aquarium', 'Maui', 'Māʻalaea'),
  s('mu-haleakala', 'Haleakalā National Park', 'park', 'Maui', 'Haleakalā'),
  s('mu-iao', 'ʻĪao Valley State Monument', 'park', 'Maui', 'Wailuku'),
  s('mu-kepaniwai', 'Kepaniwai Park', 'park', 'Maui', 'Wailuku'),
  s('mu-kalama', 'Kalama Park', 'park', 'Maui', 'Kīhei'),
  s('mu-mnbg', 'Maui Nui Botanical Gardens', 'garden', 'Maui', 'Kahului'),
  s('mu-kula', 'Kula Botanical Garden', 'garden', 'Maui', 'Kula'),
  s('mu-kaanapali', 'Kāʻanapali Beach', 'beach', 'Maui', 'Kāʻanapali'),
  s('mu-baldwin', 'Baldwin Beach Park', 'beach', 'Maui', 'Pāʻia'),
  s('mu-hookipa', 'Hoʻokipa Beach Park', 'beach', 'Maui', 'Pāʻia'),
  s('mu-kanaha', 'Kanaha Beach Park', 'beach', 'Maui', 'Kahului'),
  s('mu-kamaole', 'Kamaʻole Beach Park III', 'beach', 'Maui', 'Kīhei'),
  s('mu-waihee', 'Waiheʻe Ridge Trail', 'trail', 'Maui', 'Waiheʻe'),
  s('mu-wailea', 'Wailea Beach Path', 'trail', 'Maui', 'Wailea'),
  s('mu-macc', 'Maui Arts and Cultural Center', 'public', 'Maui', 'Kahului'),
];
