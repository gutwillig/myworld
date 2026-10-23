import { WORLD_RADIUS } from "@/grid/layout";
import { HEX_SIZE } from "@/grid/hex";

/** Mulberry32 PRNG seeded from a string, so decoration never jumps on reload. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const BOUNDARY_SAMPLES = 96;

/**
 * Irregular island outline derived from the radius-6 hex disk: the big hexagon of hex centers,
 * padded by one hex, with ~20% noise per vertex and then smoothed so no hex edge shows.
 */
export function boundaryRadii(seed: string): number[] {
  const rand = seededRandom(`${seed}:coast`);
  const circum = WORLD_RADIUS * Math.sqrt(3) * HEX_SIZE + 1.25;
  const apothem = circum * Math.cos(Math.PI / 6);
  const raw: number[] = [];
  for (let i = 0; i < BOUNDARY_SAMPLES; i++) {
    const a = (i / BOUNDARY_SAMPLES) * Math.PI * 2;
    // Edge normals of the big hexagon sit at 0°, 60°, … (corners at 30°, 90°, …).
    const local = ((a % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3);
    const offNormal = Math.min(local, Math.PI / 3 - local);
    const hexR = apothem / Math.cos(offNormal);
    raw.push(hexR * (1 + (rand() - 0.5) * 0.2));
  }
  let r = raw;
  for (let pass = 0; pass < 4; pass++) {
    r = r.map((_, i) => {
      const n = r.length;
      return (r[(i - 2 + n) % n] + r[(i - 1 + n) % n] * 2 + r[i] * 3 + r[(i + 1) % n] * 2 + r[(i + 2) % n]) / 9;
    });
  }
  // Pull toward a circle a little so the slab reads as a soft tabletop model.
  const mean = r.reduce((a, b) => a + b, 0) / r.length;
  return r.map((v) => v * 0.7 + mean * 0.3);
}

export function radiusAt(radii: number[], angle: number): number {
  const n = radii.length;
  const t = (((angle / (Math.PI * 2)) % 1) + 1) % 1;
  const f = t * n;
  const i = Math.floor(f) % n;
  const j = (i + 1) % n;
  const k = f - Math.floor(f);
  return radii[i] * (1 - k) + radii[j] * k;
}
