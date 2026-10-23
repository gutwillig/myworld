import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Plane, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BuildingIcon } from "@/buildings/BuildingIcon";
import { buildingAccent } from "@/buildings/kit";
import { ferryRoute, routeLength, seaOffset } from "@/grid/archipelago";
import { Avatar } from "@/panel/fields";
import type { Building, World } from "@/store/types";
import { useWorldStore } from "@/store/world";
import { type VisitIntent, useFx } from "@/world/fx";
import { worldPath } from "@/app/NeighborsMenu";
import { IslandDiorama } from "./IslandDiorama";
import { sharedBuilding, worldForResident } from "./residents";
import styles from "./visit.module.css";

/** Ms on the wide island shot before the camera pushes into the first building. */
const OVERVIEW_MS = 1300;
/** Ms on each featured building before moving to the next. */
const STOP_MS = 2300;
/** At most four buildings get the close-up, so a full loop stays around 10s. */
const MAX_STOPS = 4;

/** Opens when you click a resident; unmounts (and resets) when it closes. */
export function VisitPreview() {
  const intent = useFx((s) => s.visit);
  if (!intent) return null;
  return <VisitOverlay key={`${intent.fromWorldId}:${intent.buildingId ?? intent.worldId}:${intent.resident}`} intent={intent} />;
}

type Facts = {
  /** The building you came from; absent when the visit started from the Neighbors menu. */
  building: Building | undefined;
  target: World | undefined;
  shared: Building | undefined;
  /** Name to show for the resident's world, even before it exists. */
  owner: string;
  sailSeconds: number;
};

