import { useEffect, useMemo, useReducer, useRef } from "react";

export type PresenceEntry<T> = {
  key: string;
  item: T;
  /** "initial" was there on first render (no entrance animation); "new" appeared later. */
  born: "initial" | "new";
  leaving: boolean;
  leftAt: number;
};

/**
 * Keeps removed items around for `leaveMs` so they can animate out,
 * and marks which items arrived after the first render so they can animate in.
 * Changing `epoch` (reset/import) treats everything as initial again.
 */
export function usePresence<T>(items: T[], keyOf: (t: T) => string, epoch: number, leaveMs: number): PresenceEntry<T>[] {
  const ref = useRef<{ epoch: number; map: Map<string, PresenceEntry<T>> } | null>(null);
  const [tick, force] = useReducer((x: number) => x + 1, 0);

  const entries = useMemo(() => {
    const cur = ref.current;
    const fresh = !cur || cur.epoch !== epoch;
    const map = new Map<string, PresenceEntry<T>>();
    const now = performance.now();
    for (const it of items) {
      const k = keyOf(it);
      const prev = fresh ? undefined : cur?.map.get(k);
      map.set(k, {
        key: k,
        item: it,
        born: prev && !prev.leaving ? prev.born : fresh ? "initial" : "new",
        leaving: false,
        leftAt: 0,
      });
    }
    if (!fresh && cur) {
      for (const [k, e] of cur.map) {
        if (map.has(k)) continue;
        map.set(k, e.leaving ? e : { ...e, leaving: true, leftAt: now });
      }
    }
    ref.current = { epoch, map };
    return [...map.values()];
    // keyOf is expected to be stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, epoch, tick]);

  useEffect(() => {
    const leaving = entries.filter((e) => e.leaving);
    if (leaving.length === 0) return;
    const now = performance.now();
    const due = Math.max(0, Math.min(...leaving.map((e) => e.leftAt + leaveMs - now)));
    const t = window.setTimeout(() => {
      const map = ref.current?.map;
      if (!map) return;
      const at = performance.now();
      for (const e of leaving) if (e.leftAt + leaveMs <= at + 5) map.delete(e.key);
      force();
    }, due + 10);
    return () => window.clearTimeout(t);
  }, [entries, leaveMs]);

  return entries;
}
