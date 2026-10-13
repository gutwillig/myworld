/**
 * Axial hex math for flat-top hexes of radius HEX_SIZE.
 * Pure functions, no rendering dependencies.
 */
export type Hex = { q: number; r: number };

export const HEX_SIZE = 1;
const SQRT3 = Math.sqrt(3);

export const HEX_DIRECTIONS: readonly Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export const hexKey = (h: Hex): string => `${h.q},${h.r}`;

export const hexEquals = (a: Hex, b: Hex): boolean => a.q === b.q && a.r === b.r;

export const hexAdd = (a: Hex, b: Hex): Hex => ({ q: a.q + b.q, r: a.r + b.r });

export const hexScale = (a: Hex, k: number): Hex => ({ q: a.q * k, r: a.r * k });

export function hexDistance(a: Hex, b: Hex): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

export function hexNeighbors(h: Hex): Hex[] {
  return HEX_DIRECTIONS.map((d) => hexAdd(h, d));
}

/** Rounds fractional axial coordinates to the nearest hex (cube rounding). */
export function hexRound(q: number, r: number): Hex {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return { q: rq + 0, r: rr + 0 };
}

/** Straight-line hex walk from a to b, inclusive of both ends. */
export function hexLine(a: Hex, b: Hex): Hex[] {
  const n = hexDistance(a, b);
  if (n === 0) return [{ ...a }];
  const out: Hex[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push(hexRound(a.q + (b.q - a.q) * t + 1e-6, a.r + (b.r - a.r) * t + 1e-6));
  }
  return out;
}

/** Hexes at exactly `radius` from center, walked in order around the ring. */
export function hexRing(center: Hex, radius: number): Hex[] {
  if (radius === 0) return [{ ...center }];
  const out: Hex[] = [];
  let h = hexAdd(center, hexScale(HEX_DIRECTIONS[4], radius));
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < radius; j++) {
      out.push(h);
      h = hexAdd(h, HEX_DIRECTIONS[i]);
    }
  }
  return out;
}

export function hexesWithin(center: Hex, radius: number): Hex[] {
  const out: Hex[] = [];
  for (let k = 0; k <= radius; k++) out.push(...hexRing(center, k));
  return out;
}

export type Point2 = { x: number; z: number };

export function hexToWorld(h: Hex): Point2 {
  return { x: 1.5 * h.q * HEX_SIZE, z: SQRT3 * (h.r + h.q / 2) * HEX_SIZE };
}

export function worldToHex(x: number, z: number): Hex {
  const q = ((2 / 3) * x) / HEX_SIZE;
  const r = ((-1 / 3) * x + (SQRT3 / 3) * z) / HEX_SIZE;
  return hexRound(q, r);
}
