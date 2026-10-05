// ─── Feature flags ────────────────────────────────────────────────────────────
//
// Single source of truth is /features.json at the repo root, which the Expo
// config plugin (plugins/withAppBlocker.js) also reads at prebuild time.
//
// networkShield — the DNS VPN ("Network filter" / NoGoonVpnService).
//   false (first Play release): no VpnService in the manifest, no VPN code in
//   the APK, and every VPN screen/row/mention is hidden.
//   To bring it back: see docs/TODO.md → "Re-enable Network Shield".

import features from '../features.json';

export const NETWORK_SHIELD_ENABLED: boolean = features.networkShield === true;
