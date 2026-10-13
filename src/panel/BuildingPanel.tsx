import { memo } from "react";
import { ArrowUpRight, MapPin, Trash2, X } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import { BuildingIcon } from "@/buildings/BuildingIcon";
import { buildingAccent } from "@/buildings/kit";
import { typeLabel } from "@/buildings/suggest";
import type { Building, Link, Showcase, Status } from "@/store/types";
import { ShowcaseEditor } from "@/showcase/ShowcaseEditor";
import { InlineText, LinksField, ResidentsField, StatusChip } from "./fields";
import { LookPicker } from "./LookPicker";
import styles from "./panel.module.css";

export type BuildingPanelProps = {
  building: Building;
  flatHref: string;
  onClose: () => void;
  onRename: (name: string) => void;
  onOneLiner: (v: string) => void;
  onStatus: (s: Status) => void;
  onLinks: (l: Link[]) => void;
  onResidents: (r: string[]) => void;
  onKnockDown: () => void;
  onStyle: (id: string) => void;
  onGrounds: (id: string) => void;
  onAccent: (hex: string) => void;
  /** Sets (or clears) the building's showcase. */
  onShowcase: (s: Showcase | undefined) => void;
  /** Opens a resident's profile (and a way to visit their world). */
  onOpenResident?: (name: string) => void;
  residentHasWorld?: (name: string) => boolean;
};

/**
 * Everything about one building, editable in place. Takes a Building and callbacks only —
 * nothing from three.js — so the flat page and future layouts can reuse it.
 */
export const BuildingPanel = memo(function BuildingPanel({
  building,
  flatHref,
  onClose,
  onRename,
  onOneLiner,
  onStatus,
  onLinks,
  onResidents,
  onKnockDown,
  onStyle,
  onGrounds,
  onAccent,
  onShowcase,
  onOpenResident,
  residentHasWorld,
}: BuildingPanelProps) {
  const isPast = building.status === "past";
  return (
    <aside className={styles.panel} aria-label={`${building.name} details`}>
      <div className={styles.panelTop}>
        <BuildingIcon
          type={building.type}
          style={building.style}
          grounds={building.grounds}
          accent={buildingAccent(building)}
          faded={isPast}
          size={112}
          className={styles.panelIcon}
          alt={`${typeLabel(building.type)} icon`}
        />
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close panel">
          <X size={20} strokeWidth={2} />
        </button>
      </div>

      <div className={styles.scroll}>
        <p className={styles.kind}>{typeLabel(building.type)}</p>
        <InlineText
          ariaLabel="Building name"
          className={styles.name}
          value={building.name}
          placeholder="Name"
          allowEmpty={false}
          maxLength={48}
          onCommit={onRename}
        />
        <div className={styles.statusRow}>
          <StatusChip status={building.status} onChange={onStatus} />
        </div>
        <InlineText
          ariaLabel="One-liner"
          className={styles.oneLiner}
          value={building.oneLiner}
          placeholder="What happens here?"
          maxLength={160}
          multiline
          onCommit={onOneLiner}
        />

        <hr className={styles.rule} />
        <LookPicker building={building} onStyle={onStyle} onGrounds={onGrounds} onAccent={onAccent} />

        <hr className={styles.rule} />
        <ShowcaseEditor showcase={building.showcase} onChange={onShowcase} />

        <hr className={styles.rule} />
        <LinksField links={building.links} onChange={onLinks} />

        <hr className={styles.rule} />
        <h3 className={styles.sectionTitle}>Residents</h3>
        <ResidentsField
          residents={building.residents}
          onChange={onResidents}
          onOpen={onOpenResident}
          hasWorld={residentHasWorld}
        />

        <RouterLink to={flatHref} className={styles.flatLink}>
          View as a page
          <ArrowUpRight size={15} strokeWidth={2.2} aria-hidden />
        </RouterLink>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={() => onStatus(isPast ? "active" : "past")}>
          <MapPin size={18} strokeWidth={2.1} aria-hidden />
          {isPast ? "Bring back to town" : "Move to Old Town"}
        </button>
        <button type="button" className={styles.quiet} onClick={onKnockDown}>
          <Trash2 size={17} strokeWidth={2} aria-hidden />
          Knock down
        </button>
      </div>
    </aside>
  );
});
