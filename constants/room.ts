// ─── The room ─────────────────────────────────────────────────────────────────
//
// Today can be drawn as one small pixel room instead of a plain page. Same five tabs, but
// each is an object you can touch: the window (Briefing), the door (Protect), the corkboard
// (The Wall), the bed (Unwind), the dresser (Me). The companion stands on the rug.
//
// The room is drawn on a 90 x 100 grid of units. This file holds the palettes and the list
// of rectangles; components/page/RoomScene.tsx draws them. Nothing here reads app state.

export const ROOM_W = 90;
export const ROOM_H = 100;

export type RoomLevel = 0 | 1 | 2;
export type RoomPalette = {
  wall: string; wallLo: string; floor: string; floorLn: string; sky: [string, string, string]; sun: string;
  rugB: string; rugF: string; lamp: string; glow: string; frame: string; cork: string; corkF: string;
  curtain: string; door: string; doorD: string; dresser: string; dresserD: string; blanket: string; bedF: string;
  ink: string; boxInk: string; stars: boolean; lcdBg: string; lcdInk: string;
};

export const ROOM_DAY: RoomPalette = {
  wall: '#CFE6FF', wallLo: '#B5D3F0', floor: '#EBCB9E', floorLn: '#D9B27C', sky: ['#8FCBFF', '#B6DDFF', '#FFE9A8'], sun: '#FFC21A',
  rugB: '#FF8FA3', rugF: '#FFD3DA', lamp: '#1FD07A', glow: '#B6F5D2', frame: '#FFFFFF', cork: '#D9A566', corkF: '#8B5A2B',
  curtain: '#FF9FAE', door: '#1B62C2', doorD: '#14478F', dresser: '#9B6BD8', dresserD: '#7A3FD1', blanket: '#0FA68A', bedF: '#7A3FD1',
  ink: '#12233D', boxInk: '#12233D', stars: false, lcdBg: '#06140C', lcdInk: '#33FF66',
};
export const ROOM_NIGHT: RoomPalette = {
  wall: '#2B3866', wallLo: '#202B52', floor: '#5D4C7D', floorLn: '#4B3C69', sky: ['#0B1230', '#142048', '#1D2B5E'], sun: '#FFF3C4',
  rugB: '#B45B8A', rugF: '#D88BB0', lamp: '#FFC21A', glow: '#FFE9A8', frame: '#C9D6F5', cork: '#9C7440', corkF: '#5E3C18',
  curtain: '#7A4A8C', door: '#2F5BB0', doorD: '#223F7D', dresser: '#6C4DA8', dresserD: '#4E3585', blanket: '#0C8A74', bedF: '#5B3399',
  ink: '#0A1022', boxInk: '#05080F', stars: true, lcdBg: '#0A0F20', lcdInk: '#FFD76A',
};


// ─── Make it yours ────────────────────────────────────────────────────────────
//
// Colours for six parts of the room, and four pieces of decor you can switch off. The first
// swatch of each part is the default and uses the hand-tuned day and night palettes above.
// Any other swatch gets a night version by mixing it toward the night sky.

export type LookPart = 'wall' | 'floor' | 'rug' | 'door' | 'furniture' | 'blanket';
export type Swatch = { key: string; name: string; a: string; b: string };   // a = main colour, b = shade or trim

