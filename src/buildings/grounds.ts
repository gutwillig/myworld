import * as THREE from "three";
import type { BuildingType } from "@/store/types";
import { C, blob, box, car, cyl, flag, group, patch, prism, shrub, tree, type KitCtx } from "./kit/common";

/**
 * What surrounds a lot. Builders work in the building's local units (pad radius ≈ 0.86) and stay
 * inside radius ≈ 1.2 so neighbors never collide. `face` is the open side of the lot (away from the
 * road, toward the camera when possible); `gap` is where the road comes in.
 */
export type GroundsOpts = { face: number; gap: number };
export type GroundsDef = { id: string; label: string; build: (ctx: KitCtx, o: GroundsOpts) => THREE.Group };

const WATER = "#6FB7C4";
const SAND = "#E9DBB0";
const RED_CARPET = "#B8323A";
const GOLD = "#E3B04B";

/** Rotates a feature laid out along local +x so it points at `face`. */
function along(g: THREE.Group, face: number): THREE.Group {
  g.rotation.y = -face;
  return g;
}

const angDist = (a: number, b: number): number => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const polar = (a: number, r: number): [number, number] => [Math.cos(a) * r, Math.sin(a) * r];

const none: GroundsDef["build"] = () => group();

const putting: GroundsDef["build"] = (ctx, { face }) =>
  along(
    group(
      patch(ctx, C.green, 0.34, [0.88, -0.02, 0], 1, 0.78, 0.07),
      patch(ctx, "#9AD27E", 0.18, [0.94, -0.01, 0.05], 1, 0.85, 0.07),
      cyl(ctx, C.dark, 0.03, 0.03, 0.01, 8, [0.98, 0.06, 0.06]),
      flag(ctx, ctx.accent, [0.98, 0.05, 0.06], 0.55),
      blob(ctx, C.trim, 0.025, [0.78, 0.08, -0.1]),
    ),
    face,
  );

const range: GroundsDef["build"] = (ctx, { face }) => {
  const g = group(box(ctx, C.green, [0.6, 0.06, 0.74], [1.0, -0.02, 0]));
  for (const x of [0.86, 1.1]) g.add(box(ctx, "#7DB862", [0.1, 0.062, 0.74], [x, -0.02, 0]));
  for (const z of [-0.22, 0, 0.22]) {
    g.add(box(ctx, "#3F6B45", [0.1, 0.064, 0.12], [0.76, -0.015, z]));
    g.add(blob(ctx, C.trim, 0.02, [0.78, 0.07, z + 0.02]));
  }
  for (const [x, z] of [[0.95, -0.12], [1.02, 0.18], [1.14, -0.05], [1.2, 0.24], [0.9, 0.3]] as const) {
    g.add(blob(ctx, C.trim, 0.016, [x, 0.06, z]));
  }
  g.add(flag(ctx, "#F2C14E", [1.0, 0.04, -0.2], 0.24));
  g.add(flag(ctx, ctx.accent, [1.18, 0.04, 0.1], 0.3));
  for (const z of [-0.36, 0.36]) g.add(cyl(ctx, C.metal, 0.012, 0.012, 0.56, 5, [1.3, 0.0, z]));
  g.add(box(ctx, C.metal, [0.02, 0.02, 0.74], [1.3, 0.55, 0]));
  return along(g, face);
};

const fairway: GroundsDef["build"] = (ctx, { face }) =>
  along(
    group(
      patch(ctx, C.green, 0.2, [0.72, -0.02, -0.2], 1.2, 1, 0.065),
      patch(ctx, C.green, 0.24, [0.92, -0.02, -0.02], 1.2, 1, 0.065),
      patch(ctx, C.green, 0.22, [1.06, -0.02, 0.18], 1, 1, 0.065),
      patch(ctx, "#9AD27E", 0.16, [1.1, -0.012, 0.24], 1, 1, 0.065),
      patch(ctx, SAND, 0.12, [1.04, -0.01, -0.22], 1.4, 0.9, 0.065),
      patch(ctx, WATER, 0.11, [0.76, -0.01, 0.2], 1.3, 1, 0.065),
      cyl(ctx, C.dark, 0.025, 0.025, 0.01, 8, [1.12, 0.06, 0.26]),
      flag(ctx, ctx.accent, [1.12, 0.05, 0.26], 0.5),
      box(ctx, "#3F6B45", [0.12, 0.065, 0.1], [0.62, -0.01, -0.26]),
    ),
    face,
  );

