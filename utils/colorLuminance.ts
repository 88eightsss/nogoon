// Relative-luminance check for hex colors (#RGB / #RRGGBB). Used to pick a
// readable status-bar icon style for the active theme background.
export function isLightColor(hex: string): boolean {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length < 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return false;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
}

// ── Readable-on-background helper ───────────────────────────────────────────
// Several widgets use a fixed identity hue (sky blue, amber, lavender…) for
// small text and icons. Those hues were picked on a dark ground, so on the
// light themes they wash out. `readableOn` keeps the hue but nudges its
// lightness until it meets WCAG contrast against whatever surface it sits on,
// so the same call works on every theme and brightness setting.

function parseHex(hex: string): [number, number, number] | null {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length < 6) return null;
  const rgb: [number, number, number] = [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
  return rgb.some(Number.isNaN) ? null : rgb;
}

function relLuminance([r, g, b]: [number, number, number]): number {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(a: string, b: string): number {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return 21;
  const [hi, lo] = [relLuminance(ca), relLuminance(cb)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const toHex = (rgb: number[]) =>
  '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

/** `color` adjusted (toward black on light grounds, white on dark) to reach `minRatio` on `background`. */
export function readableOn(color: string, background: string, minRatio = 3.5): string {
  const c = parseHex(color);
  const bg = parseHex(background);
  if (!c || !bg) return color;
  if (contrastRatio(color, background) >= minRatio) return color;
  const target = relLuminance(bg) > 0.4 ? 0 : 255;
  for (let t = 0.1; t <= 1.0001; t += 0.1) {
    const mixed = toHex(c.map((v) => v + (target - v) * t));
    if (contrastRatio(mixed, background) >= minRatio) return mixed;
  }
  return toHex([target, target, target]);
}
