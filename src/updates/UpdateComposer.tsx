import { memo, useEffect, useState } from "react";
import { ArrowUp, ChevronDown } from "lucide-react";
import type { Building } from "@/store/types";
import { UPDATE_MAX } from "./news";
import styles from "./updates.module.css";

export type UpdateComposerProps = {
  /** Posts the line on a building; return false to keep the text (nothing was posted). */
  onPost: (buildingId: string, text: string) => boolean;
  /** One building (panel, showcase) or a picker over several (the town stack). */
  buildingId?: string;
  buildings?: Building[];
  placeholder?: string;
  autoFocus?: boolean;
};

/** One line, Enter to post. With several buildings, a small "on <building>" picker sits underneath. */
export const UpdateComposer = memo(function UpdateComposer({
  onPost,
  buildingId,
  buildings,
  placeholder = "Post an update…",
  autoFocus,
}: UpdateComposerProps) {
  const [text, setText] = useState<string>("");
  const [pick, setPick] = useState<string>(buildingId ?? buildings?.[0]?.id ?? "");
  const target = buildingId ?? pick;

  // Keep the picker valid when buildings come and go.
  useEffect(() => {
    if (buildingId || !buildings?.length) return;
    if (!buildings.some((b) => b.id === pick)) setPick(buildings[0]?.id ?? "");
  }, [buildings, buildingId, pick]);

  const submit = () => {
    if (!text.trim() || !target) return;
    if (onPost(target, text)) setText("");
  };
  const left = UPDATE_MAX - text.length;

  return (
    <form
      className={styles.composer}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className={styles.composeRow}>
        <input
          className={styles.composeInput}
          value={text}
          maxLength={UPDATE_MAX}
          placeholder={placeholder}
          aria-label="Update"
          autoFocus={autoFocus}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
        />
        <button type="submit" className={styles.postBtn} disabled={!text.trim() || !target} aria-label="Post update">
          <ArrowUp size={16} strokeWidth={2.6} />
        </button>
      </div>
      {(buildings && buildings.length > 1 && !buildingId) || left < 30 ? (
        <div className={styles.composeMeta}>
          {buildings && buildings.length > 1 && !buildingId ? (
            <label className={styles.onPick}>
              on
              <span className={styles.selectWrap}>
                <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Building">
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={12} strokeWidth={2.6} aria-hidden />
              </span>
            </label>
          ) : (
            <span />
          )}
          {left < 30 && <span className={left < 10 ? styles.countLow : styles.count}>{left}</span>}
        </div>
      ) : null}
    </form>
  );
});
