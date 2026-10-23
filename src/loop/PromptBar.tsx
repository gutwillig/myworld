import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, ArrowLeft, Briefcase, Clapperboard, CornerDownLeft, Image as ImageIcon, Images, Rocket, Smile, Sprout } from "lucide-react";
import { toast } from "sonner";
import { BuildingIcon } from "@/buildings/BuildingIcon";
import { prewarmThumbnails } from "@/buildings/thumbnail";
import { DEFAULT_ACCENT } from "@/buildings/kit";
import { searchKit, suggestTypes, typeLabel } from "@/buildings/suggest";
import type { Hex } from "@/grid/hex";
import { districtOf, pickActiveLot } from "@/grid/layout";
import { HUB_FOCUS, isGig } from "@/grid/plaza";
import { PICKABLE_TYPES, type BuildingType, type Showcase } from "@/store/types";
import { DISTRICT_TINT } from "@/world/Roads";
import { useWorldStore } from "@/store/world";
import { useFx } from "@/world/fx";
import styles from "./loop.module.css";

const PROMPTS = ["What's something you do?", "What else do you do?", "Got another one?", "What else lives in your world?"];
const REALM_PROMPTS: Record<Category, string> = {
  gig: "What else do you do here?", // Will be replaced with gig name
  side: "What other projects do you have going on?",
  fun: "What else are you building for fun?",
  past: "What else cool have you done?",
};

type Phase = { kind: "typing" } | { kind: "picking"; name: string; options: BuildingType[]; search: boolean };

type Category = "gig" | "side" | "fun" | "past";
/** The add flow asks three things in turn: what part of life it is, what it looks like, how it shows off. */
type Step = "category" | "type" | "showcase";
const CATEGORIES: { id: Category; label: string; where: string; Icon: typeof Briefcase; tint: string }[] = [
  { id: "gig", label: "Main gig", where: "The plaza", Icon: Briefcase, tint: DISTRICT_TINT.gig },
  { id: "side", label: "Side hustle", where: "By the fountain", Icon: Rocket, tint: DISTRICT_TINT.side },
  { id: "fun", label: "For fun", where: "By the playground", Icon: Smile, tint: DISTRICT_TINT.fun },
  { id: "past", label: "Past work", where: "Old Town", Icon: Archive, tint: "#A08670" },
];
type Template = Showcase["template"];
const SHOWCASES: { id: Template; label: string; what: string; Icon: typeof Briefcase }[] = [
  { id: "reel", label: "Reel", what: "A video", Icon: Clapperboard },
  { id: "studio", label: "Studio", what: "One hero image", Icon: ImageIcon },
  { id: "scrapbook", label: "Scrapbook", what: "A series of photos", Icon: Images },
];
const emptyShowcase = (t: Template): Showcase =>
  t === "reel"
    ? { template: "reel", tagline: "", videoUrl: "" }
    : t === "studio"
      ? { template: "studio", tagline: "", cover: "", cases: [] }
      : { template: "scrapbook", tagline: "", shots: [] };

const catLabel = (c: Category) => CATEGORIES.find((x) => x.id === c)?.label ?? "";

/** Where a new add lands by default: whatever part of town you're standing in. */
const categoryFor = (focus: string | null): Category =>
  focus === HUB_FOCUS.old ? "past" : focus === HUB_FOCUS.fun ? "fun" : focus === HUB_FOCUS.side || !focus ? "side" : "gig";

/**
 * The loop's only input: type a name, pick one of three buildings, watch it rise.
 * While picking, typing a building type (e.g. "tower") searches the full kit.
 */
