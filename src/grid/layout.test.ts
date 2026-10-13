import { describe, expect, it } from "vitest";
import { hexDistance, hexKey, hexLine, hexNeighbors, hexRing, hexesWithin } from "./hex";
import { HOME, OLD_TOWN_ANCHOR, computeRoads, lotsFor, pickActiveLot, pickOldTownLot } from "./layout";
import type { Building } from "@/store/types";

const mk = (i: number, hex: Building["hex"], status: Building["status"] = "active"): Building => ({
  id: String(i),
  slug: `b${i}`,
  type: "office",
  name: `B${i}`,
  oneLiner: "",
  status,
  links: [],
  residents: [],
  hex,
  createdAt: i,
});

describe("hex", () => {
  it("has six distinct neighbors at distance 1", () => {
    const n = hexNeighbors({ q: 2, r: -1 });
    expect(new Set(n.map(hexKey)).size).toBe(6);
    n.forEach((h) => expect(hexDistance(h, { q: 2, r: -1 })).toBe(1));
  });
  it("world radius 6 has 127 cells", () => {
    expect(hexesWithin(HOME, 6)).toHaveLength(127);
  });
  it("rings have 6k cells", () => {
    expect(hexRing(HOME, 4)).toHaveLength(24);
  });
  it("lines are contiguous", () => {
    const line = hexLine(HOME, { q: 4, r: -1 });
    for (let i = 1; i < line.length; i++) expect(hexDistance(line[i - 1], line[i])).toBe(1);
  });
});

describe("layout", () => {
  it("has room for at least ten active lots spaced apart", () => {
    const { active } = lotsFor("beach");
    expect(active.length).toBeGreaterThanOrEqual(10);
    for (const a of active) {
      expect(hexDistance(a, HOME)).toBeGreaterThanOrEqual(3);
      for (const b of active) if (a !== b) expect(hexDistance(a, b)).toBeGreaterThanOrEqual(2);
    }
  });

  it("ten added buildings never share a lot", () => {
    const buildings: Building[] = [];
    for (let i = 0; i < 10; i++) {
      const lot = pickActiveLot("beach", buildings);
      expect(lot).not.toBeNull();
      buildings.push(mk(i, lot!));
    }
    expect(new Set(buildings.map((b) => hexKey(b.hex))).size).toBe(10);
  });

  it("first lots spread around the house", () => {
    const buildings: Building[] = [];
    for (let i = 0; i < 4; i++) buildings.push(mk(i, pickActiveLot("beach", buildings)!));
    for (const a of buildings)
      for (const b of buildings) if (a !== b) expect(hexDistance(a.hex, b.hex)).toBeGreaterThanOrEqual(3);
  });

  it("old town lots are near the anchor and roads go there", () => {
    const lot = pickOldTownLot("beach", []);
    expect(lot).not.toBeNull();
    expect(hexDistance(lot!, OLD_TOWN_ANCHOR)).toBeLessThanOrEqual(2);
    const roads = computeRoads({ home: HOME, buildings: [mk(1, lot!, "past")] });
    expect(roads.filter((r) => r.kind === "dirt")).toHaveLength(2);
  });
});
