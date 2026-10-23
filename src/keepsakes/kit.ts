import * as THREE from "three";
import { C, type KitCtx, blob, box, cyl, dome, makeCtx, mesh } from "@/buildings/kit/common";
import type { KeepsakeKind } from "@/store/types";

/** A built keepsake. `tick` (seconds) drives its little bit of ambient motion, if any. */
export type KeepsakeBuild = { group: THREE.Group; tick?: (t: number) => void };

const SNOW = "#F6F6F0";
const HILL = "#7C9C74";
const PINE = "#4F8A55";
const STONE = "#9A958A";
const SAND_WOOD = "#B88A5E";
const CORAL = "#E5694F";
const FLAME = "#F29A3E";
const FLAME_HOT = "#F7D26A";
const MONSTER = "#2F5D3A";
const BRICK = "#A64B3B";
const SOX_RED = "#C8303A";
const GRASS = "#7DB765";
const DIRT = "#C99A6B";

/** A thin round bar between two points. */
function rod(ctx: KitCtx, color: string, a: THREE.Vector3, b: THREE.Vector3, r: number): THREE.Mesh {
  const len = a.distanceTo(b);
  const m = mesh(new THREE.CylinderGeometry(r, r, len, 5), ctx.mat(color));
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

function pine(ctx: KitCtx, x: number, z: number, s: number): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(ctx, C.woodDark, 0.025, 0.035, 0.1, 5, [0, 0, 0]));
  const cone = mesh(new THREE.ConeGeometry(0.13, 0.32, 6), ctx.mat(PINE));
  cone.position.y = 0.24;
  g.add(cone);
  g.position.set(x, 0, z);
  g.scale.setScalar(s);
  return g;
}

/** A tent-shaped hill with a snow cap, a groomed run, a chairlift and pines at the foot. */
function ski(ctx: KitCtx): KeepsakeBuild {
  const g = new THREE.Group();
  const H = 1.3;
  const R = 1.0;
  const hill = mesh(new THREE.ConeGeometry(R, H, 7), ctx.mat(HILL));
  hill.position.y = H / 2;
  hill.rotation.y = 0.22;
  g.add(hill);
  const cap = mesh(new THREE.ConeGeometry(0.6, 0.76, 7), ctx.mat(SNOW));
  cap.position.y = H - 0.38 + 0.005;
  cap.rotation.y = 0.22;
  g.add(cap);
  // Groomed run down the camera-facing slope.
  const run = box(ctx, SNOW, [0.2, 0.62, 0.04], [0, 0, 0]);
  run.geometry.translate(0, -0.31, 0);
  run.position.set(0.1, 0.62, 0.48);
  run.rotation.set(-0.66, 0, 0);
  g.add(run);
  // Chairlift up the right shoulder.
  const bottom = new THREE.Vector3(1.05, 0.4, 0.38);
  const top = new THREE.Vector3(0.28, 1.0, 0.14);
  g.add(rod(ctx, C.metal, new THREE.Vector3(1.05, 0, 0.38), bottom, 0.022));
  g.add(box(ctx, C.wall, [0.16, 0.12, 0.14], [top.x, top.y - 0.12, top.z]));
  g.add(rod(ctx, C.dark, bottom, top, 0.008));
  const chairs: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const c = box(ctx, CORAL, [0.07, 0.05, 0.06], [0, -0.06, 0]);
    chairs.push(c);
    g.add(c);
  }
  g.add(pine(ctx, -1.02, 0.42, 1.1), pine(ctx, -0.72, 0.9, 0.9), pine(ctx, 1.12, 0.92, 0.85), pine(ctx, -0.25, 1.08, 0.75));
  const tmp = new THREE.Vector3();
  return {
    group: g,
    tick: (t) => {
      chairs.forEach((c, i) => {
        const f = (t * 0.06 + i / chairs.length) % 1;
        tmp.lerpVectors(bottom, top, f);
        c.position.set(tmp.x, tmp.y - 0.06, tmp.z);
      });
    },
  };
}

