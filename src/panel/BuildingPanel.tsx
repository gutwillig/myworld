import { memo, useEffect, useState } from "react";
import { ArrowUpRight, MapPin, Trash2, X } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import { BuildingIcon } from "@/buildings/BuildingIcon";
import { buildingAccent } from "@/buildings/kit";
import { typeLabel } from "@/buildings/suggest";
import type { Building, Link, Shot, Showcase, Status } from "@/store/types";
import { ShowcaseEditor } from "@/showcase/ShowcaseEditor";
import { launchOf, videoOf, ytEmbedUrl, type Embed } from "@/showcase/media";
import { UpdatesField } from "@/updates/UpdatesField";
import { useWorldStore } from "@/store/world";
import { districtOf } from "@/grid/layout";
import { toast } from "sonner";
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
  onPostUpdate: (buildingId: string, text: string) => boolean;
  onRemoveUpdate: (updateId: string) => void;
};

/** Autoplaying preview for the panel hero: reel video, cover, or cycling scrapbook shots. */
function HeroMedia({ showcase, embed }: { showcase?: Showcase; embed: Embed | null }) {
  if (embed) {
    if (embed.kind === "file")
      return <video className={styles.heroMedia} src={embed.url} autoPlay muted loop playsInline />;
    return (
      <iframe
        key={embed.id}
        className={styles.heroMedia}
        src={`${ytEmbedUrl(embed.id)}&mute=1&loop=1&playlist=${embed.id}&controls=0`}
        title="Preview"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="autoplay; encrypted-media"
      />
    );
  }
  if (!showcase || showcase.template === "reel") return null;
  if (showcase.template === "studio") {
    return showcase.cover ? <img className={styles.heroMedia} src={showcase.cover} alt="" /> : null;
  }
  return <ShotCycle shots={showcase.shots.filter((s) => s.src)} />;
}

/** Crossfades through a scrapbook's shots, one every 2.6s. */
function ShotCycle({ shots }: { shots: Shot[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (shots.length < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % shots.length), 2600);
    return () => clearInterval(t);
  }, [shots.length]);
  const shot = shots[i % Math.max(1, shots.length)];
  return shot ? <img key={shot.id} className={styles.heroMedia} src={shot.src} alt="" /> : null;
}

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
}: BuildingPanelProps) {
  const isPast = building.status === "past";
  const isKid = !!building.parentId;
  const isGig = building.category === "gig";
  const setGig = useWorldStore((s) => s.setGig);
  const updateBuilding = useWorldStore((s) => s.updateBuilding);
  const gigName = useWorldStore((s) => (isKid ? s.world.buildings.find((b) => b.id === building.parentId)?.name : undefined));
  const otherGig = useWorldStore((s) =>
    s.world.buildings.some((b) => b.category === "gig" && b.status !== "past" && !b.parentId && b.id !== building.id),
  );
  const district = useWorldStore((s) => (isKid || isGig || isPast ? null : districtOf(s.world.terrain, building.hex)));
  const setDistrict = useWorldStore((s) => s.setDistrict);
  const video = videoOf(building);
  const launch = launchOf(building);
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
        {(building.showcase || video || launch) && (
          <div className={styles.hero}>
            <HeroMedia showcase={building.showcase} embed={video} />
            {launch && (
              <a className={styles.launch} href={launch.url} target="_blank" rel="noreferrer">
                {building.status === "lab" ? "Try it" : "Play it"}
                <ArrowUpRight size={17} strokeWidth={2.4} aria-hidden />
              </a>
            )}
          </div>
        )}
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
        {isKid ? (
          <div className={styles.plazaRow}>
            <span className={styles.plazaTag}>On {gigName ?? "the"} plaza</span>
            <InlineText
              ariaLabel="Client"
              className={styles.clientField}
              value={building.client ?? ""}
              placeholder="Add a client"
              maxLength={32}
              onCommit={(v) => updateBuilding(building.id, { client: v.trim() || undefined })}
            />
          </div>
        ) : (
          <div className={styles.statusRow}>
            <StatusChip status={building.status} onChange={onStatus} />
            {!isPast && (isGig || !otherGig) && (
              <button
                type="button"
                className={`${styles.gigToggle} ${isGig ? styles.gigToggleOn : ""}`}
                aria-pressed={isGig}
                onClick={() => setGig(building.id, !isGig)}
              >
                {isGig ? "Main gig plaza ✓" : "Make main gig plaza"}
              </button>
            )}
          </div>
        )}
        {district && (
          <div className={styles.districtSeg} role="radiogroup" aria-label="Which part of town">
            {(["side", "fun"] as const).map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={district === d}
                className={district === d ? styles.districtOn : ""}
                onClick={() => {
                  if (district !== d && !setDistrict(building.id, d))
                    toast(`The ${d === "fun" ? "playground" : "fountain"} is full.`);
                }}
              >
                {d === "side" ? "Side hustle · Fountain" : "For fun · Playground"}
              </button>
            ))}
          </div>
        )}
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
        <h3 className={styles.sectionTitle}>Updates</h3>
        <UpdatesField building={building} onPost={onPostUpdate} onRemove={onRemoveUpdate} />

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
        {!isKid && (
          <button type="button" className={styles.primary} onClick={() => onStatus(isPast ? "active" : "past")}>
            <MapPin size={18} strokeWidth={2.1} aria-hidden />
            {isPast ? "Bring back to town" : "Move to Old Town"}
          </button>
        )}
        <button type="button" className={styles.quiet} onClick={onKnockDown}>
          <Trash2 size={17} strokeWidth={2} aria-hidden />
          Knock down
        </button>
      </div>
    </aside>
  );
});
