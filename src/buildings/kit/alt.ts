import { C, box, cyl, dome, flag, group, lotPad, prism, pyramid, roundel, shrub, type KitBuilder } from "./common";

/**
 * Alternate styles for each building type. Same rules as the base kit: front faces +z,
 * footprint inside ±0.55, lot pad top at y=0.05, accent on one signature element.
 */

const BRICK = "#B9694F";

// ── Theater ────────────────────────────────────────────────────────────────

/** Big screen on stilts, a tiny projection booth and speaker posts. */
export const theaterDriveIn: KitBuilder = (ctx) => {
  const g = group(lotPad(ctx, 0.9));
  for (const x of [-0.44, 0.44]) g.add(box(ctx, C.woodDark, [0.07, 0.5, 0.07], [x, 0.05, -0.32]));
  g.add(box(ctx, C.dark, [1.1, 0.68, 0.08], [0, 0.46, -0.36]));
  g.add(box(ctx, "#EEF1EC", [1.0, 0.58, 0.02], [0, 0.51, -0.31], { emissive: true }));
  g.add(box(ctx, "#F5D27E", [0.26, 0.2, 0.01], [0.2, 0.68, -0.295], { emissive: true }));
  g.add(box(ctx, "#86A9B2", [0.5, 0.14, 0.01], [-0.18, 0.56, -0.295], { emissive: true }));
  g.add(box(ctx, ctx.accent, [1.12, 0.1, 0.1], [0, 1.14, -0.36]));
  // Projection booth facing the screen.
  g.add(box(ctx, C.wall, [0.32, 0.3, 0.28], [0.3, 0.05, 0.3]));
  g.add(box(ctx, ctx.accent, [0.38, 0.05, 0.34], [0.3, 0.35, 0.3]));
  g.add(box(ctx, C.lit, [0.12, 0.1, 0.02], [0.3, 0.2, 0.155], { emissive: true }));
  // Speaker posts in two rows.
  for (const [x, z] of [[-0.42, 0.06], [-0.12, 0.06], [-0.42, 0.4], [-0.12, 0.4]] as const) {
    g.add(box(ctx, C.metal, [0.03, 0.2, 0.03], [x, 0.05, z]));
    g.add(box(ctx, C.dark, [0.08, 0.06, 0.05], [x, 0.24, z]));
  }
  return { group: g, height: 1.36 };
};

/** Small brick cinema: arched door, round window, poster frames. */
export const theaterArtHouse: KitBuilder = (ctx) => {
  const g = group(lotPad(ctx), box(ctx, BRICK, [0.8, 0.92, 0.7], [0, 0.05, -0.08]));
  g.add(box(ctx, C.trim, [0.86, 0.06, 0.76], [0, 0.97, -0.08]));
  g.add(box(ctx, BRICK, [0.42, 0.16, 0.7], [0, 1.03, -0.08]));
  g.add(box(ctx, C.trim, [0.46, 0.04, 0.74], [0, 1.19, -0.08]));
  // Arched doorway.
  g.add(box(ctx, C.lit, [0.26, 0.26, 0.03], [0, 0.05, 0.27], { emissive: true }));
  g.add(roundel(ctx, C.lit, 0.13, [0, 0.31, 0.27], { emissive: true }));
  // Poster frames.
  for (const x of [-0.27, 0.27]) {
    g.add(box(ctx, C.woodDark, [0.17, 0.26, 0.03], [x, 0.12, 0.27]));
    g.add(box(ctx, ctx.accent, [0.12, 0.2, 0.02], [x, 0.15, 0.285]));
  }
  // Little marquee and round window.
  g.add(box(ctx, C.dark, [0.52, 0.1, 0.14], [0, 0.5, 0.31]));
  g.add(box(ctx, C.lit, [0.46, 0.04, 0.01], [0, 0.53, 0.385], { emissive: true }));
  g.add(roundel(ctx, C.trim, 0.13, [0, 0.76, 0.27]));
  g.add(roundel(ctx, C.glass, 0.1, [0, 0.76, 0.285]));
  for (const z of [-0.3, 0]) g.add(box(ctx, C.glass, [0.03, 0.22, 0.13], [0.41, 0.6, z]));
  g.add(shrub(ctx, [0.56, 0.04, 0.38], 0.1));
  return { group: g, height: 1.48 };
};

