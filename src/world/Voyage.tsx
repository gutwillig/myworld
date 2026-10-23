import { memo, useMemo, useRef } from "react";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { AIRSTRIP, COAST, DOCK, type Route, SHORE, ferryRoute, routeAt, seaOffset, standFor } from "@/grid/archipelago";
import { terrainProfile } from "@/grid/terrainProfile";
import type { Terrain } from "@/store/types";
import { useWorldStore } from "@/store/world";
import { travelFrame, useFx } from "./fx";
import { boundaryRadii, radiusAt } from "./islandShape";

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

const STRIP = new THREE.MeshStandardMaterial({ color: "#CDBFA3", flatShading: true, roughness: 1 });
const PAINT = new THREE.MeshStandardMaterial({ color: "#FBFBF4", flatShading: true, roughness: 0.9 });
const STRIP_TOP = 0.12;

/** A gravel bush strip on landlocked worlds, running off the mesa's front edge. Island-local. */
export const Airstrip = memo(function Airstrip({ seed }: { seed: string }) {
  const { center, length, yaw, dashes, sock } = useMemo(() => {
    const radii = boundaryRadii(seed);
    const dx = AIRSTRIP.tip.x - AIRSTRIP.root.x;
    const dz = AIRSTRIP.tip.z - AIRSTRIP.root.z;
    const full = Math.hypot(dx, dz);
    const ux = dx / full;
    const uz = dz / full;
    // Stop short of the cliff so the strip never hangs over the edge.
    let len = full;
    while (len > 1.6) {
      const x = AIRSTRIP.root.x + ux * len;
      const z = AIRSTRIP.root.z + uz * len;
      if (Math.hypot(x, z) < radiusAt(radii, Math.atan2(z, x)) - 0.35) break;
      len -= 0.1;
    }
    const list: [number, number][] = [];
    for (let i = 1; i <= 3; i++) {
      const f = (i / 4) * len;
      list.push([AIRSTRIP.root.x + ux * f, AIRSTRIP.root.z + uz * f]);
    }
    return {
      center: [AIRSTRIP.root.x + (ux * len) / 2, AIRSTRIP.root.z + (uz * len) / 2] as [number, number],
      length: len,
      yaw: headingToYaw(ux, uz),
      dashes: list,
      sock: [AIRSTRIP.root.x - SHORE.x * 0.75, AIRSTRIP.root.z - SHORE.z * 0.75] as [number, number],
    };
  }, [seed]);
  return (
    <group>
      <mesh position={[center[0], STRIP_TOP - 0.07, center[1]]} rotation-y={yaw} material={STRIP} receiveShadow>
        <boxGeometry args={[length, 0.14, 0.82]} />
      </mesh>
      {dashes.map(([x, z], i) => (
        <mesh key={i} position={[x, STRIP_TOP + 0.004, z]} rotation-y={yaw} material={PAINT}>
          <boxGeometry args={[0.32, 0.01, 0.07]} />
        </mesh>
      ))}
      <group position={[sock[0], STRIP_TOP, sock[1]]}>
        <mesh position={[0, 0.3, 0]} material={POST} castShadow>
          <cylinderGeometry args={[0.018, 0.022, 0.6, 5]} />
        </mesh>
        <mesh position={[0.12, 0.56, 0]} rotation-z={-Math.PI / 2 + 0.25} castShadow>
          <coneGeometry args={[0.06, 0.24, 6, 1, true]} />
          <meshStandardMaterial color="#E5694F" flatShading side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
});

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const CRUISE = 2.6;
/** Height above the takeoff/landing surface at route progress t. */
const altitude = (t: number): number => CRUISE * smooth(0.07, 0.32, t) * (1 - smooth(0.68, 0.93, t));
/** Resting height on a world: floats on the water, or wheels on the strip. */
const restY = (terrain: Terrain | undefined): number => (terrainProfile(terrain ?? "beach").shore ? WATER_Y + 0.02 : STRIP_TOP);

/** The route a trip between two worlds flies, from stand to stand. */
export function tripRoute(fromId: string, toId: string): Route {
  const { order, worlds } = useWorldStore.getState();
  return ferryRoute(
    seaOffset(order.indexOf(fromId)),
    seaOffset(order.indexOf(toId)),
    standFor(worlds[fromId]?.terrain),
    standFor(worlds[toId]?.terrain),
  );
}

/** Height of the plane along a trip, so the dashed flight path and the plane agree. */
function tripY(fromId: string, toId: string, t: number): number {
  const { worlds } = useWorldStore.getState();
  const base = THREE.MathUtils.lerp(restY(worlds[fromId]?.terrain), restY(worlds[toId]?.terrain), smooth(0.3, 0.7, t));
  return base + altitude(t);
}

const WAKE_COUNT = 46;
const WAKE_LIFE = 1.8;
const CREAM = "#FBFBF4";
const CORAL = "#E5694F";
const INK = "#2E4A3B";

/**
 * Your floatplane. Tied up at the dock on beach worlds, parked on the strip on mountain ones;
 * during a trip it takes off, flies the route and lands. Clicking it opens the neighbors list.
 */
export function Plane() {
  const group = useRef<THREE.Group>(null);
  const prop = useRef<THREE.Group>(null);
  const yaw = useRef<number>(headingToYaw(COAST.x, COAST.z));
  const bank = useRef<number>(0);
  const wake = useRef<THREE.InstancedMesh>(null);
  const trail = useRef<{ x: number; z: number; born: number }[]>([]);
  const lastDrop = useRef<number>(0);
  const routeCache = useRef<{ key: string; route: Route } | null>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }, delta) => {
    const g = group.current;
    if (!g) return;
    const now = performance.now();
    const time = clock.elapsedTime;
    const { travel } = useFx.getState();
    const { order, currentId, worlds } = useWorldStore.getState();
    let x: number;
    let z: number;
    let y: number;
    let targetYaw: number;
    let pitch = 0;
    let moving = false;
    let onWater: boolean;
    if (travel) {
      const key = `${travel.fromId}>${travel.toId}`;
      if (routeCache.current?.key !== key) routeCache.current = { key, route: tripRoute(travel.fromId, travel.toId) };
      const t = travelFrame(travel, now).boat;
      const at = routeAt(routeCache.current.route, t);
      x = at.pos.x;
      z = at.pos.z;
      y = tripY(travel.fromId, travel.toId, t);
      targetYaw = headingToYaw(at.dir.x, at.dir.z);
      pitch = (altitude(Math.min(1, t + 0.01)) - altitude(Math.max(0, t - 0.01))) * 0.9;
      moving = t > 0 && t < 1;
      const near = worlds[t < 0.5 ? travel.fromId : travel.toId];
      onWater = terrainProfile(near?.terrain ?? "beach").shore && altitude(t) < 0.04;
    } else {
      const here = worlds[currentId];
      const home = seaOffset(order.indexOf(currentId));
      const stand = standFor(here?.terrain);
      x = home.x + stand.x;
      z = home.z + stand.z;
      onWater = terrainProfile(here?.terrain ?? "beach").shore;
      y = restY(here?.terrain) + (onWater ? Math.sin(time * 2.1) * 0.025 : 0);
      targetYaw = headingToYaw(COAST.x, COAST.z);
    }
    // Shortest-path turn so arrival swings the nose back out toward the open side.
    let d = targetYaw - yaw.current;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    yaw.current += d * (travel ? 0.25 : 0.035);
    bank.current += (THREE.MathUtils.clamp(d * 4, -0.5, 0.5) - bank.current) * 0.1;

    g.position.set(x, y, z);
    const rock = onWater && !moving ? Math.sin(time * 1.7) * 0.04 : 0;
    g.rotation.set(rock + (moving ? bank.current : 0), yaw.current, pitch + (onWater ? Math.sin(time * 1.3) * 0.02 : 0), "YZX");
    if (prop.current) prop.current.rotation.x += delta * (moving ? 38 : 0);

    if (moving && onWater && now - lastDrop.current > 55) {
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
        {/* Floats + struts */}
        {[-0.22, 0.22].map((fz) => (
          <group key={fz}>
            <mesh position={[0.02, 0.05, fz]} castShadow>
              <boxGeometry args={[0.86, 0.08, 0.09]} />
              <meshStandardMaterial color={CREAM} flatShading roughness={0.7} />
            </mesh>
            <mesh position={[0.48, 0.07, fz]} rotation-z={0.5} castShadow>
              <boxGeometry args={[0.12, 0.06, 0.088]} />
              <meshStandardMaterial color={CREAM} flatShading roughness={0.7} />
            </mesh>
            {[-0.16, 0.2].map((sx) => (
              <mesh key={sx} position={[sx, 0.17, fz * 0.6]} rotation-x={fz > 0 ? -0.5 : 0.5}>
                <cylinderGeometry args={[0.012, 0.012, 0.2, 4]} />
                <meshStandardMaterial color={INK} />
              </mesh>
            ))}
          </group>
        ))}
        {/* Fuselage, cowl, windows */}
        <mesh position={[0.04, 0.34, 0]} castShadow>
          <boxGeometry args={[0.78, 0.2, 0.2]} />
          <meshStandardMaterial color={CREAM} flatShading roughness={0.7} />
        </mesh>
        <mesh position={[0.47, 0.34, 0]} castShadow>
          <boxGeometry args={[0.1, 0.17, 0.17]} />
          <meshStandardMaterial color={INK} flatShading roughness={0.8} />
        </mesh>
        <mesh position={[0.2, 0.39, 0]}>
          <boxGeometry args={[0.2, 0.07, 0.204]} />
          <meshStandardMaterial color="#8ED2C6" roughness={0.2} />
        </mesh>
        <mesh position={[0.04, 0.29, 0]}>
          <boxGeometry args={[0.78, 0.03, 0.204]} />
          <meshStandardMaterial color={CORAL} flatShading />
        </mesh>
        {/* Tail */}
        <mesh position={[-0.48, 0.37, 0]} castShadow>
          <boxGeometry args={[0.32, 0.12, 0.1]} />
          <meshStandardMaterial color={CREAM} flatShading roughness={0.7} />
        </mesh>
        <mesh position={[-0.6, 0.52, 0]} rotation-z={-0.25} castShadow>
          <boxGeometry args={[0.16, 0.22, 0.02]} />
          <meshStandardMaterial color={CORAL} flatShading />
        </mesh>
        <mesh position={[-0.6, 0.39, 0]} castShadow>
          <boxGeometry args={[0.14, 0.02, 0.44]} />
          <meshStandardMaterial color={CORAL} flatShading />
        </mesh>
        {/* High wing with ink tips */}
        <mesh position={[0.12, 0.47, 0]} castShadow>
          <boxGeometry args={[0.26, 0.03, 1.5]} />
          <meshStandardMaterial color={CORAL} flatShading roughness={0.6} />
        </mesh>
        {[-0.7, 0.7].map((wz) => (
          <mesh key={wz} position={[0.12, 0.47, wz]}>
            <boxGeometry args={[0.262, 0.032, 0.11]} />
            <meshStandardMaterial color={INK} flatShading />
          </mesh>
        ))}
        {/* Propeller */}
        <group ref={prop} position={[0.535, 0.34, 0]}>
          <mesh rotation-z={-Math.PI / 2}>
            <coneGeometry args={[0.04, 0.07, 6]} />
            <meshStandardMaterial color={CORAL} flatShading />
          </mesh>
          <mesh>
            <boxGeometry args={[0.012, 0.44, 0.04]} />
            <meshStandardMaterial color={INK} />
          </mesh>
        </group>
      </group>
      <instancedMesh ref={wake} args={[undefined, undefined, WAKE_COUNT]} frustumCulled={false}>
        <circleGeometry args={[0.5, 7]} />
        <meshBasicMaterial color="#F7FBF6" transparent opacity={0.75} depthWrite={false} />
      </instancedMesh>
    </>
  );
}

/** The dashed flight path, drawn in the air along the plane's route while traveling. */
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
    const route = tripRoute(travel.fromId, travel.toId);
    for (let i = 0; i < MAX; i++) {
      const t = (i + 0.5) / MAX;
      if (i % 2 === 1) {
        dummy.scale.setScalar(0.0001);
      } else {
        const at = routeAt(route, t);
        dummy.position.set(at.pos.x, tripY(travel.fromId, travel.toId, t) - 0.12, at.pos.z);
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