export const ROOM_SWATCHES: Record<LookPart, Swatch[]> = {
  wall: [
    { key: 'sky',    name: 'Sky',    a: '#CFE6FF', b: '#B5D3F0' },
    { key: 'mint',   name: 'Mint',   a: '#D5F2E3', b: '#B7E0CB' },
    { key: 'peach',  name: 'Peach',  a: '#FFE3D1', b: '#F5C9AE' },
    { key: 'lilac',  name: 'Lilac',  a: '#E6DDFB', b: '#CFC1F2' },
    { key: 'butter', name: 'Butter', a: '#FFF3C4', b: '#F0DE95' },
    { key: 'slate',  name: 'Slate',  a: '#C9D3E3', b: '#AEBBD1' },
  ],
  floor: [
    { key: 'oak',    name: 'Oak',    a: '#EBCB9E', b: '#D9B27C' },
    { key: 'pine',   name: 'Pine',   a: '#F2DDB3', b: '#E0C48F' },
    { key: 'walnut', name: 'Walnut', a: '#B98A62', b: '#9C7048' },
    { key: 'grey',   name: 'Grey',   a: '#CBD2DB', b: '#B3BCC8' },
    { key: 'sage',   name: 'Sage',   a: '#C8D6B5', b: '#AEC09A' },
  ],
  rug: [
    { key: 'pink',   name: 'Pink',   a: '#FF8FA3', b: '#FFD3DA' },
    { key: 'teal',   name: 'Teal',   a: '#0FA68A', b: '#7ED9C6' },
    { key: 'sun',    name: 'Sun',    a: '#E6A800', b: '#FFE08A' },
    { key: 'blue',   name: 'Blue',   a: '#1B62C2', b: '#8FB8EE' },
    { key: 'purple', name: 'Purple', a: '#7A3FD1', b: '#C5A6F0' },
  ],
  door: [
    { key: 'blue',   name: 'Blue',   a: '#1B62C2', b: '#14478F' },
    { key: 'green',  name: 'Green',  a: '#0B7A44', b: '#085C33' },
    { key: 'red',    name: 'Red',    a: '#C53030', b: '#8E2020' },
    { key: 'purple', name: 'Purple', a: '#7A3FD1', b: '#5A2BA0' },
    { key: 'ink',    name: 'Ink',    a: '#2D3748', b: '#1A202C' },
    { key: 'teal',   name: 'Teal',   a: '#0FA68A', b: '#0A7A66' },
  ],
  furniture: [
    { key: 'violet', name: 'Violet', a: '#9B6BD8', b: '#7A3FD1' },
    { key: 'wood',   name: 'Wood',   a: '#B98A62', b: '#8B5E3C' },
    { key: 'white',  name: 'White',  a: '#F3F4F6', b: '#CBD5E1' },
    { key: 'green',  name: 'Green',  a: '#4CAF7A', b: '#2F8F5B' },
    { key: 'blue',   name: 'Blue',   a: '#5B8DEF', b: '#3A66C4' },
  ],
  blanket: [
    { key: 'teal',   name: 'Teal',   a: '#0FA68A', b: '#0FA68A' },
    { key: 'coral',  name: 'Coral',  a: '#FF6F61', b: '#FF6F61' },
    { key: 'sun',    name: 'Sun',    a: '#FFC21A', b: '#FFC21A' },
    { key: 'lilac',  name: 'Lilac',  a: '#9B6BD8', b: '#9B6BD8' },
    { key: 'navy',   name: 'Navy',   a: '#2F5BB0', b: '#2F5BB0' },
  ],
};
export const LOOK_PARTS: { part: LookPart; label: string }[] = [
  { part: 'wall', label: 'Walls' }, { part: 'floor', label: 'Floor' }, { part: 'rug', label: 'Rug' },
  { part: 'door', label: 'Door' }, { part: 'furniture', label: 'Furniture' }, { part: 'blanket', label: 'Blanket' },
];
export type RoomLook = Record<LookPart, string>;
export const DEFAULT_LOOK: RoomLook = { wall: 'sky', floor: 'oak', rug: 'pink', door: 'blue', furniture: 'violet', blanket: 'teal' };

export type DecorKey = 'rug' | 'curtains' | 'plants' | 'lights' | 'trophies';
export type RoomDecor = Record<DecorKey, boolean>;
export const DEFAULT_DECOR: RoomDecor = { rug: true, curtains: true, plants: true, lights: true, trophies: true };
/** Lifetime walk-aways needed before a piece of decor appears (matches the room levels). */
export const DECOR_UNLOCK: Record<DecorKey, { level: RoomLevel; at: number; label: string }> = {
  rug:      { level: 1, at: 5,  label: 'Rug' },
  curtains: { level: 1, at: 5,  label: 'Curtains' },
  plants:   { level: 1, at: 5,  label: 'Plants' },
  lights:   { level: 2, at: 60, label: 'String lights' },
  trophies: { level: 2, at: 60, label: 'Trophy shelf' },
};

const mixHex = (a: string, b: string, t: number): string => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return '#' + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0');
};

