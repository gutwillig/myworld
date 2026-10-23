import { memo, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { BuildingMesh, GroundsMesh } from "@/buildings/BuildingMesh";
import { hasGrounds, lotFacing } from "@/buildings/grounds";
import { DEFAULT_ACCENT, buildingAccent } from "@/buildings/kit";
import { type Hex, hexToWorld } from "@/grid/hex";
import { roadSource } from "@/grid/layout";
import { groundHeight, terrainProfile } from "@/grid/terrainProfile";
import type { Building, World } from "@/store/types";
import { BUILDING_SCALE } from "@/world/PlacedBuilding";
import { Roads } from "@/world/Roads";
import { Terrain } from "@/world/Terrain";
import { Keepsakes, keepsakeClearings, useKeepsakeSpots } from "@/world/Keepsakes";
import { type Clearing, Trees } from "@/world/Trees";

const CORAL = "#E5694F";

function lotPoint(hex: Hex, world: World): THREE.Vector3 {
  const w = hexToWorld(hex);
  return new THREE.Vector3(w.x, groundHeight(terrainProfile(world.terrain), w.x, w.z), w.z);
}

/** One building as it stands in its world, without any of the interactive scene machinery. */
const StaticBuilding = memo(function StaticBuilding({ building, world }: { building: Building; world: World }) {
  const past = building.status === "past";
  const pos = useMemo(() => lotPoint(building.hex, world), [building.hex, world]);
  const facing = useMemo(
    () => lotFacing(hexToWorld(building.hex), hexToWorld(roadSource({ status: building.status, hex: building.hex }, world.terrain))),
    [building.hex, building.status, world.terrain],
  );
  const accent = buildingAccent(building);
  return (
    <group position={pos} scale={BUILDING_SCALE * (past ? 0.75 : 1)}>
      <GroundsMesh type={building.type} grounds={building.grounds} accent={accent} faded={past} face={facing.face} gap={facing.gap} />
      <BuildingMesh type={building.type} style={building.style} accent={accent} faded={past} />
    </group>
  );
});

/** A pulsing coral ring + beam over the building the story is looking at. */
function Beacon({ at }: { at: THREE.Vector3 }) {
  const ring = useRef<THREE.Mesh>(null);
  const beam = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const p = (t * 0.7) % 1;
    if (ring.current) {
      ring.current.scale.setScalar(0.9 + p * 1.6);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - p);
    }
    if (beam.current) (beam.current.material as THREE.MeshBasicMaterial).opacity = 0.22 + Math.sin(t * 2.4) * 0.08;
  });
  return (
    <group position={at}>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.06} renderOrder={4}>
        <ringGeometry args={[0.95, 1.12, 40]} />
        <meshBasicMaterial color={CORAL} transparent depthWrite={false} />
      </mesh>
      <mesh ref={beam} position-y={3.2} renderOrder={5}>
        <cylinderGeometry args={[0.32, 0.6, 6.4, 18, 1, true]} />
        <meshBasicMaterial color={CORAL} transparent depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** Where the camera rests for the wide shot (below the town so it sits high in the frame). */
const CENTER = new THREE.Vector3(0, -0.6, 0);
const CAM_DIR = new THREE.Vector3(20, 17, 20).normalize();
const CAM_DIST = 34;
/** How far in the camera pushes on a featured building (multiplier over the wide zoom). */
const FOCUS_ZOOM = 2.4;

/**
 * Turns the island and drives the hero camera: a lazy turntable for the wide shot, then it
 * eases in on the featured building's actual position (which keeps moving as the island turns).
 */