/** Grand picture palace: colonnade, dome, tall blade sign. */
export const theaterPalace: KitBuilder = (ctx) => {
  const g = group(lotPad(ctx, 0.92), box(ctx, C.stone, [1.16, 0.08, 0.94], [0, 0.05, 0]));
  g.add(box(ctx, "#EADFCB", [1.06, 0.72, 0.64], [0, 0.13, -0.12]));
  for (const x of [-0.42, -0.14, 0.14, 0.42]) g.add(cyl(ctx, C.trim, 0.045, 0.052, 0.5, 8, [x, 0.13, 0.34]));
  g.add(box(ctx, C.trim, [1.12, 0.08, 0.34], [0, 0.63, 0.25]));
  g.add(box(ctx, C.lit, [0.5, 0.32, 0.02], [0, 0.13, 0.21], { emissive: true }));
  g.add(box(ctx, C.stone, [1.12, 0.08, 0.68], [0, 0.85, -0.12]));
  g.add(cyl(ctx, C.trim, 0.3, 0.3, 0.12, 12, [0, 0.93, -0.14]));
  g.add(dome(ctx, ctx.accent, 0.3, [0, 1.05, -0.14]));
  g.add(cyl(ctx, "#E3B04B", 0.015, 0.03, 0.14, 6, [0, 1.33, -0.14]));
  // Blade sign on the corner.
  g.add(box(ctx, ctx.accent, [0.08, 0.62, 0.2], [0.5, 0.72, 0.24]));
  for (let i = 0; i < 5; i++) g.add(box(ctx, C.lit, [0.09, 0.07, 0.12], [0.5, 0.78 + i * 0.11, 0.26], { emissive: true }));
  for (const z of [-0.32, -0.04]) g.add(box(ctx, C.glass, [0.03, 0.26, 0.14], [0.535, 0.4, z]));
  return { group: g, height: 1.52 };
};

// ── Clubhouse ──────────────────────────────────────────────────────────────

/** Whitewashed links cottage with slate roof, two chimneys and a flag. */
export const clubhouseLinks: KitBuilder = (ctx) => {
  const g = group(lotPad(ctx, 0.9), box(ctx, "#F1ECE0", [0.92, 0.44, 0.56], [-0.08, 0.05, -0.12]));
  g.add(prism(ctx, "#56636B", [[-0.34, 0], [0.34, 0], [0, 0.32]], 1.02, [-0.08, 0.49, -0.12]));
  for (const x of [-0.48, 0.3]) g.add(box(ctx, C.stone, [0.12, 0.36, 0.14], [x, 0.6, -0.14]));
  g.add(box(ctx, C.trim, [0.32, 0.3, 0.12], [-0.3, 0.05, 0.2]));
  g.add(box(ctx, C.glass, [0.26, 0.18, 0.02], [-0.3, 0.13, 0.265]));
  g.add(box(ctx, ctx.accent, [0.16, 0.28, 0.03], [0.12, 0.05, 0.165]));
  g.add(box(ctx, C.glass, [0.14, 0.14, 0.02], [0.3, 0.2, 0.165]));
  g.add(box(ctx, C.wood, [0.26, 0.05, 0.08], [0.3, 0.1, 0.3]));
  g.add(flag(ctx, ctx.accent, [0.56, 0.05, 0.24], 0.8));
  g.add(shrub(ctx, [-0.6, 0.04, 0.32], 0.11));
  return { group: g, height: 1.0 };
};

