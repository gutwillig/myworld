import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BuildingMesh, GroundsMesh } from "@/buildings/BuildingMesh";
import { lotFacing } from "@/buildings/grounds";
import { buildingAccent } from "@/buildings/kit";
import { styleOf } from "@/buildings/styles";
import { typeLabel } from "@/buildings/suggest";
import { type Hex, hexEquals, hexToWorld } from "@/grid/hex";
import { roadSource } from "@/grid/layout";
import { groundHeight, terrainProfile } from "@/grid/terrainProfile";
import type { Building, Terrain } from "@/store/types";
import { Dust } from "./Dust";
import { isFresh, latestUpdate } from "@/updates/news";
import { SceneLabel } from "./SceneLabel";
import { TIMING, clamp01, easeInCubic, easeOutBack, easeOutCubic, useFx } from "./fx";
import { dragPoint, wasDrag } from "./dragState";
import styles from "./signs.module.css";

type Props = {
  building: Building;
  terrain: Terrain;
  born: "initial" | "new";
  leaving: boolean;
  /** False for islands you're not on: no hover, no clicks. */
  interactive: boolean;
};

export const BUILDING_SCALE = 1.28;
const OLD_TOWN_SCALE = 0.75;
/** How high a picked-up building floats, in world units. */
const CARRY_LIFT = 0.75;

function groundPoint(hex: Hex, terrain: Terrain): THREE.Vector3 {
  const w = hexToWorld(hex);
  return new THREE.Vector3(w.x, groundHeight(terrainProfile(terrain), w.x, w.z), w.z);
}

const RING_GEO = new THREE.RingGeometry(0.93, 1.02, 48);
RING_GEO.rotateX(-Math.PI / 2);
const GLOW_GEO = new THREE.CircleGeometry(0.93, 48);
GLOW_GEO.rotateX(-Math.PI / 2);

