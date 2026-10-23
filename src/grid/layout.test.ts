import { describe, expect, it } from "vitest";
import { hexDistance, hexKey, hexLine, hexNeighbors, hexRing, hexesWithin } from "./hex";
import { HOME, OLD_TOWN_ANCHOR, computeRoads, districtOf, lotsFor, pickActiveLot, pickOldTownLot } from "./layout";
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
  it("districts have room and stay spaced apart", () => {
    const { side, fun, active, hubs } = lotsFor("beach");
    expect(side.length).toBeGreaterThanOrEqual(5);
    expect(fun.length).toBeGreaterThanOrEqual(3);
    for (const a of active) {
      expect(hexDistance(a, HOME)).toBeGreaterThanOrEqual(2);
      expect(hexDistance(a, hubs.gig)).toBeGreaterThanOrEqual(3);
      for (const b of active) if (a !== b) expect(hexDistance(a, b)).toBeGreaterThanOrEqual(2);
    }
  });

  it("added buildings never share a lot and fill their own district first", () => {
    const buildings: Building[] = [];
    const { side } = lotsFor("beach");
    for (let i = 0; i < 9; i++) {
      const lot = pickActiveLot("beach", buildings);
      expect(lot).not.toBeNull();
      if (i < side.length) expect(districtOf("beach", lot!)).toBe("side");
      buildings.push(mk(i, lot!));
    }
    expect(new Set(buildings.map((b) => hexKey(b.hex))).size).toBe(9);
  });

  it("roads run home to hub, then hub to each place", () => {
    const lot = pickActiveLot("beach", [], "fun")!;
    const roads = computeRoads({ home: HOME, terrain: "beach", buildings: [mk(1, lot)] });
    const { hubs } = lotsFor("beach");
    expect(roads).toHaveLength(2);
    expect(roads[0].to).toEqual(hubs.fun);
    expect(roads[1].from).toEqual(hubs.fun);
  });

  it("old town lots are near the anchor and roads go there", () => {
    const lot = pickOldTownLot("beach", []);
    expect(lot).not.toBeNull();
    expect(hexDistance(lot!, OLD_TOWN_ANCHOR)).toBeLessThanOrEqual(2);
    const roads = computeRoads({ home: HOME, terrain: "beach", buildings: [mk(1, lot!, "past")] });
    expect(roads.filter((r) => r.kind === "dirt")).toHaveLength(2);
  });
});
