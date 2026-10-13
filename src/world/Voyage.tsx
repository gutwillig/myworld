import { memo, useMemo, useRef } from "react";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { COAST, DOCK, type Route, SHORE, ferryRoute, routeAt, seaOffset } from "@/grid/archipelago";
import { terrainProfile } from "@/grid/terrainProfile";
import { useWorldStore } from "@/store/world";
import { travelFrame, useFx } from "./fx";

const WATER_Y = terrainProfile("beach").waterY;
/** Shared with the light rig and the open sea: where the camera is looking. */
export const cameraFocus = new THREE.Vector3();

const headingToYaw = (x: number, z: number): number => Math.atan2(-z, x);

const PLANK = new THREE.MeshStandardMaterial({ color: "#B88A5E", flatShading: true, roughness: 1 });
const POST = new THREE.MeshStandardMaterial({ color: "#7A5A3E", flatShading: true, roughness: 1 });

/** A wooden pier from the beach out past the slab edge. Island-local. */
export const Dock = memo(function Dock() {
  const { center, length, yaw, posts } = useMemo(() => {
    const dx = DOCK.tip.x - DOCK.root.x;
    const dz = DOCK.tip.z - DOCK.root.z;
    const len = Math.hypot(dx, dz);
    const list: [number, number][] = [];
    for (let i = 1; i <= 5; i++) {
      const f = i / 5;
      for (const side of [-1, 1]) {
        list.push([DOCK.root.x + dx * f + SHORE.x * side * 0.33, DOCK.root.z + dz * f + SHORE.z * side * 0.33]);
      }
    }
    return {
      center: [(DOCK.root.x + DOCK.tip.x) / 2, (DOCK.root.z + DOCK.tip.z) / 2] as [number, number],
      length: len,
      yaw: headingToYaw(dx / len, dz / len),
      posts: list,
    };
  }, []);
  return (
    <group>
      <mesh position={[center[0], -0.05, center[1]]} rotation-y={yaw} material={PLANK} castShadow receiveShadow>
        <boxGeometry args={[length, 0.07, 0.72]} />
      </mesh>
      {posts.map(([x, z], i) => (
        <mesh key={i} position={[x, -0.3, z]} material={POST} castShadow>
          <cylinderGeometry args={[0.055, 0.06, 0.62, 5]} />
        </mesh>
      ))}
    </group>
  );
});

function hullGeometry(): THREE.ExtrudeGeometry {
  // Side profile, bow pointing +x; extruded across the beam.
  const s = new THREE.Shape();
  s.moveTo(-0.46, 0.04);
  s.lineTo(0.26, 0.0);
  s.lineTo(0.56, 0.24);
  s.lineTo(-0.5, 0.24);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.38, bevelEnabled: false });
  g.translate(0, 0, -0.19);
  return g;
}

const WAKE_COUNT = 46;
const WAKE_LIFE = 1.8;

/**
 * Your boat. Moored at the island you're on; during a trip it follows the ferry route and leaves
 * a foam trail. Clicking it opens the neighbors list.
 */