/** A building on its lot: rise, hover, drag to another lot, remodel, and knock-down. */
export const PlacedBuilding = memo(function PlacedBuilding({ building, terrain, born, leaving, interactive }: Props) {
  const isHovered = useFx((s) => s.hoveredId === building.id);
  const isSelected = useFx((s) => s.selectedId === building.id);
  const isMoving = useFx((s) => s.moving?.id === building.id);
  const busy = useFx((s) => !!s.placement || !!s.moving);
  const hover = useFx((s) => s.hover);
  const select = useFx((s) => s.select);

  const [shown, setShown] = useState<{ hex: Hex; past: boolean }>({ hex: building.hex, past: building.status === "past" });
  const [height, setHeight] = useState<number>(1.2);
  const [signOn, setSignOn] = useState<boolean>(born === "initial");
  const [dustAt, setDustAt] = useState<number | null>(null);

  const root = useRef<THREE.Group>(null);
  const outer = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const groundsRef = useRef<THREE.Group>(null);
  const riseAt = useRef<number>(born === "new" ? performance.now() + TIMING.riseStart * 1000 : -1e9);
  const sinkAt = useRef<number | null>(null);
  const demolishAt = useRef<number | null>(null);
  const landAt = useRef<number>(-1e9);
  const remodelAt = useRef<number>(-1e9);
  const bounceAt = useRef<number>(-1e9);
  const wasHovered = useRef<boolean>(false);
  const dropping = useRef<boolean>(false);
  const lift = useRef<number>(0);
  const highlight = useRef<number>(0);
  const groundsScale = useRef<number>(born === "new" ? 0 : 1);
  const placed = useRef<boolean>(false);
  const prevPos = useRef<THREE.Vector3>(new THREE.Vector3());

  // Initial rise: dust and sign timers.
  useEffect(() => {
    if (born !== "new") return;
    const d = window.setTimeout(() => setDustAt(performance.now()), TIMING.riseStart * 1000);
    const s = window.setTimeout(() => setSignOn(true), TIMING.signStart * 1000);
    return () => {
      window.clearTimeout(d);
      window.clearTimeout(s);
    };
  }, [born]);

  // Lot changes: a drag-drop lands right away; a status change sinks here and rises at the new lot.
  useEffect(() => {
    if (hexEquals(building.hex, shown.hex)) {
      if ((building.status === "past") !== shown.past) setShown({ hex: shown.hex, past: building.status === "past" });
      return;
    }
    const fx = useFx.getState();
    if (fx.droppedId === building.id) {
      fx.setDropped(null);
      dropping.current = true;
      landAt.current = performance.now();
      setShown({ hex: building.hex, past: building.status === "past" });
      return;
    }
    const now = performance.now();
    sinkAt.current = now;
    setSignOn(false);
    setDustAt(now);
    const swap = window.setTimeout(() => {
      sinkAt.current = null;
      riseAt.current = performance.now() + 120;
      placed.current = false;
      setShown({ hex: building.hex, past: building.status === "past" });
    }, TIMING.leave * 1000);
    return () => window.clearTimeout(swap);
  }, [building.hex, building.status, building.id, shown]);

  // After a lot swap: dust at the new lot, then the sign returns.
  const firstShown = useRef<boolean>(true);
  useEffect(() => {
    if (firstShown.current) {
      firstShown.current = false;
      return;
    }
    const quick = dropping.current;
    dropping.current = false;
    const dust = window.setTimeout(() => setDustAt(performance.now()), quick ? 140 : 120);
    const sign = window.setTimeout(() => setSignOn(true), quick ? 480 : 820);
    return () => {
      window.clearTimeout(dust);
      window.clearTimeout(sign);
    };
  }, [shown.hex]);

  // Remodel (style, grounds or color changed): a spin and a puff.
  const lookKey = `${building.style ?? ""}|${building.grounds ?? ""}|${building.accent ?? ""}`;
  const lastLook = useRef<string>(lookKey);
  useEffect(() => {
    if (lastLook.current === lookKey) return;
    lastLook.current = lookKey;
    remodelAt.current = performance.now();
    setDustAt(performance.now());
  }, [lookKey]);

  useEffect(() => {
    if (!leaving) return;
    demolishAt.current = performance.now();
    setSignOn(false);
    setDustAt(performance.now());
  }, [leaving]);

  const base = useMemo(() => groundPoint(shown.hex, terrain), [shown.hex, terrain]);
  const facing = useMemo(
    () => lotFacing(hexToWorld(shown.hex), hexToWorld(roadSource({ status: shown.past ? "past" : "active" }))),
    [shown.hex, shown.past],
  );
  const scale = BUILDING_SCALE * (shown.past ? OLD_TOWN_SCALE : 1);
  const accent = buildingAccent(building);

  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0, depthWrite: false }), [accent]);
  const glowMat = useMemo(() => new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0, depthWrite: false }), [accent]);
  const unhoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      ringMat.dispose();
      glowMat.dispose();
    },
    [ringMat, glowMat],
  );
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }, rawDt) => {
    const g = inner.current;
    const o = outer.current;
    if (!g || !o) return;
    const dt = Math.min(rawDt, 1 / 20);
    const now = performance.now();

    // Where the building should be: its lot, or floating under the pointer while carried.
    const fx = useFx.getState();
    const goal = base.clone();
    if (isMoving && dragPoint.has) {
      const lot = fx.lotHover;
      if (lot) goal.copy(groundPoint(lot, terrain));
      else goal.set(dragPoint.x, groundHeight(terrainProfile(terrain), dragPoint.x, dragPoint.z), dragPoint.z);
      goal.y += CARRY_LIFT;
    }
    if (!placed.current) {
      o.position.copy(goal);
      prevPos.current.copy(goal);
      placed.current = true;
    } else {
      o.position.lerp(goal, Math.min(1, dt * (isMoving ? 16 : 11)));
    }
    // Lean into the motion while carried.
    const vx = (o.position.x - prevPos.current.x) / Math.max(dt, 1e-3);
    const vz = (o.position.z - prevPos.current.z) / Math.max(dt, 1e-3);
    prevPos.current.copy(o.position);
    const tiltK = Math.min(1, dt * 10);
    o.rotation.x += ((isMoving ? THREE.MathUtils.clamp(vz * 0.035, -0.35, 0.35) : 0) - o.rotation.x) * tiltK;
    o.rotation.z += ((isMoving ? THREE.MathUtils.clamp(-vx * 0.035, -0.35, 0.35) : 0) - o.rotation.z) * tiltK;

    let sy = 1;
    let sxz = 1;
    const riseT = clamp01((now - riseAt.current) / 1000 / (TIMING.riseEnd - TIMING.riseStart));
    if (riseT < 1) {
      sy = Math.max(0.0001, easeOutBack(riseT));
      sxz = 0.82 + 0.18 * easeOutCubic(riseT);
    }
    if (sinkAt.current !== null) {
      const t = clamp01((now - sinkAt.current) / 1000 / TIMING.leave);
      sy = Math.max(0.0001, 1 - easeInCubic(t));
    }
    if (demolishAt.current !== null) {
      const t = clamp01((now - demolishAt.current) / 1000 / TIMING.leave);
      sy = 1 - 0.9 * easeInCubic(t);
      sxz = 1 + 0.12 * Math.sin(t * Math.PI);
      g.rotation.z = Math.sin(t * 22) * 0.04 * (1 - t);
      if (t >= 1) {
        g.visible = false;
        if (groundsRef.current) groundsRef.current.visible = false;
      }
    }

    // Hover: a springy hop the moment the pointer arrives.
    if (isHovered && !wasHovered.current) bounceAt.current = now;
    wasHovered.current = isHovered;
    const bt = (now - bounceAt.current) / 1000;
    if (bt < 1.2) {
      const wobble = Math.sin(bt * 17) * Math.exp(-bt * 5.5);
      sy *= 1 + 0.09 * wobble;
      sxz *= 1 - 0.045 * wobble;
    }
    // Landing after a drop.
    const lt = (now - landAt.current) / 1000 - 0.1;
    if (lt > 0 && lt < 0.5) {
      const k = Math.sin((lt / 0.5) * Math.PI) * (1 - lt / 0.5);
      sy *= 1 - 0.2 * k;
      sxz *= 1 + 0.1 * k;
    }
    // Remodel: dip, spin once, pop back.
    const rt = (now - remodelAt.current) / 1000;
    if (rt < 0.7) {
      const p = rt / 0.7;
      sy *= 1 - 0.22 * Math.sin(p * Math.PI);
      g.rotation.y = easeOutCubic(p) * Math.PI * 2;
    } else if (demolishAt.current === null) g.rotation.y = 0;

    const targetLift = isHovered && !leaving ? 0.1 : 0;
    lift.current += (targetLift - lift.current) * Math.min(1, dt * 14);
    g.scale.set(sxz, sy, sxz);
    g.position.y = lift.current;

    // Grounds stay on the lot, tuck away while the building is carried, and grow with the rise.
    const gs = groundsRef.current;
    if (gs) {
      gs.position.copy(base);
      const want = isMoving || sinkAt.current !== null ? 0 : riseT < 1 ? easeOutCubic(riseT) : 1;
      groundsScale.current += (want - groundsScale.current) * Math.min(1, dt * 9);
      const v = Math.max(0.0001, groundsScale.current);
      gs.scale.set(scale * v, scale * Math.max(0.0001, Math.min(v * 1.4, 1)), scale * v);
    }

    // Ground ring: shows on hover/selection, follows the building while carried.
    const want = leaving ? 0 : isMoving ? 0.7 : isHovered ? 1 : isSelected ? 0.75 : 0;
    highlight.current += (want - highlight.current) * Math.min(1, dt * 12);
    const h = highlight.current;
    ringMat.opacity = 0.9 * h;
    glowMat.opacity = 0.2 * h;
    const r = ringRef.current;
    if (r) {
      r.visible = h > 0.01;
      r.scale.setScalar(0.86 + 0.14 * h + Math.sin(clock.elapsedTime * 4) * 0.025 * h);
      r.position.y = isMoving ? -CARRY_LIFT / scale + 0.07 : 0.07;
    }
  });

  const onDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      const fx = useFx.getState();
      if (!interactive || leaving || e.button !== 0 || fx.placement || fx.travel) return;
      e.stopPropagation();
      fx.setPress({ id: building.id, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY });
    },
    [building.id, interactive, leaving],
  );
  const onOver = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      // Cancel any pending unhover
      if (unhoverTimer.current) {
        clearTimeout(unhoverTimer.current);
        unhoverTimer.current = null;
      }
      const fx = useFx.getState();
      if (leaving || !interactive || fx.placement || fx.moving) return;
      hover(building.id);
      document.body.style.cursor = "grab";
    },
    [building.id, hover, leaving, interactive],
  );
  const onOut = useCallback(() => {
    // Debounce unhover to prevent flicker when moving between mesh and label
    if (unhoverTimer.current) clearTimeout(unhoverTimer.current);
    unhoverTimer.current = setTimeout(() => {
      if (useFx.getState().hoveredId === building.id) hover(null);
      if (!useFx.getState().moving) document.body.style.cursor = "";
      unhoverTimer.current = null;
    }, 80);
  }, [building.id, hover]);
  const onClick = useCallback(
    (e: ThreeEvent<MouseEvent> | React.MouseEvent) => {
      e.stopPropagation();
      if (leaving || !interactive || wasDrag() || useFx.getState().placement) return;
      select(building.id);
    },
    [building.id, leaving, select, interactive],
  );

  useEffect(
    () => () => {
      if (unhoverTimer.current) clearTimeout(unhoverTimer.current);
      if (useFx.getState().hoveredId === building.id) {
        useFx.getState().hover(null);
        document.body.style.cursor = "";
      }
    },
    [building.id],
  );

  // Cancel pending unhover when sign is entered
  const onSignEnter = useCallback(() => {
    if (unhoverTimer.current) {
      clearTimeout(unhoverTimer.current);
      unhoverTimer.current = null;
    }
    if (interactive && !busy) hover(building.id);
  }, [building.id, hover, interactive, busy]);

  const news = isFresh(building) ? latestUpdate(building) : undefined;
  const meta = news?.text ?? (building.oneLiner.trim() || `${styleOf(building.type, building.style).label} ${typeLabel(building.type).toLowerCase()}`);

  return (
    <group ref={root}>
      <group ref={groundsRef} scale={scale}>
        <GroundsMesh
          type={building.type}
          grounds={building.grounds}
          accent={accent}
          faded={shown.past}
          face={facing.face}
          gap={facing.gap}
        />
      </group>
      <group ref={outer} scale={scale}>
        <mesh ref={ringRef} geometry={RING_GEO} material={ringMat} renderOrder={3} visible={false}>
          <mesh geometry={GLOW_GEO} material={glowMat} renderOrder={2} position-y={-0.004} />
        </mesh>
        <group ref={inner} onPointerDown={onDown} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
          <BuildingMesh type={building.type} style={building.style} accent={accent} faded={shown.past} onHeight={setHeight} />
        </group>
        <Dust at={dustAt} color={shown.past ? "#E4D6B8" : "#EFE7D6"} />
        {signOn && !isMoving && (
          <SceneLabel position={[0, height + 0.32, 0]} zIndex={isSelected ? 30 : isHovered ? 25 : 20} interactive={interactive && !busy}>
            <button
              type="button"
              className={[
                styles.sign,
                styles.signPop,
                isHovered ? styles.signHover : "",
                isSelected ? styles.signSelected : "",
                shown.past ? styles.signPast : "",
              ].join(" ")}
              tabIndex={interactive ? 0 : -1}
              onPointerEnter={onSignEnter}
              onPointerLeave={onOut}
              onClick={(e) => {
                e.stopPropagation();
                if (interactive && !busy) select(building.id);
              }}
            >
              {news && <span className={styles.pennant} aria-label="New update" />}
              <span className={styles.signName}>{building.name}</span>
              <span className={styles.signMeta} aria-hidden={!isHovered}>
                <span className={styles.signLine}>
                  {news && <span className={styles.signNew}>New · </span>}
                  {meta}
                </span>
                <span className={styles.signHint}>Click to open · drag to move</span>
              </span>
            </button>
          </SceneLabel>
        )}
      </group>
    </group>
  );
});
