import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DEFAULT_ACCENT } from "@/buildings/kit";
import { makeCtx } from "@/buildings/kit/common";
import { styleOf } from "@/buildings/styles";
import { seaOffset } from "@/grid/archipelago";
import { type Hex, hexEquals, hexKey, hexToWorld } from "@/grid/hex";
import { type LotZone, freeLots } from "@/grid/layout";
import { groundHeight, terrainProfile } from "@/grid/terrainProfile";
import { type KeepsakeSpot, keepsakeFits, placeKeepsakes } from "@/keepsakes/place";
import type { BuildingType, Terrain, World } from "@/store/types";
import { useWorldStore } from "@/store/world";
import { CLICK_SLOP, dragPoint, dragState } from "./dragState";
import { useFx } from "./fx";
import { BUILDING_SCALE } from "./PlacedBuilding";
import { SceneLabel } from "./SceneLabel";
import styles from "./signs.module.css";

/** How close (world units) the pointer must be to a lot's center to snap to it. */
const SNAP = 1.5;

type Lot = { hex: Hex; zone: LotZone };

/** True when the building is a plaza piece (it moves on its plaza, not between lots). */
const isKid = (id: string) => !!useWorldStore.getState().world.buildings.find((b) => b.id === id)?.parentId;

/** Lots you could use right now: free town lots while placing, any free lot (plus its own) while moving. */
function candidateLots(): Lot[] {
  const fx = useFx.getState();
  const w = useWorldStore.getState().world;
  if (fx.moving) {
    const others = w.buildings.filter((b) => b.id !== fx.moving?.id);
    return [
      ...freeLots(w.terrain, others, "active").map((hex) => ({ hex, zone: "active" as const })),
      ...freeLots(w.terrain, others, "oldTown").map((hex) => ({ hex, zone: "oldTown" as const })),
    ];
  }
  if (fx.placement) return freeLots(w.terrain, w.buildings, fx.placement.district ?? "active").map((hex) => ({ hex, zone: "active" as const }));
  return [];
}

/**
 * Pointer logic for placing and moving: press-and-drag a building to pick it up, snap to the
 * nearest lot, drop to move. While the prompt bar previews a building, hovering a lot aims the
 * ghost there and clicking builds. Lives once in the scene, works on the current island.
 */
