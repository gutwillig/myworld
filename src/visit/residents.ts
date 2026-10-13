import { slugify } from "@/store/world";
import type { Building, World } from "@/store/types";

const firstWord = (s: string): string => s.trim().split(/\s+/)[0]?.toLowerCase() ?? "";

/**
 * The neighbor world a resident name points at. "Ross", "ross" and "Ross Miller" all find
 * Ross's world; a full-name match wins over a first-name one. Never returns home.
 */
export function worldForResident(worlds: Record<string, World>, order: string[], homeId: string, name: string): World | undefined {
  const full = name.trim().toLowerCase();
  const first = firstWord(name);
  if (!first) return undefined;
  const others = order.filter((id) => id !== homeId).map((id) => worlds[id]).filter((w): w is World => !!w);
  return (
    others.find((w) => w.ownerName.trim().toLowerCase() === full) ??
    others.find((w) => firstWord(w.ownerName) === first)
  );
}

/** The same place in someone else's world, matched by name ("Accenture" ↔ "accenture"). */
export function sharedBuilding(world: World | undefined, name: string): Building | undefined {
  if (!world) return undefined;
  const slug = slugify(name);
  return world.buildings.find((b) => slugify(b.name) === slug);
}
