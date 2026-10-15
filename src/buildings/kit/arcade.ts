import { C, box, group, lotPad, type KitBuilder } from "./common";

/** Boxy structure with neon trim, lit panels, and a joystick motif on top. */
export const arcade: KitBuilder = (ctx) => {
  const g = group(lotPad(ctx), box(ctx, "#2A2D3A", [0.88, 1.1, 0.82], [0, 0.05, -0.04]));
  // Roof cap.
  g.add(box(ctx, "#363948", [0.92, 0.06, 0.86], [0, 1.18, -0.04]));
  // Neon accent trim around front.
  g.add(box(ctx, ctx.accent, [0.92, 0.08, 0.04], [0, 0.95, 0.38]));
  g.add(box(ctx, ctx.accent, [0.04, 0.08, 0.44], [-0.44, 0.95, 0.12]));
  g.add(box(ctx, ctx.accent, [0.04, 0.08, 0.44], [0.44, 0.95, 0.12]));
  // Lit panels on front (arcade screens).
  for (const x of [-0.25, 0.25]) {
    g.add(box(ctx, C.lit, [0.28, 0.5, 0.03], [x, 0.42, 0.38], { emissive: true }));
    g.add(box(ctx, "#1A1C24", [0.32, 0.54, 0.02], [x, 0.42, 0.37]));
  }
  // Door in center.
  g.add(box(ctx, C.glass, [0.22, 0.4, 0.03], [0, 0.07, 0.38]));
  g.add(box(ctx, C.woodDark, [0.03, 0.4, 0.035], [0, 0.07, 0.385]));
  // Side windows with glow.
  for (const z of [-0.25, 0.1]) {
    g.add(box(ctx, C.lit, [0.03, 0.28, 0.2], [0.44, 0.52, z], { emissive: true }));
  }
  // Joystick on roof - base.
  g.add(box(ctx, "#1A1C24", [0.22, 0.06, 0.22], [0, 1.24, 0]));
  // Joystick stick.
  g.add(box(ctx, C.woodDark, [0.06, 0.22, 0.06], [0, 1.38, 0]));
  // Joystick ball top.
  g.add(box(ctx, ctx.accent, [0.1, 0.1, 0.1], [0, 1.54, 0]));
  // Button trio next to joystick.
  for (let i = 0; i < 3; i++) {
    g.add(box(ctx, C.lit, [0.06, 0.04, 0.06], [0.18 + i * 0.1, 1.27, 0.06], { emissive: true }));
  }
  return { group: g, height: 1.64 };
};