/** The palette for a look. Defaults use the hand-tuned palettes; other colours are mixed for night. */
export function buildPalette(look: RoomLook, night: boolean): RoomPalette {
  const base = night ? ROOM_NIGHT : ROOM_DAY;
  const pick = (part: LookPart): Swatch | null => {
    const sw = ROOM_SWATCHES[part].find((x) => x.key === look[part]) ?? ROOM_SWATCHES[part][0];
    return sw.key === ROOM_SWATCHES[part][0].key ? null : sw;
  };
  const tone = (c: string) => (night ? mixHex(c, '#0B1230', 0.5) : c);
  const p: RoomPalette = { ...base };
  const w = pick('wall');      if (w) { p.wall = tone(w.a); p.wallLo = tone(w.b); }
  const f = pick('floor');     if (f) { p.floor = tone(f.a); p.floorLn = tone(f.b); }
  const r = pick('rug');       if (r) { p.rugB = tone(r.a); p.rugF = tone(r.b); }
  const d = pick('door');      if (d) { p.door = tone(d.a); p.doorD = tone(d.b); }
  const m = pick('furniture'); if (m) { p.dresser = tone(m.a); p.dresserD = tone(m.b); p.bedF = tone(m.b); }
  const b = pick('blanket');   if (b) { p.blanket = tone(b.a); }
  return p;
}

/** Room level from lifetime walk-aways. It only ever goes up, so a slip never shrinks the room. */
export function roomLevel(walkAways: number): RoomLevel {
  return walkAways >= 60 ? 2 : walkAways >= 5 ? 1 : 0;
}

export type RoomRect = { x: number; y: number; w: number; h: number; c: string; o?: number };

/** Where the touchable objects are, in room units. */
export const ROOM_HOTSPOTS = {
  door:   { x: 4,  y: 6,  w: 22, h: 58 },
  window: { x: 28, y: 6,  w: 34, h: 30 },
  board:  { x: 64, y: 8,  w: 22, h: 24 },
  bed:    { x: 66, y: 70, w: 22, h: 22 },
  dresser:{ x: 4,  y: 64, w: 22, h: 28 },
} as const;