const pond: GroundsDef["build"] = (ctx, { face }) => {
  const g = group(
    patch(ctx, SAND, 0.36, [0.96, -0.02, 0], 1.15, 0.95, 0.06),
    patch(ctx, WATER, 0.32, [0.96, -0.012, 0], 1.15, 0.95, 0.06),
    patch(ctx, C.green, 0.11, [1.06, -0.005, 0.06], 1, 1, 0.07),
    flag(ctx, ctx.accent, [1.08, 0.06, 0.07], 0.42),
    box(ctx, C.wood, [0.34, 0.03, 0.09], [0.86, 0.05, -0.12]),
  );
  for (const [x, z] of [[0.66, 0.18], [0.7, 0.24], [1.28, -0.12], [1.24, -0.2]] as const) {
    g.add(cyl(ctx, C.leaf, 0.006, 0.01, 0.16, 4, [x, 0.02, z]));
  }
  return along(g, face);
};

const carpet: GroundsDef["build"] = (ctx) => {
  const g = group(box(ctx, RED_CARPET, [0.26, 0.015, 0.7], [0, 0.05, 0.78]));
  for (const z of [0.5, 0.78, 1.06]) {
    for (const x of [-0.19, 0.19]) g.add(cyl(ctx, GOLD, 0.012, 0.018, 0.14, 6, [x, 0.05, z]));
  }
  for (const x of [-0.19, 0.19]) g.add(box(ctx, RED_CARPET, [0.012, 0.012, 0.56], [x, 0.16, 0.78]));
  for (const x of [-0.5, 0.5]) {
    g.add(cyl(ctx, C.dark, 0.05, 0.06, 0.06, 8, [x, 0.0, 0.92]));
    const beam = cyl(ctx, C.lit, 0.025, 0.04, 0.16, 8, [x, 0.06, 0.92], { emissive: true });
    beam.rotation.z = x > 0 ? 0.5 : -0.5;
    g.add(beam);
  }
  g.add(box(ctx, ctx.accent, [0.03, 0.28, 0.32], [-0.42, 0.04, 0.6]));
  return g;
};

const fountain: GroundsDef["build"] = (ctx, { face }) =>
  along(
    group(
      patch(ctx, C.stone, 0.38, [0.9, -0.02, 0], 1, 1, 0.065),
      cyl(ctx, C.trim, 0.25, 0.26, 0.09, 12, [0.9, 0.02, 0]),
      patch(ctx, WATER, 0.21, [0.9, 0.06, 0], 1, 1, 0.05),
      cyl(ctx, C.trim, 0.03, 0.04, 0.2, 6, [0.9, 0.08, 0]),
      cyl(ctx, C.trim, 0.09, 0.05, 0.04, 10, [0.9, 0.27, 0]),
      blob(ctx, "#D7EEF2", 0.06, [0.9, 0.36, 0], 1.2),
    ),
    face,
  );

const patio: GroundsDef["build"] = (ctx, { face }) => {
  const g = group(patch(ctx, C.wood, 0.36, [0.92, -0.02, 0], 0.85, 1.35, 0.065, 8));
  [
    [0.86, -0.24, ctx.accent],
    [0.98, 0.22, C.trim],
  ].forEach(([x, z, c]) => {
    const px = x as number;
    const pz = z as number;
    g.add(cyl(ctx, C.trim, 0.06, 0.06, 0.02, 8, [px, 0.12, pz]));
    g.add(cyl(ctx, C.metal, 0.008, 0.008, 0.12, 5, [px, 0.02, pz]));
    g.add(cyl(ctx, C.trim, 0.007, 0.007, 0.3, 5, [px, 0.12, pz]));
    g.add(cyl(ctx, c as string, 0.01, 0.17, 0.07, 8, [px, 0.38, pz]));
    for (const dz of [-0.09, 0.09]) g.add(box(ctx, C.woodDark, [0.05, 0.08, 0.05], [px, 0.02, pz + dz]));
  });
  return along(g, face);
};

const market: GroundsDef["build"] = (ctx, { face }) => {
  const g = group();
  for (const z of [-0.26, 0.26]) {
    g.add(box(ctx, C.wood, [0.2, 0.12, 0.26], [0.9, 0.0, z]));
    g.add(box(ctx, z < 0 ? "#E7A24B" : "#8FBF6A", [0.16, 0.04, 0.22], [0.9, 0.12, z]));
    for (const dz of [-0.12, 0.12]) g.add(box(ctx, C.woodDark, [0.025, 0.3, 0.025], [0.98, 0.0, z + dz]));
    for (let i = 0; i < 3; i++) {
      g.add(prism(ctx, i % 2 ? C.trim : ctx.accent, [[0, 0], [0.18, -0.06], [0.18, -0.03], [0, 0.03]], 0.09, [0.96, 0.32, z - 0.09 + i * 0.09], Math.PI / 2));
    }
  }
  g.add(box(ctx, C.wood, [0.12, 0.1, 0.12], [1.12, 0.0, 0.02]));
  g.add(box(ctx, "#E5694F", [0.09, 0.04, 0.09], [1.12, 0.1, 0.02]));
  return along(g, face);
};

