import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { coastCoord, groundHeight, smoothNoise, terrainProfile } from "@/grid/terrainProfile";
import type { Terrain as TerrainKind } from "@/store/types";
import { travelFrame, useFx } from "./fx";
import { boundaryRadii, radiusAt, seededRandom } from "./islandShape";

const SLAB_BOTTOM = -0.95;
const RINGS = 16;

type Props = { terrain: TerrainKind; seed: string };

type Ring = { pts: THREE.Vector3[]; angles: number[] };

/** Builds a disk of concentric jittered rings that reach exactly the island outline. */
function buildRings(radii: number[], seed: string, profile: ReturnType<typeof terrainProfile>): Ring[] {
  const rand = seededRandom(`${seed}:mesh`);
  const rings: Ring[] = [];
  const outerR = radii.reduce((a, b) => Math.max(a, b), 0);
  for (let i = 0; i <= RINGS; i++) {
    const f = i / RINGS;
    if (i === 0) {
      rings.push({ pts: [new THREE.Vector3(0, groundHeight(profile, 0, 0), 0)], angles: [0] });
      continue;
    }
    const n = Math.max(6, Math.round((2 * Math.PI * f * outerR) / 0.78));
    const offset = (rand() - 0.5) * 0.3 * (Math.PI * 2) / n;
    const pts: THREE.Vector3[] = [];
    const angles: number[] = [];
    for (let k = 0; k < n; k++) {
      let a = (k / n) * Math.PI * 2 + offset;
      let ff = f;
      if (i < RINGS) {
        a += (rand() - 0.5) * 0.45 * (Math.PI * 2) / n;
        ff += (rand() - 0.5) * 0.35 / RINGS;
      }
      const r = ff * radiusAt(radii, a);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      pts.push(new THREE.Vector3(x, groundHeight(profile, x, z), z));
      angles.push(a);
    }
    rings.push({ pts, angles });
  }
  return rings;
}

function triColor(profile: ReturnType<typeof terrainProfile>, cx: number, cy: number, cz: number, rand: () => number): THREE.Color {
  const c = coastCoord(profile, cx, cz);
  const jitter = (rand() - 0.5) * 0.035;
  const col = new THREE.Color();
  if (c > profile.waterLine - 0.1) {
    col.set("#D9C59A");
  } else if (c > profile.sandStart + 0.15) {
    col.set(profile.sand);
  } else if (c > profile.sandStart - 0.35) {
    col.set("#C9CD8E");
  } else {
    const n = smoothNoise(cx * 0.45 + 3, cz * 0.45 - 2);
    col.set(n > 0.15 ? profile.grassAlt : profile.grass);
    if (cy > 0.06) col.offsetHSL(0, 0, 0.025);
  }
  col.offsetHSL(0, 0, jitter);
  return col;
}

