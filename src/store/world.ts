import { nanoid } from "nanoid";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { hexEquals, type Hex } from "@/grid/hex";
import { HOME, computeRoads, lotZone, pickActiveLot, pickOldTownLot } from "@/grid/layout";
import { MAX_KEEPSAKES, NOTE_MAX, parseKeepsakes } from "@/keepsakes/catalog";
import type { Building, BuildingType, Keepsake, KeepsakeKind, KeepsakePin, Showcase, Status, Terrain, World } from "./types";

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
    }));
  const world: World = {
    ...base,
    id: obj.id ?? base.id,
    slug: obj.slug ?? base.slug,
    terrain: obj.terrain ?? "beach",
    buildings,
    roads: [],
    keepsakes: parseKeepsakes(obj.keepsakes),
  };
  world.roads = computeRoads(world);
  return world;
}

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
  list: { name: string; type: BuildingType; oneLiner?: string; status?: Status; showcase?: Showcase }[],
): World {
  let w = world;
  for (const item of list) {
    const status = item.status ?? "active";
    const hex = status === "past" ? pickOldTownLot(w.terrain, w.buildings) : pickActiveLot(w.terrain, w.buildings);
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
    };
    w = { ...w, buildings: [...w.buildings, b] };
  }
  return withRoads(w);
}

/** Ross's starter world: placeholder buildings to rename, so travel has somewhere to land. */
function seedRoss(): World {
  return withBuildings({ ...createEmptyWorld("Ross"), keepsakes: rossKeepsakes() }, [
    { name: "Ross & Co.", type: "office", oneLiner: "The day job." },
    { name: "Film Club", type: "theater", oneLiner: "Sunday screenings.", showcase: demoShowcase("Film Club") },
    { name: "Pickup Soccer", type: "clubhouse" },
    { name: "First Band", type: "studio", status: "past", showcase: demoShowcase("First Band") },
  ]);
}

/** The founder's own: skiing, surfing and the Red Sox. */
const homeKeepsakes = (): Keepsake[] => [
  { kind: "ballpark", note: "Go Sox!" },
  { kind: "ski", note: "" },
  { kind: "surf", note: "" },
];
const rossKeepsakes = (): Keepsake[] => [
  { kind: "bonfire", note: "Friday nights" },
  { kind: "hoop", note: "" },
];

type WorldBook = { worlds: Record<string, World>; order: string[]; homeId: string };

function initialBook(home: World): WorldBook {
  const ross = seedRoss();
  return { worlds: { [home.id]: home, [ross.id]: ross }, order: [home.id, ross.id], homeId: home.id };
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
  addBuilding: (input: { name: string; type: BuildingType; status?: Status; oneLiner?: string; hex?: Hex }) => AddResult;
  updateBuilding: (
    id: string,
    patch: Partial<
      Pick<Building, "name" | "oneLiner" | "links" | "residents" | "type" | "style" | "grounds" | "accent" | "showcase">
    >,
  ) => void;
  /** Moves a building to a free lot. Old Town lots make it past; town lots bring it back. */
  moveBuilding: (id: string, hex: Hex) => boolean;
  setStatus: (id: string, status: Status) => boolean;
  knockDown: (id: string) => void;
  /** Puts a knocked-down building back (undo); takes a new lot if its old one is gone. */
  restoreBuilding: (b: Building) => void;
  setOwnerName: (name: string) => void;
  replaceWorld: (world: World) => void;
  reset: () => void;
  /** Starts a new, empty world for a friend and returns it. */
  createWorld: (ownerName: string) => World;
  /** Makes a world the one on screen. Travel animation lives in the renderer. */
  visit: (id: string) => void;
  /**
   * Adds a keepsake to the world on screen, or takes it away if it's already there.
   * False when the island already holds MAX_KEEPSAKES.
   */
  toggleKeepsake: (kind: KeepsakeKind) => boolean;
  /** The owner's words on a keepsake's sign ("Go Sox!"). */
  setKeepsakeNote: (kind: KeepsakeKind, note: string) => void;
  /** Pins keepsakes where they were dropped (pass every one on screen so none shuffle). */
  pinKeepsakes: (pins: { kind: KeepsakeKind; at: KeepsakePin }[]) => void;
};

function withRoads(world: World): World {
  return { ...world, roads: computeRoads(world) };
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

      addBuilding: ({ name, type, status = "active", oneLiner = "", hex: wanted }) => {
        const { world } = get();
        const trimmed = name.trim();
        if (!trimmed) return { ok: false, reason: "Give it a name first." };
        const wantedOk =
          !!wanted &&
          lotZone(world.terrain, wanted) === (status === "past" ? "oldTown" : "active") &&
          !world.buildings.some((b) => hexEquals(b.hex, wanted));
        const hex = wantedOk
          ? wanted
          : status === "past"
            ? pickOldTownLot(world.terrain, world.buildings)
            : pickActiveLot(world.terrain, world.buildings);
        if (!hex) return { ok: false, reason: "Your town is full. Knock something down or move it to Old Town." };
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
        };
        set(commit(withRoads({ ...world, buildings: [...world.buildings, building] })));
        return { ok: true, building };
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
        if (!b || b.status === status) return false;
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
        if (!b || hexEquals(b.hex, hex)) return false;
        const zone = lotZone(world.terrain, hex);
        if (!zone || world.buildings.some((x) => x.id !== id && hexEquals(x.hex, hex))) return false;
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

      replaceWorld: (w) => set((s) => ({ ...swapCurrent(w), epoch: s.epoch + 1 })),

      reset: () => set((s) => ({ ...swapCurrent(createEmptyWorld(s.world.ownerName)), epoch: s.epoch + 1 })),

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
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ version: s.version, worlds: s.worlds, order: s.order, homeId: s.homeId }),
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
            return { version: STORE_VERSION, ...initialBook(parseWorld(p.world)) } as unknown as WorldState;
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
          if (w) worlds[id] = withRoads(w);
        }
        const order = p.order.filter((id) => worlds[id]);
        return { ...current, worlds, order, homeId: p.homeId, currentId: p.homeId, world: worlds[p.homeId] };
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

if (typeof window !== "undefined" && import.meta.env.DEV) {
  const w = window as unknown as { worlds: typeof useWorldStore; myworld: typeof useWorldStore };
  w.worlds = useWorldStore;
  w.myworld = useWorldStore;
}
