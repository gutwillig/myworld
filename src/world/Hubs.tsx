import { memo, useMemo, useRef } from "react";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { hexToWorld } from "@/grid/hex";
import { hubsFor } from "@/grid/layout";
import { HUB_FOCUS, districtMembers } from "@/grid/plaza";
import { groundHeight, terrainProfile } from "@/grid/terrainProfile";
import type { World } from "@/store/types";
import { wasDrag } from "./dragState";
import { useFx } from "./fx";

const HUB_R = 0.92;
const flat = (g: THREE.BufferGeometry) => {
  g.rotateX(-Math.PI / 2);
  return g;
};
const DISC = flat(new THREE.CircleGeometry(HUB_R, 36));
const RIM = flat(new THREE.RingGeometry(HUB_R - 0.06, HUB_R, 36));
const HOVER = flat(new THREE.RingGeometry(HUB_R + 0.05, HUB_R + 0.14, 40));
const RIPPLE = flat(new THREE.RingGeometry(0.9, 1, 28));

const m = (color: string) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.95 });
const PAVE = m("#E4E2D4");
const PAVE_RIM = m("#C9C5B0");
const STONE = m("#D3CFBA");
const STONE_DARK = m("#B9B39A");
const WATER = new THREE.MeshStandardMaterial({ color: "#8CCBC9", roughness: 0.25, metalness: 0.05, flatShading: true });
const SAND = m("#EADFC0");
const SAND_RIM = m("#D6C59B");
const INK = m("#2E4A3B");
const CORAL = m("#E5694F");
const CREAM = m("#FBFBF4");

type Kind = "side" | "fun";

/** The fountain (side hustles) and playground (for fun) at the end of their roads. */
export const Hubs = memo(function Hubs({ world, interactive }: { world: World; interactive: boolean }) {
  const hubs = hubsFor(world.terrain);
  const kinds = (["side", "fun"] as Kind[]).filter((d) => districtMembers(world, d).length > 0);
  return (
    <group>
      {kinds.map((d) => (
        <Hub key={d} kind={d} hex={hubs[d]} terrain={world.terrain} interactive={interactive} />
      ))}
    </group>
  );
});

function Hub({ kind, hex, terrain, interactive }: { kind: Kind; hex: World["home"]; terrain: World["terrain"]; interactive: boolean }) {
  const id = HUB_FOCUS[kind];
  const pos = useMemo(() => {
    const w = hexToWorld(hex);
    return new THREE.Vector3(w.x, groundHeight(terrainProfile(terrain), w.x, w.z) + 0.07, w.z);
  }, [hex, terrain]);
  const hoverMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#E5694F", transparent: true, opacity: 0, depthWrite: false }), []);
  const hovered = useRef<boolean>(false);
  const ring = useRef<THREE.Mesh>(null);

  useFrame(({ clock }, dt) => {
    const fx = useFx.getState();
    const inside = fx.plazaId === id;
    const want = hovered.current && !inside && !fx.moving ? 0.85 : 0;
    hoverMat.opacity += (want - hoverMat.opacity) * Math.min(1, dt * 10);
    if (ring.current) {
      ring.current.visible = hoverMat.opacity > 0.01;
      ring.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 3) * 0.015);
    }
  });

  const enter = (e: ThreeEvent<MouseEvent>) => {
    const fx = useFx.getState();
    if (!interactive || wasDrag() || fx.placement || fx.moving || fx.plazaId === id) return;
    e.stopPropagation();
    fx.select(null);
    fx.setPlaza(id);
  };

  return (
    <group position={pos}>
      <group
        onClick={enter}
        onPointerOver={() => {
          if (!interactive || useFx.getState().plazaId === id) return;
          hovered.current = true;
          document.body.style.cursor = "zoom-in";
        }}
        onPointerOut={() => {
          hovered.current = false;
          if (!useFx.getState().moving) document.body.style.cursor = "";
        }}
      >
        <mesh geometry={DISC} material={kind === "side" ? PAVE : SAND} receiveShadow />
        {kind === "side" ? <Fountain /> : <Playground />}
      </group>
      <mesh geometry={RIM} material={kind === "side" ? PAVE_RIM : SAND_RIM} position-y={0.004} />
      <mesh ref={ring} geometry={HOVER} material={hoverMat} position-y={0.006} visible={false} />
    </group>
  );
}

