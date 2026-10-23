import { memo, useMemo, useRef, useState } from "react";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { type Hex, hexToWorld } from "@/grid/hex";
import { OLD_TOWN_ANCHOR, hubsFor } from "@/grid/layout";
import { HUB_FOCUS, SPOT_MAX, districtMembers, isGig } from "@/grid/plaza";
import { groundHeight, terrainProfile } from "@/grid/terrainProfile";
import type { World } from "@/store/types";
import { wasDrag } from "./dragState";
import { useFx } from "./fx";
import { boundaryRadii, radiusAt } from "./islandShape";
import { DISTRICT_TINT } from "./Roads";
import { SceneLabel } from "./SceneLabel";
import styles from "./signs.module.css";

type RealmKind = "gig" | "side" | "fun" | "old";
type Site = { x: number; z: number; w: number; realm: number; anchor?: boolean };
const BUILDING_W = 1.7 * 1.7; // a building's own pull on the map
const PAD = 1.0; // minimum clearance between a building and any realm border
type Realm = { kind: RealmKind; focus: string; name: string; tint: string; count: number; anchor: { x: number; z: number } };
type P2 = { x: number; z: number };
/** A convex cell; lab[i] tags the edge pts[i]→pts[i+1]: the site across it, or -1 for the coast. */
type Cell = { pts: P2[]; lab: number[]; site: number };

const NAMES: Record<RealmKind, string> = { gig: "Main gig", side: "Side hustles", fun: "For fun", old: "Old Town" };
const TINT: Record<RealmKind, string> = { ...DISTRICT_TINT, old: "#A08670" };
const PX = 40; // mask pixels per world unit
const PEAK = 0.82; // wash opacity on the highlighted realm
const BORDER = 0.75; // resting opacity of the border lines

/** Clip a labelled convex polygon to the half-plane a·p <= c; the new edge is tagged `tag`. */
function clip(poly: { pts: P2[]; lab: number[] }, ax: number, az: number, c: number, tag: number) {
  const pts: P2[] = [];
  const lab: number[] = [];
  const n = poly.pts.length;
  for (let i = 0; i < n; i++) {
    const p = poly.pts[i];
    const q = poly.pts[(i + 1) % n];
    const dp = ax * p.x + az * p.z - c;
    const dq = ax * q.x + az * q.z - c;
    const cross = () => {
      const t = dp / (dp - dq);
      return { x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t };
    };
    if (dp <= 0) {
      pts.push(p);
      lab.push(poly.lab[i]);
      if (dq > 0) {
        pts.push(cross());
        lab.push(tag);
      }
    } else if (dq <= 0) {
      pts.push(cross());
      lab.push(poly.lab[i]);
    }
  }
  return { pts, lab };
}

function inside(pts: P2[], x: number, z: number): boolean {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) hit = !hit;
  }
  return hit;
}

/**
 * Theme-park realms: the whole island is split into four polygon realms (Main gig, Side hustles,
 * For fun, Old Town). Borders are a weighted Voronoi of each realm's hub and its places, so a realm
 * swells as it fills up. One realm is always lit; clicking anywhere in the lit realm steps into it.
 */
