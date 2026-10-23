import { memo, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { CircleDot, Clock, Landmark, TowerControl, Trees as TreesIcon, X } from "lucide-react";
import { groundHeight, terrainProfile } from "@/grid/terrainProfile";
import { PITCH_MAX, TOWN_CENTERS, type TownCenter as Kind, type World } from "@/store/types";
import { useWorldStore } from "@/store/world";
import { wasDrag } from "./dragState";
import { useFx } from "./fx";
import { SceneLabel } from "./SceneLabel";
import styles from "./signs.module.css";

/** Picker labels and the word on the name sign ("Jake's Square"). */
export const CENTER_INFO: Record<Kind, { label: string; sign: string; Icon: typeof Clock }> = {
  park: { label: "Park", sign: "Square", Icon: TreesIcon },
  rotary: { label: "Rotary", sign: "Circle", Icon: CircleDot },
  arch: { label: "Arch", sign: "Arch", Icon: Landmark },
  clock: { label: "Clock", sign: "Clock", Icon: Clock },
  lighthouse: { label: "Lighthouse", sign: "Light", Icon: TowerControl },
};

// Shared low-poly palette: cream stone, warm stone, lawn, wood, coral accent, ink.
const mat = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true, ...extra });
const M = {
  stone: mat("#EDE6D3"),
  stone2: mat("#D6CAB0"),
  pave: mat("#E4DDCD"),
  road: mat("#8E918C"),
  lawn: mat("#A9C98A"),
  lawn2: mat("#93B874"),
  leaf: mat("#6E9E5A"),
  wood: mat("#8A6446"),
  coral: mat("#E5694F"),
  ink: mat("#2E4A3B"),
  white: mat("#FBFBF4"),
  glass: mat("#FFE7A8", { emissive: "#FFC966", emissiveIntensity: 0.9 }),
  rock: mat("#A7A69C"),
};

function Shade({ children }: { children: ReactNode }) {
  return <group>{children}</group>;
}

function Tree({ x, z, s = 1 }: { x: number; z: number; s?: number }) {
  return (
    <group position={[x, 0, z]} scale={s}>
      <mesh position={[0, 0.1, 0]} material={M.wood} castShadow>
        <cylinderGeometry args={[0.03, 0.04, 0.2, 5]} />
      </mesh>
      <mesh position={[0, 0.36, 0]} material={M.leaf} castShadow>
        <icosahedronGeometry args={[0.22, 0]} />
      </mesh>
    </group>
  );
}

/** Jackson-style town square: a lawn crossed by diagonal paths, big corner trees, a gazebo in the middle. */
function Park() {
  return (
    <Shade>
      <mesh position={[0, 0.03, 0]} material={M.pave} receiveShadow>
        <boxGeometry args={[2.1, 0.06, 2.1]} />
      </mesh>
      <mesh position={[0, 0.065, 0]} material={M.lawn} receiveShadow>
        <boxGeometry args={[1.9, 0.03, 1.9]} />
      </mesh>
      {[Math.PI / 4, -Math.PI / 4].map((r) => (
        <mesh key={r} position={[0, 0.082, 0]} rotation={[0, r, 0]} material={M.pave} receiveShadow>
          <boxGeometry args={[2.55, 0.01, 0.16]} />
        </mesh>
      ))}
      {[-1, 1].flatMap((a) => [-1, 1].map((b) => <Tree key={`${a}${b}`} x={a * 0.68} z={b * 0.68} s={1.35} />))}
      {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((r) => (
        <mesh key={r} position={[Math.sin(r) * 0.72, 0.11, Math.cos(r) * 0.72]} rotation={[0, r, 0]} material={M.wood} castShadow>
          <boxGeometry args={[0.26, 0.05, 0.07]} />
        </mesh>
      ))}
      {/* Gazebo */}
      <group position={[0, 0.08, 0]}>
        <mesh position={[0, 0.04, 0]} material={M.stone} castShadow receiveShadow>
          <cylinderGeometry args={[0.36, 0.38, 0.08, 6]} />
        </mesh>
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.sin(a) * 0.3, 0.26, Math.cos(a) * 0.3]} material={M.white} castShadow>
              <cylinderGeometry args={[0.02, 0.02, 0.38, 5]} />
            </mesh>
          );
        })}
        <mesh position={[0, 0.58, 0]} material={M.coral} castShadow>
          <coneGeometry args={[0.44, 0.3, 6]} />
        </mesh>
        <mesh position={[0, 0.77, 0]} material={M.ink}>
          <sphereGeometry args={[0.035, 6, 4]} />
        </mesh>
      </group>
    </Shade>
  );
}

