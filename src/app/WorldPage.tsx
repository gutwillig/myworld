import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Hand, Home as HomeIcon, Plane } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ferryRoute, routeLength, seaOffset } from "@/grid/archipelago";
import { KeepsakesMenu } from "@/keepsakes/KeepsakesMenu";
import { useCanEdit } from "@/lib/ownership";
import { PromptBar } from "@/loop/PromptBar";
import { useAuthStore } from "@/store/auth";
import { BuildingPanel } from "@/panel/BuildingPanel";
import { ShowcaseOverlay } from "@/showcase/ShowcaseOverlay";
import type { Link, Status } from "@/store/types";
import { getWorldBySlug, useWorldStore } from "@/store/world";
import { loadWorldFromServer } from "@/store/sync";
import { worldForResident } from "@/visit/residents";
import { VisitPreview } from "@/visit/VisitPreview";
import { useFx } from "@/world/fx";
import { setLabelHost } from "@/world/SceneLabel";
import { Brand } from "./Brand";
import { ClaimWorldBanner } from "./ClaimWorldBanner";
import { WorldChoice } from "./WorldChoice";
import { NeighborsMenu, worldPath } from "./NeighborsMenu";
import neighbors from "./neighbors.module.css";
import { WorldMenu } from "./WorldMenu";
import styles from "./world.module.css";

const WorldScene = lazy(() => import("@/world/WorldScene"));
const TIP_KEY = "myworld.tip.move";

