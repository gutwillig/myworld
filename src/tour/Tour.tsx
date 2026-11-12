import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Compass, Maximize2, X } from "lucide-react";
import { HUB_FOCUS, clientsOf, districtMembers, focusOf } from "@/grid/plaza";
import type { Building, World } from "@/store/types";
import { useWorldStore } from "@/store/world";
import { useFx } from "@/world/fx";
import { Reel, Scrapbook, Studio } from "@/showcase/ShowcaseOverlay";
import { videoOf } from "@/showcase/media";
import styles from "./tour.module.css";

type StopKey = keyof typeof HUB_FOCUS;
type Stop = { id: string; key: StopKey; eyebrow: string; title: string; line: string; buildings: Building[] };
type Phase = "off" | "start" | "touring" | "end";

const ORDER: StopKey[] = ["gig", "side", "fun", "old"];

/** The tour's stops in order, skipping scenes that don't exist or are empty. */
function stopsFor(world: World): Stop[] {
  const stops: Stop[] = [];
  for (const key of ORDER) {
    const id = HUB_FOCUS[key];
    const f = focusOf(world, id);
    if (!f || f.empty) continue;
    const buildings =
      key === "gig"
        ? f.gig
          ? [f.gig, ...clientsOf(world.buildings, f.gig.id)]
          : []
        : key === "old"
          ? world.buildings.filter((b) => b.status === "past" && !b.parentId)
          : districtMembers(world, key);
    const places = `${buildings.length} ${buildings.length === 1 ? "place" : "places"}`;
    const line = key === "gig" ? f.gig?.oneLiner?.trim() || places : places;
    // The main gig's own name is the HQ's; call the area "Main gig" so it doesn't just repeat it.
    const title = key === "gig" ? "Main gig" : f.title;
    if (buildings.length) stops.push({ id, key, eyebrow: f.eyebrow, title, line, buildings });
  }
  return stops;
}

/** "Side quests · 2 of 5" for the building the tour is on, for its sign in the scene. */
export function tourLabelOf(world: World, id: string): string | null {
  for (const st of stopsFor(world)) {
    const i = st.buildings.findIndex((b) => b.id === id);
    if (i >= 0) return `${st.title} \u00b7 ${i + 1} of ${st.buildings.length}`;
  }
  return null;
}