/** A big roundabout with a planted island and an obelisk on a stepped base. */
function Rotary() {
  return (
    <Shade>
      <mesh position={[0, 0.025, 0]} material={M.pave} receiveShadow>
        <cylinderGeometry args={[1.14, 1.16, 0.05, 28]} />
      </mesh>
      <mesh position={[0, 0.045, 0]} material={M.road} receiveShadow>
        <cylinderGeometry args={[1.06, 1.06, 0.03, 28]} />
      </mesh>
      <mesh position={[0, 0.07, 0]} material={M.pave} receiveShadow>
        <cylinderGeometry args={[0.66, 0.68, 0.06, 24]} />
      </mesh>
      <mesh position={[0, 0.09, 0]} material={M.lawn} receiveShadow>
        <cylinderGeometry args={[0.6, 0.6, 0.04, 24]} />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.sin(a) * 0.48, 0.14, Math.cos(a) * 0.48]} material={i % 2 ? M.coral : M.lawn2} castShadow>
            <icosahedronGeometry args={[0.07, 0]} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.16, 0]} material={M.stone2} castShadow receiveShadow>
        <boxGeometry args={[0.44, 0.1, 0.44]} />
      </mesh>
      <mesh position={[0, 0.25, 0]} material={M.stone} castShadow>
        <boxGeometry args={[0.32, 0.1, 0.32]} />
      </mesh>
      <mesh position={[0, 0.88, 0]} material={M.stone} castShadow>
        <cylinderGeometry args={[0.045, 0.11, 1.16, 4]} />
      </mesh>
      <mesh position={[0, 1.52, 0]} material={M.coral} castShadow>
        <coneGeometry args={[0.065, 0.14, 4]} />
      </mesh>
    </Shade>
  );
}

/** A triumphal arch on a stone plaza, a coral banner hanging under the vault. */
function Arch() {
  return (
    <Shade>
      <mesh position={[0, 0.03, 0]} material={M.pave} receiveShadow>
        <cylinderGeometry args={[1.0, 1.02, 0.06, 8]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.46, 0, 0]}>
          <mesh position={[0, 0.1, 0]} material={M.stone2} castShadow receiveShadow>
            <boxGeometry args={[0.38, 0.12, 0.42]} />
          </mesh>
          <mesh position={[0, 0.62, 0]} material={M.stone} castShadow receiveShadow>
            <boxGeometry args={[0.3, 0.94, 0.36]} />
          </mesh>
        </group>
      ))}
      {/* Vault: a half ring between the piers */}
      <mesh position={[0, 0.92, 0]} material={M.stone} castShadow>
        <torusGeometry args={[0.31, 0.06, 4, 10, Math.PI]} />
      </mesh>
      <mesh position={[0, 1.2, 0]} material={M.stone} castShadow receiveShadow>
        <boxGeometry args={[1.26, 0.3, 0.4]} />
      </mesh>
      <mesh position={[0, 1.38, 0]} material={M.stone2} castShadow>
        <boxGeometry args={[1.34, 0.06, 0.46]} />
      </mesh>
      <mesh position={[0, 1.5, 0]} material={M.stone} castShadow>
        <boxGeometry args={[0.6, 0.18, 0.3]} />
      </mesh>
      <mesh position={[0, 1.2, 0.205]} material={M.ink}>
        <boxGeometry args={[0.56, 0.12, 0.01]} />
      </mesh>
      <mesh position={[0, 0.78, 0]} material={M.coral} castShadow>
        <boxGeometry args={[0.2, 0.3, 0.02]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.62, 0, 0.5]}>
          <mesh position={[0, 0.22, 0]} material={M.ink} castShadow>
            <cylinderGeometry args={[0.015, 0.02, 0.4, 5]} />
          </mesh>
          <mesh position={[0, 0.44, 0]} material={M.glass}>
            <sphereGeometry args={[0.04, 6, 4]} />
          </mesh>
        </group>
      ))}
    </Shade>
  );
}

