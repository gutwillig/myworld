import { useMemo, useState } from "react";
import { List, X } from "lucide-react";
import { isGig } from "@/grid/plaza";
import { typeLabel } from "@/buildings/suggest";
import type { Building } from "@/store/types";
import { useWorldStore } from "@/store/world";
import { useFx } from "@/world/fx";
import styles from "./buildingList.module.css";

/** Mobile-friendly list view of all buildings in the world */
export function BuildingList() {
  const [open, setOpen] = useState(false);
  const buildings = useWorldStore((s) => s.world.buildings);
  const ownerName = useWorldStore((s) => s.world.ownerName);
  const select = useFx((s) => s.select);

  // Sort buildings: main gig first, then by name
  const sorted = useMemo(() => {
    return [...buildings].sort((a, b) => {
      if (isGig(a) && !isGig(b)) return -1;
      if (!isGig(a) && isGig(b)) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [buildings]);

  const statusLabel = (status: Building["status"]) => {
    switch (status) {
      case "active":
        return "Active";
      case "past":
        return "Past";
      case "lab":
        return "Lab";
      default:
        return "";
    }
  };

  const handleSelect = (id: string) => {
    select(id);
    setOpen(false);
  };

  if (buildings.length === 0) return null;

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen(true)}
        aria-label="View all buildings"
      >
        <List size={18} strokeWidth={2.2} />
      </button>

      {open && (
        <div className={styles.overlay} onClick={() => setOpen(false)}>
          <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.header}>
              <h2 className={styles.title}>{ownerName}'s Buildings</h2>
              <button
                type="button"
                className={styles.close}
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X size={20} strokeWidth={2.2} />
              </button>
            </div>

            <ul className={styles.list}>
              {sorted.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    className={styles.item}
                    onClick={() => handleSelect(b.id)}
                  >
                    <span className={styles.itemName}>
                      {b.name}
                      {isGig(b) && <span className={styles.badge}>Main Gig</span>}
                    </span>
                    <span className={styles.itemMeta}>
                      {typeLabel(b.type)}
                      {b.status !== "active" && (
                        <span className={`${styles.status} ${styles[b.status]}`}>
                          {statusLabel(b.status)}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
