import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Camera, ChevronLeft, ChevronRight, Pencil, Play, X } from "lucide-react";
import { BuildingIcon } from "@/buildings/BuildingIcon";
import { buildingAccent } from "@/buildings/kit";
import { typeLabel } from "@/buildings/suggest";
import type { Building, Showcase } from "@/store/types";
import { UpdatesField } from "@/updates/UpdatesField";
import { parseVideo, ytEmbedUrl, ytThumb } from "./media";
import styles from "./showcase.module.css";

export type ShowcaseOverlayProps = {
  building: Building;
  /** Only the owner gets the Edit path; visitors consume. */
  canEdit: boolean;
  onClose: () => void;
  onEdit: () => void;
  /** Owner only: post news straight from the showcase. */
  onPostUpdate?: (buildingId: string, text: string) => boolean;
};

export const showcaseLabel = (s: Showcase): string =>
  s.template === "reel" ? "Reel" : s.template === "studio" ? "Studio" : "Scrapbook";

/** The big, consumable card that opens when a building with a showcase is clicked. */
export const ShowcaseOverlay = memo(function ShowcaseOverlay({
  building,
  canEdit,
  onClose,
  onEdit,
  onPostUpdate,
}: ShowcaseOverlayProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const showcase = building.showcase;
  if (!showcase) return null;

  return (
    <div className={styles.wrap} role="dialog" aria-modal="true" aria-label={`${building.name} showcase`}>
      <button type="button" className={styles.scrim} aria-label="Close" onClick={onClose} />
      <article className={styles.card}>
        <header className={styles.head}>
          <BuildingIcon type={building.type} style={building.style} accent={buildingAccent(building)} size={44} alt="" />
          <div className={styles.headText}>
            <p className={styles.eyebrow}>
              {showcaseLabel(showcase)} · {typeLabel(building.type)}
            </p>
            <h2 className={styles.name}>{building.name}</h2>
          </div>
          {canEdit && (
            <button type="button" className={styles.editBtn} onClick={onEdit}>
              <Pencil size={14} strokeWidth={2.3} aria-hidden />
              Edit
            </button>
          )}
          <button type="button" className={styles.x} onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={2.2} />
          </button>
        </header>

        {showcase.template === "reel" && <Reel key="reel" tagline={showcase.tagline} videoUrl={showcase.videoUrl} />}
        {showcase.template === "studio" && (
          <Studio key="studio" tagline={showcase.tagline} cover={showcase.cover} cases={showcase.cases} />
        )}
        {showcase.template === "scrapbook" && (
          <Scrapbook key="scrapbook" tagline={showcase.tagline} shots={showcase.shots} />
        )}

        {building.oneLiner && <p className={styles.liner}>{building.oneLiner}</p>}

        {(canEdit || (building.updates?.length ?? 0) > 0) && (
          <div className={styles.news}>
            <p className={styles.newsTitle}>Updates</p>
            <UpdatesField building={building} onPost={canEdit ? onPostUpdate : undefined} limit={3} />
          </div>
        )}

        {building.links.length > 0 && (
          <div className={styles.linksRow}>
            {building.links.map((l) => (
              <a key={l.url} className={styles.linkChip} href={l.url} target="_blank" rel="noreferrer">
                {l.label}
                <ArrowUpRight size={13} strokeWidth={2.4} aria-hidden />
              </a>
            ))}
          </div>
        )}
      </article>
    </div>
  );
});

/** Video template: YouTube poster + click-to-play, or a direct file with native controls. */
function Reel({ tagline, videoUrl }: { tagline: string; videoUrl: string }) {
  const embed = useMemo(() => parseVideo(videoUrl), [videoUrl]);
  const [playing, setPlaying] = useState<boolean>(false);
  return (
    <>
      <div className={styles.stage}>
        {!embed ? (
          <div className={styles.stageEmpty}>No video yet — paste one in the panel.</div>
        ) : embed.kind === "file" ? (
          <video className={styles.video} src={embed.url} controls autoPlay playsInline />
        ) : playing ? (
          <iframe
            className={styles.video}
            src={ytEmbedUrl(embed.id)}
            title="Video"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            className={styles.poster}
            style={{ backgroundImage: `url(${ytThumb(embed.id)})` }}
            onClick={() => setPlaying(true)}
            aria-label="Play video"
          >
            <span className={styles.playBtn}>
              <Play size={26} strokeWidth={2.4} fill="currentColor" aria-hidden />
            </span>
          </button>
        )}
      </div>
      {tagline && <p className={styles.tagline}>{tagline}</p>}
    </>
  );
}

/** Portfolio template: cover image, then numbered case studies. */
function Studio({
  tagline,
  cover,
  cases,
}: {
  tagline: string;
  cover: string;
  cases: { id: string; title: string; blurb: string; url: string }[];
}) {
  return (
    <>
      {cover && (
        <div className={styles.cover}>
          <img src={cover} alt="" />
        </div>
      )}
      {tagline && <p className={styles.tagline}>{tagline}</p>}
      {cases.length > 0 && (
        <ol className={styles.cases}>
          {cases.map((c, i) => (
            <li key={c.id} className={styles.case}>
              <span className={styles.caseNum} aria-hidden>
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <p className={styles.caseTitle}>{c.title || "Untitled"}</p>
                {c.blurb && <p className={styles.caseBlurb}>{c.blurb}</p>}
                {c.url && (
                  <a className={styles.caseLink} href={c.url} target="_blank" rel="noreferrer">
                    Open case
                    <ArrowUpRight size={13} strokeWidth={2.4} aria-hidden />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

/** Photo template: one slide at a time, arrows / dots / keyboard. */
function Scrapbook({ tagline, shots }: { tagline: string; shots: { id: string; src: string; caption: string }[] }) {
  const [i, setI] = useState<number>(0);
  const n = shots.length;
  const go = useCallback(
    (d: number) => {
      if (n > 0) setI((v) => (v + d + n) % n);
    },
    [n],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  return (
    <>
      {n > 0 ? (
        <div className={styles.rail}>
          <div className={styles.railTrack} style={{ transform: `translateX(-${i * 100}%)` }}>
            {shots.map((sh) => (
              <figure className={styles.slide} key={sh.id}>
                {sh.src ? (
                  <img src={sh.src} alt={sh.caption || "Photo"} />
                ) : (
                  <Camera size={44} strokeWidth={1.6} className={styles.shotPh} aria-hidden />
                )}
              </figure>
            ))}
          </div>
          {shots[i]?.caption && <span className={styles.railCaption}>{shots[i]?.caption}</span>}
          {n > 1 && (
            <>
              <button type="button" className={`${styles.arrow} ${styles.arrowPrev}`} onClick={() => go(-1)} aria-label="Previous photo">
                <ChevronLeft size={20} strokeWidth={2.3} />
              </button>
              <button type="button" className={`${styles.arrow} ${styles.arrowNext}`} onClick={() => go(1)} aria-label="Next photo">
                <ChevronRight size={20} strokeWidth={2.3} />
              </button>
              <span className={styles.dots} aria-hidden>
                {shots.map((sh, j) => (
                  <span key={sh.id} className={`${styles.dot} ${j === i ? styles.dotOn : ""}`} />
                ))}
              </span>
            </>
          )}
        </div>
      ) : (
        <div className={styles.stage}>
          <div className={styles.stageEmpty}>No photos yet — add some in the panel.</div>
        </div>
      )}
      {tagline && <p className={styles.tagline}>{tagline}</p>}
    </>
  );
}
