import { C, box, group, lotPad, prism, shrub, type KitBuilder } from "./common";

/** Wide low box, sawtooth roof, big door. Accent on the door. */
export const studio: KitBuilder = (ctx) => {
  const g = group(lotPad(ctx), box(ctx, C.wallWarm, [1.3, 0.48, 0.8], [0, 0.05, -0.04]));
  for (const x of [-0.43, 0, 0.43]) {
    // Sawtooth teeth: glazed vertical face to the front, slope down to the back.
    g.add(prism(ctx, C.roofDark, [[-0.4, 0], [0.4, 0], [0.4, 0.3]], 0.43, [x, 0.53, -0.04]));
    g.add(box(ctx, C.glass, [0.38, 0.22, 0.02], [x, 0.56, 0.37]));
  }
  g.add(box(ctx, ctx.accent, [0.5, 0.36, 0.04], [-0.2, 0.05, 0.37]));
  g.add(box(ctx, C.trim, [0.56, 0.04, 0.05], [-0.2, 0.41, 0.37]));
  g.add(box(ctx, C.glass, [0.24, 0.18, 0.03], [0.38, 0.18, 0.37]));
  g.add(box(ctx, C.lit, [0.04, 0.08, 0.04], [0.12, 0.3, 0.39], { emissive: true }));
  g.add(shrub(ctx, [0.7, 0.04, 0.42], 0.1));
  return { group: g, height: 1.0 };
};