export function roomRects(p: RoomPalette, level: RoomLevel, decor: RoomDecor = DEFAULT_DECOR): RoomRect[] {
  const has = (k: DecorKey) => level >= DECOR_UNLOCK[k].level && decor[k];
  const r: RoomRect[] = [];
  const R = (x: number, y: number, w: number, h: number, c: string, o?: number) => { r.push({ x, y, w, h, c, o }); };

  // wall, baseboard, floor
  R(0, 0, 90, 64, p.wall); R(0, 52, 90, 12, p.wallLo); R(0, 60, 90, 4, p.ink, 0.18);
  R(0, 64, 90, 36, p.floor);
  for (const y of [72, 80, 88, 96]) R(0, y, 90, 1, p.floorLn);
  for (const [x, y] of [[20, 64], [52, 72], [10, 80], [70, 80], [36, 88], [80, 88], [24, 96], [60, 96]]) R(x, y, 1, Math.min(8, 100 - y), p.floorLn);

  // string lights
  if (has('lights')) {
    const bulbs = ['#FFC21A', '#FF8FA3', '#7BDC9E', '#9FD3FF'];
    for (let i = 0; i < 90; i += 6) {
      const yy = 2 + ((i / 6) % 2);
      R(i, yy, 5, 1, p.ink, 0.5); R(i + 2, yy + 1, 2, 3, bulbs[(i / 6) % 4]);
    }
  }

  // window
  const sk = p.sky;
  R(32, 6, 26, 26, p.frame); R(34, 8, 22, 8, sk[0]); R(34, 16, 22, 8, sk[1]); R(34, 24, 22, 6, sk[2]);
  if (p.stars) {
    for (const [sx, sy] of [[37, 10], [50, 12], [42, 19], [53, 22], [36, 26]]) R(sx, sy, 1, 1, '#FFFFFF');
    R(48, 12, 5, 5, p.sun); R(51, 12, 3, 4, sk[0]);
  } else {
    R(43, 21, 6, 5, p.sun); R(44, 20, 4, 7, p.sun);
    R(36, 12, 6, 2, '#FFFFFF'); R(38, 11, 4, 1, '#FFFFFF'); R(48, 16, 7, 2, '#FFFFFF');
  }
  R(44, 8, 2, 22, p.frame); R(34, 18, 22, 2, p.frame);
  R(30, 32, 30, 3, '#C79A6B'); R(30, 35, 30, 1, '#8B5A2B', 0.4);
  if (has('curtains')) { R(28, 6, 4, 27, p.curtain); R(58, 6, 4, 27, p.curtain); R(29, 6, 1, 27, '#FFFFFF', 0.25); R(59, 6, 1, 27, '#FFFFFF', 0.25); }
  if (has('plants')) { R(52, 28, 4, 4, '#FF6F61'); R(53, 24, 2, 4, '#1F9D55'); R(51, 25, 2, 2, '#7BDC9E'); R(55, 25, 2, 2, '#7BDC9E'); }
  if (has('plants') && level >= 2) { R(35, 26, 2, 2, '#1F9D55'); R(34, 28, 4, 4, '#FFC21A'); R(37, 27, 2, 2, '#7BDC9E'); }

  // door (Protect): status lamp and padlock
  R(4, 12, 22, 52, p.ink, 0.35); R(5, 13, 20, 51, p.door); R(9, 18, 12, 16, p.doorD); R(9, 38, 12, 21, p.doorD);
  R(20, 42, 2, 2, '#FFC21A'); R(12, 23, 6, 5, '#FFC21A'); R(13, 20, 4, 3, '#FFC21A'); R(14, 21, 2, 2, p.doorD);
  R(10, 5, 10, 4, p.ink, 0.35); R(11, 6, 8, 2, p.lamp); R(9, 4, 12, 6, p.glow, 0.45);

  // corkboard (The Wall)
  R(64, 8, 22, 24, p.corkF); R(66, 10, 18, 20, p.cork);
  const tiles: [number, number, number, number, string][] = level === 0
    ? [[72, 16, 10, 6, '#7A3FD1']]
    : [[67, 11, 8, 4, '#1B62C2'], [76, 11, 6, 4, '#E8503A'], [67, 16, 4, 4, '#0B7A44'], [72, 16, 10, 6, '#7A3FD1'], [67, 21, 5, 7, '#FFC21A'], [73, 23, 9, 5, '#0FA68A']];
  for (const [x, y, w, h, c] of tiles) { R(x, y, w, h, c); R(x, y, w, 1, '#FFFFFF', 0.35); }

  // shelf of trophies
  if (has('trophies')) { R(64, 38, 22, 2, '#8B5A2B'); R(66, 33, 3, 5, '#FFC21A'); R(65, 32, 5, 2, '#FFC21A'); R(72, 34, 4, 4, '#FF6F61'); R(78, 35, 5, 3, '#9FD3FF'); }

  // rug
  if (has('rug')) { R(28, 80, 34, 14, p.rugB); R(30, 82, 30, 10, p.rugF); R(34, 85, 22, 1, p.rugB); R(34, 88, 22, 1, p.rugB); }
  // soft shadow under the companion
  R(37, 86, 16, 2, '#000000', 0.15);

  // bed (Unwind)
  R(66, 84, 22, 3, p.bedF); R(66, 87, 2, 5, p.bedF); R(86, 87, 2, 5, p.bedF); R(84, 70, 4, 17, p.bedF);
  R(66, 78, 19, 6, '#FFFFFF'); R(66, 80, 15, 5, p.blanket); R(66, 80, 15, 1, '#FFFFFF', 0.3); R(77, 74, 7, 5, '#FFFFFF'); R(77, 74, 7, 1, p.ink, 0.1);

  // dresser (Me)
  R(4, 72, 22, 18, p.dresser); R(4, 72, 22, 2, p.dresserD); R(4, 80, 22, 1, p.dresserD); R(4, 85, 22, 1, p.dresserD); R(4, 90, 22, 2, p.ink, 0.35);
  R(13, 76, 4, 1, '#FFC21A'); R(13, 82, 4, 1, '#FFC21A'); R(13, 87, 4, 1, '#FFC21A');
  R(7, 64, 8, 8, '#FFFFFF'); R(8, 65, 6, 6, p.sky[1]); R(10, 67, 2, 2, p.sun);
  if (has('plants') && level >= 2) { R(19, 68, 4, 4, '#1F9D55'); R(18, 71, 6, 3, '#FF6F61'); }
  return r;
}
