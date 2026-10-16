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

/** Where the companion stands: top-left of a 10 x 12 sprite drawn at 2 units per cell. */
export const ROOM_COMPANION = { x: 35, y: 62, cells: 2 } as const;

export function roomRects(p: RoomPalette, level: RoomLevel): RoomRect[] {
  const r: RoomRect[] = [];
  const R = (x: number, y: number, w: number, h: number, c: string, o?: number) => { r.push({ x, y, w, h, c, o }); };

  // wall, baseboard, floor
  R(0, 0, 90, 64, p.wall); R(0, 52, 90, 12, p.wallLo); R(0, 60, 90, 4, p.ink, 0.18);
  R(0, 64, 90, 36, p.floor);
  for (const y of [72, 80, 88, 96]) R(0, y, 90, 1, p.floorLn);
  for (const [x, y] of [[20, 64], [52, 72], [10, 80], [70, 80], [36, 88], [80, 88], [24, 96], [60, 96]]) R(x, y, 1, 8, p.floorLn);

  // string lights
  if (level >= 2) {
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
  if (level >= 1) {
    R(28, 6, 4, 27, p.curtain); R(58, 6, 4, 27, p.curtain); R(29, 6, 1, 27, '#FFFFFF', 0.25); R(59, 6, 1, 27, '#FFFFFF', 0.25);
    R(52, 28, 4, 4, '#FF6F61'); R(53, 24, 2, 4, '#1F9D55'); R(51, 25, 2, 2, '#7BDC9E'); R(55, 25, 2, 2, '#7BDC9E');
  }
  if (level >= 2) { R(35, 26, 2, 2, '#1F9D55'); R(34, 28, 4, 4, '#FFC21A'); R(37, 27, 2, 2, '#7BDC9E'); }

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
  if (level >= 2) { R(64, 38, 22, 2, '#8B5A2B'); R(66, 33, 3, 5, '#FFC21A'); R(65, 32, 5, 2, '#FFC21A'); R(72, 34, 4, 4, '#FF6F61'); R(78, 35, 5, 3, '#9FD3FF'); }

  // rug
  if (level >= 1) { R(28, 80, 34, 14, p.rugB); R(30, 82, 30, 10, p.rugF); R(34, 85, 22, 1, p.rugB); R(34, 88, 22, 1, p.rugB); }
  // soft shadow under the companion
  R(37, 86, 16, 2, '#000000', 0.15);

  // bed (Unwind)
  R(66, 84, 22, 3, p.bedF); R(66, 87, 2, 5, p.bedF); R(86, 87, 2, 5, p.bedF); R(84, 70, 4, 17, p.bedF);
  R(66, 78, 19, 6, '#FFFFFF'); R(66, 80, 15, 5, p.blanket); R(66, 80, 15, 1, '#FFFFFF', 0.3); R(77, 74, 7, 5, '#FFFFFF'); R(77, 74, 7, 1, p.ink, 0.1);

  // dresser (Me)
  R(4, 72, 22, 18, p.dresser); R(4, 72, 22, 2, p.dresserD); R(4, 80, 22, 1, p.dresserD); R(4, 85, 22, 1, p.dresserD); R(4, 90, 22, 2, p.ink, 0.35);
  R(13, 76, 4, 1, '#FFC21A'); R(13, 82, 4, 1, '#FFC21A'); R(13, 87, 4, 1, '#FFC21A');
  R(7, 64, 8, 8, '#FFFFFF'); R(8, 65, 6, 6, p.sky[1]); R(10, 67, 2, 2, p.sun);
  if (level >= 2) { R(19, 68, 4, 4, '#1F9D55'); R(18, 71, 6, 3, '#FF6F61'); }
  return r;
}
