import { C, box, group, lotPad, prism, shrub, type KitBuilder } from "./common";

/** Small box, pitched roof, chimney. Accent on the roof. */
export const house: KitBuilder = (ctx) => {
  const g = group(
    lotPad(ctx, 0.9),
    box(ctx, C.wall, [0.9, 0.5, 0.7], [0, 0.05, -0.05]),
    prism(ctx, ctx.accent, [[-0.45, 0], [0.45, 0], [0, 0.42]], 1.04, [0, 0.55, -0.05]),
    box(ctx, C.stone, [0.13, 0.36, 0.13], [0.26, 0.72, -0.2]),
    box(ctx, C.woodDark, [0.18, 0.3, 0.04], [0, 0.05, 0.31]),
    box(ctx, C.glass, [0.16, 0.14, 0.03], [-0.27, 0.27, 0.31], { emissive: false }),
    box(ctx, C.glass, [0.16, 0.14, 0.03], [0.27, 0.27, 0.31]),
    prism(ctx, ctx.accent, [[-0.16, 0], [0.16, 0], [0, 0.14]], 0.3, [0, 0.38, 0.38], Math.PI / 2),
    box(ctx, C.trim, [0.6, 0.05, 0.22], [0, 0.05, 0.42]),
    shrub(ctx, [-0.52, 0.04, 0.42], 0.12),
    shrub(ctx, [0.55, 0.04, 0.36], 0.1),
  );
  return { group: g, height: 1.1 };
};
