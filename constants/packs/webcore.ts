import type { PackManifest } from './types';

// Webcore: Neocities/Geocities-era personal page, modernised: glossy rounded windows,
// bright title bars, a glowing visitor counter, 88x31-style badges and a marquee.
export const WEBCORE_PACK: PackManifest = {
  format: 1,
  id: 'webcore',
  name: 'Webcore',
  tagline: 'Your early-2000s homepage, glossed up',
  version: 3,
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
        background: '#CFE3FB', surface: '#EEF5FE', surfaceHigh: '#FFFFFF',
        accent: '#2457D6', accentBright: '#4B7BEA',
        text: '#0F1730', textSecondary: '#2B3556', textMuted: '#4A5678',
      },
    },
    shape: { borderId: 'soft' },
    page: {
      frame: 'window', counter: 'visitor', stamps: 'badge', gate: 'dialog',
      marquee: '★ welcome to my page ★ you are doing great ★ no goon zone ★',
      look: {
        winBg: '#DCEAFC', winTitle: '#2457D6', winTitleText: '#FFFFFF', pane: '#12A98E',
        lcdBg: '#0B1226', lcdInk: '#4DFFA6', hi: '#FFFFFF', lo: '#6F86B0', mark: '#2457D6',
      },
    },
  },
};
