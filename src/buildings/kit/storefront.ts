import { C, box, group, lotPad, prism, type KitBuilder } from "./common";

/** Awning, big window, door. Accent on the awning. */
export const storefront: KitBuilder = (ctx) => {
  const g = group(lotPad(ctx), box(ctx, "#E2C9A8", [0.96, 0.72, 0.64], [0, 0.05, -0.1]));
  g.add(box(ctx, C.trim, [1.0, 0.1, 0.68], [0, 0.77, -0.1]));
  g.add(box(ctx, C.wood, [0.6, 0.12, 0.03], [-0.1, 0.62, 0.23]));
  // Big window and door.
  g.add(box(ctx, C.lit, [0.52, 0.32, 0.03], [-0.16, 0.12, 0.23], { emissive: true }));
  g.add(box(ctx, C.woodDark, [0.56, 0.06, 0.06], [-0.16, 0.08, 0.24]));
  g.add(box(ctx, C.woodDark, [0.2, 0.42, 0.03], [0.3, 0.05, 0.23]));
  // Striped awning sloping out over the front.
  for (let i = 0; i < 5; i++) {
    const x = -0.4 + i * 0.2;
    g.add(prism(ctx, i % 2 ? C.trim : ctx.accent, [[0, 0], [0.26, -0.14], [0.26, -0.1], [0, 0.04]], 0.2, [x, 0.56, 0.22]));
  }
  // Crates of goods.
  g.add(box(ctx, C.wood, [0.18, 0.12, 0.14], [-0.3, 0.04, 0.42]));
  g.add(box(ctx, "#8FBF6A", [0.14, 0.05, 0.1], [-0.3, 0.16, 0.42]));
  g.add(box(ctx, C.wood, [0.18, 0.12, 0.14], [-0.06, 0.04, 0.44]));
  g.add(box(ctx, "#E7A24B", [0.14, 0.05, 0.1], [-0.06, 0.16, 0.44]));
  return { group: g, height: 1.1 };
};
