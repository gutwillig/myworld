import type { Building, Road, Terrain, World } from "@/store/types";
import {
  type Hex,
  hexDistance,
  hexEquals,
  hexKey,
  hexLine,
  hexRing,
  hexToWorld,
} from "./hex";
import { coastCoord, terrainProfile } from "./terrainProfile";

export const HOME: Hex = { q: 0, r: 0 };
export const WORLD_RADIUS = 6;

/** Horizontal direction pointing away from the default camera (camera sits at +x,+z). */
const AWAY = { x: -Math.SQRT1_2, z: -Math.SQRT1_2 };

function bestAligned(ring: Hex[], dir: { x: number; z: number }): Hex {
  let best = ring[0];
  let bestDot = -Infinity;
  for (const h of ring) {
    const p = hexToWorld(h);
    const l = Math.hypot(p.x, p.z);
    const d = (p.x * dir.x + p.z * dir.z) / l;
    if (d > bestDot) {
      bestDot = d;
      best = h;
    }
  }
  return best;
}

/** The crossroads at the end of the dirt road, behind the house. */
export const OLD_TOWN_ANCHOR: Hex = bestAligned(hexRing(HOME, 5), AWAY);
export const OLD_TOWN_ROAD: Hex[] = hexLine(HOME, OLD_TOWN_ANCHOR);

const isLand = (terrain: Terrain, h: Hex, margin: number): boolean => {
  const p = terrainProfile(terrain);
  const w = hexToWorld(h);
  return coastCoord(p, w.x, w.z) < p.sandStart - margin;
};

const onPathInterior = (path: Hex[], h: Hex): boolean =>
  path.slice(1, -1).some((p) => hexEquals(p, h));

type LotCache = { active: Hex[]; oldTown: Hex[] };
const cache = new Map<Terrain, LotCache>();

function angleOf(h: Hex): number {
  const p = hexToWorld(h);
  return Math.atan2(p.z, p.x);
}

function computeLots(terrain: Terrain): LotCache {
  const nearOldTownRoad = (h: Hex) =>
    OLD_TOWN_ROAD.slice(1).some((p) => hexDistance(p, h) <= 1);

  const valid = (h: Hex) =>
    isLand(terrain, h, 0.6) && !nearOldTownRoad(h) && hexDistance(h, OLD_TOWN_ANCHOR) > 2;

  // Priority: ring 4 first (the main ring), then ring 3 and ring 5 as fill-ins.
  // Within a ring, start facing the camera and walk around so early lots are visible.
  const cameraAngle = Math.atan2(-AWAY.z, -AWAY.x);
  const byCameraAngle = (a: Hex, b: Hex) => {
    const da = Math.abs(normAngle(angleOf(a) - cameraAngle));
    const db = Math.abs(normAngle(angleOf(b) - cameraAngle));
    return da - db;
  };
  const candidates = [
    ...hexRing(HOME, 4).filter(valid).sort(byCameraAngle),
    ...hexRing(HOME, 3).filter(valid).sort(byCameraAngle),
    ...hexRing(HOME, 5).filter(valid).sort(byCameraAngle),
  ];

  const chosen: { hex: Hex; path: Hex[] }[] = [];
  for (const h of candidates) {
    const path = hexLine(HOME, h);
    const ok = chosen.every(
      (c) =>
        hexDistance(c.hex, h) >= 2 &&
        !onPathInterior(c.path, h) &&
        !onPathInterior(path, c.hex) &&
        !path.slice(1, -1).some((p) => hexDistance(p, c.hex) < 1),
    );
    if (ok) chosen.push({ hex: h, path });
  }

  const oldTown = [
    ...hexRing(OLD_TOWN_ANCHOR, 1),
    ...hexRing(OLD_TOWN_ANCHOR, 2),
  ]
    .filter(
      (h) =>
        hexDistance(h, HOME) >= 4 &&
        hexDistance(h, HOME) <= WORLD_RADIUS &&
        !OLD_TOWN_ROAD.some((p) => hexEquals(p, h)) &&
        isLand(terrain, h, 0.2),
    )
    .sort((a, b) => {
      const d = hexDistance(a, OLD_TOWN_ANCHOR) - hexDistance(b, OLD_TOWN_ANCHOR);
      if (d !== 0) return d;
      return hexDistance(b, HOME) - hexDistance(a, HOME);
    });

  return { active: chosen.map((c) => c.hex), oldTown };
}

