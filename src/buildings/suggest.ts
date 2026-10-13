import type { BuildingType } from "@/store/types";
import { PICKABLE_TYPES } from "@/store/types";

type Rule = { type: BuildingType; keywords: string[]; unless?: string[] };

const RULES: Rule[] = [
  {
    type: "office",
    keywords: ["agency", "company", "consultancy", "consulting", "firm", "studio", "startup", "cfo", "advisor", "advisory", "co", "inc", "llc", "send", "partners", "labs"],
    unless: ["design"],
  },
  { type: "theater", keywords: ["film", "movie", "show", "trailer", "theater", "theatre", "production", "cinema", "documentary"] },
  { type: "workshop", keywords: ["lab", "side", "project", "experiment", "github", "prototype", "app", "hack", "tool", "repo", "open source"] },
  { type: "clubhouse", keywords: ["golf", "league", "team", "club", "sport", "soccer", "tennis", "run", "crew"] },
  { type: "studio", keywords: ["design", "creative", "music", "podcast", "film", "art", "photo", "record"], unless: ["theater", "theatre"] },
  { type: "exchange", keywords: ["invest", "investing", "capital", "fund", "portfolio", "bets", "angel", "ventures", "vc", "syndicate"] },
  { type: "tower", keywords: ["corporate", "enterprise", "bank", "google", "amazon", "microsoft", "apple", "meta", "deloitte", "mckinsey", "goldman", "global", "group", "holdings"] },
  { type: "clinic", keywords: ["health", "dental", "medical", "care", "clinic", "therapy", "wellness", "bio"] },
  { type: "storefront", keywords: ["shop", "store", "brand", "product", "sell", "goods", "market", "coffee", "bakery", "merch"] },
];

const DEFAULTS: BuildingType[] = ["office", "workshop", "storefront"];

const LABELS: Record<BuildingType, string> = {
  house: "House",
  office: "Office",
  studio: "Studio",
  workshop: "Workshop",
  clubhouse: "Clubhouse",
  theater: "Theater",
  exchange: "Exchange",
  tower: "Tower",
  clinic: "Clinic",
  storefront: "Storefront",
};

export const typeLabel = (t: BuildingType): string => LABELS[t];

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/['’]s\b/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Scores a single keyword against tokens: whole-word hits weigh more than prefix hits. */
function score(tokens: string[], joined: string, kw: string): number {
  if (kw.includes(" ")) return joined.includes(kw) ? 2 : 0;
  let s = 0;
  for (const t of tokens) {
    if (t === kw) s += 2;
    else if (kw.length >= 3 && t.length > kw.length && (t.startsWith(kw) || t.endsWith(kw))) s += 1;
  }
  return s;
}

/**
 * Suggests three building types for a name via keyword rules.
 * Pure and synchronous; wrap in suggestTypes() for the async-ready signature.
 */
export function suggestSync(input: string): BuildingType[] {
  const tokens = tokenize(input);
  const joined = tokens.join(" ");
  const has = (w: string) => tokens.some((t) => t === w || t.startsWith(w));
  const scored: { type: BuildingType; hits: number; order: number }[] = [];
  RULES.forEach((rule, order) => {
    if (rule.unless?.some(has)) return;
    const hits = rule.keywords.reduce((acc, kw) => acc + score(tokens, joined, kw), 0);
    if (hits > 0) scored.push({ type: rule.type, hits, order });
  });
  scored.sort((a, b) => b.hits - a.hits || a.order - b.order);
  const out: BuildingType[] = [];
  for (const s of scored) if (!out.includes(s.type)) out.push(s.type);
  for (const d of DEFAULTS) if (out.length < 3 && !out.includes(d)) out.push(d);
  return out.slice(0, 3);
}

/** Async-ready entry point; a model call can replace this later with the same shape. */
export async function suggestTypes(input: string): Promise<BuildingType[]> {
  return suggestSync(input);
}

/** Searches the full kit by type name for "type over the box" queries. */
export function searchKit(query: string): BuildingType[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return PICKABLE_TYPES.filter((t) => t.startsWith(q) || LABELS[t].toLowerCase().includes(q));
}
