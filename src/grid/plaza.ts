import { hexToWorld } from "@/grid/hex";
import { districtOf, OLD_TOWN_ANCHOR, hubsFor } from "@/grid/layout";
import type { Building, World } from "@/store/types";

/** Plaza ground radius around the main-gig lot (lots are >= 3.46 apart, so this stays clear). */
export const PLAZA_RADIUS = 1.62;
/** Where client buildings may stand: a ring between the HQ and the plaza edge. */
/** Client buildings stand out past the square, each at the end of a short spur. */
export const SPOT_MIN = 2.05;
export const SPOT_MAX = 3.35;
/** How big plaza buildings are next to a normal one, and the HQ inside its plaza. */
export const CLIENT_SCALE = 0.5;
export const HQ_SCALE = 1.32;
/** How much closer the camera gets inside a plaza. */
export const PLAZA_ZOOM = 2.3;

const SLOTS = 8;
/** Fill order that spreads the first few clients round the plaza instead of bunching them. */
const SPREAD = [0, 4, 2, 6, 1, 5, 3, 7];
const RINGS = [2.3, 3.1];
/** Slot 0 faces the default camera (azimuth 45°), then walks round; the outer ring sits between inner slots. */
const slotAt = (i: number, ring: number) => {
  const a = Math.PI / 4 + Math.PI / SLOTS + ((i + ring * 0.5) / SLOTS) * Math.PI * 2;
  return { x: Math.sin(a) * RINGS[ring], z: Math.cos(a) * RINGS[ring] };
};

/** Keeps a dragged spot inside the client ring. */
export function clampSpot(x: number, z: number): { x: number; z: number } {
  const d = Math.hypot(x, z) || 1e-6;
  const r = Math.min(SPOT_MAX, Math.max(SPOT_MIN, d));
  return { x: (x / d) * r, z: (z / d) * r };
}

/** The owner's current main gig (a gig retired to Old Town keeps its clients but is no longer the square). */
export const isGig = (b: Building): boolean => b.category === "gig" && !b.parentId && b.status !== "past";
export const clientsOf = (all: Building[], gigId: string): Building[] => all.filter((b) => b.parentId === gigId);

/** Next free spot: beside the same client's other workstreams if any, else the first empty slot. */
export function nextSpot(
  siblings: Building[],
  client?: string,
  /** Direction the road leaves the plaza; slots near it stay clear. */
  avoid?: { x: number; z: number },
): { x: number; z: number } {
  const taken = siblings.map((s) => s.spot ?? { x: 0, z: 0 });
  const free = (p: { x: number; z: number }) => taken.every((t) => Math.hypot(t.x - p.x, t.z - p.z) > 0.8);
  const len = avoid ? Math.hypot(avoid.x, avoid.z) : 0;
  const clearOfRoad = (p: { x: number; z: number }) =>
    !avoid || len < 1e-6 || (p.x * avoid.x + p.z * avoid.z) / (Math.hypot(p.x, p.z) * len) < Math.cos(Math.PI / 5);
  const all = [0, 1].flatMap((ring) => SPREAD.map((i) => slotAt(i, ring))).filter(free);
  const slots = all.filter(clearOfRoad).length ? all.filter(clearOfRoad) : all;
  const mate = client ? siblings.find((s) => s.client && s.client.toLowerCase() === client.toLowerCase())?.spot : undefined;
  if (mate && slots.length) {
    return slots.reduce((a, b) => (Math.hypot(a.x - mate.x, a.z - mate.z) <= Math.hypot(b.x - mate.x, b.z - mate.z) ? a : b));
  }
  return slots[0] ?? clampSpot(Math.random() - 0.5, Math.random() - 0.5);
}

/** Camera stops inside the town: a gig's plaza, or a whole district framed around its hub. */
export const HUB_FOCUS = { gig: "hub:gig", side: "hub:side", fun: "hub:fun", old: "hub:old" } as const;
const REALM_EYEBROW = { gig: "The Plaza", side: "The Fountain", fun: "The Playground", old: "Old Town" } as const;
const REALM_TITLE = { gig: "Main gig", side: "Side hustles", fun: "For fun", old: "Past lives" } as const;

export type Focus = {
  kind: "plaza" | "side" | "fun" | "old";
  /** Island-local center the camera aims at. */
  x: number;
  z: number;
  /** Multiplier on the town zoom. */
  zoom: number;
  eyebrow: string;
  title: string;
  /** True for a realm with nothing in it yet. */
  empty?: boolean;
  /** The gig whose plaza this is (plaza focus only). */
  gig?: Building;
};

/** The places standing in a district (not the main gig, not plaza clients, not Old Town). */
export function districtMembers(world: Pick<World, "buildings" | "terrain">, d: "side" | "fun"): Building[] {
  return world.buildings.filter(
    (b) => !b.parentId && b.status !== "past" && !isGig(b) && districtOf(world.terrain, b.hex) === d,
  );
}

export function focusOf(world: Pick<World, "buildings" | "terrain">, id: string | null): Focus | null {
  if (!id) return null;
  if (id.startsWith("hub:")) {
    const d = id.slice(4) as keyof typeof HUB_FOCUS;
    if (!(d in HUB_FOCUS)) return null;
    // The main-gig realm is the plaza once there is a gig; before that it's an empty patch to start in.
    const existing = d === "gig" ? world.buildings.find(isGig) : undefined;
    if (existing) return focusOf(world, existing.id);
    const members =
      d === "old" ? world.buildings.filter((b) => b.status === "past" && !b.parentId) : d === "gig" ? [] : districtMembers(world, d);
    const anchor = d === "old" ? OLD_TOWN_ANCHOR : hubsFor(world.terrain)[d];
    const pts = [hexToWorld(anchor), ...members.map((b) => hexToWorld(b.hex))];
    const xs = pts.map((p) => p.x);
    const zs = pts.map((p) => p.z);
    const x = (Math.min(...xs) + Math.max(...xs)) / 2;
    const z = (Math.min(...zs) + Math.max(...zs)) / 2;
    const r = members.length ? Math.max(...pts.map((p) => Math.hypot(p.x - x, p.z - z))) + 0.9 : 2.8;
    return {
      kind: d === "gig" ? "plaza" : d,
      x,
      z,
      zoom: Math.min(3.4, Math.max(1.6, 8.4 / r)),
      eyebrow: REALM_EYEBROW[d],
      title: REALM_TITLE[d],
      empty: !members.length,
    };
  }
  const gig = world.buildings.find((b) => b.id === id);
  if (!gig || gig.parentId || !(isGig(gig) || clientsOf(world.buildings, gig.id).length)) return null;
  const w = hexToWorld(gig.hex);
  return { kind: "plaza", x: w.x, z: w.z, zoom: PLAZA_ZOOM, eyebrow: "The Plaza", title: gig.name, gig };
}
