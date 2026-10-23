import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { groundHeight, terrainProfile } from "@/grid/terrainProfile";
import { KEEPSAKE_SCALE, NOTE_MAX, keepsakeInfo } from "@/keepsakes/catalog";
import { buildKeepsake } from "@/keepsakes/kit";
import { type KeepsakeSpot, placeKeepsakes } from "@/keepsakes/place";
import type { Keepsake, KeepsakeKind, Terrain, World } from "@/store/types";
import { useWorldStore } from "@/store/world";
import { dragPoint, wasDrag } from "./dragState";
import { easeOutBack, useFx } from "./fx";
import { SceneLabel } from "./SceneLabel";
import type { Clearing } from "./Trees";
import styles from "./signs.module.css";

const EMPTY: Keepsake[] = [];

/** Where a world's keepsakes sit; stable for the same list and pins. */
export function useKeepsakeSpots(world: Pick<World, "id" | "terrain" | "keepsakes">): KeepsakeSpot[] {
  const list = world.keepsakes ?? EMPTY;
  const key = list.map((k) => (k.at ? `${k.kind}@${k.at.x},${k.at.z},${k.at.rot}` : k.kind)).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands in for the list
  return useMemo(() => placeKeepsakes(world.terrain, world.id, list), [world.terrain, world.id, key]);
}

/** Tree-free circles around each keepsake. */
export const keepsakeClearings = (spots: KeepsakeSpot[]): Clearing[] => spots.map((s) => ({ x: s.x, z: s.z, r: s.radius + 0.35 }));

const RISE_MS = 650;
/** How high a picked-up keepsake floats, in world units. */
const CARRY_LIFT = 0.45;

const RING_GEO = new THREE.RingGeometry(0.9, 1, 40);
RING_GEO.rotateX(-Math.PI / 2);
const DISC_GEO = new THREE.CircleGeometry(0.9, 40);
DISC_GEO.rotateX(-Math.PI / 2);
const RING_OK = new THREE.Color("#E5694F");
const RING_BAD = new THREE.Color("#9E2F22");

/** The owner's little text field, right on the keepsake's sign. */
function NoteField({ kind, label }: { kind: KeepsakeKind; label: string }) {
  const note = useWorldStore((s) => s.world.keepsakes?.find((k) => k.kind === kind)?.note ?? "");
  const setNote = useWorldStore((s) => s.setKeepsakeNote);
  const close = useFx((s) => s.editKeepsake);
  const [draft, setDraft] = useState<string>(note);
  const closed = useRef<boolean>(false);
  const done = (save: boolean) => {
    if (closed.current) return;
    closed.current = true;
    if (save) setNote(kind, draft.trim());
    close(null);
  };
  return (
    <form
      className={styles.noteForm}
      onSubmit={(e) => {
        e.preventDefault();
        done(true);
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <span className={styles.noteKind}>{label}</span>
      <input
        className={styles.noteInput}
        value={draft}
        maxLength={NOTE_MAX}
        placeholder={kind === "ballpark" ? "Go Sox!" : "Say what it is"}
        aria-label={`Sign for your ${label.toLowerCase()}`}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => done(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            done(false);
          }
        }}
      />
      <span className={styles.noteHint}>Enter to save</span>
    </form>
  );
}

type KeepsakeProps = {
  spot: KeepsakeSpot;
  note: string;
  terrain: Terrain;
  animateIn: boolean;
  interactive: boolean;
  editable: boolean;
};

