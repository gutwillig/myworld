import { C, box, cyl, group, lotPad, prism, type KitBuilder } from "./common";

/** Box with four columns, triangular pediment, ticker band. Accent on the pediment. */
export const exchange: KitBuilder = (ctx) => {
  const g = group(lotPad(ctx));
  // Stepped plinth.
  g.add(box(ctx, C.stone, [1.12, 0.06, 0.96], [0, 0.05, 0]));
  g.add(box(ctx, C.trim, [1.04, 0.06, 0.88], [0, 0.11, 0]));
  // Cella.
  g.add(box(ctx, C.wall, [0.96, 0.62, 0.56], [0, 0.17, -0.12]));
  for (const x of [-0.36, -0.12, 0.12, 0.36]) g.add(cyl(ctx, C.trim, 0.055, 0.065, 0.56, 8, [x, 0.17, 0.3]));
  g.add(box(ctx, C.lit, [0.2, 0.32, 0.02], [0, 0.17, 0.165], { emissive: true }));
  // Entablature with ticker band.
  g.add(box(ctx, C.stone, [1.04, 0.1, 0.86], [0, 0.73, 0]));
  g.add(box(ctx, C.dark, [1.06, 0.06, 0.88], [0, 0.78, 0]));
  for (let i = 0; i < 7; i++) g.add(box(ctx, i % 2 ? "#E5694F" : "#8FD07A", [0.06, 0.03, 0.01], [-0.36 + i * 0.12, 0.795, 0.445], { emissive: true }));
  // Pediment.
  g.add(prism(ctx, ctx.accent, [[-0.52, 0], [0.52, 0], [0, 0.3]], 0.88, [0, 0.84, 0], Math.PI / 2));
  return { group: g, height: 1.3 };
};
