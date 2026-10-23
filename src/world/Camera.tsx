import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { routeAt, seaOffset } from "@/grid/archipelago";
import { tripRoute } from "./Voyage";
import { hexToWorld } from "@/grid/hex";
import { useWorldStore } from "@/store/world";
import { dragState } from "./dragState";
import { clamp01, easeInOutCubic, travelFrame, useFx } from "./fx";
import { cameraFocus } from "./Voyage";
import { PLAZA_ZOOM, focusOf } from "@/grid/plaza";

/** How far the camera pulls back mid-voyage (fraction of normal zoom). */
const SEA_ZOOM = 0.42;

const DEG = Math.PI / 180;
const ELEVATION = 35 * DEG;
const AZIMUTH = 45 * DEG;
const MAX_ORBIT = 30 * DEG;
const ZOOM_MIN = 0.8;
const ZOOM_MAX = 1.6;
const SWEEP = 20 * DEG;
const SWEEP_SECONDS = 4;
const DISTANCE = 40;
/** World units that should fit across the shorter visible dimension at zoom 1. */
const FIT_W = 22.5;
const FIT_H = 16;

/**
 * The whole camera: fixed orthographic angle, scroll zoom 0.8–1.6, drag orbit ±30° that springs back,
 * a one-time 20° intro sweep, and a 10% nudge toward the selected building.
 */