const PlacedKeepsake = memo(function PlacedKeepsake({ spot, note, terrain, animateIn, interactive, editable }: KeepsakeProps) {
  const built = useMemo(() => buildKeepsake(spot.kind), [spot.kind]);
  const height = useMemo(() => new THREE.Box3().setFromObject(built.group).max.y, [built]);
  const info = keepsakeInfo(spot.kind);
  const label = info?.label ?? "Keepsake";
  const isHovered = useFx((s) => s.keepsakeHover === spot.kind);
  const isEditing = useFx((s) => s.keepsakeEdit === spot.kind);
  const carry = useFx((s) => (s.keepsakeMove?.kind === spot.kind ? s.keepsakeMove : null));
  const isCarried = !!carry;

  const outer = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Group>(null);
  const born = useRef<number>(animateIn ? performance.now() : 0);
  const placed = useRef<boolean>(false);
  const glow = useRef<number>(0);
  const hop = useRef<number>(0);
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: RING_OK, transparent: true, opacity: 0, depthWrite: false }), []);
  const discMat = useMemo(() => new THREE.MeshBasicMaterial({ color: RING_OK, transparent: true, opacity: 0, depthWrite: false }), []);
  const profile = terrainProfile(terrain);

  useEffect(
    () => () => {
      built.group.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose();
      });
      ringMat.dispose();
      discMat.dispose();
    },
    [built, ringMat, discMat],
  );

  useFrame(({ clock }, rawDt) => {
    built.tick?.(clock.elapsedTime);
    const o = outer.current;
    const g = inner.current;
    if (!o || !g) return;
    const dt = Math.min(rawDt, 1 / 20);
    const carrying = isCarried && dragPoint.has;
    const gx = carrying ? dragPoint.x : spot.x;
    const gz = carrying ? dragPoint.z : spot.z;
    const gy = groundHeight(profile, gx, gz) - 0.01 + (carrying ? CARRY_LIFT : 0);
    if (!placed.current) {
      o.position.set(gx, gy, gz);
      placed.current = true;
    } else {
      const k = Math.min(1, dt * (carrying ? 16 : 11));
      o.position.x += (gx - o.position.x) * k;
      o.position.z += (gz - o.position.z) * k;
      o.position.y += (gy - o.position.y) * k;
    }

    let s = KEEPSAKE_SCALE;
    if (born.current) {
      const t = Math.min(1, (performance.now() - born.current) / RISE_MS);
      s *= Math.max(0.001, easeOutBack(t));
      if (t >= 1) born.current = 0;
    }
    o.scale.setScalar(s);

    const wantHop = (isHovered || isEditing) && !isCarried ? 0.07 : 0;
    hop.current += (wantHop - hop.current) * Math.min(1, dt * 14);
    g.position.y = hop.current;
    // A gentle wobble while carried, like it's being held by the corner.
    g.rotation.z = isCarried ? Math.sin(clock.elapsedTime * 7) * 0.05 : g.rotation.z * 0.85;

    const want = isCarried ? 1 : isHovered && editable ? 0.85 : isEditing ? 0.7 : 0;
    glow.current += (want - glow.current) * Math.min(1, dt * 12);
    const bad = isCarried && carry ? !carry.fits : false;
    const color = bad ? RING_BAD : RING_OK;
    ringMat.color.lerp(color, Math.min(1, dt * 14));
    discMat.color.copy(ringMat.color);
    ringMat.opacity = 0.9 * glow.current;
    discMat.opacity = (bad ? 0.3 : 0.16) * glow.current;
    const r = ring.current;
    if (r) {
      r.visible = glow.current > 0.01;
      r.position.y = (isCarried ? -CARRY_LIFT / KEEPSAKE_SCALE : 0) + 0.06;
      r.scale.setScalar((info?.footprint ?? 0.6) * (0.9 + 0.1 * glow.current + Math.sin(clock.elapsedTime * 4) * 0.02 * glow.current));
    }
  });

  const onOver = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!interactive) return;
      e.stopPropagation();
      const fx = useFx.getState();
      if (fx.moving || fx.placement || fx.keepsakeMove || fx.travel) return;
      fx.hoverKeepsake(spot.kind);
      document.body.style.cursor = editable ? "grab" : "default";
    },
    [interactive, editable, spot.kind],
  );
  const onOut = useCallback(() => {
    const fx = useFx.getState();
    if (fx.keepsakeHover === spot.kind) fx.hoverKeepsake(null);
    if (!fx.keepsakeMove && !fx.moving) document.body.style.cursor = "";
  }, [spot.kind]);
  const onDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      const fx = useFx.getState();
      if (!editable || e.button !== 0 || fx.placement || fx.travel) return;
      e.stopPropagation();
      fx.setKeepsakePress({ kind: spot.kind, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY });
    },
    [editable, spot.kind],
  );
  const onClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (!interactive) return;
      e.stopPropagation();
      if (!editable || wasDrag() || useFx.getState().placement) return;
      const fx = useFx.getState();
      fx.select(null);
      fx.editKeepsake(fx.keepsakeEdit === spot.kind ? null : spot.kind);
    },
    [interactive, editable, spot.kind],
  );

  useEffect(
    () => () => {
      const fx = useFx.getState();
      if (fx.keepsakeHover === spot.kind) {
        fx.hoverKeepsake(null);
        document.body.style.cursor = "";
      }
    },
    [spot.kind],
  );

  const showSign = interactive && (isHovered || isCarried || isEditing);
  const title = note || label;

  return (
    <group ref={outer} rotation-y={spot.rot} scale={animateIn ? 0.001 : KEEPSAKE_SCALE}>
      <group ref={ring} visible={false}>
        <mesh geometry={RING_GEO} material={ringMat} renderOrder={3} />
        <mesh geometry={DISC_GEO} material={discMat} renderOrder={2} position-y={-0.004} />
      </group>
      <group
        ref={inner}
        onPointerOver={interactive ? onOver : undefined}
        onPointerOut={interactive ? onOut : undefined}
        onPointerDown={editable ? onDown : undefined}
        onClick={interactive ? onClick : undefined}
      >
        <primitive object={built.group} />
      </group>
      {showSign && (
        <SceneLabel position={[0, height + 0.32, 0]} zIndex={isEditing ? 32 : 24} interactive={isEditing}>
          {isEditing ? (
            <NoteField kind={spot.kind} label={label} />
          ) : (
            <div className={`${styles.keepsakeSign} ${carry && !carry.fits ? styles.keepsakeSignBad : ""}`}>
              <span className={styles.keepsakeNote}>{isCarried ? label : title}</span>
              {isCarried ? (
                <span className={styles.keepsakeMeta}>{carry?.fits ? "Let go to set it here" : "Keep it off lots and roads"}</span>
              ) : (
                <>
                  {note && <span className={styles.keepsakeMeta}>{label}</span>}
                  {editable && <span className={styles.keepsakeHint}>{note ? "Click to edit" : "Click to write"} · drag to move</span>}
                </>
              )}
            </div>
          )}
        </SceneLabel>
      )}
    </group>
  );
});

type KeepsakesProps = {
  spots: KeepsakeSpot[];
  terrain: Terrain;
  /** Owner's words per kind. */
  notes?: Keepsake[];
  /** Hover shows each keepsake's sign. */
  interactive?: boolean;
  /** The owner can drag them around and write on their signs. */
  editable?: boolean;
};

/**
 * The little personal props around an island. Hover one to read its sign; on your own island,
 * drag to move it or click to write on it. Ones added after the island first appears pop in.
 */
export const Keepsakes = memo(function Keepsakes({ spots, terrain, notes = EMPTY, interactive = false, editable = false }: KeepsakesProps) {
  const mounted = useRef<boolean>(false);
  useEffect(() => {
    mounted.current = true;
  }, []);
  return (
    <group>
      {spots.map((s) => (
        <PlacedKeepsake
          key={s.kind}
          spot={s}
          note={notes.find((k) => k.kind === s.kind)?.note ?? ""}
          terrain={terrain}
          animateIn={mounted.current}
          interactive={interactive}
          editable={editable && interactive}
        />
      ))}
    </group>
  );
});
