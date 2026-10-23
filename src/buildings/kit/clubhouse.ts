import { C, box, group, lotPad, prism, shrub, type KitBuilder } from "./common";

/** Low lodge, wide porch, stone chimney. Its putting green lives in grounds. Accent on the door. */
export const clubhouse: KitBuilder = (ctx) => {
  const g = group(lotPad(ctx, 0.9));
  // Lodge.
  g.add(box(ctx, C.wood, [0.92, 0.36, 0.56], [-0.18, 0.05, -0.18]));
  g.add(prism(ctx, C.woodDark, [[-0.36, 0], [0.36, 0], [0, 0.26]], 1.06, [-0.18, 0.41, -0.18]));
  // Wide porch and roof.
  g.add(box(ctx, C.trim, [0.98, 0.05, 0.24], [-0.18, 0.05, 0.2]));
  g.add(box(ctx, C.woodDark, [1.0, 0.04, 0.3], [-0.18, 0.4, 0.2]));
  for (const x of [-0.62, -0.34, -0.02, 0.26]) g.add(box(ctx, C.trim, [0.04, 0.32, 0.04], [x, 0.08, 0.32]));
  g.add(box(ctx, C.lit, [0.18, 0.16, 0.02], [-0.42, 0.15, 0.11], { emissive: true }));
  g.add(box(ctx, C.lit, [0.18, 0.16, 0.02], [0.06, 0.15, 0.11], { emissive: true }));
  g.add(box(ctx, ctx.accent, [0.16, 0.28, 0.02], [-0.18, 0.08, 0.11]));
  g.add(box(ctx, C.stone, [0.12, 0.3, 0.12], [-0.5, 0.55, -0.3]));
  g.add(shrub(ctx, [-0.7, 0.04, -0.5], 0.12));
  return { group: g, height: 1.0 };
};
