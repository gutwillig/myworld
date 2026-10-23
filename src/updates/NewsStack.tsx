import { memo, useEffect, useMemo, useState } from "react";
import { ChevronDown, Megaphone } from "lucide-react";
import { buildingAccent } from "@/buildings/kit";
import { useWorldStore } from "@/store/world";
import { useFx } from "@/world/fx";
import { isFresh, timeAgo, townNews } from "./news";
import { UpdateComposer } from "./UpdateComposer";
import styles from "./updates.module.css";

const SHORT = 4;

/**
 * "What's new in town": the town's latest lines, newest first, under the brand. Hovering an entry
 * lights its building in the scene; clicking opens it. On your own world it's also where you post.
 */
export const NewsStack = memo(function NewsStack({ hidden }: { hidden: boolean }) {
  const world = useWorldStore((s) => s.world);
  const isHome = useWorldStore((s) => s.currentId === s.homeId);
  const postUpdate = useWorldStore((s) => s.postUpdate);
  const [open, setOpen] = useState<boolean>(false);
  const [all, setAll] = useState<boolean>(false);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const news = useMemo(() => townNews(world), [world]);
  const fresh = useMemo(() => world.buildings.filter((b) => isFresh(b, now)).length, [world, now]);
  // Town buildings first, newest news first among them, so the picker defaults to what you're working on.
  const pickable = useMemo(
    () =>
      [...world.buildings].sort(
        (a, b) =>
          Number(a.status === "past") - Number(b.status === "past") ||
          (b.updates?.[0]?.at ?? b.createdAt) - (a.updates?.[0]?.at ?? a.createdAt),
      ),
    [world.buildings],
  );

  if (hidden || world.buildings.length === 0 || (!isHome && news.length === 0)) return null;

  const shown = all ? news : news.slice(0, SHORT);
  const fx = useFx.getState;

  return (
    <section className={`${styles.stack} ${open ? "" : styles.stackShut}`} aria-label="What's new in town">
      <button type="button" className={styles.stackHead} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Megaphone size={15} strokeWidth={2.3} aria-hidden className={styles.stackIcon} />
        <span className={styles.stackTitle}>What&rsquo;s new{isHome ? "" : ` with ${world.ownerName}`}</span>
        {fresh > 0 && <span className={styles.stackCount}>{fresh}</span>}
        <ChevronDown size={15} strokeWidth={2.4} aria-hidden className={styles.chev} />
      </button>

      {open && (
        <div className={styles.stackBody}>
          {isHome && (
            <UpdateComposer
              buildings={pickable}
              placeholder="What's new in town?"
              onPost={(id, text) => postUpdate(id, text)}
            />
          )}
          {news.length === 0 ? (
            <p className={styles.empty}>Post a line about anything you&rsquo;re doing. It flies a flag on that building, and neighbors read it when they visit.</p>
          ) : (
            <ul className={styles.entries}>
              {shown.map(({ building, update }) => (
                <li key={update.id} className={styles.entryItem}>
                  <button
                    type="button"
                    className={styles.entry}
                    onPointerEnter={() => fx().hover(building.id)}
                    onPointerLeave={() => fx().hover(null)}
                    onClick={() => {
                      fx().hover(null);
                      fx().select(building.id);
                    }}
                  >
                    <span className={styles.entryDot} style={{ background: buildingAccent(building) }} />
                    <span className={styles.entryBody}>
                      <span className={styles.entryWho}>{building.name}</span>
                      <span className={styles.entryWhat}>{update.text}</span>
                    </span>
                    <span className={styles.entryWhen}>{timeAgo(update.at, now)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {news.length > SHORT && (
            <button type="button" className={styles.more} onClick={() => setAll((v) => !v)}>
              {all ? "Show less" : `Show all ${news.length}`}
            </button>
          )}
        </div>
      )}
    </section>
  );
});
