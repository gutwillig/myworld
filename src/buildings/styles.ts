import type { BuildingType } from "@/store/types";
import * as alt from "./kit/alt";
import type { KitBuilder } from "./kit/common";
import { KIT } from "./kit";

/** One architectural style of a building type. */
export type StyleDef = { id: string; label: string; build: KitBuilder };

/** Every type's styles; the first is the default (the original kit model). */
export const STYLES: Record<BuildingType, StyleDef[]> = {
  house: [{ id: "cottage", label: "Cottage", build: KIT.house }],
  office: [
    { id: "classic", label: "Two-story", build: KIT.office },
    { id: "loft", label: "Brick loft", build: alt.officeLoft },
    { id: "glass", label: "Glass HQ", build: alt.officeGlass },
  ],
  studio: [
    { id: "sawtooth", label: "Sawtooth", build: KIT.studio },
    { id: "barn", label: "Barn", build: alt.studioBarn },
    { id: "aframe", label: "A-frame", build: alt.studioAFrame },
  ],
  workshop: [
    { id: "shed", label: "Open shed", build: KIT.workshop },
    { id: "garage", label: "Garage", build: alt.workshopGarage },
    { id: "greenhouse", label: "Greenhouse lab", build: alt.workshopGreenhouse },
  ],
  clubhouse: [
    { id: "lodge", label: "Lodge", build: KIT.clubhouse },
    { id: "links", label: "Links cottage", build: alt.clubhouseLinks },
    { id: "modern", label: "Modern club", build: alt.clubhouseModern },
  ],
  theater: [
    { id: "marquee", label: "Marquee", build: KIT.theater },
    { id: "drivein", label: "Drive-in", build: alt.theaterDriveIn },
    { id: "arthouse", label: "Art house", build: alt.theaterArtHouse },
    { id: "palace", label: "Picture palace", build: alt.theaterPalace },
  ],
  exchange: [
    { id: "temple", label: "Temple", build: KIT.exchange },
    { id: "bank", label: "Clock bank", build: alt.exchangeBank },
    { id: "rotunda", label: "Rotunda", build: alt.exchangeRotunda },
  ],
  tower: [
    { id: "stepped", label: "Stepped", build: KIT.tower },
    { id: "deco", label: "Art deco", build: alt.towerDeco },
    { id: "twin", label: "Twin towers", build: alt.towerTwin },
  ],
  clinic: [
    { id: "clinic", label: "Clinic", build: KIT.clinic },
    { id: "pavilion", label: "Wellness pavilion", build: alt.clinicPavilion },
    { id: "hospital", label: "Hospital", build: alt.clinicHospital },
  ],
  storefront: [
    { id: "shop", label: "Corner shop", build: KIT.storefront },
    { id: "cafe", label: "Café", build: alt.storefrontCafe },
    { id: "market", label: "Market hall", build: alt.storefrontMarket },
  ],
};

/** The style for a type, falling back to its first one for unknown or missing ids. */
export function styleOf(type: BuildingType, id?: string): StyleDef {
  const list = STYLES[type];
  return list.find((s) => s.id === id) ?? list[0];
}
