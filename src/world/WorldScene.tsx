import { Suspense, memo, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BuildingMesh } from "@/buildings/BuildingMesh";
import { hasGrounds } from "@/buildings/grounds";
import { DEFAULT_ACCENT } from "@/buildings/kit";
import { seaOffset } from "@/grid/archipelago";
import { hexToWorld } from "@/grid/hex";
import { OLD_TOWN_ANCHOR, hubsFor } from "@/grid/layout";
import { SPOT_MAX, isGig } from "@/grid/plaza";
import { Plazas } from "./Plaza";
import { Peaks } from "./Peaks";
import { groundHeight, terrainProfile } from "@/grid/terrainProfile";
import type { Building, World } from "@/store/types";
import { useWorldStore } from "@/store/world";
import { CameraRig } from "./Camera";
import { TIMING, useFx } from "./fx";
import { LotMarkers, LotPicker, PlacementGhost } from "./Lots";
import { BUILDING_SCALE, PlacedBuilding } from "./PlacedBuilding";
import { wasDrag } from "./dragState";
import { usePresence } from "./presence";
import { Roads } from "./Roads";
import { SceneLabel } from "./SceneLabel";
import { Hubs } from "./Hubs";
import { Realms } from "./Realms";
import { Terrain } from "./Terrain";
import { Keepsakes, keepsakeClearings, useKeepsakeSpots } from "./Keepsakes";
import { type Clearing, Trees } from "./Trees";
import { Airstrip, Dock, OpenSea, Plane, RouteLine, cameraFocus } from "./Voyage";
import styles from "./signs.module.css";

const keyOf = (b: Building) => b.id;
const SUN_OFFSET = new THREE.Vector3(-7, 14, 11);

/** Sun follows the camera so whichever island you're on gets crisp shadows. */
function Lights() {
  const sun = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const l = sun.current;
    if (!l) return;
    l.position.copy(cameraFocus).add(SUN_OFFSET);
    target.position.copy(cameraFocus);
    target.updateMatrixWorld();
  });
  return (
    <>
      <hemisphereLight args={["#D9E9F0", "#D6C29C", 1.9]} />
      <primitive object={target} />
      <directionalLight
        ref={sun}
        target={target}
        position={SUN_OFFSET.toArray()}
        intensity={2.7}
        color="#FFE6C7"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-camera-near={1}
        shadow-camera-far={50}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
        shadow-radius={5}
      />
    </>
  );
}

const Home = memo(function Home({ ownerName }: { ownerName: string }) {
  return (
    <group position={[0, groundHeight(terrainProfile("beach"), 0, 0), 0]} scale={1.4}>
      <BuildingMesh type="house" accent={DEFAULT_ACCENT.house} />
      <SceneLabel position={[0, 1.42, 0]} zIndex={20}>
        <div className={styles.homeSign} style={{ cursor: "default" }}>
          {`${ownerName}\u2019s place`}
        </div>
      </SceneLabel>
    </group>
  );
});

function Buildings({ world, epoch, interactive }: { world: World; epoch: number; interactive: boolean }) {
  const entries = usePresence(world.buildings, keyOf, epoch, TIMING.leave * 1000 + 700);
  return (
    <group>
      {entries.map((e) => (
        <PlacedBuilding
          key={`${epoch}:${e.key}`}
          building={e.item}
          terrain={world.terrain}
          born={e.born}
          leaving={e.leaving}
          interactive={interactive}
        />
      ))}
    </group>
  );
}

/** Big floating name for each island, only while you're out at sea. */
function IslandFlag({ world, isHome }: { world: World; isHome: boolean }) {
  const traveling = useFx((s) => !!s.travel);
  return (
    <SceneLabel position={[0, 3.4, 0]} zIndex={22}>
      <div className={`${styles.islandFlag} ${traveling ? styles.islandFlagOn : ""}`} aria-hidden={!traveling}>
        <span className={styles.islandFlagName}>{`${world.ownerName}\u2019s world`}</span>
        <span className={styles.islandFlagMeta}>
          {isHome ? "Home" : `${world.buildings.length} ${world.buildings.length === 1 ? "building" : "buildings"}`}
        </span>
      </div>
    </SceneLabel>
  );
}