export function CameraRig({ panelOpen }: { panelOpen: boolean }) {
  const { camera, gl, size } = useThree();
  const epoch = useWorldStore((s) => s.epoch);
  const state = useRef({
    zoom: 1,
    zoomTarget: 1,
    orbit: 0,
    orbitVel: 0,
    dragging: false,
    lastX: 0,
    downX: 0,
    downY: 0,
    introStart: performance.now(),
    target: new THREE.Vector3(),
    /** Where the camera was when the current trip began, so the departure starts from here. */
    travelFrom: null as THREE.Vector3 | null,
    travelZoom0: 1,
    lastWorld: "",
    /** 0..1 spring: 1 while a building's panel is open, so the camera can swoop in. */
    focus: 0,
    /** 0..1 spring: 1 while zoomed into a main-gig plaza. */
    plaza: 0,
    plazaX: 0,
    plazaZ: 0,
    plazaZoom: PLAZA_ZOOM,
  });

  useEffect(() => {
    state.current.introStart = performance.now();
  }, [epoch]);

  useEffect(() => {
    const el = gl.domElement;
    const s = state.current;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      s.dragging = true;
      s.lastX = e.clientX;
      s.downX = e.clientX;
      s.downY = e.clientY;
      dragState.distance = 0;
      s.introStart = -1e9;
    };
    const onMove = (e: PointerEvent) => {
      if (!s.dragging) return;
      dragState.distance = Math.max(dragState.distance, Math.hypot(e.clientX - s.downX, e.clientY - s.downY));
      const dx = e.clientX - s.lastX;
      s.lastX = e.clientX;
      // Dragging a building or keepsake moves it, not the camera.
      const fx = useFx.getState();
      if (fx.press || fx.moving || fx.keepsakePress || fx.keepsakeMove) return;
      if (dragState.distance > 4) {
        const next = s.orbit - dx * 0.28 * DEG;
        // Rubber-band past the limit.
        s.orbit = Math.abs(next) > MAX_ORBIT ? Math.sign(next) * (MAX_ORBIT + (Math.abs(next) - MAX_ORBIT) * 0.25) : next;
        s.orbit = THREE.MathUtils.clamp(s.orbit, -MAX_ORBIT * 1.15, MAX_ORBIT * 1.15);
        el.style.cursor = "grabbing";
      }
    };
    const onUp = () => {
      if (!s.dragging) return;
      s.dragging = false;
      el.style.cursor = "";
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const next = THREE.MathUtils.clamp(s.zoomTarget * Math.exp(-e.deltaY * 0.0012), ZOOM_MIN, ZOOM_MAX);
      // Zooming out to minimum while in a plaza exits the plaza
      if (next <= ZOOM_MIN && s.zoomTarget > ZOOM_MIN && e.deltaY > 0) {
        const fx = useFx.getState();
        if (fx.plazaId && !fx.placement && !fx.moving) {
          fx.setPlaza(null);
        }
      }
      s.zoomTarget = next;
    };
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      el.removeEventListener("wheel", onWheel);
    };
  }, [gl]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const s = state.current;
    const cam = camera as THREE.OrthographicCamera;

    if (!s.dragging) {
      // Critically-damped-ish spring back to 0.
      const k = 60;
      const c = 2 * Math.sqrt(k) * 0.85;
      s.orbitVel += (-k * s.orbit - c * s.orbitVel) * dt;
      s.orbit += s.orbitVel * dt;
    } else {
      s.orbitVel = 0;
    }
    s.zoom += (s.zoomTarget - s.zoom) * Math.min(1, dt * 10);

    const introT = clamp01((performance.now() - s.introStart) / 1000 / SWEEP_SECONDS);
    const sweep = introT < 1 ? -SWEEP * (1 - easeInOutCubic(introT)) : 0;
    const az = AZIMUTH + s.orbit + sweep;

    // Target: home, lifted so the town sits above the text box, nudged 10% toward the selection.
    const { selectedId, travel, plazaId } = useFx.getState();
    const store = useWorldStore.getState();
    const sel = selectedId ? store.world.buildings.find((b) => b.id === selectedId) : undefined;
    const lean = { x: Math.sin(az) * 1.0, z: Math.cos(az) * 1.0 };
    const here = seaOffset(store.order.indexOf(store.currentId));
    const goal = new THREE.Vector3(here.x + lean.x, 0, here.z + lean.z);
    let seaZoom = 1;
    let snap = false;
    const gig = !travel ? focusOf(store.world, plazaId) : null;
    if (travel && plazaId) useFx.getState().setPlaza(null);
    if (gig) {
      s.plazaX = gig.x;
      s.plazaZ = gig.z;
      s.plazaZoom = gig.zoom;
    }
    // Slow, weighted ease in and out (~1.2s), no bounce.
    s.plaza += ((gig ? 1 : 0) - s.plaza) * Math.min(1, dt * 3);
    if (s.plaza < 0.001) s.plaza = 0;
    if (!travel) s.travelFrom = null;
    if (travel) {
      // Up from wherever we were (home, or a peek) to sea level, follow the boat, then down onto the destination.
      if (!s.travelFrom) {
        s.travelFrom = s.target.clone();
        s.travelZoom0 = s.zoom;
      }
      const f = travelFrame(travel, performance.now());
      const from = seaOffset(store.order.indexOf(travel.fromId));
      const to = seaOffset(store.order.indexOf(travel.toId));
      const boat = routeAt(tripRoute(travel.fromId, travel.toId), f.boat).pos;
      const ax = THREE.MathUtils.lerp(s.travelFrom.x, boat.x, f.out);
      const az2 = THREE.MathUtils.lerp(s.travelFrom.z, boat.z, f.out);
      goal.set(THREE.MathUtils.lerp(ax, to.x + lean.x, f.back), 0, THREE.MathUtils.lerp(az2, to.z + lean.z, f.back));
      s.target.copy(goal);
      const outZoom = THREE.MathUtils.lerp(s.travelZoom0, SEA_ZOOM, f.out);
      seaZoom = THREE.MathUtils.lerp(outZoom, 1, f.back);
      if (f.done) {
        store.visit(travel.toId);
        useFx.getState().endTravel();
      }
    } else if (s.plaza > 0) {
      // Inside a plaza: aim at its center; when a piece is open, scoot the plaza clear of the panel.
      const p = easeInOutCubic(s.plaza);
      goal.x = THREE.MathUtils.lerp(goal.x, here.x + s.plazaX + lean.x * 0.12, p);
      goal.z = THREE.MathUtils.lerp(goal.z, here.z + s.plazaZ + lean.z * 0.12, p);
      s.focus += (0 - s.focus) * Math.min(1, dt * 5);
      if (sel && panelOpen) {
        const base = Math.min(size.width / FIT_W, size.height / FIT_H);
        const shift = 210 / (base * s.zoom * (1 + (s.plazaZoom - 1) * s.plaza));
        goal.x += Math.cos(az) * shift;
        goal.z += -Math.sin(az) * shift;
      }
    } else if (sel && panelOpen) {
      s.focus += (1 - s.focus) * Math.min(1, dt * 5);
      const w = hexToWorld(sel.hex);
      goal.x += w.x * (0.1 + 0.45 * s.focus);
      goal.z += w.z * (0.1 + 0.45 * s.focus);
      // Keep the town clear of the panel on the right.
      const rightX = Math.cos(az);
      const rightZ = -Math.sin(az);
      const base = Math.min(size.width / FIT_W, size.height / FIT_H);
      const shift = 210 / (base * s.zoom);
      goal.x += rightX * shift;
      goal.z += rightZ * shift;
    } else {
      s.focus += (0 - s.focus) * Math.min(1, dt * 5);
    }
    // A jump between worlds (first load) cuts straight there instead of gliding across the sea.
    if (s.lastWorld !== store.currentId) {
      if (!travel) snap = true;
      s.lastWorld = store.currentId;
    }
    if (snap) s.target.copy(goal);
    if (!travel) {
      const moving = s.plaza > 0.002 && s.plaza < 0.995;
      s.target.lerp(goal, Math.min(1, dt * (moving ? 2.4 : 4)));
    }
    cameraFocus.copy(s.target);

    cam.position.set(
      s.target.x + Math.sin(az) * Math.cos(ELEVATION) * DISTANCE,
      s.target.y + Math.sin(ELEVATION) * DISTANCE,
      s.target.z + Math.cos(az) * Math.cos(ELEVATION) * DISTANCE,
    );
    cam.lookAt(s.target);
    const base = Math.min(size.width / FIT_W, size.height / FIT_H);
    const z = base * s.zoom * seaZoom * (1 + s.focus * 0.26) * (1 + (s.plazaZoom - 1) * easeInOutCubic(s.plaza));
    if (Math.abs(cam.zoom - z) > 1e-4) {
      cam.zoom = z;
      cam.updateProjectionMatrix();
    }
  });

  return null;
}
