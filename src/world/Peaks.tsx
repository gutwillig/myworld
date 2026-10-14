import { memo, useMemo } from "react";
import * as THREE from "three";
import type { Terrain } from "@/store/types";
import { seededRandom } from "./islandShape";

type Peak = { x: number; z: number; h: number; r: number; rot: number; tone: number; cap: number };

const ROCK = ["#74857B", "#66786E", "#7F8F83"].map(
  (c) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 1 }),
);
const SNOW = new THREE.MeshStandardMaterial({ color: "#F4F6F2", flatShading: true, roughness: 0.9 });

/** The camera's azimuth (it sits at +x,+z); the canyon stays open on this side. */
const CAMERA_AZ = Math.PI / 4;

/**
 * A box-canyon backdrop for mountain towns (Telluride style): a ring of flat-shaded peaks
 * with snow caps, rising out of the lake behind the island. The camera-facing side stays
 * open so the town is never blocked. Seed-locked so peaks never jump between reloads.
 */
export const Peaks = memo(function Peaks({ seed, terrain }: { seed: string; terrain: Terrain }) {
  const peaks = useMemo<Peak[]>(() => {
    if (terrain !== "mountain") return [];
    const rand = seededRandom(`${seed}:peaks`);
    const out: Peak[] = [];
    // Sized for the fixed orthographic frame: near the shore and low enough that the
    // silhouettes stay on screen instead of cropping into slabs.
    const count = 16;
    for (let i = 0; i < count; i++) {
      // Spread across the ~215° arc that faces away from the camera.
      const spread = (i / (count - 1) - 0.5) * 3.75;
      const a = CAMERA_AZ + Math.PI + spread + (rand() - 0.5) * 0.14;
      const dist = 11.5 + rand() * 2.2;
      const h = 3.5 + rand() * 2.6;
      out.push({
        x: Math.cos(a) * dist,
        z: Math.sin(a) * dist,
        h,
        r: 2.6 + rand() * 1.7,
        rot: rand() * Math.PI,
        tone: Math.floor(rand() * ROCK.length),
        cap: 0.62 + rand() * 0.12,
      });
    }
    return out;
  }, [seed, terrain]);

  if (peaks.length === 0) return null;
  return (
    <group aria-hidden>
      {peaks.map((p, i) => {
        const capH = p.h * (1 - p.cap);
        return (
          <group key={i} position={[p.x, -1, p.z]} rotation-y={p.rot}>
            <mesh position={[0, p.h / 2 - 0.5, 0]} material={ROCK[p.tone]}>
              <coneGeometry args={[p.r, p.h, 5]} />
            </mesh>
            <mesh position={[0, p.h - 0.5 - capH / 2 + 0.05, 0]} material={SNOW}>
              <coneGeometry args={[p.r * (1 - p.cap), capH + 0.35, 5]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
});
