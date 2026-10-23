import { memo } from "react";
import { X } from "lucide-react";
import type { Building } from "@/store/types";
import { timeAgo } from "./news";
import { UpdateComposer } from "./UpdateComposer";
import styles from "./updates.module.css";

/** A building's own news, oldest at the bottom; the owner posts and removes here. */
export const UpdatesField = memo(function UpdatesField({
  building,
  onPost,
  onRemove,
  limit,
}: {
  building: Building;
  /** Missing = read-only (visitors). */
  onPost?: (buildingId: string, text: string) => boolean;
  onRemove?: (updateId: string) => void;
  limit?: number;
}) {
  const list = (building.updates ?? []).slice(0, limit ?? undefined);
  return (
    <div className={styles.field}>
      {onPost && <UpdateComposer buildingId={building.id} onPost={onPost} placeholder={`What's new at ${building.name}?`} />}
      {list.length > 0 && (
        <ul className={styles.rows}>
          {list.map((u) => (
            <li key={u.id} className={styles.row}>
              <span className={styles.rowWhen}>{timeAgo(u.at)}</span>
              <p className={styles.rowWhat}>{u.text}</p>
              {onRemove && (
                <button type="button" className={styles.rowX} onClick={() => onRemove(u.id)} aria-label="Remove update">
                  <X size={13} strokeWidth={2.4} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
