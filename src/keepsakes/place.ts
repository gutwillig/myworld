import { DOCK, SHORE } from "@/grid/archipelago";
import { OLD_TOWN_ANCHOR, lotsFor, reservedHexes } from "@/grid/layout";
import { hexToWorld } from "@/grid/hex";
import { type TerrainProfile, coastCoord, terrainProfile } from "@/grid/terrainProfile";
import { boundaryRadii, radiusAt, seededRandom } from "@/world/islandShape";
import type { KeepsakeKind, KeepsakePin, Terrain } from "@/store/types";
import { KEEPSAKE_SCALE, type KeepsakeZone, keepsakeInfo } from "./catalog";

/** Where a keepsake ended up, in island-local coordinates. */
export type KeepsakeSpot = { kind: KeepsakeKind; x: number; z: number; rot: number; radius: number };

/** What placement needs from a stored keepsake. */
export type KeepsakeRef = { kind: KeepsakeKind; at?: KeepsakePin };

type Candidate = { x: number; z: number };

/** Away from the default camera, so big keepsakes sit behind the town like a backdrop. */
const AWAY = { x: -Math.SQRT1_2, z: -Math.SQRT1_2 };
/** Where the lot pads and their grounds reach, in world units. */
const LOT_REACH = 1.75;
const ROAD_REACH = 0.5;
/** Half the dock's width plus a little elbow room. */
const DOCK_REACH = 0.55;
/** The founder's house at the center. */
const HOME_REACH = 1.5;

/** Everything about an island that a keepsake must keep clear of. Cached per island. */
type Site = {
  profile: TerrainProfile;
  radii: number[];
  lots: Candidate[];
  roads: Candidate[];
};

const sites = new Map<string, Site>();

function siteFor(terrain: Terrain, seed: string): Site {
  const key = `${terrain}|${seed}`;
  const hit = sites.get(key);
  if (hit) return hit;
  const { active, oldTown } = lotsFor(terrain);
  const site: Site = {
    profile: terrainProfile(terrain),
    radii: boundaryRadii(seed),
    lots: [...active, ...oldTown].map(hexToWorld),
    roads: [...reservedHexes(terrain)].map((k) => {
      const [q, r] = k.split(",").map(Number);
      return hexToWorld({ q, r });
    }),
  };
  if (sites.size > 32) sites.clear();
  sites.set(key, site);
  return site;
}

function distToSegment(p: Candidate, a: Candidate, b: Candidate): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
}

/** How much room is left between `c` and the nearest other keepsake (negative = overlapping). */
const gapTo = (c: Candidate, radius: number, others: KeepsakeSpot[]): number =>
  others.length ? Math.min(...others.map((p) => Math.hypot(p.x - c.x, p.z - c.z) - p.radius)) - radius : 6;

/** On dry land, off every lot, road, the dock and the house. Shared by auto-placement and drags. */
function clearOf(site: Site, c: Candidate, radius: number, slack: number): boolean {
  const dist = Math.hypot(c.x, c.z);
  if (dist < HOME_REACH + radius - slack) return false;
  if (dist + radius > radiusAt(site.radii, Math.atan2(c.z, c.x)) - 0.35 + slack) return false;
  if (coastCoord(site.profile, c.x, c.z) + radius * 0.6 > site.profile.waterLine - 0.15) return false;
  if (distToSegment(c, DOCK.root, DOCK.tip) < DOCK_REACH + radius - slack) return false;
  if (site.lots.some((l) => Math.hypot(l.x - c.x, l.z - c.z) < LOT_REACH + radius - 0.2 - slack)) return false;
  if (site.roads.some((r) => Math.hypot(r.x - c.x, r.z - c.z) < ROAD_REACH + radius - slack)) return false;
  return true;
}

/** Hand-placement is a little more forgiving than auto-placement, so drops feel free. */
const DRAG_SLACK = 0.35;

/** Can `kind` be dropped at (x, z) without touching anything else on the island? */
export function keepsakeFits(terrain: Terrain, seed: string, kind: KeepsakeKind, x: number, z: number, others: KeepsakeSpot[]): boolean {
  const info = keepsakeInfo(kind);
  if (!info) return false;
  const radius = info.footprint * KEEPSAKE_SCALE;
  const c = { x, z };
  return clearOf(siteFor(terrain, seed), c, radius, DRAG_SLACK) && gapTo(c, radius, others.filter((o) => o.kind !== kind)) >= 0.05;
}

