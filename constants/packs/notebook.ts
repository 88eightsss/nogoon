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
  version: 2,
  hidden: false,
  parts: {
    theme: {
      nativeMode: 'light',
      dark: {
        background: '#13203A', surface: '#1B2A47', surfaceHigh: '#243558',
        accent: '#8EC5FF', accentBright: '#BBDDFF',
        text: '#EAF2FF', textSecondary: '#B4C6E4', textMuted: '#8499BD',
      },
      light: {
        background: '#EEF5FF', surface: '#FFFFFF', surfaceHigh: '#FFF9DB',
        accent: '#1B62C2', accentBright: '#3A82E0',
        text: '#12233D', textSecondary: '#24385A', textMuted: '#566F8D',
      },
    },
    shape: { borderId: 'soft' },
    page: {
      frame: 'corner', counter: 'notebook', stamps: 'checklist', gate: 'sticky', paper: 'ruled',
      look: {
        paper: '#FFFFFF', rule: '#CFE0F5', margin: '#FF8A80', ink: '#1B62C2',
        sticky: '#FFE98A', stickyInk: '#4A3F10',
      },
    },
  },
};
