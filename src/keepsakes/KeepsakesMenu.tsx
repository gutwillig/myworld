import { memo, useEffect, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { requestObjectThumbnail } from "@/buildings/thumbnail";
import { cn } from "@/lib/utils";
import type { Keepsake, KeepsakeKind } from "@/store/types";
import { useWorldStore } from "@/store/world";
import { useFx } from "@/world/fx";
import { KEEPSAKES, MAX_KEEPSAKES, NOTE_MAX, keepsakeInfo } from "./catalog";
import { buildKeepsake } from "./kit";
import styles from "./keepsakes.module.css";

const NONE: Keepsake[] = [];

/** A pre-rendered picture of a keepsake from the world's camera angle. */
export const KeepsakeIcon = memo(function KeepsakeIcon({ kind, size = 56 }: { kind: KeepsakeKind; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => requestObjectThumbnail(`keepsake|${kind}|${size * 2}`, size * 2, () => buildKeepsake(kind).group, setSrc), [kind, size]);
  return (
    <span className={styles.icon} style={{ width: size, height: size }}>
      {src && <img src={src} alt="" width={size} height={size} draggable={false} />}
    </span>
  );
});

/** One chosen keepsake with the text on its sign. Saves as you type. */
function NoteRow({ keepsake }: { keepsake: Keepsake }) {
  const setNote = useWorldStore((s) => s.setKeepsakeNote);
  const label = keepsakeInfo(keepsake.kind)?.label ?? "Keepsake";
  return (
    <li className={styles.noteRow}>
      <KeepsakeIcon kind={keepsake.kind} size={40} />
      <label className={styles.noteField}>
        <span className={styles.noteLabel}>{label}</span>
        <input
          className={styles.noteInput}
          value={keepsake.note}
          maxLength={NOTE_MAX}
          placeholder={keepsake.kind === "ballpark" ? "Go Sox!" : "What should the sign say?"}
          onChange={(e) => setNote(keepsake.kind, e.target.value)}
          onBlur={(e) => setNote(keepsake.kind, e.target.value.trim())}
        />
      </label>
    </li>
  );
}

/** "Make it yours": up to three personal props, each with a sign visitors see on hover. */
export function KeepsakesMenu() {
  const chosen = useWorldStore((s) => s.world.keepsakes ?? NONE);
  const toggle = useWorldStore((s) => s.toggleKeepsake);
  const traveling = useFx((s) => !!s.travel);
  const [open, setOpen] = useState<boolean>(false);
  const [nudge, setNudge] = useState<number>(0);
  const full = chosen.length >= MAX_KEEPSAKES;

  useEffect(() => {
    if (traveling) setOpen(false);
  }, [traveling]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={styles.trigger} disabled={traveling} aria-label="Make it yours">
          <Sparkles size={17} strokeWidth={2.1} aria-hidden />
          Make it yours
          {chosen.length > 0 && <span className={styles.count}>{chosen.length}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className={cn(styles.panel, "w-[384px] p-[14px]")}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className={styles.head}>
          <p className={styles.eyebrow}>Keepsakes</p>
          <p key={nudge} className={`${styles.meter} ${nudge ? styles.meterNudge : ""}`} aria-live="polite">
            {chosen.length} of {MAX_KEEPSAKES}
          </p>
        </div>
        <p className={styles.lede}>
          Little things that make the island yours. Give each one a sign, then drag it anywhere on open ground.
        </p>

        {chosen.length > 0 && (
          <ul className={styles.notes}>
            {chosen.map((k) => (
              <NoteRow key={k.kind} keepsake={k} />
            ))}
          </ul>
        )}

        <ul className={styles.grid}>
          {KEEPSAKES.map((k) => {
            const on = chosen.some((c) => c.kind === k.kind);
            const locked = full && !on;
            return (
              <li key={k.kind}>
                <button
                  type="button"
                  className={`${styles.tile} ${on ? styles.tileOn : ""} ${locked ? styles.tileLocked : ""}`}
                  aria-pressed={on}
                  aria-disabled={locked}
                  onClick={() => {
                    if (!toggle(k.kind)) setNudge((n) => n + 1);
                  }}
                  title={locked ? `Up to ${MAX_KEEPSAKES} for now. Remove one to swap.` : k.blurb}
                >
                  <KeepsakeIcon kind={k.kind} size={40} />
                  <span className={styles.tileName}>{k.label}</span>
                  <span className={styles.check} aria-hidden>
                    {on && <Check size={12} strokeWidth={3} />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {full && <p className={styles.footnote}>Up to {MAX_KEEPSAKES} for now. Tap one to swap it out.</p>}
      </PopoverContent>
    </Popover>
  );
}
