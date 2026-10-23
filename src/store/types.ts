import type { Hex } from "@/grid/hex";

export type { Hex };

export type Terrain = "beach" | "mountain" | "village";
export type Status = "active" | "past" | "lab";
export type BuildingType =
  | "house"
  | "office"
  | "studio"
  | "workshop"
  | "clubhouse"
  | "theater"
  | "exchange"
  | "tower"
  | "clinic"
  | "storefront";

export type Link = { label: string; url: string };

/** One work entry in a Studio showcase. */
export type CaseStudy = { id: string; title: string; blurb: string; url: string };
/** One photo in a Scrapbook showcase. `src` is a data URL; empty = drawn placeholder. */
export type Shot = { id: string; src: string; caption: string };

/**
 * The consumable story inside a building, shown when you click it.
 * Three templates: a video, a portfolio, a photo set.
 */
export type Showcase =
  | { template: "reel"; tagline: string; videoUrl: string }
  | { template: "studio"; tagline: string; cover: string; cases: CaseStudy[] }
  | { template: "scrapbook"; tagline: string; shots: Shot[] };

/** A short line of news from a building ("Hole 7 reopened"). Newest first on the building. */
export type BuildingUpdate = { id: string; text: string; at: number };

export type Building = {
  id: string;
  slug: string;
  type: BuildingType;
  name: string;
  oneLiner: string;
  /** active = paved road, past = Old Town, lab = side experiment on a paved road */
  status: Status;
  links: Link[];
  residents: string[];
  hex: Hex;
  createdAt: number;
  /** Architectural style id within the type (see buildings/styles). Missing = the type's first style. */
  style?: string;
  /** What surrounds the lot (see buildings/grounds). Missing = the type's default. */
  grounds?: string;
  /** Accent color override. Missing = picked from the id. */
  accent?: string;
  /** The media story shown when the building is opened. Missing = plain panel. */
  showcase?: Showcase;
  /** News posted by the owner, newest first. Missing = none yet. */
  updates?: BuildingUpdate[];
  /** "gig" = the owner's main job: drawn as a plaza with its clients around it. */
  category?: "gig";
  /** Set on plaza buildings: the main-gig building whose plaza this sits on. */
  parentId?: string;
  /** Plaza buildings: offset from the plaza center, in world units. */
  spot?: { x: number; z: number };
  /** Plaza buildings: which client this workstream is for. */
  client?: string;
};

/** Small props that give an island personality (see keepsakes/catalog). */
export type KeepsakeKind = "ski" | "ballpark" | "surf" | "bonfire" | "hammock" | "hoop" | "garden" | "observatory";

/** Where a keepsake was dropped by hand, in island-local units. */
export type KeepsakePin = { x: number; z: number; rot: number };

/** A keepsake on an island, with the owner's own words for it ("Go Sox!"). */
export type Keepsake = {
  kind: KeepsakeKind;
  note: string;
  /** Missing = placed automatically. */
  at?: KeepsakePin;
};

export type Road = { from: Hex; to: Hex; kind: "paved" | "dirt"; path: Hex[] };

export type World = {
  id: string;
  slug: string;
  ownerName: string;
  terrain: Terrain;
  home: Hex;
  buildings: Building[];
  roads: Road[];
  /** In the order they were added; earlier ones keep their spot when more arrive. */
  keepsakes?: Keepsake[];
};

export const PICKABLE_TYPES: BuildingType[] = [
  "office",
  "studio",
  "workshop",
  "clubhouse",
  "theater",
  "exchange",
  "tower",
  "clinic",
  "storefront",
];
