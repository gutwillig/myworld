import { memo, useMemo, useRef } from "react";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { hexToWorld } from "@/grid/hex";
import { PLAZA_RADIUS, clientsOf, isGig } from "@/grid/plaza";
import { groundHeight, terrainProfile } from "@/grid/terrainProfile";
import type { Building, Terrain, World } from "@/store/types";
import { wasDrag } from "./dragState";
import { useFx } from "./fx";

const DISC = new THREE.CircleGeometry(PLAZA_RADIUS, 40);
DISC.rotateX(-Math.PI / 2);
const RIM = new THREE.RingGeometry(PLAZA_RADIUS - 0.07, PLAZA_RADIUS, 40);
RIM.rotateX(-Math.PI / 2);
const INNER = new THREE.RingGeometry(0.62, 0.66, 32);
INNER.rotateX(-Math.PI / 2);
const HOVER = new THREE.RingGeometry(PLAZA_RADIUS + 0.06, PLAZA_RADIUS + 0.16, 48);
HOVER.rotateX(-Math.PI / 2);

const cobble = new THREE.MeshLambertMaterial({ color: "#E4E2D4" });
const rim = new THREE.MeshLambertMaterial({ color: "#C9C5B0" });
const inner = new THREE.MeshLambertMaterial({ color: "#D3CFBA" });

/** The cobbled square under each main gig. Clicking it from the town steps into the plaza. */
export const Plazas = memo(function Plazas({ world, interactive }: { world: World; interactive: boolean }) {
  const gigs = world.buildings.filter(isGig);
  return (
    <group>
      {gigs.map((g) => (
        <group key={g.id}>
          <PlazaGround gig={g} terrain={world.terrain} interactive={interactive} />
          <Spurs gig={g} clients={clientsOf(world.buildings, g.id)} terrain={world.terrain} />
        </group>
      ))}
    </group>
  );
});

function PlazaGround({ gig, terrain, interactive }: { gig: Building; terrain: Terrain; interactive: boolean }) {
  const pos = useMemo(() => {
    const w = hexToWorld(gig.hex);
    return new THREE.Vector3(w.x, groundHeight(terrainProfile(terrain), w.x, w.z) + 0.03, w.z);
  }, [gig.hex, terrain]);
  const hoverMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#E5694F", transparent: true, opacity: 0, depthWrite: false }), []);
  const hovered = useRef<boolean>(false);
  const ring = useRef<THREE.Mesh>(null);

  useFrame(({ clock }, dt) => {
    const fx = useFx.getState();
    const inside = fx.plazaId === gig.id;
    const want = hovered.current && !inside && !fx.moving ? 0.85 : 0;
    hoverMat.opacity += (want - hoverMat.opacity) * Math.min(1, dt * 10);
    if (ring.current) {
      ring.current.visible = hoverMat.opacity > 0.01;
      ring.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 3) * 0.015);
    }
  });

  const enter = (e: ThreeEvent<MouseEvent>) => {
    const fx = useFx.getState();
    if (!interactive || wasDrag() || fx.placement || fx.moving || fx.plazaId === gig.id) return;
    e.stopPropagation();
    fx.select(null);
    fx.setPlaza(gig.id);
  };

  return (
    <group position={pos}>
      <mesh
        geometry={DISC}
        material={cobble}
        receiveShadow
        onClick={enter}
        onPointerOver={() => {
          if (!interactive || useFx.getState().plazaId === gig.id) return;
          hovered.current = true;
          document.body.style.cursor = "zoom-in";
        }}
        onPointerOut={() => {
          hovered.current = false;
          if (!useFx.getState().moving) document.body.style.cursor = "";
        }}
      />
      <mesh geometry={RIM} material={rim} position-y={0.003} />
      <mesh geometry={INNER} material={inner} position-y={0.003} />
      <mesh ref={ring} geometry={HOVER} material={hoverMat} position-y={0.006} visible={false} />
    </group>
  );
}

const SPUR_ROAD = new THREE.MeshLambertMaterial({ color: "#B4836C" });
const SPUR_CURB = new THREE.MeshLambertMaterial({ color: "#EAD9CA" });

/** A flat ribbon laid along the ground from a to b (island-local x/z). */
function strip(ax: number, az: number, bx: number, bz: number, width: number, lift: number, terrain: Terrain) {
  const p = terrainProfile(terrain);
  const len = Math.hypot(bx - ax, bz - az);
  const n = Math.max(2, Math.ceil(len / 0.12));
  const dx = (bx - ax) / len;
  const dz = (bz - az) / len;
  const sx = -dz * (width / 2);
  const sz = dx * (width / 2);
  const pos: number[] = [];
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    const c = [t0, t1].map((t) => ({ x: ax + (bx - ax) * t, z: az + (bz - az) * t }));
    const v = [
      [c[0].x + sx, c[0].z + sz],
      [c[0].x - sx, c[0].z - sz],
      [c[1].x - sx, c[1].z - sz],
      [c[1].x + sx, c[1].z + sz],
    ].map(([x, z]) => [x, groundHeight(p, x, z) + lift, z]);
    for (const k of [0, 3, 1, 1, 3, 2]) pos.push(...v[k]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** Small brick spurs off the square, one out to each client building. */
function Spurs({ gig, clients, terrain }: { gig: Building; clients: Building[]; terrain: Terrain }) {
  const key = clients.map((c) => `${c.spot?.x.toFixed(2)},${c.spot?.z.toFixed(2)}`).join("|");
  const geos = useMemo(() => {
    const c = hexToWorld(gig.hex);
    return clients.map((k) => {
      const sx = k.spot?.x ?? 1;
      const sz = k.spot?.z ?? 0;
      const d = Math.hypot(sx, sz) || 1;
      const ux = sx / d;
      const uz = sz / d;
      const from = PLAZA_RADIUS - 0.05;
      const to = Math.max(from + 0.15, d - 0.3);
      const args = [c.x + ux * from, c.z + uz * from, c.x + ux * to, c.z + uz * to] as const;
      return { road: strip(...args, 0.2, 0.026, terrain), curb: strip(...args, 0.28, 0.02, terrain) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gig.hex, key, terrain]);
  return (
    <group>
      {geos.map((g, i) => (
        <group key={i}>
          <mesh geometry={g.curb} material={SPUR_CURB} receiveShadow />
          <mesh geometry={g.road} material={SPUR_ROAD} receiveShadow />
        </group>
      ))}
    </group>
  );
}