function normAngle(a: number): number {
  let x = a;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x < -Math.PI) x += Math.PI * 2;
  return x;
}

export function lotsFor(terrain: Terrain): LotCache {
  let c = cache.get(terrain);
  if (!c) {
    c = computeLots(terrain);
    cache.set(terrain, c);
  }
  return c;
}

/**
 * Picks the free active lot furthest from existing buildings so the town spreads evenly.
 * Returns null when the town is full.
 */
export function pickActiveLot(terrain: Terrain, buildings: Building[]): Hex | null {
  const { active } = lotsFor(terrain);
  const taken = new Set(buildings.map((b) => hexKey(b.hex)));
  const occupied = buildings.filter((b) => b.status !== "past").map((b) => b.hex);
  let best: Hex | null = null;
  let bestScore = -Infinity;
  active.forEach((h, i) => {
    if (taken.has(hexKey(h))) return;
    const minD = occupied.length
      ? Math.min(...occupied.map((o) => hexDistance(o, h)))
      : 100;
    const score = minD * 100 - i;
    if (score > bestScore) {
      bestScore = score;
      best = h;
    }
  });
  return best;
}

export type LotZone = "active" | "oldTown";

/** Which kind of lot a hex is, or null if nothing can be built there. */
export function lotZone(terrain: Terrain, hex: Hex): LotZone | null {
  const { active, oldTown } = lotsFor(terrain);
  if (active.some((h) => hexEquals(h, hex))) return "active";
  if (oldTown.some((h) => hexEquals(h, hex))) return "oldTown";
  return null;
}

/** Empty lots of a zone, in priority order. */
export function freeLots(terrain: Terrain, buildings: Building[], zone: LotZone): Hex[] {
  const taken = new Set(buildings.map((b) => hexKey(b.hex)));
  const lots = zone === "active" ? lotsFor(terrain).active : lotsFor(terrain).oldTown;
  return lots.filter((h) => !taken.has(hexKey(h)));
}

/** Where a building's road arrives from: home for town lots, the Old Town crossroads for past ones. */
export function roadSource(b: Pick<Building, "status">): Hex {
  return b.status === "past" ? OLD_TOWN_ANCHOR : HOME;
}

export function pickOldTownLot(terrain: Terrain, buildings: Building[]): Hex | null {
  const taken = new Set(buildings.map((b) => hexKey(b.hex)));
  return lotsFor(terrain).oldTown.find((h) => !taken.has(hexKey(h))) ?? null;
}

/** Recomputes every road from the buildings; stored so rendering is deterministic. */
export function computeRoads(world: Pick<World, "home" | "buildings">): Road[] {
  const roads: Road[] = [];
  const past = world.buildings.filter((b) => b.status === "past");
  if (past.length > 0) {
    roads.push({
      from: world.home,
      to: OLD_TOWN_ANCHOR,
      kind: "dirt",
      path: hexLine(world.home, OLD_TOWN_ANCHOR),
    });
  }
  for (const b of world.buildings) {
    if (b.status === "past") {
      roads.push({
        from: OLD_TOWN_ANCHOR,
        to: b.hex,
        kind: "dirt",
        path: hexLine(OLD_TOWN_ANCHOR, b.hex),
      });
    } else {
      roads.push({ from: world.home, to: b.hex, kind: "paved", path: hexLine(world.home, b.hex) });
    }
  }
  return roads;
}

export const roadKey = (r: Road): string => `${r.kind}:${hexKey(r.from)}>${hexKey(r.to)}`;

/** Every hex a road, lot or Old Town might use; decoration stays off these. */
export function reservedHexes(terrain: Terrain): Set<string> {
  const { active, oldTown } = lotsFor(terrain);
  const s = new Set<string>();
  s.add(hexKey(HOME));
  hexRing(HOME, 1).forEach((h) => s.add(hexKey(h)));
  for (const lot of active) hexLine(HOME, lot).forEach((h) => s.add(hexKey(h)));
  OLD_TOWN_ROAD.forEach((h) => s.add(hexKey(h)));
  for (const lot of oldTown) hexLine(OLD_TOWN_ANCHOR, lot).forEach((h) => s.add(hexKey(h)));
  return s;
}
