import { clampSpot, clientsOf, isGig, nextSpot } from "@/grid/plaza";
import { nanoid } from "nanoid";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { hexEquals, hexToWorld, type Hex } from "@/grid/hex";
import { HOME, computeRoads, districtOf, hubsFor, lotZone, pickActiveLot, pickOldTownLot } from "@/grid/layout";
import { MAX_KEEPSAKES, NOTE_MAX, parseKeepsakes } from "@/keepsakes/catalog";
import { UPDATES_KEPT, UPDATE_MAX } from "@/updates/news";
import type { Building, BuildingType, BuildingUpdate, Keepsake, KeepsakeKind, KeepsakePin, Showcase, Status, Terrain, TownCenter, World } from "./types";
import { PITCH_MAX, TOWN_CENTERS } from "./types";

export const STORAGE_KEY = "worlds.v1";
export const STORE_VERSION = 5;

export function slugify(input: string): string {
  const s = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "place";
}

function uniqueWorldSlug(name: string, worlds: Record<string, World>, selfId?: string): string {
  const base = slugify(name).slice(0, 24) || "friend";
  const taken = new Set(Object.values(worlds).filter((w) => w.id !== selfId).map((w) => w.slug));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

function uniqueSlug(name: string, buildings: Building[], selfId?: string): string {
  const base = slugify(name);
  const taken = new Set(buildings.filter((b) => b.id !== selfId).map((b) => b.slug));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

export function createEmptyWorld(ownerName = "Gus", terrain: Terrain = "beach"): World {
  return {
    id: nanoid(10),
    slug: slugify(ownerName).slice(0, 12) || "me",
    ownerName,
    terrain,
    home: { ...HOME },
    buildings: [],
    roads: [],
    keepsakes: [],
  };
}

/** Direction the gig's road leaves its plaza (toward the next hex on its road, else toward home). */
function roadOut(world: World, gig: Building): { x: number; z: number } {
  const c = hexToWorld(gig.hex);
  const path = world.roads.find((r) => r.path.some((h) => hexEquals(h, gig.hex)))?.path;
  const i = path ? path.findIndex((h) => hexEquals(h, gig.hex)) : -1;
  const next = path && i >= 0 ? (path[i - 1] ?? path[i + 1]) : undefined;
  const to = next ? hexToWorld(next) : { x: 0, z: 0 };
  return { x: to.x - c.x, z: to.z - c.z };
}

/** Validates an unknown JSON blob as a World; throws a friendly error on mismatch. */
export function parseWorld(raw: unknown): World {
  const obj = (raw && typeof raw === "object" && "world" in (raw as object) ? (raw as { world: unknown }).world : raw) as Partial<World> | null;
  if (!obj || typeof obj !== "object" || !Array.isArray(obj.buildings)) {
    throw new Error("That file doesn't look like a myworld export.");
  }
  const base = createEmptyWorld(typeof obj.ownerName === "string" ? obj.ownerName : "Gus");
  const buildings: Building[] = obj.buildings
    .filter((b): b is Building => !!b && typeof b === "object" && typeof (b as Building).name === "string" && !!(b as Building).hex)
    .map((b) => ({
      id: b.id || nanoid(10),
      slug: b.slug || slugify(b.name),
      type: b.type,
      name: b.name,
      oneLiner: b.oneLiner ?? "",
      status: b.status ?? "active",
      links: Array.isArray(b.links) ? b.links : [],
      residents: Array.isArray(b.residents) ? b.residents : [],
      hex: { q: Number(b.hex.q), r: Number(b.hex.r) },
      createdAt: b.createdAt ?? Date.now(),
      ...(typeof b.style === "string" ? { style: b.style } : {}),
      ...(typeof b.grounds === "string" ? { grounds: b.grounds } : {}),
      ...(typeof b.accent === "string" ? { accent: b.accent } : {}),
      ...(b.showcase && typeof b.showcase === "object" ? { showcase: b.showcase as Showcase } : {}),
      ...(Array.isArray(b.updates) ? { updates: parseUpdates(b.updates) } : {}),
      ...(b.category === "gig" ? { category: "gig" as const } : {}),
      ...(typeof b.parentId === "string" ? { parentId: b.parentId } : {}),
      ...(b.spot && Number.isFinite(b.spot.x) && Number.isFinite(b.spot.z) ? { spot: clampSpot(Number(b.spot.x), Number(b.spot.z)) } : {}),
      ...(typeof b.client === "string" ? { client: b.client.slice(0, 40) } : {}),
    }));
  const world: World = {
    ...base,
    id: obj.id ?? base.id,
    slug: obj.slug ?? base.slug,
    terrain: obj.terrain ?? "beach",
    buildings,
    roads: [],
    keepsakes: parseKeepsakes(obj.keepsakes),
    center: TOWN_CENTERS.includes(obj.center as TownCenter) ? obj.center : undefined,
    pitch: typeof obj.pitch === "string" ? obj.pitch.slice(0, PITCH_MAX) : undefined,
  };
  world.roads = computeRoads(world);
  return world;
}

/** Keeps only well-formed updates, newest first, capped. */
function parseUpdates(raw: unknown[]): BuildingUpdate[] {
  return raw
    .filter((u): u is BuildingUpdate => !!u && typeof (u as BuildingUpdate).text === "string" && typeof (u as BuildingUpdate).at === "number")
    .map((u) => ({ id: u.id || nanoid(8), text: u.text.slice(0, UPDATE_MAX), at: u.at }))
    .sort((a, b) => b.at - a.at)
    .slice(0, UPDATES_KEPT);
}

const HOUR = 3600_000;
/** Ross's town has a little news so the board isn't empty on a first visit. */
const rossNews = (name: string, now: number): BuildingUpdate[] | undefined => {
  if (name === "Film Club") return [{ id: nanoid(8), text: "Friday screening: Rear Window, 8pm", at: now - 2 * HOUR }];
  if (name === "Ross & Co.") return [{ id: nanoid(8), text: "Q3 deck ships Friday — comments open", at: now - 50 * HOUR }];
  return undefined;
};
const withRossNews = (w: World): World => {
  const now = Date.now();
  return { ...w, buildings: w.buildings.map((b) => (b.updates?.length ? b : { ...b, ...(rossNews(b.name, now) ? { updates: rossNews(b.name, now) } : {}) })) };
};

/** Stand-in showcase for a building name, so older worlds demo the feature. */
function demoShowcase(name: string): Showcase | undefined {
  const n = name.toLowerCase();
  // A steady, embeddable open video stands in until the real one is pasted in.
  const reel = (tagline: string): Showcase => ({ template: "reel", tagline, videoUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ" });
  if (n.includes("golf")) return reel("Season highlights, captain's cut.");
  if (n.includes("movie") || n.includes("film club")) return reel("Sunday screenings · projector hum, popcorn optional.");
  if (n.includes("fullsend"))
    return {
      template: "studio",
      tagline: "Selected work, shipped fast.",
      cover: "",
      cases: [
        { id: "c1", title: "Overview", blurb: "What we make, for whom, and why it works.", url: "" },
        { id: "c2", title: "Recent case study", blurb: "One project, start to finish.", url: "" },
      ],
    };
  if (n.includes("first band"))
    return {
      template: "scrapbook",
      tagline: "Garage days, preserved.",
      shots: [
        { id: "d1", src: "", caption: "First rehearsal" },
        { id: "d2", src: "", caption: "The demo tape" },
        { id: "d3", src: "", caption: "One real show" },
      ],
    };
  return undefined;
}

/** Places buildings on fresh lots, in order. Used to seed example worlds. */
function withBuildings(
  world: World,
  list: { name: string; type: BuildingType; oneLiner?: string; status?: Status; showcase?: Showcase; district?: "gig" | "side" | "fun" }[],
): World {
  let w = world;
  for (const item of list) {
    const status = item.status ?? "active";
    const hex =
      status === "past"
        ? pickOldTownLot(w.terrain, w.buildings)
        : item.district === "gig"
          ? { ...hubsFor(w.terrain).gig }
          : pickActiveLot(w.terrain, w.buildings, item.district ?? "side");
    if (!hex) break;
    const b: Building = {
      id: nanoid(10),
      slug: uniqueSlug(item.name, w.buildings),
      type: item.type,
      name: item.name,
      oneLiner: item.oneLiner ?? "",
      status,
      links: [],
      residents: [],
      hex,
      createdAt: Date.now(),
      ...(item.showcase ? { showcase: item.showcase } : {}),
      ...(item.district === "gig" ? { category: "gig" as const } : {}),
    };
    w = { ...w, buildings: [...w.buildings, b] };
  }
  return withRoads(w);
}

const ROSS_PITCH =
  "I run Ross & Co., a tiny strategy shop that helps founders turn messy ideas into decks investors actually read. Nights and weekends I'm building a coffee subscription and coaching Little League.";

/** Ross's starter world: placeholder buildings to rename, so travel has somewhere to land. */
function seedRoss(): World {
  return withRossNews(withBuildings({
    ...createEmptyWorld("Ross"),
    keepsakes: rossKeepsakes(),
    center: "clock",
    pitch: ROSS_PITCH,
  }, [
    { name: "Ross & Co.", type: "office", oneLiner: "The day job.", district: "gig" },
    { name: "Film Club", type: "theater", oneLiner: "Sunday screenings.", showcase: demoShowcase("Film Club"), district: "fun" },
    { name: "Pickup Soccer", type: "clubhouse", district: "fun" },
    { name: "First Band", type: "studio", status: "past", showcase: demoShowcase("First Band") },
  ]));
}

/** The founder's own: skiing, surfing and the Red Sox. */
const homeKeepsakes = (): Keepsake[] => [
  { kind: "ballpark", note: "Go Sox!" },
  { kind: "ski", note: "" },
  { kind: "surf", note: "" },
];

/** What a brand-new world starts with, by terrain. */
export const starterKeepsakes = (terrain: Terrain): Keepsake[] =>
  terrain === "mountain"
    ? [
        { kind: "ski", note: "First tracks" },
        { kind: "observatory", note: "" },
        { kind: "garden", note: "" },
      ]
    : [
        { kind: "ballpark", note: "Go Sox!" },
        { kind: "surf", note: "" },
        { kind: "bonfire", note: "" },
      ];
const rossKeepsakes = (): Keepsake[] => [
  { kind: "bonfire", note: "Friday nights" },
  { kind: "hoop", note: "" },
];

type WorldBook = { worlds: Record<string, World>; order: string[]; homeId: string; started: boolean };

function initialBook(home: World): WorldBook {
  const ross = seedRoss();
  return {
    worlds: { [home.id]: home, [ross.id]: ross },
    order: [home.id, ross.id],
    homeId: home.id,
    started: false,
  };
}

export type AddResult = { ok: true; building: Building } | { ok: false; reason: string };

type WorldState = WorldBook & {
  version: number;
  /** The world on screen right now (mirrors worlds[currentId]). */
  world: World;
  currentId: string;
  /** Bumps on reset/import so the scene can replay its intro. */
  epoch: number;
  /** Builds on `hex` when it's a free lot of the right kind, otherwise on the best free lot. */
  addBuilding: (input: {
    name: string;
    type: BuildingType;
    status?: Status;
    oneLiner?: string;
    hex?: Hex;
    /** Puts it on this main gig's plaza instead of a lot. */
    gigId?: string;
    client?: string;
    /** Makes it the main gig itself. */
    asGig?: boolean;
    /** Town district for a non-gig place. */
    district?: "side" | "fun";
  }) => AddResult;
  /** Turns a building into (or back from) the main gig plaza. */
  setGig: (id: string, on: boolean) => void;
  /** Moves a town place to the fountain (side hustles) or the playground (for fun). */
  setDistrict: (id: string, d: "side" | "fun") => boolean;
  /** Drags a plaza building to another spot on its plaza. */
  moveSpot: (id: string, spot: { x: number; z: number }) => void;
  updateBuilding: (
    id: string,
    patch: Partial<
      Pick<Building, "name" | "oneLiner" | "links" | "residents" | "type" | "style" | "grounds" | "accent" | "showcase" | "client">
    >,
  ) => void;
  /** Moves a building to a free lot. Old Town lots make it past; town lots bring it back. */
  moveBuilding: (id: string, hex: Hex) => boolean;
  setStatus: (id: string, status: Status) => boolean;
  knockDown: (id: string) => void;
  /** Puts a knocked-down building back (undo); takes a new lot if its old one is gone. */
  restoreBuilding: (b: Building) => void;
  setOwnerName: (name: string) => void;
  /** Swaps the landmark in the middle of your town. */
  setTownCenter: (center: TownCenter) => void;
  /** Your elevator pitch, shown to visitors. */
  setPitch: (pitch: string) => void;
  replaceWorld: (world: World) => void;
  reset: () => void;
  /** Starts a new, empty world for a friend and returns it. */
  createWorld: (ownerName: string) => World;
  /** Makes a world the one on screen. Travel animation lives in the renderer. */
  visit: (id: string) => void;
  /** First-run: skin the home world with the chosen terrain and seed its keepsakes. */
  chooseHome: (terrain: Terrain) => void;
  /** Re-skins the home world's town (beach ↔ mountain), keeping buildings and keepsakes. */
  setHomeTerrain: (terrain: Terrain) => void;
  /**
   * Adds a keepsake to the world on screen, or takes it away if it's already there.
   * False when the island already holds MAX_KEEPSAKES.
   */
  toggleKeepsake: (kind: KeepsakeKind) => boolean;
  /** The owner's words on a keepsake's sign ("Go Sox!"). */
  setKeepsakeNote: (kind: KeepsakeKind, note: string) => void;
  /** Pins keepsakes where they were dropped (pass every one on screen so none shuffle). */
  pinKeepsakes: (pins: { kind: KeepsakeKind; at: KeepsakePin }[]) => void;
  /** Posts a line of news on a building in your own world. False when empty or not yours. */
  postUpdate: (buildingId: string, text: string) => boolean;
  removeUpdate: (buildingId: string, updateId: string) => void;
};

/** Plaza buildings ride on their main gig's lot; orphans (gig knocked down) go with it. */
function syncPlazas(buildings: Building[]): Building[] {
  const byId = new Map(buildings.map((b) => [b.id, b]));
  return buildings.flatMap((b) => {
    if (!b.parentId) return [b];
    const gig = byId.get(b.parentId);
    if (!gig || gig.parentId) return [];
    return [{ ...b, hex: { ...gig.hex }, status: gig.status, spot: b.spot ?? { x: 1, z: 0 } }];
  });
}

/**
 * Keeps everyone in their district: the main gig stands on the square, other town places on a
 * fountain or playground lot (older worlds get moved over the first time they load).
 */
function syncDistricts(world: World): Building[] {
  const hubs = hubsFor(world.terrain);
  let gigSeen = false;
  let out = world.buildings.map((b) => {
    if (!isGig(b)) return b;
    if (gigSeen) {
      const next = { ...b };
      delete next.category;
      return next;
    }
    gigSeen = true;
    return hexEquals(b.hex, hubs.gig) ? b : { ...b, hex: { ...hubs.gig } };
  });
  const seen = new Set<string>();
  const stray: string[] = [];
  for (const b of out) {
    if (b.parentId || b.status === "past" || isGig(b)) continue;
    const key = `${b.hex.q},${b.hex.r}`;
    if (!districtOf(world.terrain, b.hex) || seen.has(key)) stray.push(b.id);
    else seen.add(key);
  }
  for (const id of stray) {
    const lot = pickActiveLot(world.terrain, out.filter((b) => b.id !== id));
    if (!lot) continue;
    out = out.map((b) => (b.id === id ? { ...b, hex: lot } : b));
    seen.add(`${lot.q},${lot.r}`);
  }
  return out;
}

function withRoads(world: World): World {
  const buildings = syncPlazas(syncDistricts(world));
  return { ...world, buildings, roads: computeRoads({ ...world, buildings }) };
}

const firstHome = createEmptyWorld();
const firstBook = initialBook(firstHome);

export const useWorldStore = create<WorldState>()(
  persist(
    (set, get) => {
      /** Writes the current world back into the book. */
      const commit = (world: World) => ({ world, worlds: { ...get().worlds, [world.id]: world } });
      /** Swaps the current world for a different one (import/reset), keeping its place in the sea. */
      const swapCurrent = (next: World) => {
        const { worlds, order, homeId, currentId } = get();
        const rest = { ...worlds };
        delete rest[currentId];
        const id = rest[next.id] ? nanoid(10) : next.id;
        const world = withRoads({ ...next, id, slug: uniqueWorldSlug(next.slug || next.ownerName, rest) });
        return {
          world,
          worlds: { ...rest, [id]: world },
          order: order.map((x) => (x === currentId ? id : x)),
          homeId: homeId === currentId ? id : homeId,
          currentId: id,
        };
      };
      return {
      version: STORE_VERSION,
      ...firstBook,
      world: firstHome,
      currentId: firstHome.id,
      epoch: 0,

      addBuilding: ({ name, type, status = "active", oneLiner = "", hex: wanted, gigId, client, asGig, district = "side" }) => {
        const { world } = get();
        const trimmed = name.trim();
        if (!trimmed) return { ok: false, reason: "Give it a name first." };
        const gig = gigId ? world.buildings.find((b) => b.id === gigId && isGig(b)) : undefined;
        if (gig) {
          const who = client?.trim().slice(0, 40);
          const building: Building = {
            id: nanoid(10),
            slug: uniqueSlug(trimmed, world.buildings),
            type,
            name: trimmed,
            oneLiner,
            status: gig.status,
            links: [],
            residents: [],
            hex: { ...gig.hex },
            createdAt: Date.now(),
            parentId: gig.id,
            spot: nextSpot(clientsOf(world.buildings, gig.id), who, roadOut(world, gig)),
            ...(who ? { client: who } : {}),
          };
          set(commit(withRoads({ ...world, buildings: [...world.buildings, building] })));
          return { ok: true, building };
        }
        // A new main gig takes the square; the old one retires to Old Town with its clients.
        let base = world.buildings;
        if (asGig && status !== "past") {
          const old = base.find(isGig);
          if (old) {
            const lot = pickOldTownLot(world.terrain, base);
            if (!lot) return { ok: false, reason: "Old Town is full, so your current main gig has nowhere to retire." };
            base = base.map((b) => (b.id === old.id ? { ...b, hex: lot, status: "past" as const } : b));
          }
        }
        const wantedOk =
          !!wanted &&
          !asGig &&
          (status === "past"
            ? lotZone(world.terrain, wanted) === "oldTown"
            : districtOf(world.terrain, wanted) === district) &&
          !base.some((b) => hexEquals(b.hex, wanted));
        const hex =
          asGig && status !== "past"
            ? { ...hubsFor(world.terrain).gig }
            : wantedOk
              ? wanted
              : status === "past"
                ? pickOldTownLot(world.terrain, base)
                : pickActiveLot(world.terrain, base, district, true);
        if (!hex)
          return {
            ok: false,
            reason:
              status === "past"
                ? "Old Town is full."
                : `The ${district === "fun" ? "playground" : "fountain"} is full. Knock something down or move it to Old Town.`,
          };
        const building: Building = {
          id: nanoid(10),
          slug: uniqueSlug(trimmed, world.buildings),
          type,
          name: trimmed,
          oneLiner,
          status,
          links: [],
          residents: [],
          hex,
          createdAt: Date.now(),
          ...(asGig ? { category: "gig" as const } : {}),
        };
        set(commit(withRoads({ ...world, buildings: [...base, building] })));
        return { ok: true, building };
      },

      setGig: (id, on) => {
        const { world } = get();
        const b = world.buildings.find((x) => x.id === id);
        if (!b || b.parentId || (on && (b.status === "past" || world.buildings.some((x) => x.id !== id && isGig(x))))) return;
        const buildings = world.buildings.map((x) => {
          if (x.id !== id) return x;
          const next = { ...x };
          if (on) {
            next.category = "gig";
            next.hex = { ...hubsFor(world.terrain).gig };
          } else {
            delete next.category;
            const lot = pickActiveLot(world.terrain, world.buildings.filter((y) => y.id !== id && y.parentId !== id));
            if (lot) next.hex = lot;
          }
          return next;
        });
        // Turning the plaza off sends its clients out to their own lots.
        const kids = on ? [] : clientsOf(buildings, id);
        let out = buildings.filter((x) => x.parentId !== id || on);
        for (const k of kids) {
          const lot = pickActiveLot(world.terrain, out);
          if (!lot) continue;
          const { parentId: _p, spot: _s, client: _c, ...rest } = k;
          void _p;
          void _s;
          void _c;
          out = [...out, { ...rest, hex: lot }];
        }
        set(commit(withRoads({ ...world, buildings: out })));
      },

      setDistrict: (id, d) => {
        const { world } = get();
        const b = world.buildings.find((x) => x.id === id);
        if (!b || b.parentId || isGig(b) || b.status === "past" || districtOf(world.terrain, b.hex) === d) return false;
        const lot = pickActiveLot(world.terrain, world.buildings.filter((x) => x.id !== id), d, true);
        if (!lot) return false;
        set(commit(withRoads({ ...world, buildings: world.buildings.map((x) => (x.id === id ? { ...x, hex: lot } : x)) })));
        return true;
      },

      moveSpot: (id, spot) => {
        const { world } = get();
        const buildings = world.buildings.map((x) => (x.id === id && x.parentId ? { ...x, spot: clampSpot(spot.x, spot.z) } : x));
        set(commit({ ...world, buildings }));
      },

      updateBuilding: (id, patch) => {
        const { world } = get();
        const buildings = world.buildings.map((b) => {
          if (b.id !== id) return b;
          const next = { ...b, ...patch };
          if (patch.name !== undefined) {
            next.name = patch.name.trim() || b.name;
            next.slug = uniqueSlug(next.name, world.buildings, id);
          }
          return next;
        });
        set(commit({ ...world, buildings }));
      },

      setStatus: (id, status) => {
        const { world } = get();
        const b = world.buildings.find((x) => x.id === id);
        if (!b || b.parentId || b.status === status) return false;
        if (b.category === "gig" && status !== "past" && world.buildings.some((x) => x.id !== id && isGig(x))) return false;
        const others = world.buildings.filter((x) => x.id !== id);
        const wasPast = b.status === "past";
        const isPast = status === "past";
        let hex = b.hex;
        if (wasPast !== isPast) {
          const lot = isPast
            ? pickOldTownLot(world.terrain, others)
            : pickActiveLot(world.terrain, others);
          if (!lot) return false;
          hex = lot;
        }
        const buildings = world.buildings.map((x) => (x.id === id ? { ...x, status, hex } : x));
        set(commit(withRoads({ ...world, buildings })));
        return true;
      },

      moveBuilding: (id, hex) => {
        const { world } = get();
        const b = world.buildings.find((x) => x.id === id);
        if (!b || b.parentId || isGig(b) || hexEquals(b.hex, hex)) return false;
        if (b.category === "gig" && world.buildings.some((x) => x.id !== id && isGig(x)) && lotZone(world.terrain, hex) === "active") return false;
        const zone = lotZone(world.terrain, hex);
        if (!zone || world.buildings.some((x) => x.id !== id && x.parentId !== id && hexEquals(x.hex, hex))) return false;
        const status: Status = zone === "oldTown" ? "past" : b.status === "past" ? "active" : b.status;
        const buildings = world.buildings.map((x) => (x.id === id ? { ...x, hex: { ...hex }, status } : x));
        set(commit(withRoads({ ...world, buildings })));
        return true;
      },

      knockDown: (id) => {
        const { world } = get();
        set(commit(withRoads({ ...world, buildings: world.buildings.filter((b) => b.id !== id) })));
      },

      restoreBuilding: (b) => {
        const { world } = get();
        if (world.buildings.some((x) => x.id === b.id)) return;
        const taken = world.buildings.some((x) => x.hex.q === b.hex.q && x.hex.r === b.hex.r);
        const hex = taken
          ? b.status === "past"
            ? pickOldTownLot(world.terrain, world.buildings)
            : pickActiveLot(world.terrain, world.buildings)
          : b.hex;
        if (!hex) return;
        const restored = { ...b, hex, slug: uniqueSlug(b.name, world.buildings) };
        set(commit(withRoads({ ...world, buildings: [...world.buildings, restored] })));
      },

      setOwnerName: (name) => {
        const { world } = get();
        const trimmed = name.trim().slice(0, 40);
        if (!trimmed) return;
        set(commit({ ...world, ownerName: trimmed, slug: uniqueWorldSlug(trimmed, get().worlds, world.id) }));
      },

      setTownCenter: (center) => {
        const { world } = get();
        if ((world.center ?? "park") === center) return;
        set(commit({ ...world, center }));
      },

      setPitch: (pitch) => {
        const { world } = get();
        const clean = pitch.trim().slice(0, PITCH_MAX);
        if ((world.pitch ?? "") === clean) return;
        set(commit({ ...world, pitch: clean }));
      },

      replaceWorld: (w) => set((s) => ({ ...swapCurrent(w), epoch: s.epoch + 1 })),

      reset: () => {
        // Force localStorage sync to ensure state is persisted before reset
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            // Parse to check for corruption; if parsing fails, clear it
            JSON.parse(raw);
          }
        } catch {
          console.warn("[reset] Clearing corrupted localStorage");
          localStorage.removeItem(STORAGE_KEY);
        }
        set((s) => {
          // Use state from callback directly instead of get() to avoid race conditions
          const { worlds, order, homeId, currentId, epoch, started } = s;
          const next = createEmptyWorld(s.world.ownerName, s.world.terrain);
          const rest = { ...worlds };
          delete rest[currentId];
          const id = rest[next.id] ? nanoid(10) : next.id;
          const world = withRoads({ ...next, id, slug: uniqueWorldSlug(next.slug || next.ownerName, rest) });
          return {
            world,
            worlds: { ...rest, [id]: world },
            order: order.map((x) => (x === currentId ? id : x)),
            homeId: homeId === currentId ? id : homeId,
            currentId: id,
            epoch: epoch + 1,
            // Resetting home starts over from the choice screen.
            started: currentId === homeId ? false : started,
          };
        });
      },

      createWorld: (ownerName) => {
        const { worlds, order } = get();
        const name = ownerName.trim().slice(0, 40) || "Friend";
        const base = createEmptyWorld(name);
        const world: World = { ...base, slug: uniqueWorldSlug(name, worlds) };
        set({ worlds: { ...worlds, [world.id]: world }, order: [...order, world.id] });
        return world;
      },

      visit: (id) => {
        const w = get().worlds[id];
        if (!w || id === get().currentId) return;
        set({ currentId: id, world: w });
      },

      setHomeTerrain: (terrain) => {
        const { worlds, homeId, currentId } = get();
        const home = worlds[homeId];
        if (!home || home.terrain === terrain) return;
        const next = withRoads({ ...home, terrain });
        set({
          worlds: { ...worlds, [homeId]: next },
          ...(currentId === homeId ? { world: next } : {}),
          epoch: get().epoch + 1,
        });
      },

      chooseHome: (terrain) => {
        const { worlds, homeId } = get();
        const home = worlds[homeId];
        if (!home) return;
        const world = withRoads({ ...home, terrain, keepsakes: starterKeepsakes(terrain) });
        set({
          worlds: { ...worlds, [homeId]: world },
          world,
          started: true,
          epoch: get().epoch + 1,
        });
      },

      toggleKeepsake: (kind) => {
        const { world } = get();
        const list = world.keepsakes ?? [];
        if (list.some((k) => k.kind === kind)) {
          set(commit({ ...world, keepsakes: list.filter((k) => k.kind !== kind) }));
          return true;
        }
        if (list.length >= MAX_KEEPSAKES) return false;
        set(commit({ ...world, keepsakes: [...list, { kind, note: "" }] }));
        return true;
      },

      setKeepsakeNote: (kind, note) => {
        const { world } = get();
        const clean = note.slice(0, NOTE_MAX);
        const list = world.keepsakes ?? [];
        if (!list.some((k) => k.kind === kind && k.note !== clean)) return;
        set(commit({ ...world, keepsakes: list.map((k) => (k.kind === kind ? { ...k, note: clean } : k)) }));
      },

      postUpdate: (buildingId, text) => {
        const { world, currentId, homeId } = get();
        const clean = text.trim().replace(/\s+/g, " ").slice(0, UPDATE_MAX);
        if (!clean || currentId !== homeId) return false;
        const b = world.buildings.find((x) => x.id === buildingId);
        if (!b) return false;
        const update: BuildingUpdate = { id: nanoid(8), text: clean, at: Date.now() };
        const buildings = world.buildings.map((x) =>
          x.id === buildingId ? { ...x, updates: [update, ...(x.updates ?? [])].slice(0, UPDATES_KEPT) } : x,
        );
        set(commit({ ...world, buildings }));
        return true;
      },

      removeUpdate: (buildingId, updateId) => {
        const { world, currentId, homeId } = get();
        if (currentId !== homeId) return;
        const buildings = world.buildings.map((x) =>
          x.id === buildingId ? { ...x, updates: (x.updates ?? []).filter((u) => u.id !== updateId) } : x,
        );
        set(commit({ ...world, buildings }));
      },

      pinKeepsakes: (pins) => {
        const { world } = get();
        const keepsakes = (world.keepsakes ?? []).map((k) => {
          const pin = pins.find((p) => p.kind === k.kind);
          return pin ? { ...k, at: { ...pin.at } } : k;
        });
        set(commit({ ...world, keepsakes }));
      },
      };
    },
    {
      name: STORAGE_KEY,
      version: STORE_VERSION,
      storage: createJSONStorage(() => ({
        getItem: (name) => localStorage.getItem(name),
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, value);
          } catch (e) {
            // QuotaExceededError - localStorage is full (likely due to large base64 images)
            console.error("[persist] Failed to save state:", e);
            // Try to clear and save again
            try {
              localStorage.removeItem(name);
              localStorage.setItem(name, value);
            } catch {
              console.error("[persist] Still cannot save after clearing. State may be too large.");
            }
          }
        },
        removeItem: (name) => localStorage.removeItem(name),
      })),
      partialize: (s) => ({ version: s.version, worlds: s.worlds, order: s.order, homeId: s.homeId, started: s.started }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error("[persist] Failed to rehydrate state:", error);
        } else if (state) {
          console.log("[persist] State rehydrated, worlds:", Object.keys(state.worlds ?? {}));
        }
      },
      migrate: (persisted, fromVersion) => {
        try {
          let p = persisted as {
            world?: unknown;
            worlds?: Record<string, World>;
            order?: string[];
            homeId?: string;
          };
          if (fromVersion < 2) {
            // v1 stored a single world: it becomes home, and Ross moves in next door.
            return { version: STORE_VERSION, ...initialBook(parseWorld(p.world)), started: true } as unknown as WorldState;
          }
          if (fromVersion < 3 && p.worlds) {
            // v3 introduced showcases: stamp stand-ins onto buildings that obviously want one.
            const worlds: Record<string, World> = {};
            for (const [id, w] of Object.entries(p.worlds)) {
              worlds[id] = {
                ...w,
                buildings: w.buildings.map((b) => (b.showcase ? b : { ...b, ...(demoShowcase(b.name) ? { showcase: demoShowcase(b.name) } : {}) })),
              };
            }
            p = { ...p, worlds };
          }
          if (fromVersion < 5 && p.worlds) {
            // v4 introduced keepsakes as bare kinds; v5 gives them notes and hand placement.
            // Home gets the founder's own (skiing, surfing, the Red Sox).
            const worlds: Record<string, World> = {};
            for (const [id, w] of Object.entries(p.worlds)) {
              const stamp = id === p.homeId ? homeKeepsakes() : w.ownerName === "Ross" ? rossKeepsakes() : [];
              const had = parseKeepsakes(w.keepsakes);
              const upgraded = had.map((k) => stamp.find((s) => s.kind === k.kind && !k.note) ?? k);
              worlds[id] = { ...w, keepsakes: fromVersion < 4 ? stamp : upgraded };
            }
            p = { ...p, worlds };
          }
          return p as unknown as WorldState;
        } catch {
          return { version: STORE_VERSION, ...initialBook(createEmptyWorld()) } as unknown as WorldState;
        }
      },
      merge: (persisted, current) => {
        const p = persisted as Partial<WorldBook> | undefined;
        if (!p?.worlds || !p.order?.length || !p.homeId || !p.worlds[p.homeId]) return current;
        const worlds: Record<string, World> = {};
        for (const id of p.order) {
          const w = p.worlds[id];
          // Ross's town gets its starter news once, so neighbors have something to read.
          if (!w) continue;
          const ross = w.ownerName === "Ross" && id !== p.homeId;
          let next = ross && !w.buildings.some((b) => b.updates?.length) ? withRossNews(w) : w;
          // Older saves: give Ross his landmark and pitch so visiting shows them off.
          if (ross && next.pitch === undefined) next = { ...next, center: next.center ?? "clock", pitch: ROSS_PITCH };
          worlds[id] = withRoads(next);
        }
        const order = p.order.filter((id) => worlds[id]);
        // Existing worlds predate the choice screen, so they've already started.
        return { ...current, worlds, order, homeId: p.homeId, started: p.started ?? true, currentId: p.homeId, world: worlds[p.homeId] };
      },
    },
  ),
);

export const getWorldBySlug = (worlds: Record<string, World>, slug: string): World | undefined =>
  Object.values(worlds).find((w) => w.slug === slug);

export const getBuildingBySlug = (world: World, slug: string): Building | undefined =>
  world.buildings.find((b) => b.slug === slug);

/** Serializes the world in the export/API format. */
export function exportWorld(world: World): string {
  return JSON.stringify({ format: "myworld", version: STORE_VERSION, world }, null, 2);
}

if (typeof window !== "undefined") {
  const w = window as unknown as { worlds: typeof useWorldStore; myworld: typeof useWorldStore };
  w.worlds = useWorldStore;
  w.myworld = useWorldStore;
}
