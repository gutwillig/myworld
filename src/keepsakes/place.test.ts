import { describe, expect, it } from "vitest";
import { hexToWorld } from "@/grid/hex";
import { lotsFor } from "@/grid/layout";
import type { KeepsakeKind } from "@/store/types";
import { KEEPSAKES, MAX_KEEPSAKES, parseKeepsakes } from "./catalog";
import { keepsakeFits, placeKeepsakes } from "./place";

const refs = (kinds: KeepsakeKind[]) => kinds.map((kind) => ({ kind }));
const ALL = KEEPSAKES.map((k) => k.kind);
const SEEDS = ["abc123", "Gus-home", "zzzz", "q8Lm2PxT0a", "ross"];

describe("placeKeepsakes", () => {
  it("fits every keepsake on an island without overlaps", () => {
    for (const seed of SEEDS) {
      const spots = placeKeepsakes("beach", seed, refs(ALL));
      expect(spots.map((s) => s.kind).sort()).toEqual([...ALL].sort());
      for (let i = 0; i < spots.length; i++) {
        for (let j = i + 1; j < spots.length; j++) {
          const a = spots[i];
          const b = spots[j];
          expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(a.radius + b.radius);
        }
      }
    }
  });

  it("stays off building lots", () => {
    const lots = [...lotsFor("beach").active, ...lotsFor("beach").oldTown].map(hexToWorld);
    for (const s of placeKeepsakes("beach", "abc123", refs(ALL))) {
      for (const l of lots) expect(Math.hypot(l.x - s.x, l.z - s.z)).toBeGreaterThan(s.radius + 1.1);
    }
  });

  it("keeps earlier keepsakes in place when more are added", () => {
    const first = placeKeepsakes("beach", "abc123", refs(["ski", "surf"]));
    const more = placeKeepsakes("beach", "abc123", refs(["ski", "surf", "ballpark", "hoop"]));
    expect(more.slice(0, 2)).toEqual(first);
  });

  it("keeps hand-placed keepsakes exactly where they were dropped, and plans around them", () => {
    const auto = placeKeepsakes("beach", "abc123", refs(["ballpark"]))[0];
    const spots = placeKeepsakes("beach", "abc123", [
      { kind: "ski", at: { x: auto.x, z: auto.z, rot: 1 } },
      { kind: "ballpark" },
    ]);
    expect(spots[0]).toMatchObject({ kind: "ski", x: auto.x, z: auto.z, rot: 1 });
    const ball = spots[1];
    expect(Math.hypot(ball.x - auto.x, ball.z - auto.z)).toBeGreaterThan(ball.radius + spots[0].radius);
  });

  it("only accepts drops on open land", () => {
    const spots = placeKeepsakes("beach", "abc123", refs(["ski", "surf", "hoop"]));
    for (const s of spots) expect(keepsakeFits("beach", "abc123", s.kind, s.x, s.z, spots)).toBe(true);
    const lot = hexToWorld(lotsFor("beach").active[0]);
    expect(keepsakeFits("beach", "abc123", "hoop", lot.x, lot.z, spots)).toBe(false);
    expect(keepsakeFits("beach", "abc123", "hoop", 30, 30, spots)).toBe(false);
    const ski = spots[0];
    expect(keepsakeFits("beach", "abc123", "hoop", ski.x, ski.z, spots)).toBe(false);
  });
});

describe("parseKeepsakes", () => {
  it("upgrades bare kinds, drops junk and caps the list", () => {
    const out = parseKeepsakes(["ski", "nope", { kind: "ballpark", note: "  Go Sox!  " }, "ski", "surf", "hoop"]);
    expect(out).toHaveLength(MAX_KEEPSAKES);
    expect(out[0]).toEqual({ kind: "ski", note: "" });
    expect(out[1]).toEqual({ kind: "ballpark", note: "Go Sox!" });
  });
});