export function LotPicker() {
  const { camera, gl } = useThree();

  useEffect(() => {
    const el = gl.domElement;
    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.1);
    const ndc = new THREE.Vector2();
    const hit = new THREE.Vector3();

    const groundAt = (e: PointerEvent): { x: number; z: number } | null => {
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      if (!ray.ray.intersectPlane(plane, hit)) return null;
      const s = useWorldStore.getState();
      const off = seaOffset(s.order.indexOf(s.currentId));
      return { x: hit.x - off.x, z: hit.z - off.z };
    };

    const nearest = (p: { x: number; z: number }): Hex | null => {
      let best: Hex | null = null;
      let bestD = SNAP;
      for (const lot of candidateLots()) {
        const w = hexToWorld(lot.hex);
        const d = Math.hypot(w.x - p.x, w.z - p.z);
        if (d < bestD) {
          bestD = d;
          best = lot.hex;
        }
      }
      return best;
    };

    /** Every keepsake's spot when the current carry started; all get pinned on drop. */
    let carrySpots: KeepsakeSpot[] = [];

    const moveKeepsake = (e: PointerEvent): boolean => {
      const fx = useFx.getState();
      const press = fx.keepsakePress;
      if (press && !fx.keepsakeMove && !fx.travel && Math.hypot(e.clientX - press.x, e.clientY - press.y) > CLICK_SLOP + 2) {
        const w = useWorldStore.getState().world;
        carrySpots = placeKeepsakes(w.terrain, w.id, w.keepsakes ?? []);
        fx.setKeepsakeMove({ kind: press.kind, fits: true });
        fx.hoverKeepsake(null);
        fx.editKeepsake(null);
        document.body.style.cursor = "grabbing";
      }
      const carry = useFx.getState().keepsakeMove;
      if (!carry) return false;
      const p = groundAt(e);
      if (!p) return true;
      dragPoint.x = p.x;
      dragPoint.z = p.z;
      dragPoint.has = true;
      const w = useWorldStore.getState().world;
      fx.setKeepsakeMove({ kind: carry.kind, fits: keepsakeFits(w.terrain, w.id, carry.kind, p.x, p.z, carrySpots) });
      return true;
    };

    const endKeepsake = (commit: boolean) => {
      const fx = useFx.getState();
      const carry = fx.keepsakeMove;
      if (!carry) return;
      if (commit && carry.fits && dragPoint.has) {
        useWorldStore.getState().pinKeepsakes(
          carrySpots.map((s) => ({
            kind: s.kind,
            at: s.kind === carry.kind ? { x: dragPoint.x, z: dragPoint.z, rot: s.rot } : { x: s.x, z: s.z, rot: s.rot },
          })),
        );
      }
      fx.setKeepsakeMove(null);
      dragPoint.has = false;
      carrySpots = [];
      document.body.style.cursor = "";
    };

    const onMove = (e: PointerEvent) => {
      if (moveKeepsake(e)) return;
      const fx = useFx.getState();
      if (fx.press && !fx.moving && !fx.travel && Math.hypot(e.clientX - fx.press.x, e.clientY - fx.press.y) > CLICK_SLOP + 2) {
        fx.setMoving({ id: fx.press.id });
        fx.hover(null);
        document.body.style.cursor = "grabbing";
      }
      if (!fx.moving && !fx.placement) return;
      // While placing, only the open scene aims the ghost (not the cards floating over it).
      if (!fx.moving && e.target !== el) return;
      const p = groundAt(e);
      if (!p) return;
      dragPoint.x = p.x;
      dragPoint.z = p.z;
      dragPoint.has = true;
      if (fx.moving && isKid(fx.moving.id)) return;
      const lot = nearest(p);
      fx.setLotHover(lot);
      if (fx.placement && lot) fx.aimPlacement(lot);
    };

    const endMove = (commit: boolean) => {
      const fx = useFx.getState();
      if (!fx.moving) return;
      const id = fx.moving.id;
      const lot = fx.lotHover;
      const store = useWorldStore.getState();
      const b = store.world.buildings.find((x) => x.id === id);
      if (commit && b?.parentId && dragPoint.has) {
        const c = hexToWorld(b.hex);
        store.moveSpot(id, { x: dragPoint.x - c.x, z: dragPoint.z - c.z });
      } else if (commit && lot && b && !hexEquals(lot, b.hex)) {
        fx.setDropped(id);
        if (!store.moveBuilding(id, lot)) fx.setDropped(null);
      }
      fx.setMoving(null);
      fx.setLotHover(null);
      dragPoint.has = false;
      document.body.style.cursor = "";
    };

    const onUp = (e: PointerEvent) => {
      const fx = useFx.getState();
      if (fx.keepsakePress) fx.setKeepsakePress(null);
      if (fx.keepsakeMove) {
        endKeepsake(true);
        return;
      }
      if (fx.moving) endMove(true);
      else if (fx.placement && fx.lotHover && dragState.distance <= CLICK_SLOP && e.target === el) {
        fx.confirmPlacement(fx.lotHover);
      }
      if (fx.press) fx.setPress(null);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const fx = useFx.getState();
      if (fx.keepsakeMove) {
        e.stopPropagation();
        endKeepsake(false);
      } else if (fx.moving) {
        e.stopPropagation();
        endMove(false);
      }
    };
    const onCancel = () => {
      endKeepsake(false);
      endMove(false);
      useFx.getState().setKeepsakePress(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [camera, gl]);

  return null;
}

const RING = new THREE.RingGeometry(0.88, 1.0, 6, 1);
RING.rotateX(-Math.PI / 2);
const DISC = new THREE.CircleGeometry(0.88, 6);
DISC.rotateX(-Math.PI / 2);
const PLUS_A = new THREE.PlaneGeometry(0.34, 0.07);
PLUS_A.rotateX(-Math.PI / 2);
PLUS_A.rotateY(Math.PI / 4);
const PLUS_B = new THREE.PlaneGeometry(0.07, 0.34);
PLUS_B.rotateX(-Math.PI / 2);
PLUS_B.rotateY(Math.PI / 4);

const COLORS = { active: new THREE.Color("#FBFBF4"), oldTown: new THREE.Color("#D9BE8E"), target: new THREE.Color("#E5694F") };

/** One glowing lot: pops in, breathes, and turns coral when it's the target. */
const LotMarker = memo(function LotMarker({ hex, zone, terrain, delay, showPlus }: Lot & { terrain: Terrain; delay: number; showPlus: boolean }) {
  const isTarget = useFx((s) => {
    if (s.lotHover) return hexEquals(s.lotHover, hex);
    return !!s.placement && hexEquals(s.placement.hex, hex);
  });
  const g = useRef<THREE.Group>(null);
  const born = useRef<number>(performance.now() + delay);
  const ring = useMemo(() => new THREE.MeshBasicMaterial({ color: COLORS[zone], transparent: true, opacity: 0, depthWrite: false }), [zone]);
  const fill = useMemo(() => new THREE.MeshBasicMaterial({ color: COLORS[zone], transparent: true, opacity: 0, depthWrite: false }), [zone]);
  const plus = useMemo(() => new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0, depthWrite: false }), []);
  useEffect(() => () => [ring, fill, plus].forEach((m) => m.dispose()), [ring, fill, plus]);
  const pos = useMemo(() => {
    const w = hexToWorld(hex);
    return [w.x, groundHeight(terrainProfile(terrain), w.x, w.z) + 0.05, w.z] as [number, number, number];
  }, [hex, terrain]);

  useFrame(({ clock }, dt) => {
    const t = Math.min(1, Math.max(0, (performance.now() - born.current) / 260));
    const pop = t < 1 ? 1 - Math.pow(1 - t, 3) : 1;
    const pulse = 1 + Math.sin(clock.elapsedTime * 3.2 + hex.q) * (isTarget ? 0.04 : 0.018);
    const k = Math.min(1, dt * 12);
    const goal = isTarget ? COLORS.target : COLORS[zone];
    ring.color.lerp(goal, k);
    fill.color.lerp(goal, k);
    ring.opacity += ((isTarget ? 0.95 : 0.7) * pop - ring.opacity) * k;
    fill.opacity += ((isTarget ? 0.32 : 0.14) * pop - fill.opacity) * k;
    plus.opacity += ((showPlus && !isTarget ? 0.75 : 0) * pop - plus.opacity) * k;
    if (g.current) g.current.scale.setScalar((0.6 + 0.4 * pop) * pulse * (isTarget ? 1.06 : 1) * (zone === "oldTown" ? 0.72 : 1));
  });

  return (
    <group ref={g} position={pos}>
      <mesh geometry={RING} material={ring} renderOrder={2} />
      <mesh geometry={DISC} material={fill} renderOrder={1} position-y={-0.005} />
      <mesh geometry={PLUS_A} material={plus} renderOrder={3} position-y={0.005} />
      <mesh geometry={PLUS_B} material={plus} renderOrder={3} position-y={0.005} />
    </group>
  );
});