function DioramaRig({ focusLocal, baseZoom, children }: { focusLocal: THREE.Vector3 | null; baseZoom: number; children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const s = useRef({ f: 0, look: CENTER.clone(), born: performance.now(), tmp: new THREE.Vector3() });
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const st = s.current;
    const g = group.current;
    if (!g) return;
    // Gentle settle-in the first time the postcard appears.
    const t0 = Math.min(1, (performance.now() - st.born) / 900);
    g.scale.setScalar(0.86 + 0.14 * (1 - Math.pow(1 - t0, 3)));
    st.f += ((focusLocal ? 1 : 0) - st.f) * Math.min(1, dt * 5.5);
    // The turn slows while pushed in so the stop stays framed.
    g.rotation.y += dt * 0.12 * (1 - 0.8 * st.f);
    g.updateMatrixWorld();
    const goal = focusLocal ? g.localToWorld(st.tmp.copy(focusLocal)) : CENTER;
    st.look.lerp(goal, Math.min(1, dt * 6));
    camera.position.copy(st.look).addScaledVector(CAM_DIR, CAM_DIST);
    camera.lookAt(st.look);
    const cam = camera as THREE.OrthographicCamera;
    const zoom = baseZoom * (1 + (FOCUS_ZOOM - 1) * st.f);
    if (Math.abs(cam.zoom - zoom) > 1e-4) {
      cam.zoom = zoom;
      cam.updateProjectionMatrix();
    }
  });
  return (
    <group ref={group} rotation-y={-0.35}>
      {children}
    </group>
  );
}

export type DioramaProps = {
  world: World;
  /** The building with the coral beacon — the place you share, or the one being toured. */
  highlightId?: string;
  /** The building the camera is pushed in on, if any. */
  focusId?: string | null;
  width: number;
  height: number;
};

/**
 * A live miniature of someone's island: terrain, trees, roads and buildings, read straight
 * from their world. Owns its small canvas so it can sit inside any overlay, and pushes in
 * on the featured building while the tour runs.
 */
export const IslandDiorama = memo(function IslandDiorama({ world, highlightId, focusId, width, height }: DioramaProps) {
  const spots = useKeepsakeSpots(world);
  const clearings = useMemo<Clearing[]>(
    () => [
      ...world.buildings
        .filter((b) => hasGrounds(b.type, b.grounds))
        .map((b) => {
          const w = hexToWorld(b.hex);
          return { x: w.x, z: w.z, r: 1.3 * BUILDING_SCALE * (b.status === "past" ? 0.75 : 1) };
        }),
      ...keepsakeClearings(spots),
    ],
    [world.buildings, spots],
  );
  const highlight = world.buildings.find((b) => b.id === highlightId);
  const beaconAt = useMemo(() => (highlight ? lotPoint(highlight.hex, world) : null), [highlight, world]);
  const focus = world.buildings.find((b) => b.id === focusId);
  const focusLocal = useMemo(() => (focus ? lotPoint(focus.hex, world).add(new THREE.Vector3(0, 1.15, 0)) : null), [focus, world]);
  const home = useMemo(() => lotPoint({ q: 0, r: 0 }, world), [world]);
  const baseZoom = Math.min(width / 22, height / 15);

  return (
    <Canvas
      orthographic
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [20, 16.4, 20], near: 0.1, far: 120, zoom: baseZoom }}
      style={{ width, height }}
      resize={{ offsetSize: true }}
      onCreated={({ camera }) => camera.lookAt(0, -0.6, 0)}
    >
      <hemisphereLight args={["#D9E9F0", "#D6C29C", 1.9]} />
      <directionalLight
        position={[-7, 14, 11]}
        intensity={2.6}
        color="#FFE6C7"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-bias={-0.0006}
      />
      <DioramaRig focusLocal={focusLocal} baseZoom={baseZoom}>
        <Terrain terrain={world.terrain} seed={world.id} />
        <Trees seed={world.id} terrain={world.terrain} clearings={clearings} />
        <Roads roads={world.roads} terrain={world.terrain} epoch={0} />
        <Keepsakes spots={spots} terrain={world.terrain} />
        <group position={home} scale={1.4}>
          <BuildingMesh type="house" accent={DEFAULT_ACCENT.house} />
        </group>
        {world.buildings.map((b) => (
          <StaticBuilding key={b.id} building={b} world={world} />
        ))}
        {beaconAt && <Beacon at={beaconAt} />}
      </DioramaRig>
    </Canvas>
  );
});