const yard: GroundsDef["build"] = (ctx, { face }) => {
  const g = group(patch(ctx, "#CDBB98", 0.34, [0.92, -0.02, 0], 1, 1.3, 0.065, 9));
  for (let i = 0; i < 3; i++) g.add(box(ctx, i % 2 ? C.wood : "#BF8F62", [0.32, 0.05, 0.12], [0.86, 0.04 + i * 0.05, -0.24]));
  const log = cyl(ctx, C.woodDark, 0.05, 0.05, 0.3, 7, [0, 0, 0]);
  log.rotation.x = Math.PI / 2;
  log.position.set(1.04, 0.09, -0.02);
  g.add(log);
  g.add(box(ctx, C.wood, [0.14, 0.12, 0.14], [0.86, 0.04, 0.2]), box(ctx, C.wood, [0.12, 0.1, 0.12], [0.88, 0.16, 0.22]));
  const tarp = box(ctx, ctx.accent, [0.24, 0.02, 0.2], [1.06, 0.12, 0.26]);
  tarp.rotation.z = 0.3;
  g.add(tarp, box(ctx, C.wood, [0.2, 0.1, 0.16], [1.06, 0.04, 0.26]));
  return along(g, face);
};

const ambulance: GroundsDef["build"] = (ctx, { face }) => {
  const g = group(box(ctx, "#8E918C", [0.46, 0.06, 0.5], [0.94, -0.02, 0]));
  g.add(box(ctx, C.trim, [0.3, 0.012, 0.04], [0.94, 0.04, -0.22]));
  const van = group(
    box(ctx, "#F7F5EF", [0.32, 0.15, 0.16], [0, 0.04, 0]),
    box(ctx, ctx.accent, [0.33, 0.03, 0.165], [0, 0.11, 0]),
    box(ctx, C.glass, [0.02, 0.06, 0.13], [0.16, 0.12, 0]),
    box(ctx, "#6F8FC9", [0.05, 0.03, 0.05], [0.06, 0.19, 0], { emissive: true }),
    box(ctx, C.dark, [0.28, 0.03, 0.17], [0, 0.03, 0]),
  );
  van.position.set(0.94, 0.0, 0.06);
  g.add(van);
  return along(g, face);
};

const FLOWERS = ["#F2C14E", "#E5694F", "#F1A7B5", "#FBF8F1"];

const garden: GroundsDef["build"] = (ctx, { face, gap }) => {
  const g = group();
  let i = 0;
  for (let a = 0; a < Math.PI * 2; a += 0.42) {
    if (angDist(a, gap) < 0.75) continue;
    const [x, z] = polar(a, 0.98);
    if (i % 2 === 0) g.add(shrub(ctx, [x, 0.0, z], 0.1 + (i % 3) * 0.015));
    else {
      for (let k = 0; k < 3; k++) {
        const [fx, fz] = polar(a + (k - 1) * 0.08, 0.96 + (k % 2) * 0.06);
        g.add(box(ctx, FLOWERS[(i + k) % FLOWERS.length], [0.04, 0.05, 0.04], [fx, 0.02, fz]));
      }
    }
    i++;
  }
  for (const d of [-0.9, 0.9]) {
    const a = face + d;
    if (angDist(a, gap) < 0.75) continue;
    const [x, z] = polar(a, 1.12);
    g.add(tree(ctx, [x, 0.0, z], 1.1));
  }
  return g;
};

const plaza: GroundsDef["build"] = (ctx, { face, gap }) => {
  const g = group(patch(ctx, "#E4DCCB", 1.18, [0, -0.03, 0], 1, 1, 0.07, 18));
  g.add(patch(ctx, C.stone, 1.0, [0, -0.025, 0], 1, 1, 0.07, 18));
  for (const d of [-0.55, 0.55]) {
    const a = face + d;
    if (angDist(a, gap) < 0.6) continue;
    const [x, z] = polar(a, 1.0);
    const bench = group(box(ctx, C.wood, [0.22, 0.03, 0.07], [0, 0.08, 0]), box(ctx, C.wood, [0.22, 0.07, 0.02], [0, 0.11, -0.035]));
    for (const bx of [-0.09, 0.09]) bench.add(box(ctx, C.metal, [0.02, 0.08, 0.06], [bx, 0.0, 0]));
    bench.position.set(x, 0.04, z);
    bench.rotation.y = -a - Math.PI / 2;
    g.add(bench);
  }
  for (const d of [-1.15, 0, 1.15]) {
    const a = face + d;
    if (angDist(a, gap) < 0.6) continue;
    const [x, z] = polar(a, 1.06);
    g.add(cyl(ctx, C.dark, 0.012, 0.016, 0.42, 5, [x, 0.04, z]));
    g.add(box(ctx, C.lit, [0.06, 0.06, 0.06], [x, 0.45, z], { emissive: true }));
  }
  return g;
};

