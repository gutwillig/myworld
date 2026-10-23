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
  /**
   * True when the island slopes into the sea (beach + dock). False = landlocked: the ground stays
   * meadow to the cliff edge and sits on a valley floor (the "water" colors paint that floor).
   */
  shore: boolean;
  grass: string;
  grassAlt: string;
  sand: string;
  slab: string;
  /** Shallow→deep water colors (mountain lakes run colder). */
  waterShallow: string;
  waterDeep: string;
  /** Ground just under the water line, and the grass-to-shore transition band. */
  shoreWet: string;
  shoreEdge: string;
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
  shore: true,
  grass: "#9DC07A",
  grassAlt: "#8CB36C",
  sand: "#EAD7AE",
  slab: "#D8C6A2",
  waterShallow: "#8ED2C6",
  waterDeep: "#4FA7A8",
  shoreWet: "#D9C59A",
  shoreEdge: "#C9CD8E",
};

/**
 * Telluride-style mesa: alpine meadow right to the cliff edge, an airstrip where the beach would
 * be, a valley floor below and peaks all around. coastDir stays so lots/trees keep the front clear.
 */
const MOUNTAIN: TerrainProfile = {
  coastDir: BEACH.coastDir,
  sandStart: BEACH.sandStart,
  waterLine: BEACH.waterLine,
  waterY: -0.62,
  shore: false,
  grass: "#A2BC7F",
  grassAlt: "#92AC6E",
  sand: "#D8CDB8",
  slab: "#B9AE97",
  waterShallow: "#90A976",
  waterDeep: "#7C9469",
  shoreWet: "#CFC5B4",
  shoreEdge: "#BFC7A8",
};

export function terrainProfile(terrain: Terrain): TerrainProfile {
  switch (terrain) {
    case "mountain":
      return MOUNTAIN;
    case "beach":
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
  if (!p.shore) return h;
  const c = coastCoord(p, x, z);
  if (c > p.sandStart) h -= (c - p.sandStart) * 0.12;
  if (c > p.waterLine) h -= (c - p.waterLine) * 0.55;
  return Math.max(h, -0.62);
}