/** A pocket ballpark: diamond, light towers and a tall green wall in left field. */
function ballpark(ctx: KitCtx): KeepsakeBuild {
  const g = new THREE.Group();
  const field = cyl(ctx, GRASS, 0.9, 0.92, 0.05, 12, [0, 0, 0]);
  field.castShadow = false;
  g.add(field);
  const dirt = box(ctx, DIRT, [0.52, 0.02, 0.52], [0, 0.05, 0.26]);
  dirt.rotation.y = Math.PI / 4;
  g.add(dirt);
  const infield = box(ctx, GRASS, [0.34, 0.025, 0.34], [0, 0.05, 0.26]);
  infield.rotation.y = Math.PI / 4;
  g.add(infield);
  g.add(cyl(ctx, DIRT, 0.05, 0.06, 0.035, 8, [0, 0.05, 0.26]));
  for (const [x, z] of [[0, 0.62], [0.36, 0.26], [0, -0.1], [-0.36, 0.26]] as const) {
    g.add(box(ctx, C.trim, [0.045, 0.02, 0.045], [x, 0.07, z]));
  }
  // The wall in left field (home plate faces the camera, so left field is back-left).
  const wall = box(ctx, MONSTER, [1.0, 0.36, 0.08], [0, 0, 0]);
  wall.position.set(-0.47, 0.21, -0.69);
  wall.rotation.y = 0.59;
  g.add(wall);
  const board = box(ctx, C.trim, [0.22, 0.09, 0.012], [0, 0, 0]);
  board.position.set(-0.45, 0.25, -0.66);
  board.rotation.y = 0.59;
  g.add(board);
  // Brick bleachers down the right side.
  const stands = box(ctx, BRICK, [0.92, 0.14, 0.14], [0, 0, 0]);
  stands.position.set(0.56, 0.1, -0.6);
  stands.rotation.y = -0.71;
  g.add(stands);
  const standsTop = box(ctx, BRICK, [0.86, 0.1, 0.08], [0, 0, 0]);
  standsTop.position.set(0.6, 0.22, -0.64);
  standsTop.rotation.y = -0.71;
  g.add(standsTop);
  for (const [x, z] of [[-0.86, 0.12], [0.86, 0.12]] as const) {
    g.add(cyl(ctx, C.metal, 0.018, 0.024, 0.78, 5, [x, 0, z]));
    const lamp = box(ctx, "#FFF3C9", [0.16, 0.08, 0.04], [x, 0.76, z], { emissive: true });
    lamp.rotation.y = x < 0 ? 0.8 : -0.8;
    g.add(lamp);
  }
  // Pennant over the wall.
  g.add(cyl(ctx, C.metal, 0.01, 0.01, 0.34, 4, [-0.05, 0.03, -0.86]));
  const pennant = mesh(new THREE.ConeGeometry(0.05, 0.16, 3), ctx.mat(SOX_RED));
  pennant.rotation.z = -Math.PI / 2;
  pennant.position.set(0.03, 0.32, -0.86);
  g.add(pennant);
  return {
    group: g,
    tick: (t) => {
      pennant.rotation.x = Math.sin(t * 3.1) * 0.35;
    },
  };
}

/** A wooden rack holding four oversized surfboards. */
function surf(ctx: KitCtx): KeepsakeBuild {
  const g = new THREE.Group();
  for (const x of [-0.44, 0.44]) g.add(box(ctx, SAND_WOOD, [0.06, 0.58, 0.06], [x, 0, -0.08]));
  g.add(box(ctx, SAND_WOOD, [0.96, 0.05, 0.06], [0, 0.5, -0.08]));
  g.add(box(ctx, SAND_WOOD, [0.96, 0.05, 0.16], [0, 0.04, 0.02]));
  const colors = [CORAL, "#3FA7A0", "#F2C14E", C.trim];
  colors.forEach((c, i) => {
    const b = mesh(new THREE.CapsuleGeometry(0.09, 0.66, 3, 8), ctx.mat(c));
    b.scale.set(1, 1, 0.24);
    b.position.set(-0.3 + i * 0.2, 0.47, 0.02);
    b.rotation.set(-0.16, 0, (i - 1.5) * 0.04);
    g.add(b);
    const stripe = box(ctx, i === 3 ? CORAL : C.trim, [0.02, 0.62, 0.012], [0, 0, 0]);
    stripe.position.set(-0.3 + i * 0.2, 0.47, 0.044);
    stripe.rotation.set(-0.16, 0, (i - 1.5) * 0.04);
    g.add(stripe);
  });
  return { group: g };
}

