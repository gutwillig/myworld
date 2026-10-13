import * as THREE from "three";

export type Vec3 = [number, number, number];
type MatOpts = { emissive?: boolean; rough?: number };

export type KitCtx = {
  accent: string;
  faded: boolean;
  mat: (color: string, opts?: MatOpts) => THREE.MeshStandardMaterial;
};

/** A built building: its group and the height of its tallest point (for the name sign). */
export type KitBuild = { group: THREE.Group; height: number };
export type KitBuilder = (ctx: KitCtx) => KitBuild;

export const C = {
  wall: "#F2EADB",
  wallWarm: "#E8D8BF",
  stone: "#DCD4C4",
  trim: "#FBF8F1",
  roofDark: "#6F6B64",
  glass: "#86A9B2",
  lit: "#F5D27E",
  wood: "#A7774F",
  woodDark: "#6E4A33",
  metal: "#8F9592",
  green: "#86C46B",
  leaf: "#6FA35A",
  dark: "#38463F",
  pad: "#E4DDCD",
};

/** Desaturates by 40% and lifts lightness — the Old Town look. */
export function fadeColor(hex: string, amount = 0.4): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s * (1 - amount), hsl.l + (1 - hsl.l) * 0.22);
  return `#${c.getHexString()}`;
}

const matCache = new Map<string, THREE.MeshStandardMaterial>();

export function getMaterial(color: string, faded: boolean, opts?: MatOpts): THREE.MeshStandardMaterial {
  const key = `${color}|${faded ? 1 : 0}|${opts?.emissive ? 1 : 0}|${opts?.rough ?? ""}`;
  let m = matCache.get(key);
  if (!m) {
    const col = faded ? fadeColor(color) : color;
    m = new THREE.MeshStandardMaterial({
      color: col,
      flatShading: true,
      roughness: opts?.rough ?? 0.88,
      metalness: 0,
      emissive: opts?.emissive ? new THREE.Color(col) : new THREE.Color(0x000000),
      emissiveIntensity: opts?.emissive ? (faded ? 0.15 : 0.45) : 0,
    });
    matCache.set(key, m);
  }
  return m;
}

export function makeCtx(accent: string, faded: boolean): KitCtx {
  return { accent, faded, mat: (color, opts) => getMaterial(color, faded, opts) };
}

export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Box with its bottom face at pos.y. */
export function box(ctx: KitCtx, color: string, size: Vec3, pos: Vec3, opts?: MatOpts): THREE.Mesh {
  const m = mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), ctx.mat(color, opts));
  m.position.set(pos[0], pos[1] + size[1] / 2, pos[2]);
  return m;
}

/** Cylinder with its bottom at pos.y. */
export function cyl(
  ctx: KitCtx,
  color: string,
  rTop: number,
  rBottom: number,
  h: number,
  seg: number,
  pos: Vec3,
  opts?: MatOpts,
): THREE.Mesh {
  const m = mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), ctx.mat(color, opts));
  m.position.set(pos[0], pos[1] + h / 2, pos[2]);
  return m;
}

/** Low-poly blob (icosahedron) centered at pos. */
export function blob(ctx: KitCtx, color: string, r: number, pos: Vec3, squash = 1): THREE.Mesh {
  const m = mesh(new THREE.IcosahedronGeometry(r, 0), ctx.mat(color));
  m.position.set(...pos);
  m.scale.set(1, squash, 1);
  return m;
}

/**
 * Extrudes a convex (z,y) profile along x, centered at pos.x, bottom at pos.y.
 * rotY rotates the result around y (π/2 makes the profile face the front).
 */
export function prism(
  ctx: KitCtx,
  color: string,
  profile: [number, number][],
  length: number,
  pos: Vec3,
  rotY = 0,
  opts?: MatOpts,
): THREE.Mesh {
  const m = mesh(prismGeometry(profile, length), ctx.mat(color, opts));
  m.position.set(...pos);
  m.rotation.y = rotY;
  return m;
}

