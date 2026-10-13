import type { PackManifest } from './types';

// Core = what the app already looks like. No theme/shape part, so the user's own
// theme, brightness and border choices keep applying.
export const CORE_PACK: PackManifest = {
  format: 1,
  id: 'core',
  name: 'Core',
  tagline: 'Your own theme and borders',
  version: 1,
  hidden: false,
  parts: {
    page: {
      frame: 'box', counter: 'plain', stamps: 'chip', gate: 'plain',
      look: { mark: '#7c6aed', lcdBg: '#0F1D0F', lcdInk: '#7CCA80' },
    },
  },
};