export function Boat() {
  const group = useRef<THREE.Group>(null);
  const hull = useMemo(() => hullGeometry(), []);
  const yaw = useRef<number>(headingToYaw(COAST.x, COAST.z));
  const wake = useRef<THREE.InstancedMesh>(null);
  const trail = useRef<{ x: number; z: number; born: number }[]>([]);
  const lastDrop = useRef<number>(0);
  const routeCache = useRef<{ key: string; route: Route } | null>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const now = performance.now();
    const time = clock.elapsedTime;
    const { travel } = useFx.getState();
    const { order, currentId } = useWorldStore.getState();
    let x: number;
    let z: number;
    let targetYaw: number;
    let speed = 0;
    if (travel) {
      const key = `${travel.fromId}>${travel.toId}`;
      if (routeCache.current?.key !== key) {
        routeCache.current = {
          key,
          route: ferryRoute(seaOffset(order.indexOf(travel.fromId)), seaOffset(order.indexOf(travel.toId))),
        };
      }
      const f = travelFrame(travel, now);
      const at = routeAt(routeCache.current.route, f.boat);
      x = at.pos.x;
      z = at.pos.z;
      targetYaw = headingToYaw(at.dir.x, at.dir.z);
      speed = f.boat > 0 && f.boat < 1 ? 1 : 0;
    } else {
      const home = seaOffset(order.indexOf(currentId));
      x = home.x + DOCK.mooring.x;
      z = home.z + DOCK.mooring.z;
      targetYaw = headingToYaw(COAST.x, COAST.z);
    }
    // Shortest-path turn so arrival swings the bow back out to sea.
    let d = targetYaw - yaw.current;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    yaw.current += d * (travel ? 0.25 : 0.035);

    g.position.set(x, WATER_Y + 0.02 + Math.sin(time * 2.1) * 0.025, z);
    g.rotation.set(Math.sin(time * 1.7) * 0.04, yaw.current, Math.sin(time * 1.3) * 0.03 + speed * 0.05);

    if (speed > 0 && now - lastDrop.current > 55) {
      lastDrop.current = now;
      const back = { x: Math.cos(yaw.current), z: -Math.sin(yaw.current) };
      trail.current.push({ x: x - back.x * 0.5, z: z - back.z * 0.5, born: now });
      if (trail.current.length > WAKE_COUNT) trail.current.shift();
    }
    const w = wake.current;
    if (w) {
      for (let i = 0; i < WAKE_COUNT; i++) {
        const p = trail.current[i];
        const age = p ? (now - p.born) / 1000 / WAKE_LIFE : 1;
        if (!p || age >= 1) {
          dummy.scale.setScalar(0.0001);
        } else {
          dummy.position.set(p.x, WATER_Y + 0.03, p.z);
          const k = (1 - age) * (0.3 + age * 0.9) + 0.04;
          dummy.scale.set(k, k, 1);
        }
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.updateMatrix();
        w.setMatrixAt(i, dummy.matrix);
      }
      w.instanceMatrix.needsUpdate = true;
    }
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (useFx.getState().travel) return;
    window.dispatchEvent(new CustomEvent("myworld:neighbors"));
  };

  return (
    <>
      <group
        ref={group}
        onClick={onClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => (document.body.style.cursor = "")}
        scale={1.15}
      >
        <mesh geometry={hull} castShadow>
          <meshStandardMaterial color="#F4EFE2" flatShading roughness={0.7} />
        </mesh>
        <mesh position={[0.02, 0.06, 0]} castShadow>
          <boxGeometry args={[0.96, 0.05, 0.4]} />
          <meshStandardMaterial color="#2E4A3B" flatShading roughness={0.8} />
        </mesh>
        <mesh position={[-0.12, 0.36, 0]} castShadow>
          <boxGeometry args={[0.34, 0.24, 0.3]} />
          <meshStandardMaterial color="#FBFBF4" flatShading roughness={0.7} />
        </mesh>
        <mesh position={[-0.12, 0.5, 0]} castShadow>
          <boxGeometry args={[0.42, 0.05, 0.36]} />
          <meshStandardMaterial color="#E5694F" flatShading roughness={0.6} />
        </mesh>
        <mesh position={[0.02, 0.38, 0.152]}>
          <boxGeometry args={[0.1, 0.08, 0.005]} />
          <meshStandardMaterial color="#8ED2C6" roughness={0.2} />
        </mesh>
        <mesh position={[-0.3, 0.72, 0]} castShadow>
          <cylinderGeometry args={[0.012, 0.014, 0.42, 4]} />
          <meshStandardMaterial color="#7A5A3E" />
        </mesh>
        <mesh position={[-0.21, 0.86, 0]} rotation-y={0}>
          <boxGeometry args={[0.17, 0.1, 0.006]} />
          <meshStandardMaterial color="#E5694F" side={THREE.DoubleSide} />
        </mesh>
      </group>
      <instancedMesh ref={wake} args={[undefined, undefined, WAKE_COUNT]} frustumCulled={false}>
        <circleGeometry args={[0.5, 7]} />
        <meshBasicMaterial color="#F7FBF6" transparent opacity={0.75} depthWrite={false} />
      </instancedMesh>
    </>
  );
}

/** The dashed ferry line across the water, shown while traveling. */
export function RouteLine() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const shown = useRef<string>("");
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const MAX = 160;

  useFrame(() => {
    const m = mesh.current;
    const material = mat.current;
    if (!m || !material) return;
    const { travel } = useFx.getState();
    if (!travel) {
      material.opacity = 0;
      m.visible = false;
      return;
    }
    const f = travelFrame(travel, performance.now());
    m.visible = true;
    material.opacity = 0.85 * f.lift;
    const key = `${travel.fromId}>${travel.toId}`;
    if (shown.current === key) return;
    shown.current = key;
    const { order } = useWorldStore.getState();
    const route = ferryRoute(seaOffset(order.indexOf(travel.fromId)), seaOffset(order.indexOf(travel.toId)));
    for (let i = 0; i < MAX; i++) {
      const t = (i + 0.5) / MAX;
      if (i % 2 === 1) {
        dummy.scale.setScalar(0.0001);
      } else {
        const at = routeAt(route, t);
        dummy.position.set(at.pos.x, WATER_Y + 0.02, at.pos.z);
        dummy.rotation.set(-Math.PI / 2, 0, Math.atan2(at.dir.z, at.dir.x) * -1);
        dummy.scale.set(1, 1, 1);
      }
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX]} frustumCulled={false} visible={false}>
      <planeGeometry args={[0.36, 0.08]} />
      <meshBasicMaterial ref={mat} color="#FBFBF4" transparent opacity={0} depthWrite={false} />
    </instancedMesh>
  );
}

function openSeaGeometry(): THREE.BufferGeometry {
  const rings = 18;
  const segs = 64;
  const R = 64;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const deep = new THREE.Color("#5FB3B1");
  for (let i = 0; i <= rings; i++) {
    const r = (i / rings) * R;
    const alpha = 1 - THREE.MathUtils.smoothstep(r, 26, 60);
    for (let s = 0; s < segs; s++) {
      const a = (s / segs) * Math.PI * 2;
      pos.push(Math.cos(a) * r, 0, Math.sin(a) * r);
      col.push(deep.r, deep.g, deep.b, alpha * 0.9);
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
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(idx);
  return g;
}

/** Open water that fades in under the islands while the camera is up at sea level. */
export function OpenSea() {
  const geo = useMemo(() => openSeaGeometry(), []);
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    const m = mesh.current;
    const material = mat.current;
    if (!m || !material) return;
    const { travel } = useFx.getState();
    const lift = travel ? travelFrame(travel, performance.now()).lift : 0;
    material.opacity = lift;
    m.visible = lift > 0.001;
    m.position.set(cameraFocus.x, WATER_Y - 0.04, cameraFocus.z);
  });
  return (
    <mesh ref={mesh} geometry={geo} renderOrder={-1} visible={false}>
      <meshBasicMaterial ref={mat} vertexColors transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}