/** The building's showcase (reel / studio / scrapbook) or, without one, its line and links. */
function Media({ b }: { b: Building }) {
  const sc = b.showcase;
  const video = videoOf(b);
  if (sc?.template === "studio") return <Studio tagline={sc.tagline} cover={sc.cover} cases={sc.cases} />;
  if (sc?.template === "scrapbook") return <Scrapbook tagline={sc.tagline} shots={sc.shots} />;
  if (sc?.template === "reel" || video) return <Reel tagline={sc?.tagline ?? ""} embed={video} />;
  return (
    <div className={styles.plain}>
      <p className={styles.plainLine}>{b.oneLiner?.trim() || "No description yet."}</p>
      {b.links.length > 0 && (
        <div className={styles.chips}>
          {b.links.map((l) => (
            <a key={l.url} className={styles.chip} href={l.url} target="_blank" rel="noreferrer">
              {l.label} <ArrowUpRight size={13} strokeWidth={2.4} aria-hidden />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

type Props = {
  /** Bumped by the header's Tour button: starts the tour over from the first stop. */
  restart: number;
  onActiveChange: (active: boolean) => void;
};

/** Guided tour of a world: a start screen, then stop by stop, building by building. */
export function Tour({ restart, onActiveChange }: Props) {
  const world = useWorldStore((s) => s.world);
  const currentId = useWorldStore((s) => s.currentId);
  const selectedId = useFx((s) => s.selectedId);
  const traveling = useFx((s) => !!s.travel);
  const [phase, setPhase] = useState<Phase>("off");
  const [stopIdx, setStopIdx] = useState(0);
  const [bIdx, setBIdx] = useState(0);
  const stops = useMemo(() => stopsFor(world), [world]);
  const stop = stops[stopIdx];
  const spot = stop?.buildings[bIdx];

  useEffect(() => {
    onActiveChange(phase !== "off");
  }, [phase, onActiveChange]);

  // On page load: offer the tour if there's anything to see.
  const offered = useRef(false);
  useEffect(() => {
    if (offered.current) return;
    offered.current = true;
    if (world.buildings.length > 0) setPhase("start");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enter = useCallback(
    (i: number, b = 0) => {
      const s = stops[i];
      if (!s) return;
      const fx = useFx.getState();
      fx.setPlaza(s.id);
      const at = Math.max(0, Math.min(b, s.buildings.length - 1));
      fx.setTourId(s.buildings[at]?.id ?? null);
      setStopIdx(i);
      setBIdx(at);
    },
    [stops],
  );

  const begin = useCallback(() => {
    if (!stops.length) {
      setPhase("off");
      return;
    }
    setPhase("touring");
    enter(0);
  }, [stops.length, enter]);

  const exit = useCallback(() => {
    const fx = useFx.getState();
    fx.setPlaza(null);
    fx.setTourId(null);
    setPhase("off");
  }, []);

  const finish = useCallback(() => {
    const fx = useFx.getState();
    fx.setPlaza(null);
    fx.setTourId(null);
    setPhase("end");
  }, []);

  const next = useCallback(() => {
    if (!stop) return finish();
    if (bIdx + 1 < stop.buildings.length) {
      setBIdx(bIdx + 1);
      useFx.getState().setTourId(stop.buildings[bIdx + 1].id);
    } else if (stopIdx + 1 < stops.length) enter(stopIdx + 1);
    else finish();
  }, [stop, bIdx, stopIdx, stops.length, enter, finish]);

  const back = useCallback(() => {
    if (!stop) return;
    if (bIdx > 0) {
      setBIdx(bIdx - 1);
      useFx.getState().setTourId(stop.buildings[bIdx - 1].id);
    } else if (stopIdx > 0) enter(stopIdx - 1, stops[stopIdx - 1].buildings.length - 1);
  }, [stop, bIdx, stopIdx, stops, enter]);

  const skip = useCallback(() => {
    if (stopIdx + 1 < stops.length) enter(stopIdx + 1);
    else finish();
  }, [stopIdx, stops.length, enter, finish]);

  // Header button: start over at the first stop.
  const lastRestart = useRef(restart);
  useEffect(() => {
    if (restart === lastRestart.current) return;
    lastRestart.current = restart;
    begin();
  }, [restart, begin]);

  // Flying to another world ends the tour quietly.
  const tourWorld = useRef(currentId);
  useEffect(() => {
    if (tourWorld.current === currentId) return;
    tourWorld.current = currentId;
    if (phase !== "off") {
      useFx.getState().setTourId(null);
      setPhase("off");
    }
  }, [currentId, phase]);

  // If the world changes under the tour (a stop empties out), keep the indices in range.
  useEffect(() => {
    if (phase !== "touring") return;
    if (!stops.length) return exit();
    if (stopIdx >= stops.length) enter(stops.length - 1);
    else if (bIdx >= stops[stopIdx].buildings.length) enter(stopIdx, stops[stopIdx].buildings.length - 1);
  }, [phase, stops, stopIdx, bIdx, enter, exit]);

  useEffect(() => () => useFx.getState().setTourId(null), []);

  useEffect(() => {
    if (phase === "off" || traveling) return;
    const onKey = (e: KeyboardEvent) => {
      if (useFx.getState().selectedId) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const go = e.key === "ArrowRight" || e.key === " " || e.key === "Enter";
      if (phase === "start") {
        if (go) {
          e.preventDefault();
          begin();
        } else if (e.key === "Escape") {
          e.preventDefault();
          setPhase("off");
        }
        return;
      }
      if (phase === "end") {
        if (e.key === "Escape") {
          e.preventDefault();
          setPhase("off");
        }
        return;
      }
      if (t?.closest("a, button") && (e.key === " " || e.key === "Enter")) return;
      if (go) {
        e.preventDefault();
        e.stopImmediatePropagation();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopImmediatePropagation();
        back();
      } else if (e.key === "Escape") {
        e.preventDefault();
        exit();
      }
    };
    // Capture phase: the tour owns the arrow keys, so a scrapbook in the panel doesn't flip too.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [phase, traveling, begin, next, back, exit]);

  if (phase === "off" || traveling) return null;

  if (phase === "start") {
    return (
      <div className={styles.start} role="dialog" aria-label="Tour">
        <div className={styles.startInner}>
          <span className={styles.startEyebrow}>Welcome to</span>
          <h1 className={styles.startTitle}>{`${world.ownerName}\u2019s World`}</h1>
          <button type="button" className={styles.startBtn} onClick={begin} autoFocus>
            Start
          </button>
          <span className={styles.startKeys}>Press Enter or Space</span>
          <button type="button" className={styles.startSkip} onClick={() => setPhase("off")}>
            Explore on my own
          </button>
        </div>
      </div>
    );
  }

  if (phase === "end") {
    return (
      <div className={styles.endWrap}>
        <div className={styles.end} role="dialog" aria-label="Tour finished">
          <Compass size={26} strokeWidth={2} className={styles.endIcon} aria-hidden />
          <h2 className={styles.endTitle}>{`That\u2019s ${world.ownerName}\u2019s world`}</h2>
          <div className={styles.endActions}>
            <button type="button" className={styles.ghost} onClick={() => setPhase("off")}>
              Explore freely
            </button>
            <button type="button" className={styles.primary} onClick={begin}>
              Replay
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!stop || !spot || selectedId) return null;
  const nextStop = stops[stopIdx + 1];
  const atEnd = !nextStop && bIdx === stop.buildings.length - 1;
  const canBack = stopIdx > 0 || bIdx > 0;

  return (
    <aside className={styles.panel} role="region" aria-label="Tour">
      <div className={styles.progress}>
        <ol className={styles.segs} aria-label={`Area ${stopIdx + 1} of ${stops.length}`}>
          {stops.map((st, i) => (
            <li key={st.id} className={`${styles.seg} ${i === stopIdx ? styles.segOn : i < stopIdx ? styles.segDone : ""}`}>
              <button type="button" onClick={() => enter(i)} aria-current={i === stopIdx ? "step" : undefined}>
                <span className={styles.segBar} />
                <span className={styles.segLabel}>{st.title}</span>
              </button>
            </li>
          ))}
        </ol>
        <button type="button" className={styles.exit} onClick={exit} aria-label="Exit tour" title="Exit tour (Esc)">
          <X size={18} strokeWidth={2.4} aria-hidden />
        </button>
      </div>

      <header className={styles.head} key={`h-${spot.id}`}>
        <span className={styles.eyebrow}>{stop.title}</span>
        <h2 className={styles.name}>{spot.name}</h2>
        <button type="button" className={styles.open} onClick={() => useFx.getState().select(spot.id)}>
          <Maximize2 size={14} strokeWidth={2.4} aria-hidden /> Open full page
        </button>
      </header>

      <div className={styles.media} key={`m-${spot.id}`}>
        <Media b={spot} />
      </div>

      <footer className={styles.foot}>
        <div className={styles.where}>
          <span className={styles.pips} aria-hidden>
            {stop.buildings.map((b, i) => (
              <span key={b.id} className={`${styles.pip} ${i === bIdx ? styles.pipOn : i < bIdx ? styles.pipDone : ""}`} />
            ))}
          </span>
          <span className={styles.count}>{`${bIdx + 1} of ${stop.buildings.length} in ${stop.title}`}</span>
          <button type="button" className={styles.skip} onClick={skip}>
            {nextStop ? `Skip to ${nextStop.title}` : "Skip to the end"}
          </button>
        </div>
        <div className={styles.controls}>
          <button type="button" className={styles.ghost} onClick={back} disabled={!canBack}>
            <ArrowLeft size={16} strokeWidth={2.4} aria-hidden /> Back
          </button>
          <button type="button" className={styles.primary} onClick={next}>
            {atEnd ? "Finish" : "Next"} <ArrowRight size={18} strokeWidth={2.4} aria-hidden />
          </button>
        </div>
      </footer>
    </aside>
  );
}

/** Small header button that (re)starts the tour. */
export function TourButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className={styles.headerBtn} onClick={onClick}>
      <Compass size={17} strokeWidth={2.2} aria-hidden /> Tour
    </button>
  );
}
