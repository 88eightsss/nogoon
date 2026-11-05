// ─── Tiny QR code encoder (byte mode, error correction M, versions 1 to 10) ─────────────────
//
// No dependency. Enough for a web link up to 213 bytes, which covers a normal https address.
// Returns a square matrix of booleans (true = dark module). Quiet zone is the caller's job (4 modules).
// Checked against a QR decoder (OpenCV) for a range of lengths and versions when it was written.

const EXP: number[] = new Array(512);
const LOG: number[] = new Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x; LOG[x] = i;
    x <<= 1; if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const gmul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function rsGenerator(deg: number): number[] {
  let poly = [1];
  for (let i = 0; i < deg; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gmul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function rsRemainder(data: number[], ecLen: number): number[] {
  const gen = rsGenerator(ecLen);
  const rem = new Array(ecLen).fill(0);
  for (const b of data) {
    const factor = b ^ rem[0];
    rem.shift(); rem.push(0);
    for (let i = 0; i < ecLen; i++) rem[i] ^= gmul(gen[i + 1], factor);
  }
  return rem;
}

// Level M: [ecCodewordsPerBlock, [[blockCount, dataCodewordsPerBlock], ...]]
const M_TABLE: Record<number, [number, [number, number][]]> = {
  1: [10, [[1, 16]]],
  2: [16, [[1, 28]]],
  3: [26, [[1, 44]]],
  4: [18, [[2, 32]]],
  5: [24, [[2, 43]]],
  6: [16, [[4, 27]]],
  7: [18, [[4, 31]]],
  8: [22, [[2, 38], [2, 39]]],
  9: [22, [[3, 36], [2, 37]]],
  10: [26, [[4, 43], [1, 44]]],
};
const ALIGN: Record<number, number[]> = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

export const QR_MAX_BYTES = 213;

function dataCapacity(v: number): number {
  return M_TABLE[v][1].reduce((s, [n, d]) => s + n * d, 0);
}

function utf8(s: string): number[] {
  const out: number[] = [];
  for (const ch of unescape(encodeURIComponent(s))) out.push(ch.charCodeAt(0));
  return out;
}

function bchFormat(data5: number): number {
  let v = data5 << 10;
  for (let i = 4; i >= 0; i--) if (v & (1 << (i + 10))) v ^= 0x537 << i;
  return ((data5 << 10) | v) ^ 0x5412;
}
function bchVersion(ver: number): number {
  let v = ver << 12;
  for (let i = 5; i >= 0; i--) if (v & (1 << (i + 12))) v ^= 0x1f25 << i;
  return (ver << 12) | v;
}

export function encodeQR(text: string): boolean[][] {
  const bytes = utf8(text);
  let version = 0;
  for (let v = 1; v <= 10; v++) {
    const headerBits = 4 + (v <= 9 ? 8 : 16);
    if (Math.ceil((headerBits + bytes.length * 8) / 8) <= dataCapacity(v)) { version = v; break; }
  }
  if (!version) throw new Error('Link is too long for the code');

  // ── bit stream
  const bits: number[] = [];
  const put = (val: number, len: number) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(0b0100, 4);
  put(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  const cap = dataCapacity(version) * 8;
  put(0, Math.min(4, cap - bits.length));
  while (bits.length % 8) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    data.push(b);
  }
  for (let pad = 0xec; data.length < dataCapacity(version); pad ^= 0xec ^ 0x11) data.push(pad);

  // ── blocks + error correction, interleaved
  const [ecLen, groups] = M_TABLE[version];
  const blocks: { d: number[]; e: number[] }[] = [];
  let pos = 0;
  for (const [count, size] of groups) {
    for (let i = 0; i < count; i++) {
      const d = data.slice(pos, pos + size); pos += size;
      blocks.push({ d, e: rsRemainder(d, ecLen) });
    }
  }
  const maxD = Math.max(...blocks.map((b) => b.d.length));
  const out: number[] = [];
  for (let i = 0; i < maxD; i++) for (const b of blocks) if (i < b.d.length) out.push(b.d[i]);
  for (let i = 0; i < ecLen; i++) for (const b of blocks) out.push(b.e[i]);

  // ── matrix
  const n = 17 + 4 * version;
  const m: (boolean | null)[][] = Array.from({ length: n }, () => new Array(n).fill(null));
  const reserved: boolean[][] = Array.from({ length: n }, () => new Array(n).fill(false));
  const set = (r: number, c: number, dark: boolean) => { if (r >= 0 && r < n && c >= 0 && c < n) { m[r][c] = dark; reserved[r][c] = true; } };

  const finder = (r0: number, c0: number) => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const inside = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      const dark = inside && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
      set(r0 + r, c0 + c, dark);
    }
  };
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0);

  const al = ALIGN[version];
  for (const r of al) for (const c of al) {
    if ((r === 6 && c === 6) || (r === 6 && c === al[al.length - 1]) || (r === al[al.length - 1] && c === 6)) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }
  }
  for (let i = 8; i < n - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  set(n - 8, 8, true);                       // dark module
  // reserve format areas
  for (let i = 0; i < 9; i++) { if (!reserved[8][i]) { m[8][i] = false; reserved[8][i] = true; } if (!reserved[i][8]) { m[i][8] = false; reserved[i][8] = true; } }
  for (let i = 0; i < 8; i++) { if (!reserved[8][n - 1 - i]) { m[8][n - 1 - i] = false; reserved[8][n - 1 - i] = true; } if (!reserved[n - 1 - i][8]) { m[n - 1 - i][8] = false; reserved[n - 1 - i][8] = true; } }
  // version info
  if (version >= 7) {
    const info = bchVersion(version);
    for (let i = 0; i < 18; i++) {
      const dark = ((info >> i) & 1) === 1;
      const a = Math.floor(i / 3), b = (i % 3) + n - 11;
      set(a, b, dark); set(b, a, dark);
    }
  }

  // data placement (zigzag)
  const bitsOut: number[] = [];
  for (const b of out) for (let i = 7; i >= 0; i--) bitsOut.push((b >> i) & 1);
  const place = (mask: number): boolean[][] => {
    const g = m.map((row) => row.slice()) as (boolean | null)[][];
    let k = 0;
    let up = true;
    for (let col = n - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (let i = 0; i < n; i++) {
        const r = up ? n - 1 - i : i;
        for (let dc = 0; dc < 2; dc++) {
          const c = col - dc;
          if (reserved[r][c]) continue;
          let dark = k < bitsOut.length ? bitsOut[k] === 1 : false;
          k++;
          const flip =
            mask === 0 ? (r + c) % 2 === 0 :
            mask === 1 ? r % 2 === 0 :
            mask === 2 ? c % 3 === 0 :
            mask === 3 ? (r + c) % 3 === 0 :
            mask === 4 ? (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0 :
            mask === 5 ? ((r * c) % 2) + ((r * c) % 3) === 0 :
            mask === 6 ? (((r * c) % 2) + ((r * c) % 3)) % 2 === 0 :
                         (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
          if (flip) dark = !dark;
          g[r][c] = dark;
        }
      }
      up = !up;
    }
    // format bits: level M = 00
    const fmt = bchFormat((0b00 << 3) | mask);
    for (let i = 0; i < 15; i++) {
      const dark = ((fmt >> i) & 1) === 1;
      // around top-left finder
      if (i < 6) g[i][8] = dark; else if (i < 8) g[i + 1][8] = dark; else if (i === 8) g[8][7] = dark; else g[8][14 - i] = dark;
      // split between top-right and bottom-left
      if (i < 8) g[8][n - 1 - i] = dark; else g[n - 15 + i][8] = dark;
    }
    return g.map((row) => row.map((v) => v === true));
  };

  const penalty = (g: boolean[][]): number => {
    let p = 0;
    for (let r = 0; r < n; r++) {
      let run = 1;
      for (let c = 1; c < n; c++) { if (g[r][c] === g[r][c - 1]) { run++; if (c === n - 1 && run >= 5) p += run - 2; } else { if (run >= 5) p += run - 2; run = 1; } }
    }
    for (let c = 0; c < n; c++) {
      let run = 1;
      for (let r = 1; r < n; r++) { if (g[r][c] === g[r - 1][c]) { run++; if (r === n - 1 && run >= 5) p += run - 2; } else { if (run >= 5) p += run - 2; run = 1; } }
    }
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
      const v = g[r][c]; if (v === g[r][c + 1] && v === g[r + 1][c] && v === g[r + 1][c + 1]) p += 3;
    }
    const pat1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], pat2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    const match = (get: (i: number) => boolean, pat: number[]) => pat.every((v, i) => (get(i) ? 1 : 0) === v);
    for (let r = 0; r < n; r++) for (let c = 0; c <= n - 11; c++) {
      if (match((i) => g[r][c + i], pat1)) p += 40;
      if (match((i) => g[r][c + i], pat2)) p += 40;
    }
    for (let c = 0; c < n; c++) for (let r = 0; r <= n - 11; r++) {
      if (match((i) => g[r + i][c], pat1)) p += 40;
      if (match((i) => g[r + i][c], pat2)) p += 40;
    }
    let dark = 0; for (const row of g) for (const v of row) if (v) dark++;
    p += Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5) * 10;
    return p;
  };

  let best: boolean[][] | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const g = place(mask);
    const s = penalty(g);
    if (s < bestScore) { bestScore = s; best = g; }
  }
  return best as boolean[][];
}

/** True when a link can be turned into a code (short enough). */
export function fitsInQR(text: string): boolean {
  try { return utf8(text).length <= QR_MAX_BYTES; } catch { return false; }
}