/** Modern club: stone base, cantilevered glass floor, deck with an umbrella. */
export const clubhouseModern: KitBuilder = (ctx) => {
  const g = group(lotPad(ctx, 0.9));
  g.add(box(ctx, C.stone, [0.78, 0.3, 0.58], [-0.12, 0.05, -0.16]));
  g.add(box(ctx, C.glass, [0.7, 0.24, 0.02], [-0.12, 0.08, 0.135]));
  g.add(box(ctx, C.trim, [1.12, 0.28, 0.66], [0.05, 0.35, -0.1]));
  g.add(box(ctx, C.glass, [1.02, 0.16, 0.02], [0.05, 0.41, 0.235]));
  g.add(box(ctx, C.glass, [0.02, 0.16, 0.56], [0.615, 0.41, -0.1]));
  g.add(box(ctx, ctx.accent, [1.14, 0.05, 0.68], [0.05, 0.63, -0.1]));
  // Deck, rail and umbrella.
  g.add(box(ctx, C.wood, [0.5, 0.04, 0.3], [0.28, 0.05, 0.38]));
  g.add(box(ctx, C.trim, [0.5, 0.02, 0.02], [0.28, 0.2, 0.53]));
  for (const x of [0.04, 0.52]) g.add(box(ctx, C.trim, [0.02, 0.15, 0.02], [x, 0.05, 0.53]));
  g.add(cyl(ctx, C.trim, 0.008, 0.008, 0.3, 5, [0.38, 0.09, 0.4]));
  g.add(cyl(ctx, ctx.accent, 0.01, 0.16, 0.07, 8, [0.38, 0.36, 0.4]));
  g.add(shrub(ctx, [-0.6, 0.04, 0.36], 0.11));
  return { group: g, height: 0.96 };
};

// ── Office ─────────────────────────────────────────────────────────────────

/** Brick loft with lintel windows and a rooftop water tank. */
export const officeLoft: KitBuilder = (ctx) => {
  const g = group(lotPad(ctx), box(ctx, BRICK, [0.92, 1.0, 0.78], [0, 0.05, -0.06]));
  g.add(box(ctx, C.trim, [0.98, 0.07, 0.84], [0, 1.05, -0.06]));
  for (const row of [0.2, 0.62]) {
    for (const col of [-0.28, 0, 0.28]) {
      if (row === 0.2 && col === 0) continue;
      g.add(box(ctx, C.glass, [0.16, 0.28, 0.03], [col, row, 0.33]));
      g.add(box(ctx, C.trim, [0.21, 0.04, 0.04], [col, row + 0.28, 0.335]));
    }
    for (const z of [-0.28, 0.06]) g.add(box(ctx, C.glass, [0.03, 0.28, 0.16], [0.46, row, z]));
  }
  g.add(box(ctx, C.lit, [0.2, 0.3, 0.03], [0, 0.05, 0.33], { emissive: true }));
  g.add(box(ctx, ctx.accent, [0.32, 0.04, 0.16], [0, 0.37, 0.4]));
  // Water tank on legs.
  for (const [x, z] of [[0.1, -0.24], [0.3, -0.24], [0.1, -0.04], [0.3, -0.04]] as const) {
    g.add(box(ctx, C.metal, [0.025, 0.12, 0.025], [x, 1.12, z]));
  }
  g.add(cyl(ctx, C.wood, 0.14, 0.14, 0.22, 8, [0.2, 1.24, -0.14]));
  g.add(cyl(ctx, ctx.accent, 0.02, 0.16, 0.1, 8, [0.2, 1.46, -0.14]));
  g.add(shrub(ctx, [-0.6, 0.04, 0.42], 0.12));
  return { group: g, height: 1.62 };
};