/** One world: its island, trees, roads, buildings and dock, placed at its spot in the sea. */
const Island = memo(function Island({ worldId, index }: { worldId: string; index: number }) {
  const world = useWorldStore((s) => s.worlds[worldId]);
  const isCurrent = useWorldStore((s) => s.currentId === worldId);
  const isHome = useWorldStore((s) => s.homeId === worldId);
  const epoch = useWorldStore((s) => s.epoch);
  const traveling = useFx((s) => !!s.travel);
  const off = seaOffset(index);
  const clearingKey = world
    ? world.buildings
        .filter((b) => !b.parentId && (isGig(b) || hasGrounds(b.type, b.grounds)))
        .map((b) => `${b.hex.q},${b.hex.r},${b.status === "past" ? 1 : 0},${isGig(b) ? 1 : 0}`)
        .join("|")
    : "";
  const spots = useKeepsakeSpots(world ?? { id: worldId, terrain: "beach" });
  const clearings = useMemo<Clearing[]>(
    () => [
      ...(clearingKey
        ? clearingKey.split("|").map((k) => {
            const [q, r, past, gig] = k.split(",").map(Number);
            const w = hexToWorld({ q, r });
            return { x: w.x, z: w.z, r: gig ? SPOT_MAX + 0.55 : 1.3 * BUILDING_SCALE * (past ? 0.75 : 1) };
          })
        : []),
      ...(world
        ? Object.values(hubsFor(world.terrain)).map((h) => {
            const w = hexToWorld(h);
            return { x: w.x, z: w.z, r: 1.15 };
          })
        : []),
      ...keepsakeClearings(spots),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clearingKey, spots, world?.terrain],
  );
  if (!world) return null;
  return (
    <group position={[off.x, 0, off.z]}>
      <Terrain terrain={world.terrain} seed={world.id} />
      <Peaks seed={world.id} terrain={world.terrain} />
      <Trees seed={world.id} terrain={world.terrain} clearings={clearings} />
      <Roads roads={world.roads} terrain={world.terrain} epoch={epoch} hubs={hubsFor(world.terrain)} />
      <Keepsakes
        key={epoch}
        spots={spots}
        notes={world.keepsakes}
        terrain={world.terrain}
        interactive={isCurrent && !traveling}
        editable={isHome}
      />
      <Home ownerName={world.ownerName} />
      <Realms world={world} interactive={isCurrent && !traveling} />
      <Plazas world={world} interactive={isCurrent && !traveling} />
      <Hubs world={world} interactive={isCurrent && !traveling} />
      <Buildings world={world} epoch={epoch} interactive={isCurrent && !traveling} />
      {isCurrent && !traveling && (
        <>
          <LotMarkers world={world} />
          <PlacementGhost terrain={world.terrain} />
        </>
      )}
      {terrainProfile(world.terrain).shore ? <Dock /> : <Airstrip seed={world.id} />}
      <IslandFlag world={world} isHome={isHome} />
    </group>
  );
});

function Islands() {
  const order = useWorldStore((s) => s.order);
  return (
    <>
      {order.map((id, i) => (
        <Island key={id} worldId={id} index={i} />
      ))}
    </>
  );
}

/** The 3D world. Reads the store and renders it; only drag-drops and docking write back. */
export default function WorldScene({ panelOpen }: { panelOpen: boolean }) {
  const select = useFx((s) => s.select);

  return (
    <Canvas
      orthographic
      shadows="soft"
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
      camera={{ position: [20, 20, 20], near: 0.1, far: 200, zoom: 40 }}
      onPointerMissed={() => {
        if (wasDrag()) return;
        const fx = useFx.getState();
        if (fx.selectedId) select(null);
        if (fx.keepsakeEdit) fx.editKeepsake(null);
      }}
      style={{ position: "absolute", inset: 0 }}
    >
      <CameraRig panelOpen={panelOpen} />
      <LotPicker />
      <Lights />
      <Suspense fallback={null}>
        <OpenSea />
        <Islands />
        <RouteLine />
        <Plane />
      </Suspense>
    </Canvas>
  );
}
