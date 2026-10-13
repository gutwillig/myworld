import type { Terrain } from "@/store/types";

/**
 * Pure description of a terrain's shape. Shared by the layout module (where lots may go)
 * and the renderer (how the ground looks). Adding mountain/village = new branch here.
 */
export type TerrainProfile = {
  /** Unit vector (x,z) pointing toward the sea; null when there is no coast. */
  coastDir: { x: number; z: number } | null;
  /** Coast coordinate where grass turns to sand. */
  sandStart: number;
  /** Coast coordinate where sand dips under water. */
  waterLine: number;
  waterY: number;
  grass: string;
  grassAlt: string;
  sand: string;
  slab: string;
};

const norm = (x: number, z: number) => {
  const l = Math.hypot(x, z);
  return { x: x / l, z: z / l };
};

const BEACH: TerrainProfile = {
  coastDir: norm(-0.3, 1),
  sandStart: 5.3,
  waterLine: 7.1,
  waterY: -0.24,
  grass: "#9DC07A",
  grassAlt: "#8CB36C",
  sand: "#EAD7AE",
  slab: "#D8C6A2",
};

export function terrainProfile(terrain: Terrain): TerrainProfile {
  switch (terrain) {
    case "beach":
    case "mountain":
    case "village":
    default:
      return BEACH;
  }
}

/** Distance along the coast direction; larger = closer to the sea. */
export function coastCoord(p: TerrainProfile, x: number, z: number): number {
  if (!p.coastDir) return -Infinity;
  return x * p.coastDir.x + z * p.coastDir.z;
}

/** Cheap deterministic value noise from summed sines. */
export function smoothNoise(x: number, z: number): number {
  return (
    Math.sin(x * 1.31 + z * 0.73) * 0.5 +
    Math.sin(x * -0.67 + z * 1.91 + 1.7) * 0.3 +
    Math.sin(x * 2.73 - z * 2.11 + 4.2) * 0.2
  );
}

/** Ground height at a world position, used by terrain mesh, roads, buildings and props. */
export function groundHeight(p: TerrainProfile, x: number, z: number): number {
  let h = smoothNoise(x, z) * 0.08;
  const c = coastCoord(p, x, z);
  if (c > p.sandStart) h -= (c - p.sandStart) * 0.12;
  if (c > p.waterLine) h -= (c - p.waterLine) * 0.55;
  return Math.max(h, -0.62);
}