function VisitOverlay({ intent }: { intent: VisitIntent }) {
  const navigate = useNavigate();
  const worlds = useWorldStore((s) => s.worlds);
  const order = useWorldStore((s) => s.order);
  const homeId = useWorldStore((s) => s.homeId);
  const currentId = useWorldStore((s) => s.currentId);
  const [leaving, setLeaving] = useState<boolean>(false);

  const fromNeighbors = !!intent.worldId;
  const building = intent.buildingId ? worlds[intent.fromWorldId]?.buildings.find((b) => b.id === intent.buildingId) : undefined;
  const target = intent.worldId ? worlds[intent.worldId] : worldForResident(worlds, order, homeId, intent.resident);
  const shared = target && building ? sharedBuilding(target, building.name) : undefined;
  const owner = target?.ownerName ?? intent.resident.trim().split(/\s+/)[0] ?? intent.resident;
  const targetIndex = target ? order.indexOf(target.id) : order.length;

  const sailSeconds = useMemo(() => {
    const from = seaOffset(order.indexOf(currentId));
    const to = seaOffset(targetIndex);
    return Math.round(Math.min(6, Math.max(2.8, routeLength(ferryRoute(from, to)) / 13)) + 2);
  }, [order, currentId, targetIndex]);

  const close = useCallback(() => {
    useFx.getState().openVisit(null);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  // The building (or neighbor's world) disappeared under us.
  const gone = fromNeighbors ? !target : !building;
  useEffect(() => {
    if (gone && !leaving) close();
  }, [gone, leaving, close]);
  if (gone) return null;

  // Visits are read-only: you land on their island as a guest, nothing of yours follows.
  const go = () => {
    const fx = useFx.getState();
    const store = useWorldStore.getState();
    const dest = target ?? store.createWorld(owner);
    if (shared) {
      fx.setArrivalNote({
        worldId: dest.id,
        text: `${dest.ownerName}\u2019s world \u00b7 you\u2019re both at ${shared.name}`,
      });
    }
    setLeaving(true);
    fx.select(null);
    fx.openVisit(null);
    navigate(worldPath(dest, store.homeId));
  };

  const facts: Facts = { building, target, shared, owner, sailSeconds };
  return (
    <div className={styles.root} role="dialog" aria-modal="true" aria-label={`Visit ${owner}\u2019s world`}>
      <button type="button" className={styles.scrim} aria-label="Close" onClick={close} />
      <Postcard key="postcard" facts={facts} onGo={go} onClose={close} />
    </div>
  );
}

/** The buildings the postcard tours: the place you share first, then the ones holding real work. */
function tourOf(target: World | undefined, shared: Building | undefined): Building[] {
  if (!target) return [];
  const rank = (b: Building): number => (b.id === shared?.id ? 0 : b.showcase || b.links.length > 0 ? 1 : 2);
  return [...target.buildings]
    .sort((a, b) => rank(a) - rank(b) || b.createdAt - a.createdAt)
    .slice(0, MAX_STOPS);
}

function Postcard({ facts, onGo, onClose }: { facts: Facts; onGo: () => void; onClose: () => void }) {
  const { target, owner, shared, building, sailSeconds } = facts;
  const tour = useMemo(() => tourOf(target, shared), [target, shared]);
  // -1 is the wide island shot; 0..n are the close-ups on each featured building.
  const [stop, setStop] = useState<number>(-1);
  const [paused, setPaused] = useState<boolean>(false);

  useEffect(() => {
    setStop(-1);
  }, [tour]);

  useEffect(() => {
    if (tour.length === 0) return;
    const iv = window.setInterval(() => {
      if (!paused && !document.hidden) setStop((s) => ((s + 2) % (tour.length + 1)) - 1);
    }, stop === -1 ? OVERVIEW_MS : STOP_MS);
    return () => window.clearInterval(iv);
  }, [tour.length, paused, stop]);

  const focused = stop >= 0 ? tour[stop] : undefined;

  return (
    <div className={`${styles.card} ${styles.postcard}`}>
      <div className={styles.dio} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        {target ? (
          <IslandDiorama world={target} highlightId={focused?.id ?? shared?.id} focusId={focused?.id} width={440} height={250} />
        ) : (
          <div className={styles.emptySea}>
            <span className={styles.emptyIsle} aria-hidden />
            <span>Open water, for now</span>
          </div>
        )}
        <span className={styles.stamp} aria-hidden>
          <Avatar name={owner} size={30} />
          <span className={styles.stampText}>{owner.toUpperCase()}</span>
        </span>
        {focused && (
          <div className={styles.peek} key={focused.id}>
            <span className={styles.peekEyebrow}>Inside {focused.name}</span>
            {focused.oneLiner && <span className={styles.peekLiner}>{focused.oneLiner}</span>}
            {focused.links.length > 0 && (
              <span className={styles.peekLinks}>
                {focused.links.slice(0, 2).map((l) => (
                  <a key={l.url} className={styles.peekLink} href={l.url} target="_blank" rel="noreferrer">
                    {l.label}
                    <ArrowUpRight size={12} strokeWidth={2.4} aria-hidden />
                  </a>
                ))}
              </span>
            )}
          </div>
        )}
        <button type="button" className={styles.cardX} onClick={onClose} aria-label="Close">
          <X size={18} strokeWidth={2.2} />
        </button>
      </div>
      <div className={styles.body}>
        <p className={styles.eyebrow}>{building ? `Resident of ${building.name}` : "Your neighbor"}</p>
        <h2 className={styles.title}>{target ? `${owner}\u2019s world` : `Start ${owner}\u2019s world?`}</h2>
        <p className={styles.meta}>{worldMeta(target)}</p>
        {target && target.buildings.length > 0 && (
          <ul className={styles.chips}>
            {target.buildings.slice(0, 6).map((b) => (
              <li key={b.id} className={`${styles.chip} ${b.id === shared?.id ? styles.chipShared : ""} ${b.status === "past" ? styles.chipPast : ""}`}>
                <BuildingIcon type={b.type} style={b.style} accent={buildingAccent(b)} faded={b.status === "past"} size={22} />
                {b.name}
              </li>
            ))}
          </ul>
        )}
        {shared && building && (
          <div className={styles.shared}>
            <span className={styles.sharedIcons} aria-hidden>
              <BuildingIcon type={building.type} style={building.style} accent={buildingAccent(building)} size={34} />
              <BuildingIcon type={shared.type} style={shared.style} accent={buildingAccent(shared)} size={34} />
            </span>
            <span>
              You&rsquo;re both at <strong>{shared.name}</strong>
              <span className={styles.sharedSub}>The beacon marks it on {owner}&rsquo;s island</span>
            </span>
          </div>
        )}
        <div className={styles.actions}>
          <button type="button" className={styles.quiet} onClick={onClose}>
            Not now
          </button>
          <button type="button" className={styles.primary} onClick={onGo} autoFocus>
            <Plane size={18} strokeWidth={2.2} aria-hidden />
            {target ? "Fly over" : "Start it & fly over"}
            <span className={styles.primaryMeta}>~{sailSeconds}s</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function worldMeta(w: World | undefined): string {
  if (!w) return "Not started yet";
  const past = w.buildings.filter((b) => b.status === "past").length;
  const now = w.buildings.length - past;
  if (!w.buildings.length) return "An empty island";
  return past ? `${plural(now, "building")} \u00b7 ${past} in Old Town` : plural(now, "building");
}

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
