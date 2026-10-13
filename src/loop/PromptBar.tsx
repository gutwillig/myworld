import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Sprout } from "lucide-react";
import { toast } from "sonner";
import { BuildingIcon } from "@/buildings/BuildingIcon";
import { prewarmThumbnails } from "@/buildings/thumbnail";
import { DEFAULT_ACCENT } from "@/buildings/kit";
import { searchKit, suggestTypes, typeLabel } from "@/buildings/suggest";
import type { Hex } from "@/grid/hex";
import { pickActiveLot } from "@/grid/layout";
import { PICKABLE_TYPES, type BuildingType } from "@/store/types";
import { useWorldStore } from "@/store/world";
import { useFx } from "@/world/fx";
import styles from "./loop.module.css";

const PROMPTS = ["What's something you do?", "What else do you do?", "Got another one?", "What else lives in your world?"];

type Phase = { kind: "typing" } | { kind: "picking"; name: string; options: BuildingType[]; search: boolean };

/**
 * The loop's only input: type a name, pick one of three buildings, watch it rise.
 * While picking, typing a building type (e.g. "tower") searches the full kit.
 */
export function PromptBar({ hidden, onPickingChange }: { hidden: boolean; onPickingChange?: (picking: boolean) => void }) {
  const addBuilding = useWorldStore((s) => s.addBuilding);
  const count = useWorldStore((s) => s.world.buildings.length);
  const isHome = useWorldStore((s) => s.currentId === s.homeId);
  const owner = useWorldStore((s) => s.world.ownerName);
  const [value, setValue] = useState<string>("");
  const [phase, setPhase] = useState<Phase>({ kind: "typing" });
  const [active, setActive] = useState<number>(0);
  const [leavingType, setLeavingType] = useState<BuildingType | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reqId = useRef<number>(0);

  const placeholder = isHome
    ? PROMPTS[Math.min(count, 1) === 0 ? 0 : 1 + (count % (PROMPTS.length - 1))]
    : count === 0
      ? `What does ${owner} do?`
      : `What else does ${owner} do?`;

  useEffect(() => {
    if (!hidden) inputRef.current?.focus({ preventScroll: true });
  }, [hidden]);

  useEffect(() => {
    const t = window.setTimeout(() => prewarmThumbnails(PICKABLE_TYPES, (x) => DEFAULT_ACCENT[x], 264), 2500);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    onPickingChange?.(phase.kind === "picking");
  }, [phase.kind, onPickingChange]);

  const openCards = useCallback(async (name: string) => {
    const id = ++reqId.current;
    try {
      const options = await suggestTypes(name);
      if (id !== reqId.current) return;
      setPhase({ kind: "picking", name, options, search: false });
      setActive(0);
    } catch {
      if (id === reqId.current) {
        toast("Couldn't suggest buildings right now.");
      }
    }
  }, []);

  // When picking and the text changes, re-suggest; "type over the box" with a kit name searches the kit.
  useEffect(() => {
    if (phase.kind !== "picking") return;
    const v = value.trim();
    if (!v) {
      setPhase({ kind: "typing" });
      return;
    }
    if (v === phase.name) return;
    const kit = searchKit(v);
    if (kit.length > 0) {
      setPhase({ kind: "picking", name: phase.name, options: kit.slice(0, 3), search: true });
      setActive(0);
      return;
    }
    const t = window.setTimeout(() => void openCards(v), 140);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // While picking, the active card previews as a ghost on a lot; hovering lots in the scene moves it.
  const previewType = phase.kind === "picking" && !hidden ? (phase.options[active] ?? null) : null;
  const previewName = phase.kind === "picking" ? phase.name : "";
  useEffect(() => {
    const fx = useFx.getState();
    if (!previewType || leavingType) {
      if (fx.placement) fx.setPlacement(null);
      return;
    }
    const current = fx.placement;
    const w = useWorldStore.getState().world;
    const hex = current?.hex ?? pickActiveLot(w.terrain, w.buildings);
    if (!hex) {
      if (current) fx.setPlacement(null);
      return;
    }
    fx.setPlacement({ name: previewName, type: previewType, hex });
  }, [previewType, previewName, leavingType]);
  useEffect(() => () => useFx.getState().setPlacement(null), []);

  const choose = useCallback(
    (type: BuildingType, at?: Hex) => {
      if (phase.kind !== "picking") return;
      const hex = at ?? useFx.getState().placement?.hex;
      useFx.getState().setPlacement(null);
      const result = addBuilding({ name: phase.name, type, hex });
      if (result.ok === false) {
        toast("reason" in result ? result.reason : "Couldn't build that.");
        return;
      }
      setLeavingType(type);
      window.setTimeout(() => {
        setLeavingType(null);
        setPhase({ kind: "typing" });
      }, 260);
      setValue("");
      inputRef.current?.focus({ preventScroll: true });
    },
    [addBuilding, phase],
  );

  // Clicking a glowing lot in the scene builds the active card there.
  const placeTick = useFx((s) => s.placeTick);
  const lastTick = useRef<number>(placeTick);
  useEffect(() => {
    if (placeTick === lastTick.current) return;
    lastTick.current = placeTick;
    const p = useFx.getState().placement;
    if (phase.kind === "picking" && p) choose(p.type, p.hex);
  }, [placeTick, phase.kind, choose]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (!v) {
      inputRef.current?.focus();
      return;
    }
    if (phase.kind === "picking" && phase.options.length > 0) {
      choose(phase.options[active] ?? phase.options[0]);
      return;
    }
    void openCards(v);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (phase.kind !== "picking") return;
    const n = phase.options.length;
    if (e.key === "ArrowRight" || (e.key === "Tab" && !e.shiftKey)) {
      e.preventDefault();
      setActive((a) => (a + 1) % n);
    } else if (e.key === "ArrowLeft" || (e.key === "Tab" && e.shiftKey)) {
      e.preventDefault();
      setActive((a) => (a - 1 + n) % n);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setPhase({ kind: "typing" });
    } else if (/^[1-3]$/.test(e.key) && e.altKey) {
      e.preventDefault();
      const i = Number(e.key) - 1;
      if (phase.options[i]) choose(phase.options[i]);
    }
  };

  const options = phase.kind === "picking" ? phase.options : [];
  const moreTypes = useMemo(
    () => (phase.kind === "picking" ? PICKABLE_TYPES.filter((t) => !phase.options.includes(t)) : []),
    [phase],
  );

  return (
    <div className={`${styles.dock} ${hidden ? styles.dockHidden : ""}`} aria-hidden={hidden}>
      {phase.kind === "picking" && (
        <div className={styles.picker}>
          <div className={styles.cards} role="listbox" aria-label={`Pick a building for ${phase.name}`}>
            {options.map((t, i) => (
              <button
                key={`${phase.name}:${t}`}
                type="button"
                role="option"
                aria-selected={i === active}
                className={`${styles.card} ${i === active ? styles.cardActive : ""} ${leavingType ? (leavingType === t ? styles.cardChosen : styles.cardFade) : ""}`}
                style={{ animationDelay: `${i * 55}ms` }}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(t)}
                tabIndex={hidden ? -1 : 0}
              >
                <BuildingIcon type={t} accent={DEFAULT_ACCENT[t]} size={132} className={styles.cardArt} />
                <span className={styles.cardLabel}>{typeLabel(t)}</span>
                {i === 0 && !phase.search ? <span className={styles.badge}>Best match</span> : <span className={styles.badgeGhost} />}
              </button>
            ))}
          </div>
          <div className={styles.moreRow}>
            <span className={styles.moreHint}>or</span>
            {moreTypes.map((t) => (
              <button key={t} type="button" className={styles.moreChip} onClick={() => choose(t)} tabIndex={hidden ? -1 : 0}>
                {typeLabel(t)}
              </button>
            ))}
          </div>
        </div>
      )}

      <form className={styles.bar} onSubmit={onSubmit}>
        <span className={styles.sprout} aria-hidden>
          <Sprout size={22} strokeWidth={2} />
        </span>
        <label htmlFor="prompt" className="sr-only">
          {placeholder}
        </label>
        <input
          id="prompt"
          ref={inputRef}
          className={styles.input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          maxLength={48}
          tabIndex={hidden ? -1 : 0}
        />
        <button type="submit" className={styles.enter} disabled={!value.trim()} tabIndex={hidden ? -1 : 0}>
          {phase.kind === "picking" ? "Build" : "Enter"}
          <CornerDownLeft size={18} strokeWidth={2.2} aria-hidden />
        </button>
      </form>
      {phase.kind === "picking" && (
        <p className={styles.hint}>
          <kbd>←</kbd>
          <kbd>→</kbd> to choose · <kbd>Enter</kbd> to build · or click a glowing lot to build there · <kbd>Esc</kbd> to edit
        </p>
      )}
    </div>
  );
}
