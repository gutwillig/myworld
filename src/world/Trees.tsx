import { memo, useMemo } from "react";
import * as THREE from "three";
import { hexKey, hexToWorld, hexesWithin } from "@/grid/hex";
import { HOME, WORLD_RADIUS, reservedHexes } from "@/grid/layout";
import { coastCoord, groundHeight, terrainProfile } from "@/grid/terrainProfile";
import type { Terrain } from "@/store/types";
import { seededRandom } from "./islandShape";

type Tree = { x: number; y: number; z: number; s: number; rot: number; kind: "pine" | "round"; tint: number };

const TRUNK = new THREE.CylinderGeometry(0.05, 0.07, 0.3, 5);
TRUNK.translate(0, 0.15, 0);
const PINE_LOW = new THREE.ConeGeometry(0.34, 0.62, 6);
PINE_LOW.translate(0, 0.52, 0);
const PINE_HIGH = new THREE.ConeGeometry(0.24, 0.48, 6);
PINE_HIGH.translate(0, 0.86, 0);
const ROUND = new THREE.IcosahedronGeometry(0.33, 0);
ROUND.translate(0, 0.58, 0);

const LEAVES = ["#5E9B5A", "#6FA35A", "#4F8A55", "#7DAE5F"].map((c) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.9 }));
const BARK = new THREE.MeshStandardMaterial({ color: "#8A6446", flatShading: true, roughness: 1 });

/** A circle trees should stay out of (a lot with grounds), in island coordinates. */
export type Clearing = { x: number; z: number; r: number };

/** 25 low-poly trees on free land, seeded by world id so they never jump on reload. */
export const Trees = memo(function Trees({ seed, terrain, clearings = [] }: { seed: string; terrain: Terrain; clearings?: Clearing[] }) {
  const trees = useMemo(() => {
    const rand = seededRandom(`${seed}:trees`);
    const profile = terrainProfile(terrain);
    const reserved = reservedHexes(terrain);
    const free = hexesWithin(HOME, WORLD_RADIUS).filter((h) => {
      if (reserved.has(hexKey(h))) return false;
      const w = hexToWorld(h);
      return coastCoord(profile, w.x, w.z) < profile.sandStart - 0.2;
    });
    for (let i = free.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [free[i], free[j]] = [free[j], free[i]];
    }
    const out: Tree[] = [];
    let i = 0;
    while (out.length < 25 && free.length > 0) {
      const h = free[i % free.length];
      const w = hexToWorld(h);
      const x = w.x + (rand() - 0.5) * 0.9;
      const z = w.z + (rand() - 0.5) * 0.9;
      if (out.every((t) => Math.hypot(t.x - x, t.z - z) > 0.55)) {
        // Mountain towns are all pines; beaches mix in round broadleafs.
        const wantPine = terrain === "mountain" || rand() < 0.62;
        out.push({
          x,
          z,
          y: groundHeight(profile, x, z) - 0.02,
          s: (terrain === "mountain" ? 0.95 : 0.75) + rand() * 0.55,
          rot: rand() * Math.PI,
          kind: wantPine ? "pine" : "round",
          tint: Math.floor(rand() * LEAVES.length),
        });
      }
      i++;
      if (i > 400) break;
    }
    return out;
  }, [seed, terrain]);

  const visible = useMemo(
    () => trees.map((t) => clearings.every((c) => Math.hypot(t.x - c.x, t.z - c.z) > c.r)),
    [trees, clearings],
  );

  return (
    <group>
      {trees.map((t, i) => visible[i] && (
        <group key={i} position={[t.x, t.y, t.z]} scale={t.s} rotation-y={t.rot}>
          <mesh geometry={TRUNK} material={BARK} castShadow />
          {t.kind === "pine" ? (
            <>
              <mesh geometry={PINE_LOW} material={LEAVES[t.tint]} castShadow receiveShadow />
              <mesh geometry={PINE_HIGH} material={LEAVES[t.tint]} castShadow receiveShadow />
            </>
          ) : (
            <mesh geometry={ROUND} material={LEAVES[(t.tint + 1) % LEAVES.length]} castShadow receiveShadow />
          )}
        </group>
      ))}
    </group>
  );
});
