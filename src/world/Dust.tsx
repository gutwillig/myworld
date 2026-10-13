import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const GEO = new THREE.IcosahedronGeometry(0.11, 0);
const DURATION = 0.75;

/** Six puffs that expand and fade, triggered whenever `at` (performance.now ms) changes. */
export function Dust({ at, color = "#E9DFC9", spread = 0.62 }: { at: number | null; color?: string; spread?: number }) {
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color, flatShading: true, transparent: true, opacity: 0, depthWrite: false }),
    [color],
  );
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const dirs = useMemo(
    () => Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      return new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    }),
    [],
  );

  useFrame(() => {
    if (at === null) return;
    const t = (performance.now() - at) / 1000 / DURATION;
    const active = t >= 0 && t <= 1;
    refs.current.forEach((m, i) => {
      if (!m) return;
      m.visible = active;
      if (!active) return;
      const e = 1 - Math.pow(1 - t, 2);
      const d = dirs[i];
      m.position.set(d.x * spread * e, 0.08 + e * 0.22 + (i % 2) * 0.05, d.z * spread * e);
      m.scale.setScalar(0.6 + e * 1.4);
      m.rotation.set(e * 2 + i, e * 3, 0);
    });
    mat.opacity = active ? 0.85 * (1 - t) : 0;
  });

  return (
    <group>
      {dirs.map((_, i) => (
        <mesh key={i} ref={(m) => (refs.current[i] = m)} geometry={GEO} material={mat} visible={false} />
      ))}
    </group>
  );
}