/** A stone clock tower whose hands keep the visitor's real local time. */
function ClockTower() {
  const hour = useRef<THREE.Group>(null);
  const minute = useRef<THREE.Group>(null);
  useFrame(() => {
    const d = new Date();
    const m = d.getMinutes() + d.getSeconds() / 60;
    const h = (d.getHours() % 12) + m / 60;
    if (minute.current) minute.current.children.forEach((c) => (c.rotation.z = -(m / 60) * Math.PI * 2));
    if (hour.current) hour.current.children.forEach((c) => (c.rotation.z = -(h / 12) * Math.PI * 2));
  });
  const faces = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  return (
    <Shade>
      <mesh position={[0, 0.03, 0]} material={M.pave} receiveShadow>
        <cylinderGeometry args={[0.95, 0.97, 0.06, 8]} />
      </mesh>
      <mesh position={[0, 0.12, 0]} material={M.stone2} castShadow receiveShadow>
        <boxGeometry args={[0.6, 0.14, 0.6]} />
      </mesh>
      <mesh position={[0, 0.82, 0]} material={M.stone} castShadow receiveShadow>
        <boxGeometry args={[0.44, 1.3, 0.44]} />
      </mesh>
      <mesh position={[0, 1.5, 0]} material={M.stone2} castShadow>
        <boxGeometry args={[0.52, 0.08, 0.52]} />
      </mesh>
      {/* Open belfry and coral roof */}
      {[-1, 1].flatMap((a) => [-1, 1].map((b) => (
        <mesh key={`${a}${b}`} position={[a * 0.18, 1.67, b * 0.18]} material={M.stone} castShadow>
          <boxGeometry args={[0.06, 0.26, 0.06]} />
        </mesh>
      )))}
      <mesh position={[0, 1.66, 0]} material={M.wood}>
        <sphereGeometry args={[0.08, 6, 4]} />
      </mesh>
      <mesh position={[0, 1.82, 0]} material={M.stone2}>
        <boxGeometry args={[0.46, 0.05, 0.46]} />
      </mesh>
      <mesh position={[0, 2.04, 0]} rotation={[0, Math.PI / 4, 0]} material={M.coral} castShadow>
        <coneGeometry args={[0.34, 0.42, 4]} />
      </mesh>
      {/* Faces, with hour and minute hands on each */}
      <group ref={hour}>
        {faces.map((r) => (
          <group key={r} rotation={[0, r, 0]}>
            <group position={[0, 1.22, 0.235]}>
              <mesh position={[0, 0.045, 0]} material={M.ink}>
                <boxGeometry args={[0.025, 0.09, 0.01]} />
              </mesh>
            </group>
          </group>
        ))}
      </group>
      <group ref={minute}>
        {faces.map((r) => (
          <group key={r} rotation={[0, r, 0]}>
            <group position={[0, 1.22, 0.24]}>
              <mesh position={[0, 0.06, 0]} material={M.ink}>
                <boxGeometry args={[0.016, 0.13, 0.01]} />
              </mesh>
            </group>
          </group>
        ))}
      </group>
      {faces.map((r) => (
        <group key={r} rotation={[0, r, 0]}>
          <mesh position={[0, 1.22, 0.222]} rotation={[Math.PI / 2, 0, 0]} material={M.white}>
            <cylinderGeometry args={[0.16, 0.16, 0.02, 16]} />
          </mesh>
        </group>
      ))}
    </Shade>
  );
}

