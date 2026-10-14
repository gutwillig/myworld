import type { Building, BuildingUpdate, World } from "@/store/types";

/** Longest line of news a building can post. */
export const UPDATE_MAX = 120;
/** How many updates a building keeps (oldest fall off). */
export const UPDATES_KEPT = 12;
/** News younger than this flies a pennant on the building. */
export const FRESH_MS = 7 * 24 * 3600_000;

export type TownNews = { building: Building; update: BuildingUpdate };

export const latestUpdate = (b: Building): BuildingUpdate | undefined => b.updates?.[0];

/** True when the building has news from the last week. */
export function isFresh(b: Building, now: number = Date.now()): boolean {
  const u = latestUpdate(b);
  return !!u && now - u.at < FRESH_MS;
}

/** Every update in town, newest first. */
export function townNews(world: World): TownNews[] {
  const all: TownNews[] = [];
  for (const building of world.buildings) for (const update of building.updates ?? []) all.push({ building, update });
  return all.sort((a, b) => b.update.at - a.update.at);
}

/** "now", "5m", "2h", "3d", or "Oct 9" for anything older than a week. */
export function timeAgo(at: number, now: number = Date.now()): string {
  const s = Math.max(0, (now - at) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  return new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
