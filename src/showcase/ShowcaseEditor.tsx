import { useRef, useState } from "react";
import { Briefcase, Clapperboard, ImagePlus, Images, Plus, Trash2, X } from "lucide-react";
import { nanoid } from "nanoid";
import type { Showcase } from "@/store/types";
import { normalizeUrl } from "@/panel/links";
import { InlineText } from "@/panel/fields";
import { fileToDataUrl, parseVideo } from "./media";
import editor from "./showcase.module.css";
import panel from "@/panel/panel.module.css";

export type ShowcaseEditorProps = {
  showcase: Showcase | undefined;
  onChange: (s: Showcase | undefined) => void;
};

const TEMPLATES = [
  { id: "reel", label: "Reel", Icon: Clapperboard, hint: "A video that plays right here — YouTube, Vimeo, or an .mp4 link." },
  { id: "studio", label: "Studio", Icon: Briefcase, hint: "A cover image, then your case studies." },
  { id: "scrapbook", label: "Scrapbook", Icon: Images, hint: "Photos with captions, one at a time." },
] as const;

const MAX_SHOTS = 8;

/** The panel section that picks a showcase template and fills in its media. */
export function ShowcaseEditor({ showcase, onChange }: ShowcaseEditorProps) {
  const pick = (id: (typeof TEMPLATES)[number]["id"]) => {
    if (showcase?.template === id) return;
    onChange(
      id === "reel"
        ? { template: "reel", tagline: "", videoUrl: "" }
        : id === "studio"
          ? { template: "studio", tagline: "", cover: "", cases: [] }
          : { template: "scrapbook", tagline: "", shots: [] },
    );
  };

  return (
    <section className={editor.editor}>
      <h3 className={panel.sectionTitle}>Showcase</h3>
      <div className={editor.picker} role="group" aria-label="Showcase template">
        {TEMPLATES.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={`${editor.tile} ${showcase?.template === id ? editor.tileOn : ""}`}
            onClick={() => pick(id)}
            aria-pressed={showcase?.template === id}
          >
            <Icon size={17} strokeWidth={2.1} aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {showcase?.template === "reel" && <ReelFields showcase={showcase} onChange={onChange} />}
      {showcase?.template === "studio" && <StudioFields showcase={showcase} onChange={onChange} />}
      {showcase?.template === "scrapbook" && <ScrapbookFields showcase={showcase} onChange={onChange} />}

      {showcase && (
        <button type="button" className={editor.clearBtn} onClick={() => onChange(undefined)}>
          Remove showcase
        </button>
      )}
    </section>
  );
}

type FieldsProps<T extends Showcase> = { showcase: T; onChange: (s: Showcase | undefined) => void };

function Tagline({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  return (
    <InlineText ariaLabel="Tagline" className={editor.textField} value={value} placeholder="Tagline — one good line" maxLength={90} onCommit={onCommit} />
  );
}

function ReelFields({ showcase, onChange }: FieldsProps<Extract<Showcase, { template: "reel" }>>) {
  const bad = showcase.videoUrl.trim() !== "" && !parseVideo(showcase.videoUrl);
  return (
    <>
      <Tagline value={showcase.tagline} onCommit={(tagline) => onChange({ ...showcase, tagline })} />
      <textarea
        className={editor.textField}
        aria-label="Video URL or embed"
        placeholder="Paste a YouTube link, Vimeo link, Vimeo embed code, or .mp4 URL"
        value={showcase.videoUrl}
        rows={2}
        onChange={(e) => onChange({ ...showcase, videoUrl: e.target.value })}
      />
      {bad ? (
        <p className={panel.fieldError}>Paste a YouTube link, Vimeo link/embed, or direct video URL.</p>
      ) : (
        <p className={editor.fieldHint}>Visitors see the poster and press play without leaving the world.</p>
      )}
    </>
  );
}

function StudioFields({ showcase, onChange }: FieldsProps<Extract<Showcase, { template: "studio" }>>) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cases = showcase.cases;
  return (
    <>
      <Tagline value={showcase.tagline} onCommit={(tagline) => onChange({ ...showcase, tagline })} />
      <label className={editor.coverBox}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) onChange({ ...showcase, cover: await fileToDataUrl(f, 1600, 0.82) });
            e.target.value = "";
          }}
        />
        {showcase.cover ? (
          <>
            <img src={showcase.cover} alt="Cover" />
            <button
              type="button"
              className={editor.coverX}
              aria-label="Remove cover"
              onClick={(e) => {
                e.preventDefault();
                onChange({ ...showcase, cover: "" });
              }}
            >
              <Trash2 size={14} strokeWidth={2.2} />
            </button>
          </>
        ) : (
          <span className={editor.coverInner}>
            <ImagePlus size={17} strokeWidth={2} aria-hidden />
            Upload a cover image
          </span>
        )}
      </label>

      <div className={editor.rowList}>
        {cases.map((c, i) => (
          <div key={c.id} className={editor.row}>
            <span className={editor.rowThumb} aria-hidden>
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className={editor.rowBody}>
              <InlineText
                ariaLabel={`Case ${i + 1} title`}
                className={panel.linkLabel}
                value={c.title}
                placeholder="Case title"
                allowEmpty={false}
                maxLength={70}
                onCommit={(title) => onChange({ ...showcase, cases: cases.map((x, j) => (j === i ? { ...x, title } : x)) })}
              />
              <textarea
                className={editor.blurb}
                aria-label={`Case ${i + 1} description`}
                placeholder="One or two lines about it…"
                maxLength={220}
                rows={2}
                value={c.blurb}
                onChange={(e) => onChange({ ...showcase, cases: cases.map((x, j) => (j === i ? { ...x, blurb: e.target.value } : x)) })}
              />
              <input
                className={editor.textField}
                aria-label={`Case ${i + 1} link`}
                placeholder="Link (optional)"
                value={c.url}
                inputMode="url"
                onChange={(e) => onChange({ ...showcase, cases: cases.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })}
                onBlur={(e) => {
                  const url = normalizeUrl(e.target.value);
                  if (url !== c.url) onChange({ ...showcase, cases: cases.map((x, j) => (j === i ? { ...x, url } : x)) });
                }}
              />
            </div>
            <button
              type="button"
              className={editor.del}
              aria-label={`Remove case ${i + 1}`}
              onClick={() => onChange({ ...showcase, cases: cases.filter((_, j) => j !== i) })}
            >
              <X size={15} strokeWidth={2.2} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className={editor.ghostAdd}
        onClick={() => onChange({ ...showcase, cases: [...cases, { id: nanoid(6), title: "", blurb: "", url: "" }] })}
      >
        <Plus size={16} strokeWidth={2.2} aria-hidden />
        Add a case study
      </button>
    </>
  );
}

function ScrapbookFields({ showcase, onChange }: FieldsProps<Extract<Showcase, { template: "scrapbook" }>>) {
  const shots = showcase.shots;
  return (
    <>
      <Tagline value={showcase.tagline} onCommit={(tagline) => onChange({ ...showcase, tagline })} />
      <label className={editor.coverBox}>
        <input
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={async (e) => {
            const files = [...(e.target.files ?? [])].slice(0, MAX_SHOTS - shots.length);
            const added = await Promise.all(
              files.map(async (f) => ({ id: nanoid(6), src: await fileToDataUrl(f, 1200, 0.78), caption: "" })),
            );
            if (added.length) onChange({ ...showcase, shots: [...shots, ...added] });
            e.target.value = "";
          }}
        />
        <span>
          <ImagePlus size={17} strokeWidth={2} aria-hidden />
          Upload photos{shots.length > 0 && ` (${shots.length}/${MAX_SHOTS})`}
        </span>
      </label>

      <div className={editor.rowList}>
        {shots.map((sh, i) => (
          <div key={sh.id} className={editor.row}>
            <span className={editor.rowThumb}>
              {sh.src ? <img src={sh.src} alt="" /> : <Images size={16} aria-hidden />}
            </span>
            <div className={editor.rowBody}>
              <InlineText
                ariaLabel={`Photo ${i + 1} caption`}
                className={panel.linkLabel}
                value={sh.caption}
                placeholder="Caption"
                maxLength={70}
                onCommit={(caption) => onChange({ ...showcase, shots: shots.map((x, j) => (j === i ? { ...x, caption } : x)) })}
              />
            </div>
            <button
              type="button"
              className={editor.del}
              aria-label={`Remove photo ${i + 1}`}
              onClick={() => onChange({ ...showcase, shots: shots.filter((_, j) => j !== i) })}
            >
              <X size={15} strokeWidth={2.2} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
