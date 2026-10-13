import type { PackManifest } from './types';

// Notebook: quiet paper, pen-blue ink, a sticky note at the gate. The companion
// shrinks to a small widget you can drag anywhere (frame: 'corner'), so the page
// is calm and the mascot is optional company. Good for people who find a pet
// front-and-center a bit much.
export const NOTEBOOK_PACK: PackManifest = {
  format: 1,
  id: 'notebook',
  name: 'Notebook',
  tagline: 'Quiet paper. Your companion waits in the corner.',
  version: 1,
  hidden: false,
  parts: {
    theme: {
      nativeMode: 'light',
      dark: {
        background: '#1E2321', surface: '#262C29', surfaceHigh: '#2F3733',
        accent: '#9CC7FF', accentBright: '#C5E0FF',
        text: '#ECEFEA', textSecondary: '#B9C2BC', textMuted: '#8A958E',
      },
      light: {
        background: '#F6F1E3', surface: '#FBF8EE', surfaceHigh: '#FFFFFF',
        accent: '#2F4E8F', accentBright: '#4A6DB3',
        text: '#27272F', textSecondary: '#4A4A57', textMuted: '#6B6B7E',
      },
    },
    shape: { borderId: 'soft' },
    page: {
      frame: 'corner', counter: 'notebook', stamps: 'checklist', gate: 'sticky', paper: 'ruled',
      look: {
        paper: '#FBF8EE', rule: '#C9D6EE', margin: '#E39A9A', ink: '#2F4E8F',
        sticky: '#FFE98A', stickyInk: '#4A3F10',
      },
    },
  },
};