/** A striped lighthouse on a rocky base, its lamp slowly sweeping. */
function Lighthouse() {
  const beam = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (beam.current) beam.current.rotation.y += dt * 0.8;
  });
  const bands = [0, 1, 2, 3];
  return (
    <Shade>
      {[[0, 0, 0.62], [0.42, 0.25, 0.32], [-0.36, -0.34, 0.36], [-0.3, 0.4, 0.26]].map(([x, z, r], i) => (
        <mesh key={i} position={[x, r * 0.35, z]} material={M.rock} castShadow receiveShadow>
          <dodecahedronGeometry args={[r, 0]} />
        </mesh>
      ))}
      <mesh position={[0, 0.3, 0]} material={M.stone2} castShadow>
        <cylinderGeometry args={[0.36, 0.4, 0.14, 10]} />
      </mesh>
      {bands.map((i) => {
        const y0 = 0.37 + i * 0.32;
        const r0 = 0.3 - i * 0.035;
        return (
          <mesh key={i} position={[0, y0 + 0.16, 0]} material={i % 2 ? M.coral : M.white} castShadow>
            <cylinderGeometry args={[r0 - 0.035, r0, 0.32, 12]} />
          </mesh>
        );
      })}
      <mesh position={[0, 1.7, 0]} material={M.ink} castShadow>
        <cylinderGeometry args={[0.24, 0.2, 0.05, 12]} />
      </mesh>
      <mesh position={[0, 1.84, 0]} material={M.glass}>
        <cylinderGeometry args={[0.12, 0.12, 0.22, 8]} />
      </mesh>
      <mesh position={[0, 2.03, 0]} material={M.ink} castShadow>
        <coneGeometry args={[0.17, 0.18, 8]} />
      </mesh>
      <group ref={beam} position={[0, 1.84, 0]}>
        <mesh position={[0.5, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.1, 0.8, 8, 1, true]} />
          <meshBasicMaterial color="#FFE7A8" transparent opacity={0.28} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </Shade>
  );
}

const MODELS: Record<Kind, () => ReactElement> = {
  park: Park,
  rotary: Rotary,
  arch: Arch,
  clock: ClockTower,
  lighthouse: Lighthouse,
};
/** Height of each landmark's top, so the sign and cards float just above it. */
const TOP: Record<Kind, number> = { park: 0.95, rotary: 1.65, arch: 1.7, clock: 2.3, lighthouse: 2.2 };
const SCALE = 1.25;

/** The owner's card: pick a landmark (it swaps live) and write a short pitch. */
function CenterEditor({ world, onClose }: { world: World; onClose: () => void }) {
  const setCenter = useWorldStore((s) => s.setTownCenter);
  const setPitch = useWorldStore((s) => s.setPitch);
  const [draft, setDraft] = useState(world.pitch ?? "");
  const current = world.center ?? "park";
  const done = () => {
    setPitch(draft);
    onClose();
  };
  return (
    <form
      className={styles.centerCard}
      onSubmit={(e) => {
        e.preventDefault();
        done();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          done();
        }
      }}
    >
      <div className={styles.centerHead}>
        <span className={styles.noteKind}>Your town centre</span>
        <button type="button" className={styles.centerClose} onClick={done} aria-label="Close">
          <X size={14} strokeWidth={2.4} />
        </button>
      </div>
      <div className={styles.centerOptions} role="radiogroup" aria-label="Town centre">
        {TOWN_CENTERS.map((k) => {
          const { label, Icon } = CENTER_INFO[k];
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={current === k}
              className={`${styles.centerOption} ${current === k ? styles.centerOptionOn : ""}`}
              onClick={() => setCenter(k)}
            >
              <Icon size={18} strokeWidth={2} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
      <label className={styles.noteKind} htmlFor="pitch">
        Your elevator pitch
      </label>
      <textarea
        id="pitch"
        className={styles.pitchInput}
        value={draft}
        maxLength={PITCH_MAX}
        rows={4}
        placeholder="Who you are and what you do, in a few lines. Visitors see this when they land."
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            done();
          }
        }}
      />
      <div className={styles.centerFoot}>
        <span className={styles.noteHint}>{`${draft.length}/${PITCH_MAX}`}</span>
        <button type="submit" className={styles.centerDone}>
          Done
        </button>
      </div>
    </form>
  );
}