function buildGround(rings: Ring[], profile: ReturnType<typeof terrainProfile>, seed: string): THREE.BufferGeometry {
  const rand = seededRandom(`${seed}:paint`);
  const pos: number[] = [];
  const col: number[] = [];
  const pushTri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    const ux = b.x - a.x;
    const uz = b.z - a.z;
    const vx = c.x - a.x;
    const vz = c.z - a.z;
    const cross = uz * vx - ux * vz;
    const tri = cross >= 0 ? [a, b, c] : [a, c, b];
    const color = triColor(profile, (a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3, (a.z + b.z + c.z) / 3, rand);
    for (const v of tri) {
      pos.push(v.x, v.y, v.z);
      col.push(color.r, color.g, color.b);
    }
  };

  for (let i = 0; i < rings.length - 1; i++) {
    const A = rings[i];
    const B = rings[i + 1];
    const nA = A.pts.length;
    const nB = B.pts.length;
    if (nA === 1) {
      for (let j = 0; j < nB; j++) pushTri(A.pts[0], B.pts[j], B.pts[(j + 1) % nB]);
      continue;
    }
    const angA = (k: number) => A.angles[k % nA] + Math.floor(k / nA) * Math.PI * 2;
    const angB = (k: number) => B.angles[k % nB] + Math.floor(k / nB) * Math.PI * 2;
    let a = 0;
    let b = 0;
    while (a < nA || b < nB) {
      const advanceA = b >= nB || (a < nA && angA(a + 1) <= angB(b + 1));
      if (advanceA) {
        pushTri(A.pts[a % nA], A.pts[(a + 1) % nA], B.pts[b % nB]);
        a++;
      } else {
        pushTri(A.pts[a % nA], B.pts[(b + 1) % nB], B.pts[b % nB]);
        b++;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function buildSlab(outer: Ring, profile: ReturnType<typeof terrainProfile>): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const top = new THREE.Color(profile.slab);
  const band = new THREE.Color(profile.slab).offsetHSL(0, -0.05, -0.08);
  const n = outer.pts.length;
  for (let k = 0; k < n; k++) {
    const p = outer.pts[k];
    const q = outer.pts[(k + 1) % n];
    const mid = -0.55;
    const layers: { y0p: number; y0q: number; y1: number; c: THREE.Color }[] = [
      { y0p: p.y, y0q: q.y, y1: Math.min(mid, Math.min(p.y, q.y) - 0.02), c: top },
      { y0p: Math.min(mid, Math.min(p.y, q.y) - 0.02), y0q: Math.min(mid, Math.min(p.y, q.y) - 0.02), y1: SLAB_BOTTOM, c: band },
    ];
    for (const L of layers) {
      const a = [p.x, L.y0p, p.z];
      const b = [q.x, L.y0q, q.z];
      const c = [q.x, L.y1, q.z];
      const d = [p.x, L.y1, p.z];
      for (const v of [a, c, b, a, d, c]) {
        pos.push(v[0], v[1], v[2]);
        col.push(L.c.r, L.c.g, L.c.b);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/** Soft radial shadow texture for the table under the model. */
function makeShadowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(128, 128, 40, 128, 128, 128);
    g.addColorStop(0, "rgba(46,74,59,0.34)");
    g.addColorStop(0.55, "rgba(46,74,59,0.16)");
    g.addColorStop(1, "rgba(46,74,59,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const WATER_R = 24;

function buildWater(profile: ReturnType<typeof terrainProfile>): THREE.BufferGeometry {
  // Polar grid so the edge can fade into the page and vertices can wave.
  const rings = 30;
  const segs = 72;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const shallow = new THREE.Color("#8ED2C6");
  const deep = new THREE.Color("#4FA7A8");
  const tmp = new THREE.Color();
  for (let i = 0; i <= rings; i++) {
    const r = (i / rings) * WATER_R;
    for (let s = 0; s < segs; s++) {
      const a = (s / segs) * Math.PI * 2 + (i % 2 ? Math.PI / segs : 0);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      pos.push(x, 0, z);
      const c = coastCoord(profile, x, z);
      const seaSide = THREE.MathUtils.smoothstep(c, profile.waterLine - 3.2, profile.waterLine + 0.6);
      const fade = 1 - THREE.MathUtils.smoothstep(r, 13.5, 22);
      const depth = THREE.MathUtils.smoothstep(c, profile.waterLine, profile.waterLine + 6);
      tmp.copy(shallow).lerp(deep, depth);
      col.push(tmp.r, tmp.g, tmp.b, Math.min(0.92, seaSide * fade * 0.95));
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let s = 0; s < segs; s++) {
      const a = i * segs + s;
      const b = i * segs + ((s + 1) % segs);
      const c = (i + 1) * segs + s;
      const d = (i + 1) * segs + ((s + 1) % segs);
      idx.push(a, b, c, b, d, c);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
  out.setIndex(idx);
  out.computeVertexNormals();
  return out;
}

const Water = memo(function Water({ terrain }: { terrain: TerrainKind }) {
  const profile = terrainProfile(terrain);
  const geo = useMemo(() => buildWater(profile), [profile]);
  const base = useMemo(() => Float32Array.from(geo.getAttribute("position").array as Float32Array), [geo]);
  const ref = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const { travel } = useFx.getState();
    // Out at sea the open water takes over; each island keeps only a faint shallow halo.
    if (mat.current) mat.current.opacity = travel ? 1 - 0.75 * travelFrame(travel, performance.now()).lift : 1;
    const attr = geo.getAttribute("position") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      const x = base[i];
      const z = base[i + 2];
      arr[i + 1] = Math.sin(x * 0.9 + t * 0.9) * 0.035 + Math.sin(z * 1.3 - t * 0.7) * 0.03;
    }
    attr.needsUpdate = true;
  });
  return (
    <mesh ref={ref} geometry={geo} position={[0, profile.waterY, 0]} receiveShadow>
      <meshStandardMaterial
        ref={mat}
        vertexColors
        transparent
        flatShading
        roughness={0.35}
        metalness={0.05}
        depthWrite={false}
      />
    </mesh>
  );
});

/** The ground, slab, water and table shadow. Terrain kind is a parameter, not a separate scene. */
export const Terrain = memo(function Terrain({ terrain, seed }: Props) {
  const profile = terrainProfile(terrain);
  const { ground, slab } = useMemo(() => {
    const radii = boundaryRadii(seed);
    const rings = buildRings(radii, seed, profile);
    return { ground: buildGround(rings, profile, seed), slab: buildSlab(rings[rings.length - 1], profile) };
  }, [seed, profile]);
  const shadowTex = useMemo(() => makeShadowTexture(), []);

  return (
    <group>
      <mesh geometry={ground} receiveShadow>
        <meshStandardMaterial vertexColors flatShading roughness={0.95} />
      </mesh>
      <mesh geometry={slab} castShadow receiveShadow>
        <meshStandardMaterial vertexColors flatShading roughness={1} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[1.2, SLAB_BOTTOM - 0.02, -0.6]} scale={[2.25, 2.25, 1]}>
        <planeGeometry args={[14, 14]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} />
      </mesh>
      <Water terrain={terrain} />
    </group>
  );
});
