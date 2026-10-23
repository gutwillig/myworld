import { C, box, group, lotPad, shrub, type KitBuilder } from "./common";

/** Two-story box, flat roof, window grid, sign on top. Accent on the sign. */
export const office: KitBuilder = (ctx) => {
  const g = group(lotPad(ctx), box(ctx, C.wall, [0.98, 0.9, 0.82], [0, 0.05, -0.04]));
  g.add(box(ctx, C.stone, [1.04, 0.07, 0.88], [0, 0.95, -0.04]));
  g.add(box(ctx, C.dark, [1.0, 0.04, 0.84], [0, 0.49, -0.04]));
  for (const row of [0.2, 0.6]) {
    for (const col of [-0.3, 0, 0.3]) {
      if (row === 0.2 && col === 0) continue;
      g.add(box(ctx, C.glass, [0.2, 0.22, 0.03], [col, row, 0.37]));
    }
    for (const zc of [-0.26, 0.08]) g.add(box(ctx, C.glass, [0.03, 0.22, 0.2], [0.49, row, zc]));
  }
  g.add(box(ctx, C.lit, [0.22, 0.32, 0.03], [0, 0.05, 0.37], { emissive: true }));
  g.add(box(ctx, C.metal, [0.04, 0.16, 0.04], [-0.3, 1.02, -0.04]));
  g.add(box(ctx, C.metal, [0.04, 0.16, 0.04], [0.3, 1.02, -0.04]));
  g.add(box(ctx, ctx.accent, [0.8, 0.22, 0.06], [0, 1.15, -0.04]));
  g.add(box(ctx, C.metal, [0.22, 0.12, 0.2], [-0.24, 1.02, -0.3]));
  g.add(shrub(ctx, [0.6, 0.04, 0.44]));
  g.add(shrub(ctx, [-0.62, 0.04, 0.4], 0.12));
  return { group: g, height: 1.42 };
};
