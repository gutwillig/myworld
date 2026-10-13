import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { BuildingType } from "@/store/types";
import { type GroundsOpts, PREVIEW_FACING, groundsOf } from "./grounds";
import { makeCtx } from "./kit/common";
import { styleOf } from "./styles";

type Props = {
  type: BuildingType;
  accent: string;
  faded?: boolean;
  style?: string;
  /** Called with the built height so callers can place signs. */
  onHeight?: (h: number) => void;
};

function disposeGeometry(root: THREE.Object3D): void {
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose();
  });
}

/** Turns a building type and style into geometry. Knows nothing about the store. */
export const BuildingMesh = memo(function BuildingMesh({ type, accent, faded = false, style, onHeight }: Props) {
  const built = useMemo(() => styleOf(type, style).build(makeCtx(accent, faded)), [type, style, accent, faded]);
  useEffect(() => {
    onHeight?.(built.height);
  }, [built, onHeight]);
  useEffect(() => () => disposeGeometry(built.group), [built]);
  return <primitive object={built.group} />;
});

/** The lot's surroundings (green, plaza, parking…), oriented away from the road. */
export const GroundsMesh = memo(function GroundsMesh({
  type,
  grounds,
  accent,
  faded = false,
  face = PREVIEW_FACING.face,
  gap = PREVIEW_FACING.gap,
}: { type: BuildingType; grounds?: string; accent: string; faded?: boolean } & Partial<GroundsOpts>) {
  const group = useMemo(() => groundsOf(type, grounds).build(makeCtx(accent, faded), { face, gap }), [type, grounds, accent, faded, face, gap]);
  useEffect(() => () => disposeGeometry(group), [group]);
  return <primitive object={group} />;
});

/** Slowly spinning building for the /kit page and other showcases. */
export function SpinningBuilding({ type, accent, faded, style }: Props) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.25;
  });
  return (
    <group ref={ref}>
      <BuildingMesh type={type} accent={accent} faded={faded} style={style} />
    </group>
  );
}