/** A fine grid of grassy points at least `minDist` from home (keepsakes aren't tied to hexes). */
function landCandidates(p: TerrainProfile, minDist: number): Candidate[] {
  const anchor = hexToWorld(OLD_TOWN_ANCHOR);
  const out: Candidate[] = [];
  for (let x = -11; x <= 11; x += 0.5) {
    for (let z = -11; z <= 11; z += 0.5) {
      if (Math.hypot(x, z) < minDist) continue;
      if (coastCoord(p, x, z) > p.sandStart - 0.3) continue;
      if (Math.hypot(x - anchor.x, z - anchor.z) < 2.2) continue;
      out.push({ x, z });
    }
  }
  return out;
}

/** Points along the sand, skipping the stretch around the dock. */
function beachCandidates(p: TerrainProfile): Candidate[] {
  const dir = p.coastDir;
  if (!dir) return [];
  const along = (p.sandStart + p.waterLine) / 2 - 0.2;
  const dockAt = DOCK.root.x * SHORE.x + DOCK.root.z * SHORE.z;
  const out: Candidate[] = [];
  for (let t = -6.5; t <= 6.5; t += 0.5) {
    if (Math.abs(t - dockAt) < 1.4) continue;
    out.push({ x: dir.x * along + SHORE.x * t, z: dir.z * along + SHORE.z * t });
  }
  return out;
}

const pools = new Map<string, Record<KeepsakeZone, Candidate[]>>();

function poolsFor(terrain: Terrain): Record<KeepsakeZone, Candidate[]> {
  const hit = pools.get(terrain);
  if (hit) return hit;
  const p = terrainProfile(terrain);
  const out = { edge: landCandidates(p, 6.5), yard: landCandidates(p, 4.5), beach: beachCandidates(p) };
  pools.set(terrain, out);
  return out;
}

/**
 * Puts each keepsake somewhere it fits. Hand-placed ones stay exactly where they were dropped;
 * the rest go greedily, in list order, never on a lot, road, the dock or off the island and
 * spread apart from the others, so adding one never moves the earlier ones.
 */
export function placeKeepsakes(terrain: Terrain, seed: string, list: KeepsakeRef[]): KeepsakeSpot[] {
  if (list.length === 0) return [];
  const rand = seededRandom(`${seed}:keepsakes`);
  const site = siteFor(terrain, seed);
  const zones = poolsFor(terrain);
  const seen = new Set<KeepsakeKind>();
  const unique = list.filter((k) => !!keepsakeInfo(k.kind) && !seen.has(k.kind) && !!seen.add(k.kind));

  const pinned: KeepsakeSpot[] = [];
  for (const k of unique) {
    if (!k.at) continue;
    const info = keepsakeInfo(k.kind);
    if (info) pinned.push({ kind: k.kind, x: k.at.x, z: k.at.z, rot: k.at.rot, radius: info.footprint * KEEPSAKE_SCALE });
  }

  const placed: KeepsakeSpot[] = [];
  for (const k of unique) {
    const rot = Math.PI / 4 + (rand() - 0.5) * 0.5;
    const pin = pinned.find((p) => p.kind === k.kind);
    if (pin) {
      placed.push(pin);
      continue;
    }
    const info = keepsakeInfo(k.kind);
    if (!info) continue;
    const radius = info.footprint * KEEPSAKE_SCALE;
    const others = [...placed, ...pinned.filter((p) => !placed.includes(p))];
    let best: Candidate | null = null;
    let bestScore = -Infinity;
    for (const c of zones[info.zone]) {
      if (info.zone !== "beach" && coastCoord(site.profile, c.x, c.z) + radius * 0.8 > site.profile.sandStart) continue;
      if (!clearOf(site, c, radius, 0)) continue;
      const gap = gapTo(c, radius, others);
      if (gap < 0.3) continue;
      const dist = Math.hypot(c.x, c.z);
      const back = (c.x * AWAY.x + c.z * AWAY.z) / Math.max(dist, 1e-6);
      // Big ones lean toward the back like a backdrop; small yard ones toward the camera.
      const pref = info.zone === "edge" ? back * 1.2 + dist * 0.15 : info.zone === "yard" ? -back * 0.6 : 0;
      const score = pref + Math.min(gap, 4) * 0.8 + rand() * 0.05;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    if (best) placed.push({ kind: k.kind, x: best.x, z: best.z, radius, rot });
  }
  return placed;
}
