import type { BuildingType } from "@/store/types";
import { arcade } from "./arcade";
import { clinic } from "./clinic";
import { clubhouse } from "./clubhouse";
import type { KitBuilder } from "./common";
import { exchange } from "./exchange";
import { house } from "./house";
import { office } from "./office";
import { storefront } from "./storefront";
import { studio } from "./studio";
import { theater } from "./theater";
import { tower } from "./tower";
import { workshop } from "./workshop";

export const KIT: Record<BuildingType, KitBuilder> = {
  house,
  office,
  studio,
  workshop,
  clubhouse,
  theater,
  exchange,
  tower,
  clinic,
  storefront,
  arcade,
};

/** Accent palette; each building picks one from its id so two offices differ. */
export const ACCENTS = ["#E5694F", "#D9A441", "#4E8F8A", "#C4573A", "#6F8FC9", "#B86A8F", "#5E9B5A", "#E08A3C"];

export const DEFAULT_ACCENT: Record<BuildingType, string> = {
  house: "#D9674A",
  office: "#E5694F",
  studio: "#4E8F8A",
  workshop: "#D9A441",
  clubhouse: "#E5694F",
  theater: "#C4573A",
  exchange: "#4E8F8A",
  tower: "#6F8FC9",
  clinic: "#E05A4F",
  storefront: "#E5694F",
  arcade: "#B86A8F",
};

export function accentFor(type: BuildingType, id: string): string {
  if (type === "clinic" || type === "house") return DEFAULT_ACCENT[type];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const base = ACCENTS.indexOf(DEFAULT_ACCENT[type]);
  return ACCENTS[(base + (h % 3)) % ACCENTS.length];
}

/** A building's accent: its own choice, or one picked from its id. */
export function buildingAccent(b: { type: BuildingType; id: string; accent?: string }): string {
  return b.accent ?? accentFor(b.type, b.id);
}