/** Stones, crossed logs and a flickering flame, with two log benches. */
function bonfire(ctx: KitCtx): KeepsakeBuild {
  const g = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    g.add(blob(ctx, STONE, 0.055, [Math.cos(a) * 0.17, 0.03, Math.sin(a) * 0.17], 0.7));
  }
  for (const a of [0.5, -0.6]) {
    const log = cyl(ctx, C.woodDark, 0.03, 0.03, 0.28, 6, [0, 0, 0]);
    log.rotation.set(Math.PI / 2, 0, a);
    log.position.set(0, 0.04, 0);
    g.add(log);
  }
  const outer = mesh(new THREE.ConeGeometry(0.1, 0.3, 6), ctx.mat(FLAME, { emissive: true }));
  outer.geometry.translate(0, 0.15, 0);
  outer.position.y = 0.05;
  const inner = mesh(new THREE.ConeGeometry(0.055, 0.2, 5), ctx.mat(FLAME_HOT, { emissive: true }));
  inner.geometry.translate(0, 0.1, 0);
  inner.position.y = 0.05;
  outer.castShadow = inner.castShadow = false;
  g.add(outer, inner);
  for (const a of [Math.PI * 0.25, Math.PI * 1.15]) {
    const bench = cyl(ctx, SAND_WOOD, 0.045, 0.045, 0.3, 6, [0, 0, 0]);
    bench.rotation.set(0, -a - Math.PI / 2, Math.PI / 2);
    bench.position.set(Math.cos(a) * 0.42, 0.045, Math.sin(a) * 0.42);
    g.add(bench);
  }
  return {
    group: g,
    tick: (t) => {
      outer.scale.set(1, 0.85 + Math.sin(t * 11) * 0.12 + Math.sin(t * 7.3) * 0.08, 1);
      inner.scale.set(1, 0.9 + Math.sin(t * 13 + 1) * 0.15, 1);
      outer.rotation.y = t * 0.8;
    },
  };
}

function palm(ctx: KitCtx, x: number, lean: number): THREE.Group {
  const g = new THREE.Group();
  let px = 0;
  let py = 0;
  for (let i = 0; i < 4; i++) {
    const seg = cyl(ctx, "#9A7552", 0.04 - i * 0.005, 0.048 - i * 0.005, 0.24, 6, [px, py, 0]);
    seg.rotation.z = -lean * (i + 1) * 0.12;
    g.add(seg);
    px += Math.sin(lean * (i + 1) * 0.12) * 0.24;
    py += 0.23;
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const frond = box(ctx, "#5E9B5A", [0.34, 0.02, 0.09], [0, 0, 0]);
    frond.geometry.translate(0.17, 0, 0);
    frond.position.set(px, py, 0);
    frond.rotation.set(0, a, -0.45);
    g.add(frond);
  }
  g.position.x = x;
  return g;
}

/** Two palms with a striped hammock slung between them. */
function hammock(ctx: KitCtx): KeepsakeBuild {
  const g = new THREE.Group();
  g.add(palm(ctx, -0.48, -1), palm(ctx, 0.48, 1));
  const swing = new THREE.Group();
  swing.position.set(0, 0.62, 0);
  const bed = mesh(new THREE.TorusGeometry(0.36, 0.06, 4, 12, Math.PI), ctx.mat(CORAL));
  bed.rotation.z = Math.PI;
  bed.scale.set(1, 0.6, 1.4);
  swing.add(bed);
  g.add(swing);
  g.add(rod(ctx, C.wallWarm, new THREE.Vector3(-0.36, 0.62, 0), new THREE.Vector3(-0.47, 0.7, 0), 0.008));
  g.add(rod(ctx, C.wallWarm, new THREE.Vector3(0.36, 0.62, 0), new THREE.Vector3(0.47, 0.7, 0), 0.008));
  return {
    group: g,
    tick: (t) => {
      swing.rotation.x = Math.sin(t * 1.4) * 0.16;
    },
  };
}

/** A half court with a hoop and a ball that keeps bouncing. */
function hoop(ctx: KitCtx): KeepsakeBuild {
  const g = new THREE.Group();
  const court = box(ctx, "#5F7F9A", [0.96, 0.03, 0.78], [0, 0, 0]);
  court.castShadow = false;
  g.add(court);
  g.add(box(ctx, CORAL, [0.32, 0.032, 0.3], [0, 0, -0.22]));
  g.add(box(ctx, C.trim, [0.96, 0.034, 0.02], [0, 0, 0.1]));
  g.add(cyl(ctx, C.dark, 0.025, 0.03, 0.62, 6, [0, 0, -0.42]));
  g.add(box(ctx, C.trim, [0.34, 0.22, 0.025], [0, 0.48, -0.38]));
  g.add(box(ctx, CORAL, [0.12, 0.08, 0.03], [0, 0.52, -0.37]));
  const rim = mesh(new THREE.TorusGeometry(0.065, 0.012, 4, 10), ctx.mat("#E07A2C"));
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, 0.5, -0.29);
  g.add(rim);
  const ball = mesh(new THREE.IcosahedronGeometry(0.055, 1), ctx.mat("#E07A2C"));
  g.add(ball);
  return {
    group: g,
    tick: (t) => {
      ball.position.set(0.2, 0.085 + Math.abs(Math.sin(t * 3.2)) * 0.22, 0.12);
    },
  };
}

