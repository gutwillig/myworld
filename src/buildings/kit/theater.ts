import { C, box, group, lotPad, type KitBuilder } from "./common";

/** Tall box, marquee bar across the front, vertical blade sign. Accent on the marquee. */
export const theater: KitBuilder = (ctx) => {
  const g = group(lotPad(ctx), box(ctx, "#C9B49A", [0.86, 1.25, 0.8], [0, 0.05, -0.06]));
  g.add(box(ctx, C.wood, [0.9, 0.08, 0.84], [0, 1.3, -0.06]));
  // Marquee bar with lit underside.
  g.add(box(ctx, ctx.accent, [0.96, 0.18, 0.26], [0, 0.48, 0.42]));
  g.add(box(ctx, C.lit, [0.86, 0.035, 0.22], [0, 0.45, 0.42], { emissive: true }));
  g.add(box(ctx, C.trim, [0.8, 0.07, 0.02], [0, 0.54, 0.555]));
  // Doors.
  g.add(box(ctx, C.lit, [0.5, 0.36, 0.03], [0, 0.05, 0.35], { emissive: true }));
  for (const x of [-0.12, 0.12]) g.add(box(ctx, C.woodDark, [0.03, 0.36, 0.035], [x, 0.05, 0.355]));
  // Vertical blade sign.
  g.add(box(ctx, C.woodDark, [0.08, 0.7, 0.2], [-0.36, 0.66, 0.42]));
  for (let i = 0; i < 5; i++) g.add(box(ctx, C.lit, [0.09, 0.07, 0.1], [-0.36, 0.72 + i * 0.12, 0.44], { emissive: true }));
  // Upper windows.
  for (const x of [0, 0.25]) g.add(box(ctx, C.glass, [0.14, 0.24, 0.03], [x, 0.82, 0.35]));
  for (const z of [-0.3, 0.05]) g.add(box(ctx, C.glass, [0.03, 0.24, 0.16], [0.43, 0.82, z]));
  return { group: g, height: 1.62 };
};
