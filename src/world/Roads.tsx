import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { type Hex, hexToWorld } from "@/grid/hex";
import { roadKey } from "@/grid/layout";
import { groundHeight, terrainProfile } from "@/grid/terrainProfile";
import type { Road, Terrain } from "@/store/types";
import { TIMING, clamp01, easeInOutCubic } from "./fx";
import { usePresence } from "./presence";

const STEP = 0.1;

const STYLE = {
  paved: { width: 0.35, curb: 0.46, lift: 0.028, color: "#8E918C", curbColor: "#E4DDCD", dash: "#F6F1E4" },
  dirt: { width: 0.25, curb: 0.32, lift: 0.012, color: "#C9A877", curbColor: "#D8C29A", dash: null },
} as const;

/** Smooths the zig-zag hex walk into a gentle curve, endpoints pinned. */
function centerline(path: Hex[], startInset: number): THREE.Vector3[] {
  let pts = path.map((h) => {
    const w = hexToWorld(h);
    return new THREE.Vector2(w.x, w.z);
  });
  for (let pass = 0; pass < 3; pass++) {
    pts = pts.map((p, i) => (i === 0 || i === pts.length - 1 ? p : p.clone().multiplyScalar(0.5).add(pts[i - 1].clone().add(pts[i + 1]).multiplyScalar(0.25))));
  }
  if (pts.length >= 2 && startInset > 0) {
    const dir = pts[1].clone().sub(pts[0]).normalize();
    pts[0] = pts[0].clone().add(dir.multiplyScalar(startInset));
  }
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p.x, 0, p.y)), false, "centripetal");
  const n = Math.max(2, Math.ceil(curve.getLength() / STEP));
  return curve.getSpacedPoints(n);
}

type Ribbon = { geo: THREE.BufferGeometry; count: number };

/** A ground-hugging ribbon laid out in order along its length so drawRange can grow it. */
function ribbon(
  line: THREE.Vector3[],
  width: number,
  lift: number,
  terrain: Terrain,
  segFilter?: (i: number, dist: number) => boolean,
): Ribbon {
  const p = terrainProfile(terrain);
  const pos: number[] = [];
  let dist = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    const segLen = a.distanceTo(b);
    if (!segFilter || segFilter(i, dist)) {
      const dir = new THREE.Vector3().subVectors(b, a).normalize();
      const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(width / 2);
      const corners = [a.clone().add(side), a.clone().sub(side), b.clone().sub(side), b.clone().add(side)];
      for (const c of corners) c.y = groundHeight(p, c.x, c.z) + lift;
      const [l0, r0, r1, l1] = corners;
      for (const v of [l0, l1, r0, r0, l1, r1]) pos.push(v.x, v.y, v.z);
    }
    dist += segLen;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return { geo, count: pos.length / 3 };
}

const RoadMesh = memo(function RoadMesh({
  road,
  terrain,
  born,
  leaving,
}: {
  road: Road;
  terrain: Terrain;
  born: "initial" | "new";
  leaving: boolean;
}) {
  const style = STYLE[road.kind];
  const parts = useMemo(() => {
    const line = centerline(road.path, road.kind === "paved" || road.from.q === 0 ? 0.5 : 0);
    const curb = ribbon(line, style.curb, style.lift - 0.006, terrain);
    const surface = ribbon(line, style.width, style.lift, terrain);
    const dash = style.dash ? ribbon(line, 0.035, style.lift + 0.003, terrain, (i) => i % 4 < 2 && i > 3) : null;
    return { curb, surface, dash };
  }, [road, terrain, style]);

  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const start = useRef<number>(born === "new" ? performance.now() : -1e9);
  const leaveAt = useRef<number | null>(null);
  if (leaving && leaveAt.current === null) leaveAt.current = performance.now();

  useFrame(() => {
    const now = performance.now();
    let f = clamp01((now - start.current) / 1000 / TIMING.roadEnd);
    if (leaveAt.current !== null) f = Math.min(f, 1 - clamp01((now - leaveAt.current) / 1000 / TIMING.leave));
    const e = easeInOutCubic(f);
    const list = [parts.curb, parts.surface, parts.dash];
    meshes.current.forEach((m, i) => {
      const r = list[i];
      if (!m || !r) return;
      const n = Math.floor((r.count / 6) * e) * 6;
      m.geometry.setDrawRange(0, n);
      m.visible = n > 0;
    });
  });

  return (
    <group>
      <mesh ref={(m) => (meshes.current[0] = m)} geometry={parts.curb.geo} receiveShadow>
        <meshStandardMaterial color={style.curbColor} flatShading roughness={1} />
      </mesh>
      <mesh ref={(m) => (meshes.current[1] = m)} geometry={parts.surface.geo} receiveShadow>
        <meshStandardMaterial color={style.color} flatShading roughness={0.95} />
      </mesh>
      {parts.dash && (
        <mesh ref={(m) => (meshes.current[2] = m)} geometry={parts.dash.geo}>
          <meshStandardMaterial color={style.dash ?? "#fff"} roughness={0.9} />
        </mesh>
      )}
    </group>
  );
});

const keyOf = (r: Road) => roadKey(r);

/** Renders every road from store data; roads grow in when added and retract when removed. */
export function Roads({ roads, terrain, epoch }: { roads: Road[]; terrain: Terrain; epoch: number }) {
  const entries = usePresence(roads, keyOf, epoch, TIMING.leave * 1000 + 60);
  return (
    <group>
      {entries.map((e) => (
        <RoadMesh key={`${epoch}:${e.key}`} road={e.item} terrain={terrain} born={e.born} leaving={e.leaving} />
      ))}
    </group>
  );
}