/** Glass HQ with white fins and a green roof. */
export const officeGlass: KitBuilder = (ctx) => {
  const g = group(lotPad(ctx, 0.9), box(ctx, C.stone, [1.12, 0.06, 0.88], [0, 0.05, -0.04]));
  g.add(box(ctx, C.glass, [1.0, 0.72, 0.76], [0, 0.11, -0.04]));
  for (let i = 0; i < 7; i++) g.add(box(ctx, C.trim, [0.025, 0.72, 0.03], [-0.45 + i * 0.15, 0.11, 0.34]));
  for (let i = 0; i < 5; i++) g.add(box(ctx, C.trim, [0.03, 0.72, 0.025], [0.5, 0.11, -0.36 + i * 0.16]));
  g.add(box(ctx, C.trim, [1.04, 0.04, 0.8], [0, 0.46, -0.04]));
  g.add(box(ctx, C.trim, [1.06, 0.06, 0.82], [0, 0.83, -0.04]));
  g.add(box(ctx, C.green, [0.92, 0.04, 0.68], [0, 0.89, -0.04]));
  g.add(shrub(ctx, [-0.25, 0.92, -0.2], 0.09));
  g.add(shrub(ctx, [0.2, 0.92, 0.05], 0.08));
  g.add(box(ctx, C.lit, [0.26, 0.3, 0.03], [0, 0.11, 0.35], { emissive: true }));
  g.add(box(ctx, ctx.accent, [0.52, 0.05, 0.26], [0, 0.42, 0.46]));
  g.add(box(ctx, ctx.accent, [0.34, 0.12, 0.04], [0.22, 0.93, 0.32]));
  return { group: g, height: 1.24 };
};

// ── Studio ─────────────────────────────────────────────────────────────────

/** Barn studio: gambrel roof, braced barn doors, hay loft window. */
export const studioBarn: KitBuilder = (ctx) => {
  const g = group(lotPad(ctx), box(ctx, C.wall, [0.88, 0.5, 0.8], [0, 0.05, -0.05]));
  g.add(
    prism(ctx, C.roofDark, [[-0.48, 0], [0.48, 0], [0.34, 0.22], [0, 0.38], [-0.34, 0.22]], 0.86, [0, 0.55, -0.05], Math.PI / 2),
  );
  g.add(box(ctx, ctx.accent, [0.42, 0.4, 0.03], [0, 0.05, 0.36]));
  const a = box(ctx, C.trim, [0.03, 0.52, 0.02], [0, 0.04, 0.38]);
  a.rotation.z = 0.8;
  const b = box(ctx, C.trim, [0.03, 0.52, 0.02], [0, 0.04, 0.38]);
  b.rotation.z = -0.8;
  a.position.y = b.position.y = 0.25;
  g.add(a, b);
  g.add(box(ctx, C.trim, [0.46, 0.03, 0.03], [0, 0.45, 0.37]));
  g.add(box(ctx, C.lit, [0.14, 0.12, 0.02], [0, 0.66, 0.385], { emissive: true }));
  for (const x of [-0.32, 0.32]) g.add(box(ctx, C.glass, [0.1, 0.14, 0.02], [x, 0.24, 0.36]));
  g.add(box(ctx, C.metal, [0.08, 0.12, 0.08], [0, 0.92, -0.05]));
  g.add(shrub(ctx, [0.62, 0.04, 0.42], 0.1));
  return { group: g, height: 1.1 };
};

/** A-frame cabin with a glass gable and an ON AIR light. */
export const studioAFrame: KitBuilder = (ctx) => {
  const g = group(lotPad(ctx));
  g.add(prism(ctx, C.roofDark, [[-0.52, 0], [0.52, 0], [0, 0.98]], 0.8, [0, 0.05, -0.08], Math.PI / 2));
  g.add(prism(ctx, C.glass, [[-0.4, 0], [0.4, 0], [0, 0.74]], 0.02, [0, 0.07, 0.33], Math.PI / 2));
  g.add(box(ctx, C.trim, [0.02, 0.72, 0.03], [0, 0.07, 0.34]));
  g.add(box(ctx, C.trim, [0.6, 0.02, 0.03], [0, 0.4, 0.34]));
  g.add(box(ctx, C.wood, [0.86, 0.04, 0.24], [0, 0.05, 0.46]));
  g.add(box(ctx, ctx.accent, [0.16, 0.3, 0.03], [0.16, 0.07, 0.35]));
  g.add(box(ctx, ctx.accent, [0.16, 0.06, 0.03], [-0.16, 0.52, 0.35], { emissive: true }));
  g.add(cyl(ctx, C.metal, 0.03, 0.03, 0.3, 6, [0.22, 0.62, -0.3]));
  g.add(shrub(ctx, [-0.6, 0.04, 0.4], 0.11));
  return { group: g, height: 1.18 };
};

