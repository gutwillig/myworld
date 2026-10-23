import { C, box, group, lotPad, shrub, type KitBuilder } from "./common";

/** Box with a cross, wide entrance. Accent on the cross. */
export const clinic: KitBuilder = (ctx) => {
  const g = group(lotPad(ctx), box(ctx, "#F7F5EF", [1.1, 0.66, 0.74], [0, 0.05, -0.08]));
  g.add(box(ctx, "#CFE3DE", [1.14, 0.06, 0.78], [0, 0.71, -0.08]));
  // Wide entrance with canopy.
  g.add(box(ctx, C.lit, [0.56, 0.3, 0.03], [0, 0.05, 0.3], { emissive: true }));
  g.add(box(ctx, C.trim, [0.74, 0.04, 0.3], [0, 0.38, 0.38]));
  g.add(box(ctx, C.metal, [0.03, 0.33, 0.03], [-0.34, 0.05, 0.5]));
  g.add(box(ctx, C.metal, [0.03, 0.33, 0.03], [0.34, 0.05, 0.5]));
  for (const x of [-0.42, 0.42]) g.add(box(ctx, C.glass, [0.16, 0.16, 0.03], [x, 0.48, 0.3]));
  for (const z of [-0.3, 0.05]) g.add(box(ctx, C.glass, [0.03, 0.18, 0.18], [0.55, 0.4, z]));
  // Cross on the roof, facing front.
  g.add(box(ctx, ctx.accent, [0.12, 0.42, 0.08], [0, 0.77, 0.02], { emissive: true }));
  g.add(box(ctx, ctx.accent, [0.42, 0.12, 0.08], [0, 0.92, 0.02], { emissive: true }));
  g.add(shrub(ctx, [-0.62, 0.04, 0.46], 0.11));
  g.add(shrub(ctx, [0.64, 0.04, 0.44], 0.11));
  return { group: g, height: 1.3 };
};