export const Realms = memo(function Realms({ world, interactive }: { world: World; interactive: boolean }) {
  const { realms, sites } = useMemo(() => {
    const hubs = hubsFor(world.terrain);
    const gig = world.buildings.find(isGig);
    const past = world.buildings.filter((b) => b.status === "past" && !b.parentId);
    const groups: Record<RealmKind, Hex[]> = {
      gig: gig ? [gig.hex] : [],
      side: districtMembers(world, "side").map((b) => b.hex),
      fun: districtMembers(world, "fun").map((b) => b.hex),
      old: past.map((b) => b.hex),
    };
    const anchors: Record<RealmKind, Hex> = { gig: gig?.hex ?? hubs.gig, side: hubs.side, fun: hubs.fun, old: OLD_TOWN_ANCHOR };
    const clients = gig ? world.buildings.filter((b) => b.parentId === gig.id).length : 0;
    const realms: Realm[] = [];
    const sites: Site[] = [];
    (["gig", "side", "fun", "old"] as RealmKind[]).forEach((kind) => {
      // Side hustles and For fun only claim land once something stands there.
      if ((kind === "side" || kind === "fun") && groups[kind].length === 0) return;
      const i = realms.length;
      const count = groups[kind].length + (kind === "gig" ? Math.ceil(clients / 3) : 0);
      const a = hexToWorld(anchors[kind]);
      realms.push({ kind, focus: kind === "gig" && gig ? gig.id : HUB_FOCUS[kind], name: NAMES[kind], tint: TINT[kind], count, anchor: a });
      // Default reach ~2.4 units; every structure pushes the border out a little (capped).
      const reach = Math.min(kind === "gig" ? 5 : 4.2, (kind === "gig" && gig ? SPOT_MAX + 0.7 : 2.4) + 0.3 * count);
      sites.push({ ...a, w: reach * reach, realm: i, anchor: true });
      for (const h of groups[kind]) sites.push({ ...hexToWorld(h), w: BUILDING_W, realm: i });
      if (kind === "gig" && gig) {
        const c = hexToWorld(gig.hex);
        for (const k of world.buildings) if (k.parentId === gig.id && k.spot) sites.push({ x: c.x + k.spot.x, z: c.z + k.spot.z, w: BUILDING_W, realm: i });
      }
    });
    // The house in the middle belongs to whichever realm already holds that spot, and gets the same clearance.
    if (sites.length) {
      const owner = sites.reduce((o, t) => (t.x * t.x + t.z * t.z - t.w < o.x * o.x + o.z * o.z - o.w ? t : o));
      sites.push({ x: 0, z: 0, w: BUILDING_W, realm: owner.realm });
    }
    // Keep every border at least PAD clear of a building: cap any foreign hub's pull so it can't
    // reach inside that ring (power distance at the ring's near edge stays below the hub's).
    for (const s of sites) {
      if (!s.anchor) continue;
      for (const b of sites) {
        if (b.anchor || b.realm === s.realm) continue;
        const gap = Math.max(0, Math.hypot(s.x - b.x, s.z - b.z) - PAD);
        s.w = Math.min(s.w, gap * gap - PAD * PAD + BUILDING_W - 0.05);
      }
    }
    return { realms, sites };
  }, [world]);

  const { cells, outline, extent } = useMemo(() => {
    const radii = boundaryRadii(world.id);
    const p = terrainProfile(world.terrain);
    const outline: P2[] = Array.from({ length: 72 }, (_, i) => {
      const a = (i / 72) * Math.PI * 2;
      const r = radiusAt(radii, a) * 0.96;
      return { x: Math.cos(a) * r, z: Math.sin(a) * r };
    });
    let land = { pts: outline, lab: outline.map(() => -1) };
    // Realms stop at the water's edge on islands with a shore.
    if (p.shore && p.coastDir) land = clip(land, p.coastDir.x, p.coastDir.z, p.waterLine - 0.15, -1);
    const cells: Cell[] = sites.map((si, i) => {
      let poly = land;
      sites.forEach((sj, j) => {
        if (i === j) return;
        // Power bisector: |p-si|²-wi <= |p-sj|²-wj
        const ax = 2 * (sj.x - si.x);
        const az = 2 * (sj.z - si.z);
        const c = sj.x * sj.x + sj.z * sj.z - si.x * si.x - si.z * si.z - sj.w + si.w;
        poly = clip(poly, ax, az, c, j);
      });
      return { ...poly, site: i };
    });
    return { cells: cells.filter((c) => c.pts.length >= 3), outline: land.pts, extent: Math.ceil(Math.max(...radii)) + 1 };
  }, [sites, world.id, world.terrain]);

  const realmAt = useMemo(
    () =>
      (x: number, z: number): number => {
        if (!inside(outline, x, z)) return -1;
        let best = -1;
        let bestD = Infinity;
        for (const s of sites) {
          const d = (x - s.x) ** 2 + (z - s.z) ** 2 - s.w;
          if (d < bestD) {
            bestD = d;
            best = s.realm;
          }
        }
        return best;
      },
    [sites, outline],
  );

  // Vector-drawn masks: one wash per realm (fill + its own outline) and one shared border layer.
  const { textures, borderTex, labels } = useMemo(() => {
    const n = extent * 2 * PX;
    const toPx = (v: P2) => [(v.x + extent) * PX, (v.z + extent) * PX] as const;
    const canvas = () => {
      const c = document.createElement("canvas");
      c.width = c.height = n;
      return c;
    };
    const tex = (c: HTMLCanvasElement) => {
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    };
    const edges = (cell: Cell, keep: (other: number) => boolean, ctx: CanvasRenderingContext2D) => {
      cell.pts.forEach((a, i) => {
        const lab = cell.lab[i];
        if (!keep(lab)) return;
        const b = cell.pts[(i + 1) % cell.pts.length];
        ctx.moveTo(...toPx(a));
        ctx.lineTo(...toPx(b));
      });
    };
    const realmOfSite = (j: number) => (j < 0 ? -1 : sites[j].realm);
    const textures = realms.map((_, k) => {
      const c = canvas();
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "rgba(255,255,255,0.68)";
      for (const cell of cells) {
        if (sites[cell.site].realm !== k) continue;
        ctx.beginPath();
        cell.pts.forEach((v, i) => (i ? ctx.lineTo(...toPx(v)) : ctx.moveTo(...toPx(v))));
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.68)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.beginPath();
      for (const cell of cells) if (sites[cell.site].realm === k) edges(cell, (o) => realmOfSite(o) !== k, ctx);
      ctx.strokeStyle = "#ffffff";
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.lineWidth = PX * 0.12;
      ctx.stroke();
      return tex(c);
    });
    // Shared borders: only between different realms, drawn once.
    const bc = canvas();
    const bctx = bc.getContext("2d")!;
    bctx.beginPath();
    for (const cell of cells) {
      const k = sites[cell.site].realm;
      edges(cell, (o) => o >= 0 && sites[o].realm !== k && o > cell.site, bctx);
    }
    bctx.lineCap = "round";
    bctx.setLineDash([PX * 0.22, PX * 0.16]);
    bctx.strokeStyle = "rgba(251,251,244,0.95)";
    bctx.lineWidth = PX * 0.06;
    bctx.stroke();
    // Name spot: deep inside the realm and clear of its buildings and their floating signs.
    const labels = realms.map((rm, k) => {
      const mine = sites.filter((s) => s.realm === k);
      let best = { x: rm.anchor.x, z: rm.anchor.z, s: -Infinity };
      for (let z = -extent; z <= extent; z += 0.25)
        for (let x = -extent; x <= extent; x += 0.25) {
          if (realmAt(x, z) !== k) continue;
          let edgeD = 1.5;
          outer: for (let r = 0.25; r < 1.5; r += 0.25)
            for (let a = 0; a < 8; a++)
              if (realmAt(x + Math.cos(a * 0.785) * r, z + Math.sin(a * 0.785) * r) !== k) {
                edgeD = r;
                break outer;
              }
          const occupied = mine.length > 1 || rm.count > 0;
          const siteD = occupied
            ? Math.min(
                ...mine.map((s) => Math.hypot(x - s.x, z - s.z) - 0.9),
                ...mine.map((s) => Math.hypot(x - s.x + 1.3, z - s.z + 1.3) - 0.9),
              )
            : 2 - Math.hypot(x - rm.anchor.x, z - rm.anchor.z);
          // ...and clear of the house in the middle and its name sign.
          const homeD = Math.min(Math.hypot(x, z) - 1.4, Math.hypot(x + 1.3, z + 1.3) - 1);
          const s = Math.min(edgeD * 1.2, siteD, homeD) - Math.hypot(x, z) * 0.02;
          if (s > best.s) best = { x, z, s };
        }
      return best;
    });
    return { textures, borderTex: tex(bc), labels };
  }, [realms, sites, cells, realmAt, extent]);

  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(extent * 2, extent * 2, extent * 8, extent * 8);
    g.rotateX(-Math.PI / 2);
    const p = terrainProfile(world.terrain);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, groundHeight(p, pos.getX(i), pos.getZ(i)) + 0.045);
    g.computeVertexNormals();
    return g;
  }, [extent, world.terrain]);

  const overlay = (map: THREE.Texture, color: string) =>
    new THREE.MeshBasicMaterial({
      map,
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -8,
    });
  const mats = useMemo(() => realms.map((rm, k) => overlay(textures[k], rm.tint)), [realms, textures]);
  const borderMat = useMemo(() => overlay(borderTex, "#ffffff"), [borderTex]);
  const hitMat = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }), []);

  const group = useRef<THREE.Group>(null);
  // One realm is always lit: the busiest to start, then whichever the pointer last rested in.
  const initial = realms.reduce((best, r, i) => (r.count > realms[best].count ? i : best), 0);
  const litRef = useRef<number>(initial);
  const [lit, setLitState] = useState<number>(initial);
  const [hidden, setHidden] = useState<boolean>(false);

  const live = () => {
    const fx = useFx.getState();
    return interactive && !fx.plazaId && !fx.placement && !fx.moving && !fx.travel;
  };
  const setLit = (k: number) => {
    if (k < 0 || litRef.current === k) return;
    litRef.current = k;
    setLitState(k);
  };
  const realmOf = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    const local = group.current!.worldToLocal(e.point.clone());
    return realmAt(local.x, local.z);
  };

  useFrame((_, dt) => {
    const on = live();
    if (on === hidden) setHidden(!on);
    const k = Math.min(1, dt * 9);
    mats.forEach((m, i) => {
      const want = on && litRef.current === i ? PEAK : 0;
      m.opacity += (want - m.opacity) * k;
    });
    borderMat.opacity += ((on ? BORDER : 0) - borderMat.opacity) * k;
  });

  if (!realms.length) return null;
  return (
    <group ref={group}>
      {mats.map((m, k) => (
        <mesh key={realms[k].kind} geometry={geo} material={m} raycast={() => null} renderOrder={1} />
      ))}
      <mesh geometry={geo} material={borderMat} raycast={() => null} renderOrder={2} />
      <mesh
        geometry={geo}
        material={hitMat}
        onPointerMove={(e) => {
          if (!live()) return;
          const k = realmOf(e);
          setLit(k);
          if (e.intersections[0]?.object === e.object) document.body.style.cursor = k >= 0 ? "zoom-in" : "";
        }}
        onPointerOut={() => {
          if (!useFx.getState().moving) document.body.style.cursor = "";
        }}
        onClick={(e) => {
          if (!live() || wasDrag()) return;
          const k = realmOf(e);
          if (k < 0) return;
          e.stopPropagation();
          const fx = useFx.getState();
          // With a panel or note open, a ground click just closes it.
          if (fx.selectedId || fx.keepsakeEdit) {
            fx.select(null);
            if (fx.keepsakeEdit) fx.editKeepsake(null);
            return;
          }
          // Touch has no hover: the first tap lights a realm, the next tap in it steps in.
          if (k !== litRef.current) {
            setLit(k);
            return;
          }
          fx.setPlaza(realms[k].focus);
          document.body.style.cursor = "";
        }}
      />
      {interactive &&
        realms.map((rm, k) => {
          const l = labels[k];
          const y = groundHeight(terrainProfile(world.terrain), l.x, l.z) + 0.05;
          return (
            <SceneLabel key={rm.kind} position={[l.x, y, l.z]} zIndex={4}>
              <div
                className={styles.realmName}
                data-on={lit === k ? "" : undefined}
                data-hidden={hidden ? "" : undefined}
                style={{ ["--realm" as string]: rm.tint }}
              >
                {rm.name}
              </div>
            </SceneLabel>
          );
        })}
    </group>
  );
});