export function prismGeometry(profile: [number, number][], length: number): THREE.BufferGeometry {
  const hx = length / 2;
  const n = profile.length;
  const cy = profile.reduce((a, p) => a + p[1], 0) / n;
  const cz = profile.reduce((a, p) => a + p[0], 0) / n;
  const tris: THREE.Vector3[][] = [];
  for (let i = 0; i < n; i++) {
    const [z0, y0] = profile[i];
    const [z1, y1] = profile[(i + 1) % n];
    const a = new THREE.Vector3(-hx, y0, z0);
    const b = new THREE.Vector3(hx, y0, z0);
    const c = new THREE.Vector3(hx, y1, z1);
    const d = new THREE.Vector3(-hx, y1, z1);
    tris.push([a, b, c], [a, c, d]);
  }
  const caps = THREE.ShapeUtils.triangulateShape(
    profile.map(([z, y]) => new THREE.Vector2(z, y)),
    [],
  );
  for (const [i0, i1, i2] of caps) {
    for (const sx of [-hx, hx]) {
      tris.push([i0, i1, i2].map((i) => new THREE.Vector3(sx, profile[i][1], profile[i][0])));
    }
  }
  const center = new THREE.Vector3(0, cy, cz);
  const pos: number[] = [];
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const cen = new THREE.Vector3();
  for (const t of tris) {
    e1.subVectors(t[1], t[0]);
    e2.subVectors(t[2], t[0]);
    nrm.crossVectors(e1, e2);
    cen.copy(t[0]).add(t[1]).add(t[2]).divideScalar(3).sub(center);
    const ordered = nrm.dot(cen) >= 0 ? t : [t[0], t[2], t[1]];
    for (const v of ordered) pos.push(v.x, v.y, v.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** The paved lot every building stands on. */
export function lotPad(ctx: KitCtx, r = 0.86): THREE.Mesh {
  const m = mesh(new THREE.CylinderGeometry(r, r + 0.03, 0.08, 9), ctx.mat(C.pad));
  m.position.set(0, -0.03 + 0.04, 0);
  m.rotation.y = Math.PI / 9;
  m.castShadow = false;
  return m;
}

export function group(...children: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  for (const c of children) g.add(c);
  return g;
}

/** A small round shrub. */
export const shrub = (ctx: KitCtx, pos: Vec3, r = 0.1): THREE.Mesh => blob(ctx, C.leaf, r, [pos[0], pos[1] + r * 0.7, pos[2]], 0.85);

/** Square pyramid (a 4-sided cone) with its bottom at pos.y. */
export function pyramid(ctx: KitCtx, color: string, r: number, h: number, pos: Vec3, opts?: MatOpts): THREE.Mesh {
  const m = cyl(ctx, color, 0, r, h, 4, pos, opts);
  m.rotation.y = Math.PI / 4;
  return m;
}

/** Half sphere sitting on pos.y. */
export function dome(ctx: KitCtx, color: string, r: number, pos: Vec3, opts?: MatOpts): THREE.Mesh {
  const m = mesh(new THREE.SphereGeometry(r, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), ctx.mat(color, opts));
  m.position.set(...pos);
  return m;
}

/** Upright round plate facing +z (clock faces, round windows, arches). */
export function roundel(ctx: KitCtx, color: string, r: number, pos: Vec3, opts?: MatOpts): THREE.Mesh {
  const m = mesh(new THREE.CylinderGeometry(r, r, 0.03, 12), ctx.mat(color, opts));
  m.rotation.x = Math.PI / 2;
  m.position.set(...pos);
  return m;
}

/** Flat ground patch (ellipse via sx/sz) with its top just above pos.y. */
export function patch(ctx: KitCtx, color: string, r: number, pos: Vec3, sx = 1, sz = 1, h = 0.03, seg = 12): THREE.Mesh {
  const m = mesh(new THREE.CylinderGeometry(r, r * 1.04, h, seg), ctx.mat(color));
  m.position.set(pos[0], pos[1] + h / 2, pos[2]);
  m.scale.set(sx, 1, sz);
  m.castShadow = false;
  return m;
}

/** Small low-poly tree. */
export function tree(ctx: KitCtx, pos: Vec3, s = 1, kind: "pine" | "round" = "round"): THREE.Group {
  const g = group(cyl(ctx, C.wood, 0.025 * s, 0.035 * s, 0.16 * s, 5, pos));
  if (kind === "pine") {
    g.add(cyl(ctx, C.leaf, 0, 0.17 * s, 0.32 * s, 6, [pos[0], pos[1] + 0.12 * s, pos[2]]));
    g.add(cyl(ctx, "#5E9B5A", 0, 0.12 * s, 0.24 * s, 6, [pos[0], pos[1] + 0.3 * s, pos[2]]));
  } else {
    g.add(blob(ctx, C.leaf, 0.16 * s, [pos[0], pos[1] + 0.27 * s, pos[2]]));
  }
  return g;
}

/** Little car: body, cabin, dark wheels hint. Faces +x before rotY. */
export function car(ctx: KitCtx, color: string, pos: Vec3, rotY = 0): THREE.Group {
  const g = group(
    box(ctx, color, [0.24, 0.07, 0.12], [0, 0.02, 0]),
    box(ctx, C.trim, [0.12, 0.06, 0.1], [-0.02, 0.09, 0]),
    box(ctx, C.glass, [0.02, 0.045, 0.09], [0.045, 0.095, 0]),
    box(ctx, C.dark, [0.2, 0.03, 0.13], [0, 0.0, 0]),
  );
  g.position.set(...pos);
  g.rotation.y = rotY;
  return g;
}

/** Pennant flag on a thin pole. */
export function flag(ctx: KitCtx, color: string, pos: Vec3, h = 0.5): THREE.Group {
  return group(
    cyl(ctx, C.trim, 0.01, 0.01, h, 5, pos),
    prism(ctx, color, [[0, 0], [0.18, 0.06], [0, 0.12]], 0.012, [pos[0], pos[1] + h - 0.13, pos[2]], Math.PI / 2),
  );
}