// ── Workshop ───────────────────────────────────────────────────────────────

/** Garage with a half-open roll-up door, solar panels and a dish. */
export const workshopGarage: KitBuilder = (ctx) => {
  const g = group(lotPad(ctx), box(ctx, "#D9D2C2", [0.96, 0.56, 0.74], [0, 0.05, -0.06]));
  g.add(box(ctx, C.lit, [0.52, 0.14, 0.02], [-0.14, 0.05, 0.315], { emissive: true }));
  g.add(box(ctx, C.metal, [0.52, 0.26, 0.03], [-0.14, 0.19, 0.32]));
  for (let i = 0; i < 4; i++) g.add(box(ctx, "#7B827F", [0.52, 0.012, 0.035], [-0.14, 0.23 + i * 0.06, 0.322]));
  g.add(box(ctx, ctx.accent, [0.14, 0.32, 0.03], [0.3, 0.05, 0.32]));
  g.add(box(ctx, C.dark, [1.0, 0.05, 0.78], [0, 0.61, -0.06]));
  for (const x of [-0.24, 0.12]) {
    const p = box(ctx, "#4E6A86", [0.3, 0.02, 0.4], [x, 0.7, -0.1]);
    p.rotation.x = -0.35;
    g.add(p);
  }
  g.add(cyl(ctx, C.trim, 0.1, 0.03, 0.05, 8, [0.38, 0.72, -0.3]));
  g.add(cyl(ctx, ctx.accent, 0.12, 0.12, 0.22, 8, [0.62, 0.04, 0.12]));
  g.add(box(ctx, C.wood, [0.2, 0.12, 0.2], [-0.64, 0.04, 0.3]));
  return { group: g, height: 1.0 };
};

/** Greenhouse lab with glass gable and planter boxes. */
export const workshopGreenhouse: KitBuilder = (ctx) => {
  const g = group(lotPad(ctx), box(ctx, C.stone, [0.92, 0.12, 0.7], [0, 0.05, -0.06]));
  g.add(box(ctx, "#A9CBC6", [0.88, 0.38, 0.66], [0, 0.17, -0.06]));
  g.add(prism(ctx, "#C3DEDA", [[-0.35, 0], [0.35, 0], [0, 0.3]], 0.92, [0, 0.55, -0.06]));
  for (let i = 0; i < 5; i++) g.add(box(ctx, C.trim, [0.025, 0.38, 0.02], [-0.4 + i * 0.2, 0.17, 0.275]));
  g.add(box(ctx, C.trim, [0.92, 0.025, 0.7], [0, 0.55, -0.06]));
  g.add(box(ctx, ctx.accent, [0.16, 0.3, 0.02], [0.3, 0.17, 0.285]));
  for (const [x, c] of [[-0.3, "#E5694F"], [0.0, "#F2C14E"]] as const) {
    g.add(box(ctx, C.wood, [0.26, 0.1, 0.14], [x, 0.05, 0.44]));
    g.add(shrub(ctx, [x - 0.06, 0.15, 0.44], 0.07));
    g.add(box(ctx, c, [0.05, 0.05, 0.05], [x + 0.07, 0.15, 0.44]));
  }
  g.add(box(ctx, C.lit, [0.06, 0.06, 0.06], [0, 0.6, -0.06], { emissive: true }));
  return { group: g, height: 1.0 };
};

// ── Exchange ───────────────────────────────────────────────────────────────

