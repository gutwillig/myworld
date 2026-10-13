import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

let labelHost: HTMLElement | null = null;

/** Registers the DOM layer (outside the Canvas) that scene labels render into. */
export function setLabelHost(el: HTMLElement | null): void {
  labelHost = el;
}

type Props = {
  position: [number, number, number];
  zIndex?: number;
  offsetX?: number;
  interactive?: boolean;
  children: ReactNode;
};

const tmp = new THREE.Vector3();

/**
 * A DOM label pinned to a 3D point. Owns its element and root, so unmount order
 * between React DOM and the R3F reconciler can never throw.
 */
export function SceneLabel({ position, zIndex = 10, offsetX = 0, interactive = false, children }: Props) {
  const anchor = useRef<THREE.Group>(null);
  const gl = useThree((s) => s.gl);
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const root = useRef<Root | null>(null);
  const last = useRef<string>("");

  // One element + one root per mount; a fresh pair is made if the component remounts.
  useLayoutEffect(() => {
    const host = labelHost ?? gl.domElement.parentElement;
    const div = document.createElement("div");
    div.style.cssText = "position:absolute;top:0;left:0;will-change:transform;pointer-events:none;";
    host?.appendChild(div);
    const r = createRoot(div);
    root.current = r;
    last.current = "";
    setEl(div);
    return () => {
      root.current = null;
      div.style.display = "none";
      setTimeout(() => {
        r.unmount();
        div.remove();
      }, 0);
    };
  }, [gl]);

  useLayoutEffect(() => {
    if (el) el.style.zIndex = String(zIndex);
  }, [el, zIndex]);

  useEffect(() => {
    if (!el) return;
    root.current?.render(
      <div
        style={{
          transform: `translate(calc(-50% + ${offsetX}px), -50%)`,
          pointerEvents: interactive ? "auto" : "none",
        }}
      >
        {children}
      </div>,
    );
  });

  useFrame(({ camera, size }) => {
    const g = anchor.current;
    if (!g || !el) return;
    tmp.setFromMatrixPosition(g.matrixWorld).project(camera);
    const x = Math.round(((tmp.x + 1) / 2) * size.width * 10) / 10;
    const y = Math.round(((1 - tmp.y) / 2) * size.height * 10) / 10;
    const t = `translate3d(${x}px,${y}px,0)`;
    if (t !== last.current) {
      el.style.transform = t;
      last.current = t;
    }
  });

  return <group ref={anchor} position={position} />;
}
