import type { Terrain } from "@/store/types";
import { terrainProfile } from "./terrainProfile";

/**
 * Where worlds sit in the shared sea, where each one's dock is, and the ferry route between two
 * docks. Pure math so the store and the renderer can both use it.
 */
export type Vec2 = { x: number; z: number };

const coast = terrainProfile("beach").coastDir ?? { x: 0, z: 1 };
/** Points from land out to sea, across the beach. */
export const COAST: Vec2 = { x: coast.x, z: coast.z };
/** Runs along the shoreline (90° from COAST). */
export const SHORE: Vec2 = { x: COAST.z, z: -COAST.x };

/** Distance between neighboring island centers. */
export const SEA_SPACING = 36;

const add = (a: Vec2, b: Vec2, k = 1): Vec2 => ({ x: a.x + b.x * k, z: a.z + b.z * k });

/**
 * Island centers for each world in the book. Home sits at the origin and friends line up
 * along the coast, alternating sides, so every ferry ride runs past the beaches.
 */
export function seaOffset(index: number): Vec2 {
  if (index <= 0) return { x: 0, z: 0 };
  const k = Math.ceil(index / 2);
  const side = index % 2 === 1 ? -1 : 1;
  return { x: SHORE.x * side * SEA_SPACING * k, z: SHORE.z * side * SEA_SPACING * k };
}

const DOCK_SHORE_SHIFT = 2.2;

/** The dock in island-local coordinates, from where it leaves the sand to its tip. */
export const DOCK = {
  root: add({ x: COAST.x * 6.3, z: COAST.z * 6.3 }, SHORE, DOCK_SHORE_SHIFT),
  tip: add({ x: COAST.x * 11.4, z: COAST.z * 11.4 }, SHORE, DOCK_SHORE_SHIFT),
  /** Where the boat ties up, alongside the dock's far end. */
  mooring: add({ x: COAST.x * 10.9, z: COAST.z * 10.9 }, SHORE, DOCK_SHORE_SHIFT + 0.85),
};

/** The airstrip on landlocked (mountain) worlds: same front corner, running out to the cliff edge. */
export const AIRSTRIP = {
  root: add({ x: COAST.x * 5.7, z: COAST.z * 5.7 }, SHORE, DOCK_SHORE_SHIFT),
  tip: add({ x: COAST.x * 8.5, z: COAST.z * 8.5 }, SHORE, DOCK_SHORE_SHIFT),
  /** Where the plane parks, nose toward the drop. */
  stand: add({ x: COAST.x * 6.15, z: COAST.z * 6.15 }, SHORE, DOCK_SHORE_SHIFT),
};

/** Where your plane rests on a world: tied up at the dock, or parked on the airstrip. */
export function standFor(terrain: Terrain | undefined): Vec2 {
  return terrainProfile(terrain ?? "beach").shore ? DOCK.mooring : AIRSTRIP.stand;
}

export type Route = { p0: Vec2; p1: Vec2; p2: Vec2; p3: Vec2 };

/** A flight between two islands' stands: out past the coast, along it, back in to land. */
export function ferryRoute(from: Vec2, to: Vec2, fromStand: Vec2 = DOCK.mooring, toStand: Vec2 = DOCK.mooring): Route {
  const p0 = add(from, fromStand);
  const p3 = add(to, toStand);
  const reach = Math.min(11, 5 + Math.hypot(to.x - from.x, to.z - from.z) * 0.12);
  return { p0, p1: add(p0, COAST, reach), p2: add(p3, COAST, reach), p3 };
}

/** Position and heading (unit vector) at t∈[0,1] along a route. */
export function routeAt(r: Route, t: number): { pos: Vec2; dir: Vec2 } {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  const pos = {
    x: a * r.p0.x + b * r.p1.x + c * r.p2.x + d * r.p3.x,
    z: a * r.p0.z + b * r.p1.z + c * r.p2.z + d * r.p3.z,
  };
  const dx = 3 * u * u * (r.p1.x - r.p0.x) + 6 * u * t * (r.p2.x - r.p1.x) + 3 * t * t * (r.p3.x - r.p2.x);
  const dz = 3 * u * u * (r.p1.z - r.p0.z) + 6 * u * t * (r.p2.z - r.p1.z) + 3 * t * t * (r.p3.z - r.p2.z);
  const l = Math.hypot(dx, dz) || 1;
  return { pos, dir: { x: dx / l, z: dz / l } };
}

/** Approximate route length, for pacing the trip. */
export function routeLength(r: Route): number {
  let len = 0;
  let prev = routeAt(r, 0).pos;
  for (let i = 1; i <= 40; i++) {
    const p = routeAt(r, i / 40).pos;
    len += Math.hypot(p.x - prev.x, p.z - prev.z);
    prev = p;
  }
  return len;
}
