import { type FormEvent, useEffect, useState } from "react";
import { Anchor, Eye, Plane, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar } from "@/panel/fields";
import type { World } from "@/store/types";
import { useWorldStore } from "@/store/world";
import { useFx } from "@/world/fx";
import styles from "./neighbors.module.css";

/** URL for a world: home lives at `/`, everyone else at `/w/:slug`. */
export function worldPath(world: World, homeId: string): string {
  return world.id === homeId ? "/" : `/w/${world.slug}`;
}

/** Every world in the sea, plus a way to start a friend's. Picking one sails there. */
export function NeighborsMenu() {
  const navigate = useNavigate();
  const order = useWorldStore((s) => s.order);
  const worlds = useWorldStore((s) => s.worlds);
  const homeId = useWorldStore((s) => s.homeId);
  const currentId = useWorldStore((s) => s.currentId);
  const createWorld = useWorldStore((s) => s.createWorld);
  const traveling = useFx((s) => !!s.travel);
  const [open, setOpen] = useState<boolean>(false);
  const [name, setName] = useState<string>("");

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("myworld:neighbors", onOpen);
    return () => window.removeEventListener("myworld:neighbors", onOpen);
  }, []);

  useEffect(() => {
    if (traveling) setOpen(false);
  }, [traveling]);

  // Home is yours, so it sails straight there; anyone else's world gets the postcard preview first.
  const go = (w: World) => {
    setOpen(false);
    if (w.id === currentId) return;
    if (w.id === homeId) {
      navigate(worldPath(w, homeId));
      return;
    }
    const fx = useFx.getState();
    fx.select(null);
    fx.openVisit({ resident: w.ownerName, worldId: w.id, fromWorldId: currentId });
  };

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const w = createWorld(trimmed);
    setName("");
    setOpen(false);
    navigate(worldPath(w, homeId));
  };

  const others = order.filter((id) => id !== homeId).map((id) => worlds[id]).filter(Boolean);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={styles.trigger} disabled={traveling} aria-label="Neighbors">
          <span className={styles.stack} aria-hidden>
            {others.slice(0, 3).map((w) => (
              <span key={w.id} className={styles.stackItem}>
                <Avatar name={w.ownerName} size={26} />
              </span>
            ))}
          </span>
          Neighbors
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={10} className={styles.panel}>
        <p className={styles.eyebrow}>Fly to</p>
        <ul className={styles.list}>
          {order.map((id) => {
            const w = worlds[id];
            if (!w) return null;
            const here = id === currentId;
            const isHome = id === homeId;
            return (
              <li key={id}>
                <button type="button" className={`${styles.row} ${here ? styles.rowHere : ""}`} onClick={() => go(w)}>
                  <Avatar name={w.ownerName} size={38} />
                  <span className={styles.rowText}>
                    <span className={styles.rowName}>{isHome ? "My world" : `${w.ownerName}\u2019s world`}</span>
                    <span className={styles.rowMeta}>
                      {w.buildings.length} {w.buildings.length === 1 ? "building" : "buildings"}
                    </span>
                  </span>
                  {here ? (
                    <span className={styles.here}>
                      <Anchor size={14} aria-hidden /> Here
                    </span>
                  ) : isHome ? (
                    <Plane size={19} className={styles.go} aria-hidden />
                  ) : (
                    <Eye size={19} className={styles.go} aria-label="Preview" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <form className={styles.create} onSubmit={onCreate}>
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Start a friend's world…"
            aria-label="Friend's name"
            maxLength={40}
          />
          <button type="submit" className={styles.createBtn} disabled={!name.trim()} aria-label="Start world">
            <Plus size={18} strokeWidth={2.4} aria-hidden />
          </button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