/** Glowing lots while placing a new building or dragging one around. */
export function LotMarkers({ world }: { world: World }) {
  const placing = useFx((s) => !!s.placement);
  const placingDistrict = useFx((s) => s.placement?.district);
  const movingId = useFx((s) => s.moving?.id ?? null);
  const carrying = useFx((s) => !!s.keepsakeMove);
  const lots = useMemo<Lot[]>(() => {
    // Carrying a keepsake: show the lots it has to stay clear of.
    if (carrying) {
      return [
        ...freeLots(world.terrain, world.buildings, "active").map((hex) => ({ hex, zone: "active" as const })),
        ...freeLots(world.terrain, world.buildings, "oldTown").map((hex) => ({ hex, zone: "oldTown" as const })),
      ];
    }
    if (movingId && world.buildings.find((b) => b.id === movingId)?.parentId) return [];
    if (movingId) {
      const others = world.buildings.filter((b) => b.id !== movingId);
      return [
        ...freeLots(world.terrain, others, "active").map((hex) => ({ hex, zone: "active" as const })),
        ...freeLots(world.terrain, others, "oldTown").map((hex) => ({ hex, zone: "oldTown" as const })),
      ];
    }
    if (placing) return freeLots(world.terrain, world.buildings, placingDistrict ?? "active").map((hex) => ({ hex, zone: "active" as const }));
    return [];
  }, [world, placing, placingDistrict, movingId, carrying]);
  return (
    <>
      {lots.map((l, i) => (
        <LotMarker
          key={`${movingId ?? (carrying ? "keep" : "place")}:${hexKey(l.hex)}`}
          {...l}
          terrain={world.terrain}
          delay={i * 28}
          showPlus={placing && !movingId}
        />
      ))}
    </>
  );
}

