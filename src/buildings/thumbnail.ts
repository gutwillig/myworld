import * as THREE from "three";
import type { BuildingType } from "@/store/types";
import { PREVIEW_FACING, groundsOf } from "./grounds";
import { makeCtx } from "./kit/common";
import { styleOf } from "./styles";

let renderer: THREE.WebGLRenderer | null = null;
let failed = false;
const cache = new Map<string, string>();

function getRenderer(): THREE.WebGLRenderer | null {
  if (renderer || failed) return renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);
  } catch (err) {
    console.warn("[thumbnail] WebGL unavailable", err);
    failed = true;
    renderer = null;
  }
  return renderer;
}

export type ThumbOpts = { style?: string; grounds?: string };

const keyOf = (type: BuildingType, accent: string, size: number, faded: boolean, o: ThumbOpts): string =>
  `${type}|${o.style ?? ""}|${o.grounds ?? "-"}|${accent}|${size}|${faded ? 1 : 0}`;

/** A cached thumbnail, if one has been rendered already. */
export const cachedThumbnail = (type: BuildingType, accent: string, size: number, faded: boolean, o: ThumbOpts = {}): string | undefined =>
  cache.get(keyOf(type, accent, size, faded, o));

/**
 * Renders a building (optionally with a style and its grounds) to a transparent PNG data URL from
 * the world's camera angle. One shared offscreen renderer; results are cached.
 */
export function renderThumbnail(type: BuildingType, accent: string, size = 256, faded = false, o: ThumbOpts = {}): string | null {
  return renderObjectThumbnail(keyOf(type, accent, size, faded, o), size, () => {
    const ctx = makeCtx(accent, faded);
    const { group } = styleOf(type, o.style).build(ctx);
    if (o.grounds !== undefined) group.add(groundsOf(type, o.grounds).build(ctx, PREVIEW_FACING));
    return group;
  });
}

/**
 * Renders any low-poly group from the world's camera angle to a cached PNG data URL.
 * `key` must uniquely describe what `build` produces at this size.
 */
export function renderObjectThumbnail(key: string, size: number, build: () => THREE.Group): string | null {
  const hit = cache.get(key);
  if (hit) return hit;
  const r = getRenderer();
  if (!r) return null;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight("#DDEBF2", "#D8C6A2", 2.1));
  const sun = new THREE.DirectionalLight("#FFE8CC", 3.0);
  sun.position.set(-3, 8, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -3;
  sun.shadow.camera.right = 3;
  sun.shadow.camera.top = 3;
  sun.shadow.camera.bottom = -3;
  sun.shadow.radius = 4;
  sun.shadow.bias = -0.0008;
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: 0.16 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.001;
  ground.receiveShadow = true;
  scene.add(ground);

  const group = build();
  scene.add(group);

  const box = new THREE.Box3().setFromObject(group);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const extent = sphere.radius * 0.9;
  const cam = new THREE.OrthographicCamera(-extent, extent, extent, -extent, 0.1, 100);
  const el = THREE.MathUtils.degToRad(32);
  const az = THREE.MathUtils.degToRad(45);
  const d = 20;
  cam.position.set(
    sphere.center.x + Math.sin(az) * Math.cos(el) * d,
    sphere.center.y + Math.sin(el) * d,
    sphere.center.z + Math.cos(az) * Math.cos(el) * d,
  );
  cam.lookAt(sphere.center);

  r.setSize(size, size, false);
  r.render(scene, cam);
  const url = r.domElement.toDataURL("image/png");
  cache.set(key, url);

  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose();
  });
  ground.geometry.dispose();
  (ground.material as THREE.Material).dispose();
  sun.shadow.map?.dispose();
  return url;
}

type Job = { run: () => void };
const queue: Job[] = [];
let pumping = false;

/** Renders queued thumbnails a couple per frame so opening a panel full of tiles never stalls. */
function pump(): void {
  const start = performance.now();
  while (queue.length && performance.now() - start < 10) queue.shift()?.run();
  if (queue.length) window.requestAnimationFrame(pump);
  else pumping = false;
}

/** Queues a thumbnail render; `cb` gets the URL (or null when WebGL is unavailable). Returns a cancel. */
export function requestThumbnail(
  type: BuildingType,
  accent: string,
  size: number,
  faded: boolean,
  o: ThumbOpts,
  cb: (url: string | null) => void,
): () => void {
  let alive = true;
  const job: Job = { run: () => alive && cb(renderThumbnail(type, accent, size, faded, o)) };
  queue.push(job);
  if (!pumping) {
    pumping = true;
    window.requestAnimationFrame(pump);
  }
  return () => {
    alive = false;
    const i = queue.indexOf(job);
    if (i >= 0) queue.splice(i, 1);
  };
}

/** Queues a render of any group (see renderObjectThumbnail). Returns a cancel. */
export function requestObjectThumbnail(key: string, size: number, build: () => THREE.Group, cb: (url: string | null) => void): () => void {
  const hit = cache.get(key);
  if (hit) {
    cb(hit);
    return () => undefined;
  }
  let alive = true;
  const job: Job = { run: () => alive && cb(renderObjectThumbnail(key, size, build)) };
  queue.push(job);
  if (!pumping) {
    pumping = true;
    window.requestAnimationFrame(pump);
  }
  return () => {
    alive = false;
    const i = queue.indexOf(job);
    if (i >= 0) queue.splice(i, 1);
  };
}

/** Renders card thumbnails during idle time so the first pick feels instant. */
export function prewarmThumbnails(types: BuildingType[], accentOf: (t: BuildingType) => string, size: number): void {
  const queue = [...types];
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  const idle = (cb: () => void): void => {
    if (w.requestIdleCallback) w.requestIdleCallback(cb, { timeout: 1500 });
    else setTimeout(cb, 120);
  };
  const step = () => {
    const t = queue.shift();
    if (!t) return;
    renderThumbnail(t, accentOf(t), size);
    idle(step);
  };
  idle(step);
}