/** Old bank with rusticated stone and a clock tower. */
export const exchangeBank: KitBuilder = (ctx) => {
  const g = group(lotPad(ctx), box(ctx, C.stone, [0.98, 0.62, 0.7], [0, 0.05, -0.08]));
  for (const y of [0.25, 0.45]) g.add(box(ctx, C.trim, [1.0, 0.03, 0.72], [0, y, -0.08]));
  g.add(box(ctx, C.lit, [0.22, 0.28, 0.03], [0, 0.05, 0.28], { emissive: true }));
  g.add(roundel(ctx, C.lit, 0.11, [0, 0.33, 0.28], { emissive: true }));
  for (const x of [-0.32, 0.32]) g.add(box(ctx, C.glass, [0.14, 0.2, 0.03], [x, 0.26, 0.28]));
  g.add(box(ctx, C.trim, [1.04, 0.06, 0.76], [0, 0.67, -0.08]));
  // Clock tower.
  g.add(box(ctx, C.wall, [0.32, 0.6, 0.32], [0, 0.73, -0.16]));
  g.add(roundel(ctx, C.trim, 0.11, [0, 1.12, 0.005]));
  g.add(box(ctx, C.dark, [0.015, 0.08, 0.01], [0, 1.15, 0.025]));
  g.add(box(ctx, C.dark, [0.06, 0.015, 0.01], [0.02, 1.12, 0.025]));
  g.add(box(ctx, C.trim, [0.38, 0.04, 0.38], [0, 1.33, -0.16]));
  g.add(pyramid(ctx, ctx.accent, 0.28, 0.3, [0, 1.37, -0.16]));
  return { group: g, height: 1.82 };
};

/** Round trading house with a lit ticker ring. */
export const exchangeRotunda: KitBuilder = (ctx) => {
  const g = group(lotPad(ctx, 0.9));
  g.add(cyl(ctx, C.wall, 0.5, 0.52, 0.66, 14, [0, 0.05, -0.02]));
  g.add(cyl(ctx, C.glass, 0.505, 0.505, 0.18, 14, [0, 0.26, -0.02]));
  g.add(cyl(ctx, C.dark, 0.52, 0.52, 0.08, 14, [0, 0.55, -0.02]));
  for (let i = -3; i <= 3; i++) {
    const a = i * 0.32;
    const seg = box(ctx, i % 2 ? "#E5694F" : "#8FD07A", [0.08, 0.035, 0.01], [Math.sin(a) * 0.525, 0.572, Math.cos(a) * 0.525 - 0.02], { emissive: true });
    seg.rotation.y = a;
    g.add(seg);
  }
  g.add(cyl(ctx, ctx.accent, 0.38, 0.5, 0.1, 14, [0, 0.71, -0.02]));
  g.add(cyl(ctx, C.metal, 0.012, 0.012, 0.32, 5, [0, 0.81, -0.02]));
  g.add(box(ctx, C.lit, [0.22, 0.26, 0.03], [0, 0.05, 0.495], { emissive: true }));
  g.add(box(ctx, C.trim, [0.32, 0.04, 0.14], [0, 0.32, 0.54]));
  return { group: g, height: 1.24 };
};

// ── Tower ──────────────────────────────────────────────────────────────────

/** Art deco skyscraper: stepped tiers, glass ribbons, crown and spire. */
export const towerDeco: KitBuilder = (ctx) => {
  const g = group(lotPad(ctx), box(ctx, C.stone, [0.84, 0.3, 0.84], [0, 0.05, 0]));
  g.add(box(ctx, "#ECE4D2", [0.66, 1.0, 0.66], [0, 0.35, 0]));
  g.add(box(ctx, "#ECE4D2", [0.5, 0.5, 0.5], [0, 1.35, 0]));
  g.add(box(ctx, "#ECE4D2", [0.34, 0.36, 0.34], [0, 1.85, 0]));
  for (const x of [-0.2, 0, 0.2]) g.add(box(ctx, C.glass, [0.08, 0.9, 0.02], [x, 0.4, 0.335]));
  for (const z of [-0.2, 0, 0.2]) g.add(box(ctx, C.glass, [0.02, 0.9, 0.08], [0.335, 0.4, z]));
  for (const x of [-0.12, 0.12]) g.add(box(ctx, C.glass, [0.08, 0.42, 0.02], [x, 1.39, 0.255]));
  g.add(pyramid(ctx, ctx.accent, 0.26, 0.32, [0, 2.21, 0]));
  g.add(cyl(ctx, C.metal, 0.008, 0.015, 0.32, 5, [0, 2.5, 0]));
  g.add(box(ctx, C.lit, [0.26, 0.2, 0.02], [0, 0.05, 0.43], { emissive: true }));
  return { group: g, height: 2.95 };
};

