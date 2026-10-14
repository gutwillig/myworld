import { memo } from "react";
import { ArrowUpRight, MapPin, Trash2, X } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import { toast } from "sonner";
import { BuildingIcon } from "@/buildings/BuildingIcon";
import { buildingAccent } from "@/buildings/kit";
import { typeLabel } from "@/buildings/suggest";
import type { Building, Link, Showcase, Status } from "@/store/types";
import { ShowcaseEditor } from "@/showcase/ShowcaseEditor";
import { UpdatesField } from "@/updates/UpdatesField";
import { InlineText, LinksField, ResidentsField } from "./fields";
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
  onPostUpdate: (buildingId: string, text: string) => boolean;
  onRemoveUpdate: (updateId: string) => void;
  /** If true, the panel is read-only (visitor mode). */
  readOnly?: boolean;
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
  onPostUpdate,
  onRemoveUpdate,
  readOnly = false,
}: BuildingPanelProps) {
  const isPast = building.status === "past";

  const handleRename = (name: string) => {
    onRename(name);
    toast("Name saved");
  };

  const handleOneLiner = (text: string) => {
    onOneLiner(text);
    toast("Description saved");
  };

  const handleStyle = (id: string) => {
    onStyle(id);
    toast("Style updated");
  };

  const handleGrounds = (id: string) => {
    onGrounds(id);
    toast("Grounds updated");
  };

  const handleAccent = (hex: string) => {
    onAccent(hex);
    toast("Color updated");
  };

  const handleShowcase = (s: Showcase | undefined) => {
    onShowcase(s);
    toast(s ? "Showcase updated" : "Showcase cleared");
  };

  const handleLinks = (links: Link[]) => {
    onLinks(links);
    toast("Links saved");
  };

  const handleResidents = (residents: string[]) => {
    onResidents(residents);
    toast("Residents saved");
  };

  const handleStatusChange = () => {
    onStatus(isPast ? "active" : "past");
    toast(isPast ? "Moved back to town" : "Moved to Old Town");
  };

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
        {readOnly ? (
          <h2 className={styles.name}>{building.name}</h2>
        ) : (
          <InlineText
            ariaLabel="Building name"
            className={styles.name}
            value={building.name}
            placeholder="Name"
            allowEmpty={false}
            maxLength={48}
            onCommit={handleRename}
          />
        )}

        {/* One-liner / tagline - first editable field */}
        {readOnly ? (
          building.oneLiner && <p className={styles.oneLiner}>{building.oneLiner}</p>
        ) : (
          <InlineText
            ariaLabel="One-liner"
            className={styles.oneLiner}
            value={building.oneLiner}
            placeholder="What happens here? A tagline for people to understand what this is to you."
            maxLength={160}
            multiline
            onCommit={handleOneLiner}
          />
        )}

        {/* Style, Grounds, Color */}
        {!readOnly && (
          <>
            <hr className={styles.rule} />
            <h3 className={styles.sectionTitle}>Appearance</h3>
            <LookPicker
              building={building}
              onStyle={handleStyle}
              onGrounds={handleGrounds}
              onAccent={handleAccent}
            />
          </>
        )}

        {/* Showcase */}
        {!readOnly && (
          <>
            <hr className={styles.rule} />
            <h3 className={styles.sectionTitle}>Showcase</h3>
            <p className={styles.showcaseHint}>What do you want to focus on when someone opens this building?</p>
            <ShowcaseEditor showcase={building.showcase} onChange={handleShowcase} />
          </>
        )}

        {/* Updates */}
        <hr className={styles.rule} />
        <h3 className={styles.sectionTitle}>Updates</h3>
        <UpdatesField building={building} onPost={onPostUpdate} onRemove={onRemoveUpdate} />

        {/* Links */}
        {building.links.length > 0 && (
          <>
            <hr className={styles.rule} />
            {readOnly ? (
              <div className={styles.linksReadOnly}>
                {building.links.map((l) => (
                  <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className={styles.linkChip}>
                    {l.label}
                    <ArrowUpRight size={13} strokeWidth={2.4} aria-hidden />
                  </a>
                ))}
              </div>
            ) : (
              <LinksField links={building.links} onChange={handleLinks} />
            )}
          </>
        )}
        {!readOnly && building.links.length === 0 && (
          <>
            <hr className={styles.rule} />
            <LinksField links={building.links} onChange={handleLinks} />
          </>
        )}

        {/* Residents */}
        {(building.residents.length > 0 || !readOnly) && (
          <>
            <hr className={styles.rule} />
            <h3 className={styles.sectionTitle}>Residents</h3>
            <ResidentsField
              residents={building.residents}
              onChange={readOnly ? undefined : handleResidents}
              onOpen={onOpenResident}
              hasWorld={residentHasWorld}
            />
          </>
        )}

        <RouterLink to={flatHref} className={styles.flatLink}>
          View as a page
          <ArrowUpRight size={15} strokeWidth={2.2} aria-hidden />
        </RouterLink>

        {/* Secondary actions - smaller CTAs at bottom of scroll area */}
        {!readOnly && (
          <div className={styles.secondaryActions}>
            <button type="button" className={styles.secondaryBtn} onClick={handleStatusChange}>
              <MapPin size={15} strokeWidth={2.1} aria-hidden />
              {isPast ? "Bring back to town" : "Move to Old Town"}
            </button>
            <button type="button" className={styles.dangerBtn} onClick={onKnockDown}>
              <Trash2 size={15} strokeWidth={2} aria-hidden />
              Knock down
            </button>
          </div>
        )}
      </div>
    </aside>
  );
});