export function PromptBar({ hidden, onPickingChange }: { hidden: boolean; onPickingChange?: (picking: boolean) => void }) {
  const addBuilding = useWorldStore((s) => s.addBuilding);
  const updateBuilding = useWorldStore((s) => s.updateBuilding);
  const count = useWorldStore((s) => s.world.buildings.length);
  const isHome = useWorldStore((s) => s.currentId === s.homeId);
  const owner = useWorldStore((s) => s.world.ownerName);
  const buildings = useWorldStore((s) => s.world.buildings);
  const plazaId = useFx((s) => s.plazaId);
  const gig = useMemo(() => buildings.find(isGig) ?? null, [buildings]);
  const clients = useMemo(
    () => [...new Set(buildings.filter((b) => b.parentId && b.client).map((b) => b.client as string))],
    [buildings],
  );
  const [category, setCategory] = useState<Category>("side");
  const [client, setClient] = useState<string>("");
  const [replaceGig, setReplaceGig] = useState<boolean>(false);
  const toPlaza = category === "gig" && !!gig && !replaceGig;
  const district = category === "fun" ? "fun" : "side";
  // Only side hustles and fun things get a ghost on a lot; the gig and Old Town have fixed homes.
  const usesLots = category === "side" || category === "fun";
  const [value, setValue] = useState<string>("");
  const [phase, setPhase] = useState<Phase>({ kind: "typing" });
  const [active, setActive] = useState<number>(0);
  const [step, setStep] = useState<Step>("category");
  const [chosenType, setChosenType] = useState<BuildingType | null>(null);
  const [leavingType, setLeavingType] = useState<BuildingType | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reqId = useRef<number>(0);

  const placeholder = useMemo(() => {
    // When zoomed into a realm, use realm-specific prompts
    if (plazaId) {
      const realm = categoryFor(plazaId);
      if (realm === "gig" && gig) return `What else do you do at ${gig.name}?`;
      return REALM_PROMPTS[realm];
    }
    // World overview prompts
    if (isHome) return PROMPTS[Math.min(count, 1) === 0 ? 0 : 1 + (count % (PROMPTS.length - 1))];
    return count === 0 ? `What does ${owner} do?` : `What else does ${owner} do?`;
  }, [plazaId, gig, isHome, count, owner]);

  useEffect(() => {
    if (!hidden) inputRef.current?.focus({ preventScroll: true });
  }, [hidden]);

  useEffect(() => {
    const t = window.setTimeout(() => prewarmThumbnails(PICKABLE_TYPES, (x) => DEFAULT_ACCENT[x], 264), 2500);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    onPickingChange?.(phase.kind === "picking");
    // Zoomed into a realm, the add goes there: skip the category question and start at the building type.
    // From the whole-world view, always ask the category first.
    if (phase.kind === "picking") {
      const zoomed = useFx.getState().plazaId;
      const c = categoryFor(zoomed);
      setCategory(c);
      setReplaceGig(false);
      setStep(zoomed ? "type" : "category");
      setChosenType(null);
      setActive(zoomed ? 0 : CATEGORIES.findIndex((x) => x.id === c));
    }
  }, [phase.kind, onPickingChange]);

  const openCards = useCallback(async (name: string) => {
    const id = ++reqId.current;
    const options = await suggestTypes(name);
    if (id !== reqId.current) return;
    setPhase({ kind: "picking", name, options, search: false });
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
      if (step === "type") setActive(0);
      return;
    }
    const t = window.setTimeout(() => void openCards(v), 140);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // While picking, the active card previews as a ghost on a lot; hovering lots in the scene moves it.
  const previewType =
    phase.kind !== "picking" || hidden ? null : step === "type" ? (phase.options[active] ?? null) : step === "showcase" ? chosenType : null;
  const previewName = phase.kind === "picking" ? phase.name : "";
  useEffect(() => {
    const fx = useFx.getState();
    if (!previewType || leavingType || !usesLots) {
      if (fx.placement) fx.setPlacement(null);
      return;
    }
    const current = fx.placement;
    const w = useWorldStore.getState().world;
    const keep = current && districtOf(w.terrain, current.hex) === district;
    const hex = keep ? current.hex : pickActiveLot(w.terrain, w.buildings, district, true);
    if (!hex) {
      if (current) fx.setPlacement(null);
      return;
    }
    fx.setPlacement({ name: previewName, type: previewType, hex, district });
  }, [previewType, previewName, leavingType, usesLots, district]);
  useEffect(() => () => useFx.getState().setPlacement(null), []);

  const goTo = useCallback((next: Step, index = 0) => {
    setStep(next);
    setActive(index);
  }, []);

  const pickCategory = useCallback(
    (c: Category) => {
      setCategory(c);
      setReplaceGig(false);
      goTo("type");
    },
    [goTo],
  );

  const pickType = useCallback(
    (type: BuildingType, at?: Hex) => {
      setChosenType(type);
      if (at) {
        const p = useFx.getState().placement;
        if (p) useFx.getState().setPlacement({ ...p, type, hex: at });
      }
      goTo("showcase");
    },
    [goTo],
  );

  const build = useCallback(
    (template: Template | null, at?: Hex) => {
      const type = chosenType;
      if (phase.kind !== "picking" || !type) return;
      const fx = useFx.getState();
      const hex = usesLots ? (at ?? fx.placement?.hex) : undefined;
      fx.setPlacement(null);
      const result = toPlaza
        ? addBuilding({ name: phase.name, type, gigId: gig.id, client: client.trim() || undefined })
        : addBuilding({
            name: phase.name,
            type,
            hex,
            status: category === "past" ? "past" : "active",
            asGig: category === "gig",
            district,
          });
      if (result.ok === false) {
        toast("reason" in result ? result.reason : "Couldn't build that.");
        return;
      }
      if (template) {
        const id = result.building.id;
        updateBuilding(id, { showcase: emptyShowcase(template) });
        const label = SHOWCASES.find((x) => x.id === template)?.label ?? "Showcase";
        toast(`${phase.name} got a ${label}`, {
          description: "Open it any time to add the media.",
          action: { label: "Fill it in", onClick: () => useFx.getState().select(id) },
        });
      }
      setLeavingType(type);
      window.setTimeout(() => {
        setLeavingType(null);
        setPhase({ kind: "typing" });
      }, 260);
      setValue("");
      if (toPlaza && fx.plazaId !== gig.id) {
        fx.select(null);
        fx.setPlaza(gig.id);
      } else if (category === "gig" && !toPlaza) {
        // A brand-new main gig: fly straight into its square so the first client is one step away.
        fx.select(null);
        window.setTimeout(() => useFx.getState().setPlaza(result.building.id), 420);
      } else if (usesLots && fx.plazaId && fx.plazaId !== HUB_FOCUS[district]) {
        fx.setPlaza(fx.plazaId.startsWith("hub:") ? HUB_FOCUS[district] : null);
      }
      inputRef.current?.focus({ preventScroll: true });
    },
    [addBuilding, updateBuilding, chosenType, phase, toPlaza, gig, client, category, usesLots, district],
  );

  // Clicking a glowing lot in the scene builds the active card there.
  const placeTick = useFx((s) => s.placeTick);
  const lastTick = useRef<number>(placeTick);
  useEffect(() => {
    if (placeTick === lastTick.current) return;
    lastTick.current = placeTick;
    const p = useFx.getState().placement;
    if (phase.kind !== "picking" || !p) return;
    if (step === "type") pickType(p.type, p.hex);
    else if (step === "showcase") build(SHOWCASES[active]?.id ?? null, p.hex);
  }, [placeTick, phase.kind, step, active, pickType, build]);

  const stepCount = step === "category" ? CATEGORIES.length : step === "showcase" ? SHOWCASES.length : phase.kind === "picking" ? phase.options.length : 0;
  const confirm = (i: number) => {
    if (phase.kind !== "picking") return;
    if (step === "category") pickCategory(CATEGORIES[i]?.id ?? "side");
    else if (step === "type") {
      const t = phase.options[i] ?? phase.options[0];
      if (t) pickType(t);
    } else build(SHOWCASES[i]?.id ?? null);
  };
  const back = () => {
    if (step === "showcase") goTo("type", Math.max(0, phase.kind === "picking" && chosenType ? phase.options.indexOf(chosenType) : 0));
    else if (step === "type" && !plazaId) goTo("category", CATEGORIES.findIndex((x) => x.id === category));
    else setPhase({ kind: "typing" });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (!v) {
      inputRef.current?.focus();
      return;
    }
    if (phase.kind === "picking") {
      confirm(active);
      return;
    }
    void openCards(v);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (phase.kind !== "picking") return;
    const n = stepCount;
    if (e.key === "ArrowRight" || (e.key === "Tab" && !e.shiftKey)) {
      e.preventDefault();
      setActive((a) => (a + 1) % n);
    } else if (e.key === "ArrowLeft" || (e.key === "Tab" && e.shiftKey)) {
      e.preventDefault();
      setActive((a) => (a - 1 + n) % n);
    } else if (e.key === "Escape") {
      e.preventDefault();
      back();
    } else if (/^[1-4]$/.test(e.key) && e.altKey) {
      e.preventDefault();
      const i = Number(e.key) - 1;
      if (i < n) confirm(i);
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
          <div className={styles.stepHead}>
            <button type="button" className={styles.stepBack} onClick={back} aria-label="Back" tabIndex={hidden ? -1 : 0}>
              <ArrowLeft size={15} strokeWidth={2.4} />
            </button>
            <span className={styles.stepTitle}>
              {step === "category"
                ? `What is ${phase.name}?`
                : step === "type"
                  ? `What does ${phase.name} look like?`
                  : `How should ${phase.name} show off?`}
            </span>
            {step !== "category" && (
              <button type="button" className={styles.stepCrumb} onClick={() => goTo("category", CATEGORIES.findIndex((x) => x.id === category))} tabIndex={hidden ? -1 : 0}>
                <span className={styles.crumbDot} style={{ background: CATEGORIES.find((x) => x.id === category)?.tint }} />
                {catLabel(category)}
                {step === "showcase" && chosenType ? ` · ${typeLabel(chosenType)}` : ""}
              </button>
            )}
          </div>

          {step === "type" && (toPlaza || (category === "gig" && gig)) && (
            <div className={styles.catRow}>
              {toPlaza && (
                <>
                  <input
                    className={styles.clientInput}
                    value={client}
                    onChange={(e) => setClient(e.target.value)}
                    placeholder="for client…"
                    list="myworld-clients"
                    maxLength={32}
                    aria-label="Client"
                    tabIndex={hidden ? -1 : 0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        confirm(active);
                      }
                    }}
                  />
                  <datalist id="myworld-clients">
                    {clients.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </>
              )}
              {category === "gig" && gig && (
                <button
                  type="button"
                  className={`${styles.replaceLink} ${replaceGig ? styles.replaceLinkOn : ""}`}
                  onClick={() => setReplaceGig((v) => !v)}
                  tabIndex={hidden ? -1 : 0}
                >
                  {replaceGig ? `New main gig · ${gig.name} retires to Old Town` : "or make it my new main gig"}
                </button>
              )}
            </div>
          )}

          {step === "category" && (
            <div key="category" className={`${styles.cards} ${styles.cards4}`} role="listbox" aria-label={`What is ${phase.name}?`}>
              {CATEGORIES.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  className={`${styles.card} ${styles.tile} ${i === active ? styles.cardActive : ""}`}
                  style={{ animationDelay: `${i * 45}ms`, ["--tile" as string]: c.tint }}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pickCategory(c.id)}
                  tabIndex={hidden ? -1 : 0}
                >
                  <span className={styles.tileIcon}>
                    <c.Icon size={30} strokeWidth={1.9} />
                  </span>
                  <span className={styles.cardLabel}>{c.id === "gig" && !gig ? "Main gig" : c.label}</span>
                  <span className={styles.tileSub}>{c.id === "gig" && gig ? `Joins ${gig.name}` : c.where}</span>
                </button>
              ))}
            </div>
          )}

          {step === "type" && (
            <>
              <div key="type" className={styles.cards} role="listbox" aria-label={`Pick a building for ${phase.name}`}>
                {options.map((t, i) => (
                  <button
                    key={`${phase.name}:${t}`}
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    className={`${styles.card} ${i === active ? styles.cardActive : ""}`}
                    style={{ animationDelay: `${i * 55}ms` }}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pickType(t)}
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
                  <button key={t} type="button" className={styles.moreChip} onClick={() => pickType(t)} tabIndex={hidden ? -1 : 0}>
                    {typeLabel(t)}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === "showcase" && (
            <>
              <div key="showcase" className={styles.cards} role="listbox" aria-label={`How should ${phase.name} show off?`}>
                {SHOWCASES.map((t, i) => (
                  <button
                    key={t.id}
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    className={`${styles.card} ${styles.tile} ${i === active ? styles.cardActive : ""} ${leavingType ? (i === active ? styles.cardChosen : styles.cardFade) : ""}`}
                    style={{ animationDelay: `${i * 55}ms`, ["--tile" as string]: "#E5694F" }}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => build(t.id)}
                    tabIndex={hidden ? -1 : 0}
                  >
                    <span className={styles.tileIcon}>
                      <t.Icon size={30} strokeWidth={1.9} />
                    </span>
                    <span className={styles.cardLabel}>{t.label}</span>
                    <span className={styles.tileSub}>{t.what}</span>
                  </button>
                ))}
              </div>
              <div className={styles.moreRow}>
                <button type="button" className={styles.moreChip} onClick={() => build(null)} tabIndex={hidden ? -1 : 0}>
                  Skip for now
                </button>
              </div>
            </>
          )}
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
          {phase.kind !== "picking" ? "Enter" : step === "showcase" ? "Build" : "Next"}
          <CornerDownLeft size={18} strokeWidth={2.2} aria-hidden />
        </button>
      </form>
      {phase.kind === "picking" && (
        <p className={styles.hint}>
          <kbd>←</kbd>
          <kbd>→</kbd> to choose · <kbd>Enter</kbd> {step === "showcase" ? "to build" : "for next"} ·{" "}
          {step === "category"
            ? ""
            : toPlaza
              ? `goes on ${gig.name}’s plaza · `
              : category === "gig"
                ? "takes the town square · "
                : category === "past"
                  ? "goes to Old Town · "
                  : `goes by the ${category === "fun" ? "playground" : "fountain"} · or click a glowing lot · `}
          <kbd>Esc</kbd> to go back
        </p>
      )}
    </div>
  );
}
