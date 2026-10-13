import type { PackManifest } from './types';

// Webcore: Neocities/Geocities-era personal page. Silver bevelled windows, navy
// title bars, a visitor counter, 88x31-style badges and a marquee.
export const WEBCORE_PACK: PackManifest = {
  format: 1,
  id: 'webcore',
  name: 'Webcore',
  tagline: 'Your own early-2000s homepage',
  version: 1,
  hidden: false,
  parts: {
    theme: {
      nativeMode: 'light',
      dark: {
        background: '#0A0A2A', surface: '#1B1B3F', surfaceHigh: '#2A2A5A',
        accent: '#33FF99', accentBright: '#8CFFC4',
        text: '#F2F2FF', textSecondary: '#B8B8E0', textMuted: '#8A8AC0',
        protect: '#33FFE0', calm: '#FFB366', arcade: '#C79BFF', me: '#66C2FF',
      },
      light: {
        background: '#C0C0C0', surface: '#DFDFDF', surfaceHigh: '#FFFFFF',
        accent: '#000080', accentBright: '#1A1AA6',
        text: '#111111', textSecondary: '#33334D', textMuted: '#55556B',
      },
    },
    shape: { borderId: 'sharp' },
    page: {
      frame: 'window', counter: 'visitor', stamps: 'badge', gate: 'dialog',
      marquee: '*** welcome to my page *** you are doing great *** no goon zone ***',
      look: {
        winBg: '#C0C0C0', winTitle: '#000080', winTitleText: '#FFFFFF', pane: '#008080',
        lcdBg: '#000000', lcdInk: '#33FF66', hi: '#FFFFFF', lo: '#808080', mark: '#000080',
      },
    },
  },
};
