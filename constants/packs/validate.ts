// Hand-written validator for pack manifests (no schema lib installed). Anything that
// does not match returns null and the caller falls back to the Core pack.

import type { PackManifest } from './types';

const HEX = /^#[0-9a-fA-F]{6}$/;
const FRAMES  = ['box', 'egg', 'window'];
const COUNTERS = ['plain', 'tiles', 'visitor'];
const STAMPS  = ['chip', 'hanko', 'badge'];
const GATES   = ['plain', 'shrine', 'dialog'];
const BORDERS = ['none', 'sharp', 'soft', 'pixel', 'glow', 'laced'];
const COLOR_KEYS = ['background', 'surface', 'surfaceHigh', 'accent', 'accentBright', 'text', 'textSecondary', 'textMuted'];
const OPT_COLOR_KEYS = ['protect', 'calm', 'arcade', 'me'];

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, max: number) => typeof v === 'string' && v.length > 0 && v.length <= max;

function colorsOk(c: unknown): boolean {
  if (!isObj(c)) return false;
  if (!COLOR_KEYS.every((k) => typeof c[k] === 'string' && HEX.test(c[k]))) return false;
  return OPT_COLOR_KEYS.every((k) => c[k] === undefined || (typeof c[k] === 'string' && HEX.test(c[k])));
}

export function validatePack(input: unknown): PackManifest | null {
  if (!isObj(input) || input.format !== 1) return null;
  if (!str(input.id, 32) || !/^[a-z0-9-]+$/.test(input.id)) return null;
  if (!str(input.name, 24) || !str(input.tagline, 80)) return null;
  if (typeof input.version !== 'number' || typeof input.hidden !== 'boolean') return null;
  if (input.unlock !== undefined) {
    const u = input.unlock;
    if (!isObj(u)) return null;
    if (u.code !== undefined && !str(u.code, 24)) return null;
    if (u.streak !== undefined && (typeof u.streak !== 'number' || u.streak < 1 || u.streak > 3650)) return null;
  }
  const parts = input.parts;
  if (!isObj(parts) || !isObj(parts.page)) return null;
  const p = parts.page;
  if (!FRAMES.includes(p.frame) || !COUNTERS.includes(p.counter) || !STAMPS.includes(p.stamps) || !GATES.includes(p.gate)) return null;
  if (p.marquee !== undefined && !str(p.marquee, 120)) return null;
  if (!isObj(p.look)) return null;
  if (!Object.values(p.look).every((v) => typeof v === 'string' && HEX.test(v))) return null;
  if (parts.theme !== undefined) {
    const t = parts.theme;
    if (!isObj(t) || (t.nativeMode !== 'dark' && t.nativeMode !== 'light')) return null;
    if (!colorsOk(t.dark) || !colorsOk(t.light)) return null;
  }
  if (parts.shape !== undefined && !(isObj(parts.shape) && BORDERS.includes(parts.shape.borderId))) return null;
  return input as unknown as PackManifest;
}
