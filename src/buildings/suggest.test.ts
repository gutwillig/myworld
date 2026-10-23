import { describe, expect, it } from "vitest";
import { suggestSync } from "./suggest";

describe("suggest", () => {
  it.each([
    ["Fullsend", "office"],
    ["golf league", "clubhouse"],
    ["Jake's film", "theater"],
    ["Stoked Capital", "exchange"],
    ["side project app", "workshop"],
    ["Bright Dental", "clinic"],
    ["design agency", "studio"],
  ])("%s -> %s first", (input, expected) => {
    expect(suggestSync(input)[0]).toBe(expected);
  });

  it("always returns three distinct types", () => {
    for (const s of ["", "x", "golf", "Stoked Capital fund"]) {
      const r = suggestSync(s);
      expect(r).toHaveLength(3);
      expect(new Set(r).size).toBe(3);
    }
  });
});