/** Twin glass towers joined by a sky bridge. */
export const towerTwin: KitBuilder = (ctx) => {
  const g = group(lotPad(ctx), box(ctx, C.stone, [1.0, 0.12, 0.7], [0, 0.05, 0]));
  for (const [x, h] of [[-0.25, 1.75], [0.25, 2.1]] as const) {
    g.add(box(ctx, "#9DBAC0", [0.38, h, 0.5], [x, 0.17, 0]));
    for (let y = 0.45; y < h; y += 0.3) g.add(box(ctx, C.trim, [0.39, 0.03, 0.51], [x, 0.17 + y, 0]));
    g.add(box(ctx, C.trim, [0.42, 0.06, 0.54], [x, 0.17 + h, 0]));
  }
  g.add(box(ctx, ctx.accent, [0.14, 0.14, 0.3], [0, 1.24, 0]));
  g.add(box(ctx, ctx.accent, [0.2, 0.08, 0.2], [0.25, 2.33, 0]));
  g.add(box(ctx, C.lit, [0.3, 0.16, 0.02], [0, 0.17, 0.26], { emissive: true }));
  return { group: g, height: 2.62 };
};

// ── Clinic ─────────────────────────────────────────────────────────────────

/** Round wellness pavilion on a wooden deck. */
export const clinicPavilion: KitBuilder = (ctx) => {
  const g = group(lotPad(ctx), cyl(ctx, C.wood, 0.62, 0.62, 0.05, 12, [0, 0.05, 0]));
  g.add(cyl(ctx, "#F3EEE2", 0.44, 0.44, 0.42, 12, [0, 0.1, -0.04]));
  g.add(cyl(ctx, C.glass, 0.445, 0.445, 0.16, 12, [0, 0.22, -0.04]));
  g.add(cyl(ctx, "#D2A878", 0.08, 0.54, 0.16, 12, [0, 0.52, -0.04]));
  g.add(cyl(ctx, C.leaf, 0.07, 0.07, 0.04, 8, [0, 0.7, -0.04]));
  g.add(box(ctx, C.lit, [0.18, 0.26, 0.03], [0, 0.1, 0.4], { emissive: true }));
  g.add(box(ctx, C.woodDark, [0.03, 0.42, 0.03], [0.46, 0.1, 0.4]));
  g.add(box(ctx, ctx.accent, [0.06, 0.18, 0.03], [0.46, 0.46, 0.42], { emissive: true }));
  g.add(box(ctx, ctx.accent, [0.18, 0.06, 0.03], [0.46, 0.52, 0.42], { emissive: true }));
  g.add(shrub(ctx, [-0.5, 0.08, 0.32], 0.1));
  g.add(shrub(ctx, [-0.56, 0.08, -0.12], 0.09));
  return { group: g, height: 1.05 };
};

/** Hospital: tall block, low entrance wing, rooftop helipad. */
export const clinicHospital: KitBuilder = (ctx) => {
  const g = group(lotPad(ctx, 0.9), box(ctx, "#F7F5EF", [1.08, 0.96, 0.56], [0, 0.05, -0.18]));
  for (const y of [0.42, 0.7]) {
    for (let i = 0; i < 5; i++) g.add(box(ctx, C.glass, [0.13, 0.14, 0.02], [-0.4 + i * 0.2, y, 0.105]));
  }
  g.add(box(ctx, ctx.accent, [1.1, 0.05, 0.58], [0, 0.94, -0.18]));
  g.add(box(ctx, "#F7F5EF", [0.62, 0.32, 0.3], [-0.1, 0.05, 0.22]));
  g.add(box(ctx, C.lit, [0.3, 0.22, 0.02], [-0.1, 0.05, 0.375], { emissive: true }));
  g.add(box(ctx, "#CFE3DE", [0.66, 0.04, 0.34], [-0.1, 0.37, 0.22]));
  // Helipad.
  g.add(cyl(ctx, C.dark, 0.22, 0.22, 0.03, 12, [0.2, 1.01, -0.18]));
  g.add(box(ctx, C.trim, [0.03, 0.01, 0.16], [0.16, 1.04, -0.18]));
  g.add(box(ctx, C.trim, [0.03, 0.01, 0.16], [0.24, 1.04, -0.18]));
  g.add(box(ctx, C.trim, [0.08, 0.01, 0.03], [0.2, 1.04, -0.18]));
  // Cross sign.
  g.add(box(ctx, ctx.accent, [0.08, 0.24, 0.03], [-0.34, 0.68, 0.11], { emissive: true }));
  g.add(box(ctx, ctx.accent, [0.24, 0.08, 0.03], [-0.34, 0.76, 0.11], { emissive: true }));
  return { group: g, height: 1.34 };
};