const GHOST = new THREE.MeshStandardMaterial({
  color: "#FFFFFF",
  transparent: true,
  opacity: 0.6,
  roughness: 0.7,
  emissive: new THREE.Color("#FFF3E2"),
  emissiveIntensity: 0.3,
  depthWrite: false,
  flatShading: true,
});

function lotPosition(hex: Hex, terrain: Terrain): THREE.Vector3 {
  const w = hexToWorld(hex);
  return new THREE.Vector3(w.x, groundHeight(terrainProfile(terrain), w.x, w.z), w.z);
}

/** A see-through maquette of the building the prompt bar is about to build. */
function Ghost({ type, hex, name, terrain }: { type: BuildingType; hex: Hex; name: string; terrain: Terrain }) {
  const built = useMemo(() => {
    const b = styleOf(type).build(makeCtx(DEFAULT_ACCENT[type], false));
    b.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.material = GHOST;
      m.castShadow = false;
      m.receiveShadow = false;
    });
    return b;
  }, [type]);
  useEffect(
    () => () =>
      built.group.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose();
      }),
    [built],
  );
  const ref = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const swapAt = useRef<number>(performance.now());
  const first = useRef<boolean>(true);
  useEffect(() => {
    swapAt.current = performance.now();
  }, [type]);

  useFrame(({ clock }, dt) => {
    const g = ref.current;
    if (!g) return;
    const goal = lotPosition(hex, terrain);
    if (first.current) {
      g.position.copy(goal);
      first.current = false;
    } else g.position.lerp(goal, Math.min(1, dt * 14));
    const t = Math.min(1, (performance.now() - swapAt.current) / 320);
    const pop = 0.7 + 0.3 * (1 - Math.pow(1 - t, 3)) + Math.sin(t * Math.PI) * 0.06;
    if (inner.current) {
      inner.current.position.y = 0.16 + Math.sin(clock.elapsedTime * 2.6) * 0.05;
      inner.current.scale.setScalar(pop);
      inner.current.rotation.y = Math.sin(clock.elapsedTime * 0.9) * 0.08;
    }
  });

  return (
    <group ref={ref} scale={BUILDING_SCALE}>
      <group ref={inner}>
        <primitive object={built.group} />
      </group>
      <SceneLabel position={[0, built.height + 0.5, 0]} zIndex={26}>
        <div className={styles.ghostSign}>
          <span>{name}</span>
          <span className={styles.ghostHint}>Click a lot · Enter to build</span>
        </div>
      </SceneLabel>
    </group>
  );
}

/** The prompt bar's preview, on the current island. */
export function PlacementGhost({ terrain }: { terrain: Terrain }) {
  const placement = useFx((s) => s.placement);
  if (!placement) return null;
  return <Ghost type={placement.type} hex={placement.hex} name={placement.name} terrain={terrain} />;
}
