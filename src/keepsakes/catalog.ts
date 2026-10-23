import type { Keepsake, KeepsakeKind } from "@/store/types";

/** Where on the island a keepsake likes to sit. */
export type KeepsakeZone = "edge" | "yard" | "beach";

export type KeepsakeInfo = {
  kind: KeepsakeKind;
  label: string;
  blurb: string;
  zone: KeepsakeZone;
  /** Radius it covers on the ground, in world units (before KEEPSAKE_SCALE). */
  footprint: number;
};

/** Keepsakes are drawn a touch smaller than buildings so they stay background flavor. */
export const KEEPSAKE_SCALE = 0.86;

/** How many keepsakes one island can hold, for now. */
export const MAX_KEEPSAKES = 3;

/** Longest note on a keepsake's sign. */
export const NOTE_MAX = 40;

export const KEEPSAKES: KeepsakeInfo[] = [
  { kind: "ski", label: "Ski hill", blurb: "A snowy run and a chairlift on the edge of town", zone: "edge", footprint: 1.15 },
  { kind: "ballpark", label: "Ballpark", blurb: "A little diamond with a big green wall", zone: "edge", footprint: 0.95 },
  { kind: "surf", label: "Surf rack", blurb: "Oversized boards waiting by the water", zone: "beach", footprint: 0.5 },
  { kind: "bonfire", label: "Bonfire", blurb: "A crackling ring of stones on the sand", zone: "beach", footprint: 0.5 },
  { kind: "hammock", label: "Hammock", blurb: "Strung between two palms, swaying", zone: "beach", footprint: 0.6 },
  { kind: "hoop", label: "Hoop court", blurb: "Half court, always a game on", zone: "yard", footprint: 0.6 },
  { kind: "garden", label: "Veggie patch", blurb: "Tidy rows and one tall sunflower", zone: "yard", footprint: 0.55 },
  { kind: "observatory", label: "Stargazer", blurb: "A tiny dome with its telescope out", zone: "yard", footprint: 0.45 },
];

const BY_KIND = new Map(KEEPSAKES.map((k) => [k.kind, k]));

export const keepsakeInfo = (kind: KeepsakeKind): KeepsakeInfo | undefined => BY_KIND.get(kind);

export const isKeepsakeKind = (v: unknown): v is KeepsakeKind => typeof v === "string" && BY_KIND.has(v as KeepsakeKind);

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Cleans up a stored keepsake list: accepts the older bare-kind format, drops unknown kinds and
 * duplicates, trims notes, and keeps at most MAX_KEEPSAKES.
 */
export function parseKeepsakes(raw: unknown): Keepsake[] {
  if (!Array.isArray(raw)) return [];
  const out: Keepsake[] = [];
  for (const item of raw) {
    const obj = (typeof item === "string" ? { kind: item } : item) as Partial<Keepsake> | null;
    if (!obj || !isKeepsakeKind(obj.kind) || out.some((k) => k.kind === obj.kind)) continue;
    const at = obj.at;
    out.push({
      kind: obj.kind,
      note: typeof obj.note === "string" ? obj.note.trim().slice(0, NOTE_MAX) : "",
      ...(at && finite(at.x) && finite(at.z) && finite(at.rot) ? { at: { x: at.x, z: at.z, rot: at.rot } } : {}),
    });
    if (out.length >= MAX_KEEPSAKES) break;
  }
  return out;
}
