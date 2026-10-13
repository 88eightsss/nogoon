// ─── Pack format v1 ───────────────────────────────────────────────────────────
//
// A pack is DATA. The app has fixed renderers (components/page/*); a pack only
// fills in values: colors, border shape, which frame the companion lives in, how
// the gate looks. Packs never carry code. Anything unknown fails validation and
// the app falls back to the Core pack. See project doc claude/nogoon-packs-spec.md.

import type { BorderId } from '@/constants/Themes';

export type HabitatFrame = 'box' | 'egg' | 'window';
export type CounterLook  = 'plain' | 'tiles' | 'visitor';
export type StampLook    = 'chip' | 'hanko' | 'badge';
export type GateStyle    = 'plain' | 'shrine' | 'dialog';

// Key colors for one brightness anchor. The rest of a ThemePalette is derived
// (constants/packs/theme.ts) and the contrast guard in Themes.ts still runs.
export type PackColors = {
  background:    string;
  surface:       string;
  surfaceHigh:   string;
  accent:        string;
  accentBright:  string;
  text:          string;
  textSecondary: string;
  textMuted:     string;
  protect?:      string;
  calm?:         string;
  arcade?:       string;
  me?:           string;
};

// Colors the page components use for the pack's own artwork. Every value is #RRGGBB.
export type PackLook = {
  shell?:      string;  // egg body
  bezel?:      string;  // egg screen surround
  lcdBg?:      string;  // LCD / counter screen background
  lcdInk?:     string;  // LCD / counter ink
  mark?:       string;  // stamp / seal ink
  wood?:       string;  // ema plaque
  woodInk?:    string;
  winBg?:      string;  // window chrome
  winTitle?:   string;
  winTitleText?: string;
  pane?:       string;  // window content pane
  hi?:         string;  // bevel highlight
  lo?:         string;  // bevel shadow
};

export type PackUnlock = {
  code?:   string;   // redeem code (case-insensitive)
  streak?: number;   // unlocks when longest streak reaches this many days
  tap?:    boolean;  // secret gesture on My Page
};

export interface PackManifest {
  format:   1;
  id:       string;
  name:     string;
  tagline:  string;
  version:  number;
  hidden:   boolean;        // hidden packs are not listed until unlocked
  unlock?:  PackUnlock;     // absent = always available
  parts: {
    theme?: { nativeMode: 'dark' | 'light'; dark: PackColors; light: PackColors };
    shape?: { borderId: BorderId };
    page: {
      frame:    HabitatFrame;
      counter:  CounterLook;
      stamps:   StampLook;
      gate:     GateStyle;
      marquee?: string;
      look:     PackLook;
    };
  };
}