// ── Storefront ─────────────────────────────────────────────────────────────

/** Corner café: big window, curved canopy, cup on the roof, chalkboard. */
export const storefrontCafe: KitBuilder = (ctx) => {
  const g = group(lotPad(ctx), box(ctx, "#F0E2C8", [0.86, 0.66, 0.62], [0, 0.05, -0.1]));
  g.add(box(ctx, C.trim, [0.9, 0.06, 0.66], [0, 0.71, -0.1]));
  g.add(box(ctx, C.lit, [0.5, 0.28, 0.03], [-0.12, 0.1, 0.215], { emissive: true }));
  g.add(box(ctx, C.woodDark, [0.16, 0.36, 0.03], [0.28, 0.05, 0.215]));
  g.add(prism(ctx, ctx.accent, [[0, 0], [0.2, -0.08], [0.22, -0.03], [0.02, 0.06]], 0.86, [0, 0.5, 0.21]));
  for (const x of [-0.24, 0.12]) {
    g.add(box(ctx, C.glass, [0.14, 0.12, 0.02], [x, 0.55, 0.215]));
    g.add(box(ctx, ctx.accent, [0.05, 0.14, 0.02], [x - 0.1, 0.54, 0.22]));
  }
  g.add(cyl(ctx, C.trim, 0.09, 0.07, 0.16, 10, [0.2, 0.77, -0.12]));
  g.add(cyl(ctx, ctx.accent, 0.092, 0.092, 0.04, 10, [0.2, 0.83, -0.12]));
  const board = box(ctx, C.dark, [0.12, 0.18, 0.03], [0.5, 0.04, 0.34]);
  board.rotation.x = -0.2;
  g.add(board);
  return { group: g, height: 1.12 };
};

/** Open market hall: long pitched roof on posts, crates of produce, lanterns. */
export const storefrontMarket: KitBuilder = (ctx) => {
  const g = group(lotPad(ctx, 0.9));
  for (const x of [-0.48, 0, 0.48]) {
    for (const z of [-0.3, 0.3]) g.add(box(ctx, C.woodDark, [0.05, 0.46, 0.05], [x, 0.05, z]));
  }
  g.add(prism(ctx, ctx.accent, [[-0.44, 0], [0.44, 0], [0, 0.3]], 1.14, [0, 0.5, 0]));
  g.add(box(ctx, C.trim, [1.14, 0.03, 0.04], [0, 0.49, 0.42]));
  const produce = ["#8FBF6A", "#E7A24B", "#E5694F", "#F2C14E"];
  produce.forEach((c, i) => {
    const x = -0.36 + i * 0.24;
    g.add(box(ctx, C.wood, [0.18, 0.12, 0.16], [x, 0.05, 0.08]));
    g.add(box(ctx, c, [0.14, 0.05, 0.12], [x, 0.17, 0.08]));
  });
  g.add(box(ctx, C.wood, [0.9, 0.16, 0.12], [0, 0.05, -0.18]));
  for (const x of [-0.25, 0.25]) g.add(box(ctx, C.lit, [0.06, 0.07, 0.06], [x, 0.4, 0.1], { emissive: true }));
  return { group: g, height: 1.0 };
};
