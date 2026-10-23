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

/** The three districts off the house: main-gig square, side-hustle fountain, for-fun playground. */
export type District = "gig" | "side" | "fun";
export type Hubs = Record<District, Hex>;

type LotCache = { active: Hex[]; oldTown: Hex[]; side: Hex[]; fun: Hex[]; hubs: Hubs };
const cache = new Map<Terrain, LotCache>();

/**
 * World directions (camera sits at +x,+z; the sea is toward +z): square lower right, fountain out
 * on the deep land to the right, playground upper left, Old Town at the back.
 */
const dirAt = (deg: number) => ({ x: Math.cos((deg * Math.PI) / 180), z: Math.sin((deg * Math.PI) / 180) });
const HUB_DIRS: Record<District, { x: number; z: number }> = {
  gig: dirAt(30),
  side: dirAt(-60),
  fun: dirAt(180),
};

function computeLots(terrain: Terrain): LotCache {
  const nearOldTownRoad = (h: Hex) =>
    OLD_TOWN_ROAD.slice(1).some((p) => hexDistance(p, h) <= 1);

  const hubAt = (d: District): Hex => {
    for (const ring of [3, 2]) {
      const land = hexRing(HOME, ring).filter((h) => isLand(terrain, h, 0.9));
      if (land.length) return bestAligned(land, HUB_DIRS[d]);
    }
    return bestAligned(hexRing(HOME, 2), HUB_DIRS[d]);
  };
  const hubs: Hubs = { gig: hubAt("gig"), side: hubAt("side"), fun: hubAt("fun") };
  const hubRoads = (Object.values(hubs) as Hex[]).map((h) => hexLine(HOME, h));

  const valid = (h: Hex) =>
    isLand(terrain, h, 0.6) &&
    hexDistance(h, HOME) >= 2 &&
    hexDistance(h, HOME) <= WORLD_RADIUS &&
    !nearOldTownRoad(h) &&
    hexDistance(h, OLD_TOWN_ANCHOR) > 2 &&
    hexDistance(h, hubs.gig) >= 3 &&
    hubRoads.every((road) => road.every((p) => !hexEquals(p, h))) &&
    // Stay a step off the main roads so spurs read as branches.
    hubRoads.every((road) => road.slice(1, -1).every((p) => hexDistance(p, h) >= 1));

  // Each district fans out from its hub: nearest ring first, facing out from the house first.
  const spurs = (d: "side" | "fun", taken: Hex[]): Hex[] => {
    const hub = hubs[d];
    const others = (["gig", "side", "fun"] as District[]).filter((x) => x !== d).map((x) => hubs[x]);
    const out = (h: Hex) => {
      const p = hexToWorld(h);
      const c = hexToWorld(hub);
      const l = Math.hypot(c.x, c.z) || 1;
      return ((p.x - c.x) * c.x + (p.z - c.z) * c.z) / l;
    };
    const candidates = [2, 3, 4]
      .flatMap((k) =>
        hexRing(hub, k)
          .filter(valid)
          .filter((h) => others.every((o) => hexDistance(h, o) > hexDistance(h, hub)))
          .sort((a, b) => out(b) - out(a)),
      );
    const chosen: { hex: Hex; path: Hex[] }[] = [];
    for (const h of candidates) {
      const path = hexLine(hub, h);
      const clash = [...taken, ...chosen.map((c) => c.hex)].some((c) => hexDistance(c, h) < 2);
      const crosses = chosen.some((c) => onPathInterior(c.path, h) || onPathInterior(path, c.hex));
      if (!clash && !crosses) chosen.push({ hex: h, path });
    }
    return chosen.map((c) => c.hex);
  };
  const side = spurs("side", []);
  const fun = spurs("fun", side);

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

  return { active: [...side, ...fun], oldTown, side, fun, hubs };
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

/** The free lot nearest its hub in a district (falling back to the other district when full); null when the town is full. */
export function pickActiveLot(
  terrain: Terrain,
  buildings: Building[],
  district: "side" | "fun" = "side",
  strict = false,
): Hex | null {
  const lots = lotsFor(terrain);
  const taken = new Set(buildings.map((b) => hexKey(b.hex)));
  const order = strict ? [lots[district]] : [lots[district], lots[district === "side" ? "fun" : "side"]];
  // Spread out round the hub: prefer lots a couple of steps from everyone already there.
  const occupied = buildings.filter((b) => b.status !== "past" && !b.parentId).map((b) => b.hex);
  for (const list of order) {
    let best: Hex | null = null;
    let bestScore = -Infinity;
    list.forEach((h, i) => {
      if (taken.has(hexKey(h))) return;
      const minD = occupied.length ? Math.min(3, ...occupied.map((o) => hexDistance(o, h))) : 3;
      const score = minD * 100 - i;
      if (score > bestScore) {
        bestScore = score;
        best = h;
      }
    });
    if (best) return best;
  }
  return null;
}

export const hubsFor = (terrain: Terrain): Hubs => lotsFor(terrain).hubs;

/** Which district a town lot belongs to (null for Old Town, hubs and empty land). */
export function districtOf(terrain: Terrain, hex: Hex): "side" | "fun" | null {
  const { side, fun } = lotsFor(terrain);
  if (side.some((h) => hexEquals(h, hex))) return "side";
  if (fun.some((h) => hexEquals(h, hex))) return "fun";
  return null;
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
export function freeLots(terrain: Terrain, buildings: Building[], zone: LotZone | "side" | "fun"): Hex[] {
  const taken = new Set(buildings.map((b) => hexKey(b.hex)));
  const lots = lotsFor(terrain)[zone];
  return lots.filter((h) => !taken.has(hexKey(h)));
}

/** Where a building's road arrives from: its district hub in town, the Old Town crossroads for past ones. */
export function roadSource(b: Pick<Building, "status" | "hex">, terrain: Terrain): Hex {
  if (b.status === "past") return OLD_TOWN_ANCHOR;
  const d = districtOf(terrain, b.hex);
  return d ? hubsFor(terrain)[d] : HOME;
}

export function pickOldTownLot(terrain: Terrain, buildings: Building[]): Hex | null {
  const taken = new Set(buildings.map((b) => hexKey(b.hex)));
  return lotsFor(terrain).oldTown.find((h) => !taken.has(hexKey(h))) ?? null;
}

/** Recomputes every road from the buildings; stored so rendering is deterministic. */
export function computeRoads(world: Pick<World, "home" | "buildings" | "terrain">): Road[] {
  const hubs = hubsFor(world.terrain);
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
  // Main roads out to each district that has something in it.
  const used = new Set<District>();
  for (const b of world.buildings) {
    if (b.parentId || b.status === "past") continue;
    if (b.category === "gig" && hexEquals(b.hex, hubs.gig)) used.add("gig");
    else used.add(districtOf(world.terrain, b.hex) ?? "side");
  }
  (["gig", "side", "fun"] as District[]).forEach((d) => {
    if (used.has(d)) roads.push({ from: world.home, to: hubs[d], kind: "paved", path: hexLine(world.home, hubs[d]) });
  });
  for (const b of world.buildings) {
    if (b.parentId) continue;
    if (b.status !== "past" && hexEquals(b.hex, hubs.gig)) continue;
    if (b.status === "past") {
      roads.push({
        from: OLD_TOWN_ANCHOR,
        to: b.hex,
        kind: "dirt",
        path: hexLine(OLD_TOWN_ANCHOR, b.hex),
      });
    } else {
      const d = districtOf(world.terrain, b.hex);
      const from = d ? hubs[d] : world.home;
      roads.push({ from, to: b.hex, kind: "paved", path: hexLine(from, b.hex) });
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
  const { hubs, side, fun } = lotsFor(terrain);
  (Object.values(hubs) as Hex[]).forEach((hub) => {
    hexLine(HOME, hub).forEach((h) => s.add(hexKey(h)));
    hexRing(hub, 1).forEach((h) => s.add(hexKey(h)));
  });
  for (const lot of side) hexLine(hubs.side, lot).forEach((h) => s.add(hexKey(h)));
  for (const lot of fun) hexLine(hubs.fun, lot).forEach((h) => s.add(hexKey(h)));
  void active;
  OLD_TOWN_ROAD.forEach((h) => s.add(hexKey(h)));
  for (const lot of oldTown) hexLine(OLD_TOWN_ANCHOR, lot).forEach((h) => s.add(hexKey(h)));
  return s;
}