const parking: GroundsDef["build"] = (ctx, { face }) => {
  const g = group(box(ctx, "#8E918C", [0.46, 0.06, 0.84], [0.96, -0.02, 0]));
  for (const z of [-0.39, -0.13, 0.13, 0.39]) g.add(box(ctx, C.trim, [0.3, 0.012, 0.02], [1.02, 0.04, z]));
  g.add(car(ctx, ctx.accent, [1.0, 0.04, -0.26]));
  g.add(car(ctx, "#6F8FC9", [1.0, 0.04, 0.26]));
  return along(g, face);
};

const grove: GroundsDef["build"] = (ctx, { face, gap }) => {
  const g = group();
  [-0.85, -0.3, 0.25, 0.8].forEach((d, i) => {
    const a = face + d;
    if (angDist(a, gap) < 0.7) return;
    const [x, z] = polar(a, 0.98 + (i % 2) * 0.14);
    g.add(tree(ctx, [x, 0.0, z], 1.15 + (i % 3) * 0.15, i % 2 ? "pine" : "round"));
  });
  return g;
};

const DEFS: Record<string, GroundsDef> = {
  none: { id: "none", label: "Bare lot", build: none },
  putting: { id: "putting", label: "Putting green", build: putting },
  range: { id: "range", label: "Driving range", build: range },
  fairway: { id: "fairway", label: "Fairway & bunker", build: fairway },
  pond: { id: "pond", label: "Water hazard", build: pond },
  carpet: { id: "carpet", label: "Red carpet", build: carpet },
  fountain: { id: "fountain", label: "Fountain", build: fountain },
  patio: { id: "patio", label: "Patio", build: patio },
  market: { id: "market", label: "Market stalls", build: market },
  yard: { id: "yard", label: "Lumber yard", build: yard },
  ambulance: { id: "ambulance", label: "Ambulance bay", build: ambulance },
  garden: { id: "garden", label: "Garden", build: garden },
  plaza: { id: "plaza", label: "Plaza", build: plaza },
  parking: { id: "parking", label: "Parking", build: parking },
  grove: { id: "grove", label: "Grove", build: grove },
};

const BY_TYPE: Record<BuildingType, string[]> = {
  house: ["none", "garden", "grove"],
  office: ["none", "plaza", "fountain", "parking", "garden", "grove"],
  studio: ["none", "patio", "yard", "garden", "plaza", "grove"],
  workshop: ["none", "yard", "garden", "parking", "grove"],
  clubhouse: ["putting", "range", "fairway", "pond", "garden", "grove", "none"],
  theater: ["none", "carpet", "parking", "plaza", "fountain", "garden"],
  exchange: ["none", "fountain", "plaza", "garden", "parking"],
  tower: ["none", "plaza", "fountain", "parking", "grove"],
  clinic: ["none", "ambulance", "garden", "fountain", "parking"],
  storefront: ["none", "patio", "market", "garden", "parking"],
};

/** Grounds a type can have, in display order. */
export function groundsFor(type: BuildingType): GroundsDef[] {
  return BY_TYPE[type].map((id) => DEFS[id]);
}

export function defaultGrounds(type: BuildingType): string {
  return type === "clubhouse" ? "putting" : "none";
}

/** The grounds for a type, falling back to its default for unknown or missing ids. */
export function groundsOf(type: BuildingType, id?: string): GroundsDef {
  const wanted = id ?? defaultGrounds(type);
  return BY_TYPE[type].includes(wanted) ? DEFS[wanted] : DEFS[defaultGrounds(type)];
}

/** True when the grounds spill past the lot pad (trees nearby should make room). */
export const hasGrounds = (type: BuildingType, id?: string): boolean => groundsOf(type, id).id !== "none";

/**
 * Open side of a lot: well clear of the road, and of those sides the one the camera (+x,+z)
 * sees best, so a back-row driving range swings out to the side instead of hiding behind.
 */
export function lotFacing(lot: { x: number; z: number }, roadFrom: { x: number; z: number }): GroundsOpts {
  const gap = Math.atan2(roadFrom.z - lot.z, roadFrom.x - lot.x);
  const toCamera = Math.PI / 4;
  const candidates = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI, (-3 * Math.PI) / 4, -Math.PI / 2, -Math.PI / 4];
  const clear = candidates.filter((c) => angDist(c, gap) >= 1.25);
  const pool = clear.length ? clear : candidates;
  let best = pool[0];
  let bestScore = -Infinity;
  for (const c of pool) {
    const score = Math.cos(c - toCamera) + 0.15 * angDist(c, gap);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return { face: best, gap };
}

/** Preview facing for thumbnails: grounds toward the viewer, road behind. */
export const PREVIEW_FACING: GroundsOpts = { face: Math.PI / 4, gap: (-3 * Math.PI) / 4 };
