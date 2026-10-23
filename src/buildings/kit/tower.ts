import { C, box, group, lotPad, shrub, type KitBuilder } from "./common";

/** Tall narrow box, stepped top. Accent on the top. */
export const tower: KitBuilder = (ctx) => {
  const g = group(lotPad(ctx));
  g.add(box(ctx, C.stone, [0.8, 0.22, 0.8], [0, 0.05, 0]));
  g.add(box(ctx, "#E9E3D6", [0.62, 1.6, 0.62], [0, 0.27, 0]));
  // Horizontal glass bands on the two visible faces.
  for (let i = 0; i < 6; i++) {
    const y = 0.38 + i * 0.25;
    g.add(box(ctx, C.glass, [0.56, 0.12, 0.02], [0, y, 0.31]));
    g.add(box(ctx, C.glass, [0.02, 0.12, 0.56], [0.31, y, 0]));
  }
  g.add(box(ctx, C.lit, [0.3, 0.16, 0.02], [0, 0.05, 0.41], { emissive: true }));
  // Stepped top.
  g.add(box(ctx, ctx.accent, [0.5, 0.16, 0.5], [0, 1.87, 0]));
  g.add(box(ctx, ctx.accent, [0.34, 0.14, 0.34], [0, 2.03, 0]));
  g.add(box(ctx, ctx.accent, [0.18, 0.12, 0.18], [0, 2.17, 0]));
  g.add(box(ctx, C.metal, [0.03, 0.22, 0.03], [0, 2.29, 0]));
  g.add(shrub(ctx, [0.56, 0.04, 0.5], 0.12));
  g.add(shrub(ctx, [-0.56, 0.04, 0.5], 0.1));
  return { group: g, height: 2.55 };
};
