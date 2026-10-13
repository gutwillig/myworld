import { C, box, cyl, group, lotPad, prism, shrub, type KitBuilder } from "./common";

/** Shed, single slope roof, open front, barrel outside. Accent on the barrel. */
export const workshop: KitBuilder = (ctx) => {
  const g = group(lotPad(ctx));
  // Back and side walls; front is open.
  g.add(box(ctx, C.wood, [0.9, 0.62, 0.06], [0, 0.05, -0.36]));
  g.add(box(ctx, C.wood, [0.06, 0.5, 0.72], [-0.45, 0.05, 0]));
  g.add(box(ctx, C.wood, [0.06, 0.5, 0.72], [0.45, 0.05, 0]));
  g.add(box(ctx, C.woodDark, [0.84, 0.03, 0.66], [0, 0.05, 0]));
  // Single-slope roof: high at back, low at front.
  g.add(prism(ctx, C.roofDark, [[-0.46, 0.66], [0.48, 0.48], [0.48, 0.54], [-0.46, 0.74]], 1.04, [0, 0.05, 0]));
  g.add(box(ctx, C.woodDark, [0.06, 0.48, 0.06], [-0.44, 0.05, 0.38]));
  g.add(box(ctx, C.woodDark, [0.06, 0.48, 0.06], [0.44, 0.05, 0.38]));
  // Workbench and a warm lamp inside.
  g.add(box(ctx, C.woodDark, [0.5, 0.2, 0.18], [0, 0.08, -0.22]));
  g.add(box(ctx, C.lit, [0.08, 0.06, 0.08], [0, 0.48, -0.1], { emissive: true }));
  g.add(box(ctx, C.metal, [0.14, 0.1, 0.12], [-0.12, 0.28, -0.22]));
  // Barrels.
  g.add(cyl(ctx, ctx.accent, 0.12, 0.12, 0.28, 8, [0.62, 0.04, 0.32]));
  g.add(cyl(ctx, C.dark, 0.125, 0.125, 0.03, 8, [0.62, 0.2, 0.32]));
  g.add(cyl(ctx, ctx.accent, 0.1, 0.1, 0.22, 8, [0.66, 0.04, 0.02]));
  g.add(box(ctx, C.wood, [0.2, 0.12, 0.2], [-0.62, 0.04, 0.34]));
  g.add(shrub(ctx, [-0.6, 0.04, -0.4], 0.12));
  return { group: g, height: 0.95 };
};
