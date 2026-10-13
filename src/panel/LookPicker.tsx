import { memo } from "react";
import { Check } from "lucide-react";
import { BuildingIcon } from "@/buildings/BuildingIcon";
import { defaultGrounds, groundsFor } from "@/buildings/grounds";
import { ACCENTS, buildingAccent } from "@/buildings/kit";
import { STYLES, styleOf } from "@/buildings/styles";
import type { Building } from "@/store/types";
import styles from "./panel.module.css";

type Props = {
  building: Building;
  onStyle: (id: string) => void;
  onGrounds: (id: string) => void;
  onAccent: (hex: string) => void;
};

/** Style, grounds and color for one building, each choice shown as a little 3D picture. */
export const LookPicker = memo(function LookPicker({ building, onStyle, onGrounds, onAccent }: Props) {
  const accent = buildingAccent(building);
  const faded = building.status === "past";
  const styleList = STYLES[building.type];
  const style = styleOf(building.type, building.style).id;
  const grounds = building.grounds ?? defaultGrounds(building.type);

  return (
    <section className={styles.look} aria-label="Look">
      {styleList.length > 1 && (
        <>
          <h3 className={styles.sectionTitle}>Style</h3>
          <div className={styles.tiles} role="radiogroup" aria-label="Style">
            {styleList.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={s.id === style}
                className={`${styles.tile} ${s.id === style ? styles.tileOn : ""}`}
                onClick={() => s.id !== style && onStyle(s.id)}
              >
                <BuildingIcon type={building.type} style={s.id} accent={accent} faded={faded} size={72} className={styles.tileArt} />
                <span className={styles.tileLabel}>{s.label}</span>
                {s.id === style && (
                  <span className={styles.tileCheck} aria-hidden>
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      <h3 className={styles.sectionTitle}>Grounds</h3>
      <div className={styles.tiles} role="radiogroup" aria-label="Grounds">
        {groundsFor(building.type).map((g) => (
          <button
            key={g.id}
            type="button"
            role="radio"
            aria-checked={g.id === grounds}
            className={`${styles.tile} ${g.id === grounds ? styles.tileOn : ""}`}
            onClick={() => g.id !== grounds && onGrounds(g.id)}
          >
            <BuildingIcon
              type={building.type}
              style={style}
              grounds={g.id}
              accent={accent}
              faded={faded}
              size={72}
              className={styles.tileArt}
            />
            <span className={styles.tileLabel}>{g.label}</span>
            {g.id === grounds && (
              <span className={styles.tileCheck} aria-hidden>
                <Check size={12} strokeWidth={3} />
              </span>
            )}
          </button>
        ))}
      </div>

      <h3 className={styles.sectionTitle}>Color</h3>
      <div className={styles.swatches} role="radiogroup" aria-label="Accent color">
        {ACCENTS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={c === accent}
            aria-label={`Accent ${c}`}
            className={`${styles.swatch} ${c === accent ? styles.swatchOn : ""}`}
            style={{ background: c }}
            onClick={() => c !== accent && onAccent(c)}
          >
            {c === accent && <Check size={14} strokeWidth={3} aria-hidden />}
          </button>
        ))}
      </div>
    </section>
  );
});