/** The world route: full-bleed scene, brand, corner menu, prompt dock and the building panel. */
export default function WorldPage() {
  const selectedId = useFx((s) => s.selectedId);
  const select = useFx((s) => s.select);
  const world = useWorldStore((s) => s.world);
  const updateBuilding = useWorldStore((s) => s.updateBuilding);
  const setStatus = useWorldStore((s) => s.setStatus);
  const knockDown = useWorldStore((s) => s.knockDown);
  const restoreBuilding = useWorldStore((s) => s.restoreBuilding);
  const postUpdate = useWorldStore((s) => s.postUpdate);
  const removeUpdate = useWorldStore((s) => s.removeUpdate);
  const [closing, setClosing] = useState<boolean>(false);
  const [picking, setPicking] = useState<boolean>(false);
  /** The showcase opens on click; the owner can still reach the panel via Edit. */
  const [editOverride, setEditOverride] = useState<boolean>(false);
  const navigate = useNavigate();
  const { world: worldSlug } = useParams();
  const worlds = useWorldStore((s) => s.worlds);
  const homeId = useWorldStore((s) => s.homeId);
  const currentId = useWorldStore((s) => s.currentId);
  const travel = useFx((s) => s.travel);
  const moving = useFx((s) => s.moving);
  const lotHover = useFx((s) => s.lotHover);
  const visiting = useFx((s) => !!s.visit);
  const order = useWorldStore((s) => s.order);
  const started = useWorldStore((s) => s.started);
  const isHome = currentId === homeId;
  const canEdit = useCanEdit();
  const user = useAuthStore((s) => s.user);
  // Track fetch state: null = not started, "pending" = fetching, "done" = completed
  const [fetchState, setFetchState] = useState<"pending" | "done" | null>(worldSlug ? "pending" : null);

  // Look up the world by slug - first locally, then we'll fetch from server if needed
  const localWorld = worldSlug ? getWorldBySlug(worlds, worldSlug) : null;
  const targetId = worldSlug ? localWorld?.id : homeId;

  // Fetch world from server if not found locally
  useEffect(() => {
    if (!worldSlug || localWorld) {
      setFetchState(null);
      return;
    }
    if (fetchState === "done") return;

    setFetchState("pending");
    loadWorldFromServer(worldSlug).then((serverWorld) => {
      if (serverWorld) {
        const { worlds, order } = useWorldStore.getState();
        useWorldStore.setState({
          worlds: { ...worlds, [serverWorld.id]: serverWorld },
          order: [...order, serverWorld.id],
        });
        useWorldStore.getState().visit(serverWorld.id);
      }
      setFetchState("done");
    });
  }, [worldSlug, localWorld, fetchState]);

  const building = travel ? null : (world.buildings.find((b) => b.id === selectedId) ?? null);
  const panelOpen = !!building;
  const showPanel = !!building && (!building.showcase || editOverride);

  // A new selection opens the showcase again, not the panel.
  useEffect(() => {
    setEditOverride(false);
  }, [selectedId]);

  // The URL decides which world you're on. First load jumps straight there; after that, you sail.
  const firstVisit = useRef<boolean>(true);
  useLayoutEffect(() => {
    // If we're loading a world from server, wait for it
    if (worldSlug && !localWorld && fetchState === "pending") return;

    // If slug was provided but world not found locally or on server, show error
    if (worldSlug && !targetId && fetchState === "done") {
      toast("There's no world by that name yet.");
      navigate("/", { replace: true });
      return;
    }

    if (!targetId) return;
    const store = useWorldStore.getState();
    if (firstVisit.current) {
      firstVisit.current = false;
      store.visit(targetId);
      return;
    }
    if (travel || targetId === store.currentId) return;
    const from = seaOffset(store.order.indexOf(store.currentId));
    const to = seaOffset(store.order.indexOf(targetId));
    const sail = Math.min(6, Math.max(2.8, routeLength(ferryRoute(from, to)) / 13));
    useFx.getState().startTravel(store.currentId, targetId, sail);
  }, [targetId, travel, currentId, navigate, worldSlug, localWorld, fetchState]);

  // A short welcome after docking.
  const [arrived, setArrived] = useState<string | null>(null);
  const lastWorld = useRef<string>(currentId);
  useEffect(() => {
    if (lastWorld.current === currentId) return;
    lastWorld.current = currentId;
    const store = useWorldStore.getState();
    const w = store.worlds[currentId];
    if (!w) return;
    const fx = useFx.getState();
    const note = fx.arrivalNote;
    fx.setArrivalNote(null);
    setArrived(
      currentId === homeId ? "Home again" : note && note.worldId === currentId ? note.text : `Welcome to ${w.ownerName}’s world`,
    );
    const t = window.setTimeout(() => setArrived(null), 2600);
    return () => window.clearTimeout(t);
  }, [currentId, homeId]);

  useEffect(() => {
    document.title = isHome ? "My world · myworld" : `${world.ownerName}'s world · myworld`;
  }, [world.ownerName, isHome]);

  useEffect(() => {
    if (selectedId && !building && !travel && world.id === targetId) select(null);
  }, [selectedId, building, select, travel, world.id, targetId]);

  const destination = travel ? worlds[travel.toId] : undefined;
  const movingBuilding = moving ? world.buildings.find((b) => b.id === moving.id) : undefined;

  // One-time tip once there's something to move; gone after the first drag or open.
  const [tip, setTip] = useState<boolean>(() => {
    try {
      return localStorage.getItem(TIP_KEY) !== "1";
    } catch {
      return false;
    }
  });
  const dismissTip = useCallback(() => {
    setTip(false);
    try {
      localStorage.setItem(TIP_KEY, "1");
    } catch {
      /* private mode: the tip just shows again next time */
    }
  }, []);
  useEffect(() => {
    if (tip && (moving || selectedId)) dismissTip();
  }, [tip, moving, selectedId, dismissTip]);
  const showTip = tip && world.buildings.length > 0 && !panelOpen && !picking && !travel && !arrived && !moving && !visiting && started;

  const openResident = useCallback(
    (name: string) => {
      if (!building) return;
      useFx.getState().openVisit({ resident: name, buildingId: building.id, fromWorldId: currentId });
    },
    [building, currentId],
  );
  const residentHasWorld = useCallback(
    (name: string) => {
      const w = worldForResident(worlds, order, homeId, name);
      return !!w && w.id !== currentId;
    },
    [worlds, order, homeId, currentId],
  );

  const close = useCallback(() => {
    setClosing(true);
    window.setTimeout(() => {
      setClosing(false);
      select(null);
    }, 200);
  }, [select]);

  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || useFx.getState().visit) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen, close]);

  const onStatus = useCallback(
    (s: Status) => {
      if (!building) return;
      const ok = setStatus(building.id, s);
      if (!ok) toast("No free lot for that move right now.");
    },
    [building, setStatus],
  );

  const onKnockDown = useCallback(() => {
    if (!building) return;
    const snapshot = building;
    select(null);
    window.setTimeout(() => knockDown(snapshot.id), 60);
    toast(`${snapshot.name} was knocked down`, {
      action: { label: "Undo", onClick: () => restoreBuilding(snapshot) },
      duration: 5000,
    });
  }, [building, knockDown, restoreBuilding, select]);

  return (
    <main className={styles.page}>
      <div className={styles.atmosphere} aria-hidden />
      <div className={styles.canvasWrap}>
        <Suspense fallback={<div className={styles.loading}>Laying out the beach…</div>}>
          <WorldScene panelOpen={panelOpen && !closing} />
        </Suspense>
      </div>
      <div className={styles.signLayer} ref={setLabelHost} aria-live="off" />

      <header className={styles.top}>
        <Brand />
        <div className={styles.topRight}>
          {canEdit && <KeepsakesMenu />}
          <WorldMenu />
        </div>
      </header>

      {/* Neighbors floats separately in the top-right corner */}
      <div className={styles.neighborsFloat}>
        <NeighborsMenu />
      </div>

      
      {/* Authenticated user visiting another world - show Fly home */}
      {user && !isHome && !travel && (
        <div className={neighbors.visiting} key={currentId}>
          <span>
            Visiting <strong>{world.ownerName}&rsquo;s world</strong>
          </span>
          <button
            type="button"
            className={neighbors.homeBtn}
            onClick={() => {
              const home = worlds[homeId];
              if (home) navigate(worldPath(home, homeId));
            }}
          >
            <HomeIcon size={15} strokeWidth={2.2} aria-hidden /> Fly home
          </button>
        </div>
      )}

      {/* Unauthenticated visitor - show claim CTA */}
      <ClaimWorldBanner
        ownerName={world.ownerName}
        hidden={isHome || panelOpen || !!travel || !!arrived || visiting}
      />

      {world.buildings.length === 0 && !panelOpen && !picking && !travel && (
        <p className={styles.welcome} key={currentId}>
          {isHome
            ? "This is your world. Name one thing you do, and it’ll rise at the end of a road."
            : `This is ${world.ownerName}’s world. Name something they do to build it.`}
        </p>
      )}

      {travel && destination && (
        <div className={neighbors.hud} role="status" key={travel.start}>
          <div className={neighbors.hudLabel}>
            <Plane size={20} strokeWidth={2.2} aria-hidden />
            {travel.toId === homeId ? "Flying home" : `Flying to ${destination.ownerName}'s world`}
          </div>
          <div className={neighbors.track}>
            <div className={neighbors.fill} style={{ animationDuration: `${travel.duration}s` }} />
          </div>
        </div>
      )}

      {!travel && arrived && (
        <div className={neighbors.hud} role="status" key={arrived}>
          <div className={neighbors.hudLabel}>{arrived}</div>
        </div>
      )}

      {movingBuilding && (
        <div className={neighbors.hud} role="status">
          <div className={neighbors.hudLabel}>
            <Hand size={18} strokeWidth={2.2} aria-hidden />
            {lotHover
              ? `Drop to move ${movingBuilding.name} here`
              : `Moving ${movingBuilding.name} · drop on a glowing lot`}
          </div>
        </div>
      )}

      {showTip && (
        <button type="button" className={styles.tip} onClick={dismissTip}>
          <Hand size={16} strokeWidth={2.2} aria-hidden />
          Drag a building to move it · click it to change its look
          <span className={styles.tipX} aria-hidden>
            Got it
          </span>
        </button>
      )}

      <PromptBar hidden={!canEdit || panelOpen || !!travel || !!arrived || !!moving || visiting} onPickingChange={setPicking} />

      {building && showPanel && (
        <div className={`${styles.panelSlot} ${closing ? styles.panelOut : styles.panelIn}`} key={building.id}>
          <BuildingPanel
            building={building}
            flatHref={`/w/${world.slug}/${building.slug}`}
            onClose={close}
            onRename={(name) => updateBuilding(building.id, { name })}
            onOneLiner={(oneLiner) => updateBuilding(building.id, { oneLiner })}
            onStatus={onStatus}
            onLinks={(links: Link[]) => updateBuilding(building.id, { links })}
            onResidents={(residents: string[]) => updateBuilding(building.id, { residents })}
            onKnockDown={onKnockDown}
            onStyle={(style) => updateBuilding(building.id, { style })}
            onGrounds={(grounds) => updateBuilding(building.id, { grounds })}
            onAccent={(accent) => updateBuilding(building.id, { accent })}
            onShowcase={(showcase) => updateBuilding(building.id, { showcase })}
            onOpenResident={openResident}
            residentHasWorld={residentHasWorld}
            onPostUpdate={postUpdate}
            onRemoveUpdate={(updateId) => removeUpdate(building.id, updateId)}
            readOnly={!canEdit}
          />
        </div>
      )}

      {building && !showPanel && (
        <ShowcaseOverlay
          key={building.id}
          building={building}
          canEdit={canEdit}
          onClose={close}
          onEdit={() => setEditOverride(true)}
          onPostUpdate={postUpdate}
        />
      )}

      <VisitPreview />

      {!started && !worldSlug && <WorldChoice />}
    </main>
  );
}