/** A fenced veggie patch with a sunflower that tracks the sun (sort of). */
function garden(ctx: KitCtx): KeepsakeBuild {
  const g = new THREE.Group();
  g.add(box(ctx, "#7A5A3E", [0.8, 0.07, 0.6], [0, 0, 0]));
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 4; i++) {
      const x = -0.27 + i * 0.18;
      const z = -0.18 + row * 0.18;
      g.add(blob(ctx, row === 1 ? "#86C46B" : "#5E9B5A", 0.06, [x, 0.11, z], 0.8));
      if (row === 2 && i % 2 === 0) g.add(blob(ctx, "#D9443A", 0.025, [x + 0.04, 0.15, z + 0.04]));
    }
  }
  const post = (x: number, z: number) => g.add(box(ctx, C.trim, [0.035, 0.18, 0.035], [x, 0, z]));
  for (const x of [-0.44, 0.44]) for (const z of [-0.34, 0.34]) post(x, z);
  g.add(box(ctx, C.trim, [0.88, 0.025, 0.02], [0, 0.12, 0.34]), box(ctx, C.trim, [0.88, 0.025, 0.02], [0, 0.12, -0.34]));
  g.add(box(ctx, C.trim, [0.02, 0.025, 0.68], [0.44, 0.12, 0]), box(ctx, C.trim, [0.02, 0.025, 0.68], [-0.44, 0.12, 0]));
  g.add(cyl(ctx, "#5E9B5A", 0.012, 0.016, 0.56, 5, [0.36, 0, -0.26]));
  const head = new THREE.Group();
  head.position.set(0.36, 0.56, -0.26);
  const petals = cyl(ctx, "#F2C14E", 0.09, 0.09, 0.02, 10, [0, 0, 0]);
  petals.rotation.x = Math.PI / 2;
  const seeds = cyl(ctx, "#6E4A33", 0.045, 0.045, 0.03, 8, [0, 0, 0.005]);
  seeds.rotation.x = Math.PI / 2;
  head.add(petals, seeds);
  g.add(head);
  return {
    group: g,
    tick: (t) => {
      head.rotation.y = 0.5 + Math.sin(t * 0.4) * 0.3;
    },
  };
}

/** A white observatory whose dome slowly turns its telescope across the sky. */
function observatory(ctx: KitCtx): KeepsakeBuild {
  const g = new THREE.Group();
  g.add(cyl(ctx, C.wall, 0.28, 0.3, 0.3, 12, [0, 0, 0]));
  g.add(box(ctx, CORAL, [0.1, 0.17, 0.02], [0, 0, 0.29]));
  const turret = new THREE.Group();
  turret.position.y = 0.3;
  turret.add(dome(ctx, "#DCD4C4", 0.29, [0, 0, 0]));
  const slit = box(ctx, C.dark, [0.08, 0.22, 0.05], [0, 0, 0]);
  slit.position.set(0, 0.1, 0.24);
  slit.rotation.x = -0.6;
  turret.add(slit);
  const scope = cyl(ctx, C.dark, 0.035, 0.045, 0.3, 8, [0, 0, 0]);
  scope.geometry.translate(0, 0.15, 0);
  scope.position.set(0, 0.08, 0.1);
  scope.rotation.x = 0.85;
  turret.add(scope);
  g.add(turret);
  return {
    group: g,
    tick: (t) => {
      turret.rotation.y = Math.sin(t * 0.25) * 0.9;
    },
  };
}

const BUILDERS: Record<KeepsakeKind, (ctx: KitCtx) => KeepsakeBuild> = {
  ski,
  ballpark,
  surf,
  bonfire,
  hammock,
  hoop,
  garden,
  observatory,
};

/** Builds a keepsake. Origin is its ground center; its front faces +z. */
export function buildKeepsake(kind: KeepsakeKind): KeepsakeBuild {
  const build = BUILDERS[kind];
  const out = build(makeCtx(C.wall, false));
  out.tick?.(0);
  return out;
}