/** What a visitor sees on landing: the owner's pitch in a speech bubble over their landmark. */
function PitchBubble({ name, pitch, onClose }: { name: string; pitch: string; onClose: () => void }) {
  return (
    <div className={styles.pitchBubble} onPointerDown={(e) => e.stopPropagation()} role="dialog" aria-label={`${name}'s pitch`}>
      <div className={styles.centerHead}>
        <span className={styles.pitchName}>{`Hi, I\u2019m ${name}`}</span>
        <button type="button" className={styles.centerClose} onClick={onClose} aria-label="Close">
          <X size={14} strokeWidth={2.4} />
        </button>
      </div>
      <p className={styles.pitchText}>{pitch}</p>
    </div>
  );
}

type Props = { world: World; isHome: boolean; isCurrent: boolean; interactive: boolean };

/** The landmark in the middle of every town. Owners click it to restyle it and write their pitch. */
export const TownCenter = memo(function TownCenter({ world, isHome, isCurrent, interactive }: Props) {
  const kind = world.center ?? "park";
  const Model = MODELS[kind];
  const y = useMemo(() => groundHeight(terrainProfile(world.terrain), 0, 0), [world.terrain]);
  const [editing, setEditing] = useState(false);
  const [hover, setHover] = useState(false);
  const [pitchOpen, setPitchOpen] = useState(false);
  const pitch = world.pitch?.trim() ?? "";

  // Visitors get the pitch each time they land; it waits until the plane has arrived.
  useEffect(() => {
    setPitchOpen(!isHome && isCurrent && interactive && !!pitch);
  }, [isHome, isCurrent, interactive, pitch]);
  useEffect(() => {
    if (!interactive) setEditing(false);
  }, [interactive]);

  const canEdit = isHome && interactive;
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (!interactive || wasDrag()) return;
    const fx = useFx.getState();
    if (fx.placement || fx.moving || fx.travel) return;
    e.stopPropagation();
    if (canEdit) setEditing((v) => !v);
    else if (pitch) setPitchOpen((v) => !v);
  };
  const clickable = canEdit || (!isHome && !!pitch);
  const top = TOP[kind] * SCALE;

  return (
    <group position={[0, y, 0]}>
      <group
        scale={SCALE}
        onClick={interactive ? onClick : undefined}
        onPointerOver={
          interactive && clickable
            ? (e) => {
                e.stopPropagation();
                setHover(true);
                document.body.style.cursor = "pointer";
              }
            : undefined
        }
        onPointerOut={
          interactive && clickable
            ? () => {
                setHover(false);
                document.body.style.cursor = "";
              }
            : undefined
        }
      >
        <Model />
      </group>
      {/* The editor is tall, so it floats beside the landmark rather than above it. */}
      {editing && (
        <SceneLabel position={[0, top * 0.5, 0]} zIndex={34} offsetX={250} interactive>
          <CenterEditor world={world} onClose={() => setEditing(false)} />
        </SceneLabel>
      )}
      <SceneLabel position={[0, top + 0.18, 0]} zIndex={pitchOpen ? 34 : 20} interactive={pitchOpen}>
        <div className={styles.centerStack}>
          {pitchOpen && !editing && <PitchBubble name={world.ownerName} pitch={pitch} onClose={() => setPitchOpen(false)} />}
          <div className={`${styles.homeSign} ${hover ? styles.signHover : ""}`} style={{ cursor: "default" }}>
            {`${world.ownerName}\u2019s ${CENTER_INFO[kind].sign}`}
            {hover && canEdit && !editing && <span className={styles.centerHint}>Click to change</span>}
          </div>
        </div>
      </SceneLabel>
    </group>
  );
});
