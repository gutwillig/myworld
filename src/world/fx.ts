import { create } from "zustand";
import type { Hex } from "@/grid/hex";
import type { BuildingType, KeepsakeKind } from "@/store/types";

/**
 * Transient, non-persisted UI/animation state. Kept separate from the world store,
 * which knows nothing about rendering.
 */
export type LeaveKind = "demolish" | "sink";

/** A ferry ride between two worlds, timed by the renderer. */
export type Travel = { fromId: string; toId: string; start: number; duration: number; sail: number };

/** The building the prompt bar is about to build, previewed as a ghost on a lot. */
export type Placement = { name: string; type: BuildingType; hex: Hex };

/**
 * A world previewed before sailing there: either a resident opened from a building
 * (`buildingId` set) or a neighbor picked from the top menu (`worldId` set).
 */
export type VisitIntent = { resident: string; buildingId?: string; worldId?: string; fromWorldId: string };

type FxState = {
  visit: VisitIntent | null;
  openVisit: (v: VisitIntent | null) => void;
  /** Replaces the generic welcome line on the next arrival. */
  arrivalNote: { worldId: string; text: string } | null;
  setArrivalNote: (n: { worldId: string; text: string } | null) => void;
  placement: Placement | null;
  setPlacement: (p: Placement | null) => void;
  /** Moves the ghost to a lot (hover). */
  aimPlacement: (hex: Hex) => void;
  /** Bumped when a lot is clicked during placement; the prompt bar builds there. */
  placeTick: number;
  confirmPlacement: (hex: Hex) => void;
  /** Pointer pressed on a building; becomes a move once it travels a few pixels. */
  press: { id: string; x: number; y: number } | null;
  setPress: (p: { id: string; x: number; y: number } | null) => void;
  /** A building being dragged to another lot. */
  moving: { id: string } | null;
  setMoving: (m: { id: string } | null) => void;
  /** The lot under the pointer while placing or moving. */
  lotHover: Hex | null;
  setLotHover: (h: Hex | null) => void;
  /** Set right before a drag-drop commits so the building lands instead of sinking and rising. */
  droppedId: string | null;
  setDropped: (id: string | null) => void;
  /** Keepsake under the pointer (its sign shows). */
  keepsakeHover: KeepsakeKind | null;
  hoverKeepsake: (k: KeepsakeKind | null) => void;
  /** Pointer pressed on one of your keepsakes; becomes a drag once it travels a few pixels. */
  keepsakePress: { kind: KeepsakeKind; x: number; y: number } | null;
  setKeepsakePress: (p: { kind: KeepsakeKind; x: number; y: number } | null) => void;
  /** A keepsake being carried, and whether it can be set down where it is. */
  keepsakeMove: { kind: KeepsakeKind; fits: boolean } | null;
  setKeepsakeMove: (m: { kind: KeepsakeKind; fits: boolean } | null) => void;
  /** Keepsake whose sign is open for writing on. */
  keepsakeEdit: KeepsakeKind | null;
  editKeepsake: (k: KeepsakeKind | null) => void;
  travel: Travel | null;
  startTravel: (fromId: string, toId: string, sailSeconds: number) => void;
  endTravel: () => void;
  selectedId: string | null;
  hoveredId: string | null;
  leaving: Record<string, { kind: LeaveKind; at: number }>;
  /** Pixels moved during the current pointer drag; used to swallow clicks after orbiting. */
  dragDistance: number;
  select: (id: string | null) => void;
  hover: (id: string | null) => void;
  markLeaving: (id: string, kind: LeaveKind) => void;
  clearLeaving: (id: string) => void;
  setDragDistance: (d: number) => void;
};

export const useFx = create<FxState>()((set) => ({
  visit: null,
  openVisit: (v) => set({ visit: v }),
  arrivalNote: null,
  setArrivalNote: (n) => set({ arrivalNote: n }),
  placement: null,
  setPlacement: (p) => set({ placement: p }),
  aimPlacement: (hex) =>
    set((s) => (s.placement && (s.placement.hex.q !== hex.q || s.placement.hex.r !== hex.r) ? { placement: { ...s.placement, hex } } : {})),
  placeTick: 0,
  confirmPlacement: (hex) => set((s) => (s.placement ? { placement: { ...s.placement, hex }, placeTick: s.placeTick + 1 } : {})),
  press: null,
  setPress: (p) => set({ press: p }),
  moving: null,
  setMoving: (m) => set({ moving: m }),
  lotHover: null,
  setLotHover: (h) =>
    set((s) => {
      const a = s.lotHover;
      if (a === h || (a && h && a.q === h.q && a.r === h.r)) return {};
      return { lotHover: h };
    }),
  droppedId: null,
  setDropped: (id) => set({ droppedId: id }),
  keepsakeHover: null,
  hoverKeepsake: (k) => set((s) => (s.keepsakeHover === k ? {} : { keepsakeHover: k })),
  keepsakePress: null,
  setKeepsakePress: (p) => set({ keepsakePress: p }),
  keepsakeMove: null,
  setKeepsakeMove: (m) =>
    set((s) => (s.keepsakeMove?.kind === m?.kind && s.keepsakeMove?.fits === m?.fits ? {} : { keepsakeMove: m })),
  keepsakeEdit: null,
  editKeepsake: (k) => set({ keepsakeEdit: k }),
  travel: null,
  startTravel: (fromId, toId, sail) =>
    set({
      travel: { fromId, toId, start: performance.now(), sail, duration: sail + TRAVEL_LEAD + TRAVEL_TAIL },
      selectedId: null,
      hoveredId: null,
      keepsakeHover: null,
      keepsakeEdit: null,
      visit: null,
    }),
  endTravel: () => set({ travel: null }),
  selectedId: null,
  hoveredId: null,
  leaving: {},
  dragDistance: 0,
  select: (id) => set({ selectedId: id }),
  hover: (id) => set({ hoveredId: id }),
  markLeaving: (id, kind) => set((s) => ({ leaving: { ...s.leaving, [id]: { kind, at: performance.now() } } })),
  clearLeaving: (id) =>
    set((s) => {
      const next = { ...s.leaving };
      delete next[id];
      return { leaving: next };
    }),
  setDragDistance: (d) => set({ dragDistance: d }),
}));

export const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t: number): number => t * t * t;
export const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

/** Seconds of a building's sequence: road 0–0.7, rise 0.5–1.3, sign 1.2–1.6. */
export const TIMING = {
  roadEnd: 0.7,
  riseStart: 0.5,
  riseEnd: 1.3,
  signStart: 1.2,
  leave: 0.42,
};

/** Seconds of zoom-out before the boat leaves, and of zoom-in after it docks. */
export const TRAVEL_LEAD = 0.8;
export const TRAVEL_TAIL = 1.2;

const smooth = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * One frame of a trip. `out` eases the camera up to the sea view, `back` eases it down onto the
 * destination, `boat` is progress along the route.
 */
export function travelFrame(tr: Travel, now: number): { t: number; out: number; back: number; lift: number; boat: number; done: boolean } {
  const t = (now - tr.start) / 1000;
  const out = smooth(0, TRAVEL_LEAD + 0.6, t);
  const back = smooth(tr.duration - TRAVEL_TAIL - 0.3, tr.duration, t);
  const boat = easeInOutCubic(clamp01((t - TRAVEL_LEAD) / tr.sail));
  return { t, out, back, lift: out * (1 - back), boat, done: t >= tr.duration };
}

if (typeof window !== "undefined" && import.meta.env.DEV) {
  (window as unknown as { myworldFx: typeof useFx }).myworldFx = useFx;
}