/** Stone basin, a little column and a bowl that spills; rings ripple out across the water. */
function Fountain() {
  const ripples = useRef<THREE.Mesh[]>([]);
  const spout = useRef<THREE.Mesh>(null);
  const rippleMats = useMemo(
    () => [0, 1].map(() => new THREE.MeshBasicMaterial({ color: "#FBFBF4", transparent: true, opacity: 0.5, depthWrite: false })),
    [],
  );
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    ripples.current.forEach((r, i) => {
      const k = (t * 0.45 + i * 0.5) % 1;
      r.scale.setScalar(0.12 + k * 0.4);
      rippleMats[i].opacity = 0.55 * (1 - k);
    });
    if (spout.current) spout.current.scale.y = 1 + Math.sin(t * 5) * 0.12;
  });
  return (
    <group>
      <mesh position-y={0.08} material={STONE} castShadow receiveShadow>
        <cylinderGeometry args={[0.56, 0.6, 0.16, 18]} />
      </mesh>
      <mesh position-y={0.165} material={STONE_DARK}>
        <cylinderGeometry args={[0.5, 0.5, 0.02, 18]} />
      </mesh>
      <mesh position-y={0.15} material={WATER}>
        <cylinderGeometry args={[0.49, 0.49, 0.04, 18]} />
      </mesh>
      {[0, 1].map((i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) ripples.current[i] = el;
          }}
          geometry={RIPPLE}
          material={rippleMats[i]}
          position-y={0.175}
        />
      ))}
      <mesh position-y={0.3} material={STONE} castShadow>
        <cylinderGeometry args={[0.06, 0.09, 0.3, 8]} />
      </mesh>
      <mesh position-y={0.46} material={STONE} castShadow>
        <cylinderGeometry args={[0.2, 0.1, 0.07, 12]} />
      </mesh>
      <mesh position-y={0.49} material={WATER}>
        <cylinderGeometry args={[0.17, 0.17, 0.02, 12]} />
      </mesh>
      <mesh ref={spout} position-y={0.56} material={WATER}>
        <coneGeometry args={[0.045, 0.16, 8]} />
      </mesh>
      <mesh position={[0, 0.56, 0]} rotation-x={Math.PI} material={CORAL}>
        <sphereGeometry args={[0.03, 8, 6]} />
      </mesh>
    </group>
  );
}

/** A swing set with two swinging seats, and a slide off a little tower. */
function Playground() {
  const seats = useRef<THREE.Group[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    seats.current.forEach((g, i) => {
      g.rotation.x = Math.sin(t * 2.2 + i * 1.7) * 0.45;
    });
  });
  const legs = (x: number) =>
    [-1, 1].map((s) => (
      <mesh key={`${x}${s}`} position={[x, 0.24, s * 0.1]} rotation-x={-s * 0.38} material={INK} castShadow>
        <boxGeometry args={[0.035, 0.52, 0.035]} />
      </mesh>
    ));
  return (
    <group>
      {/* Swings */}
      <group position={[-0.28, 0, -0.22]} rotation-y={Math.PI / 4}>
        {legs(-0.32)}
        {legs(0.32)}
        <mesh position={[0, 0.48, 0]} material={INK} castShadow>
          <boxGeometry args={[0.7, 0.035, 0.035]} />
        </mesh>
        {[-0.14, 0.14].map((x, i) => (
          <group
            key={x}
            position={[x, 0.47, 0]}
            ref={(el) => {
              if (el) seats.current[i] = el;
            }}
          >
            {[-0.05, 0.05].map((dx) => (
              <mesh key={dx} position={[dx, -0.17, 0]} material={CREAM}>
                <boxGeometry args={[0.01, 0.34, 0.01]} />
              </mesh>
            ))}
            <mesh position={[0, -0.34, 0]} material={CORAL} castShadow>
              <boxGeometry args={[0.13, 0.025, 0.07]} />
            </mesh>
          </group>
        ))}
      </group>
      {/* Slide */}
      <group position={[0.28, 0, 0.2]} rotation-y={-Math.PI / 4}>
        {[
          [-0.08, -0.08],
          [0.08, -0.08],
          [-0.08, 0.08],
          [0.08, 0.08],
        ].map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x, 0.18, z]} material={INK} castShadow>
            <boxGeometry args={[0.03, 0.36, 0.03]} />
          </mesh>
        ))}
        <mesh position={[0, 0.37, 0]} material={CREAM} castShadow>
          <boxGeometry args={[0.22, 0.03, 0.22]} />
        </mesh>
        <mesh position={[0, 0.5, 0]} material={CORAL} castShadow>
          <coneGeometry args={[0.17, 0.18, 4]} />
        </mesh>
        <mesh position={[0, 0.19, 0.3]} rotation-x={0.82} material={CORAL} castShadow>
          <boxGeometry args={[0.16, 0.025, 0.5]} />
        </mesh>
        {[0.08, 0.16, 0.24, 0.32].map((y) => (
          <mesh key={y} position={[0, y, -0.11]} material={INK}>
            <boxGeometry args={[0.16, 0.02, 0.02]} />
          </mesh>
        ))}
      </group>
      {/* A ball left on the sand */}
      <mesh position={[0.36, 0.05, -0.36]} material={CORAL} castShadow>
        <sphereGeometry args={[0.05, 10, 8]} />
      </mesh>
    </group>
  );
}
