import { useEffect, useRef, useState } from "react";
import { ExternalLink, Github, Globe, Instagram, Linkedin, Plane, Plus, Twitter, X, Youtube } from "lucide-react";
import type { Link, Status } from "@/store/types";
import { type LinkKind, labelFromUrl, linkKind, normalizeUrl, parseResidents } from "./links";
import styles from "./panel.module.css";

/** Click-to-edit text that writes on blur (or Enter). Empty is a valid state. */
export function InlineText({
  value,
  placeholder,
  onCommit,
  className,
  multiline = false,
  ariaLabel,
  maxLength = 140,
  allowEmpty = true,
}: {
  value: string;
  placeholder: string;
  onCommit: (v: string) => void;
  className?: string;
  multiline?: boolean;
  ariaLabel: string;
  maxLength?: number;
  allowEmpty?: boolean;
}) {
  const [draft, setDraft] = useState<string>(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setDraft(value), [value]);

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  };
  useEffect(resize, [draft]);

  const commit = () => {
    const v = draft.replace(/\s+/g, " ").trim();
    if (!v && !allowEmpty) {
      setDraft(value);
      return;
    }
    if (v !== value) onCommit(v);
  };

  return (
    <textarea
      ref={ref}
      rows={1}
      aria-label={ariaLabel}
      className={`${styles.inline} ${className ?? ""}`}
      value={draft}
      placeholder={placeholder}
      maxLength={maxLength}
      onChange={(e) => setDraft(multiline ? e.target.value : e.target.value.replace(/\n/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          (e.target as HTMLTextAreaElement).blur();
        }
        if (e.key === "Escape") {
          e.stopPropagation();
          setDraft(value);
          window.setTimeout(() => ref.current?.blur(), 0);
        }
      }}
      spellCheck
    />
  );
}

const STATUS_COPY: Record<Status, { label: string; hint: string }> = {
  active: { label: "Active", hint: "On a paved road" },
  lab: { label: "Lab", hint: "An experiment" },
  past: { label: "Past", hint: "Lives in Old Town" },
};
const NEXT: Record<Status, Status> = { active: "past", past: "lab", lab: "active" };

/** Click cycles active → past → lab. */
export function StatusChip({ status, onChange }: { status: Status; onChange: (s: Status) => void }) {
  return (
    <button
      type="button"
      className={`${styles.chip} ${styles[`chip_${status}`]}`}
      onClick={() => onChange(NEXT[status])}
      title={`${STATUS_COPY[status].hint}. Click to make it ${STATUS_COPY[NEXT[status]].label.toLowerCase()}.`}
    >
      <span className={styles.chipDot} aria-hidden />
      {STATUS_COPY[status].label}
      <span className={styles.chipNext} aria-hidden>
        → {STATUS_COPY[NEXT[status]].label}
      </span>
    </button>
  );
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`${styles.chip} ${styles[`chip_${status}`]} ${styles.chipStatic}`}>
      <span className={styles.chipDot} aria-hidden />
      {STATUS_COPY[status].label}
    </span>
  );
}

const ICONS: Record<LinkKind, typeof Globe> = {
  linkedin: Linkedin,
  github: Github,
  twitter: Twitter,
  youtube: Youtube,
  instagram: Instagram,
  web: Globe,
};

export function LinkIcon({ link, size = 17 }: { link: Link; size?: number }) {
  const Icon = ICONS[linkKind(link)];
  return <Icon size={size} strokeWidth={2} aria-hidden />;
}

/** Links list: label+URL rows. Paste a URL and the label fills from the domain. */
export function LinksField({ links, onChange }: { links: Link[]; onChange: (l: Link[]) => void }) {
  const [adding, setAdding] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    if (!adding.trim()) return;
    const url = normalizeUrl(adding);
    if (!url) {
      setError("That doesn't look like a link yet.");
      return;
    }
    onChange([...links, { url, label: labelFromUrl(url) }]);
    setAdding("");
    setError(null);
  };

  return (
    <div className={styles.links}>
      {links.map((l, i) => (
        <div key={`${l.url}:${i}`} className={styles.linkRow}>
          <span className={styles.linkIcon}>
            <LinkIcon link={l} />
          </span>
          <InlineText
            ariaLabel="Link label"
            className={styles.linkLabel}
            value={l.label}
            placeholder={labelFromUrl(l.url)}
            allowEmpty={false}
            maxLength={60}
            onCommit={(label) => onChange(links.map((x, j) => (j === i ? { ...x, label } : x)))}
          />
          <a className={styles.iconBtn} href={l.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${l.label}`}>
            <ExternalLink size={16} strokeWidth={2} />
          </a>
          <button type="button" className={`${styles.iconBtn} ${styles.removeBtn}`} aria-label={`Remove ${l.label}`} onClick={() => onChange(links.filter((_, j) => j !== i))}>
            <X size={15} strokeWidth={2.2} />
          </button>
        </div>
      ))}
      <form
        className={styles.addRow}
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Plus size={18} strokeWidth={2} aria-hidden className={styles.addIcon} />
        <input
          className={styles.addInput}
          aria-label="Add a link"
          placeholder="Add a link"
          value={adding}
          onChange={(e) => {
            setAdding(e.target.value);
            setError(null);
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            const url = normalizeUrl(text);
            if (url && !adding.trim()) {
              e.preventDefault();
              onChange([...links, { url, label: labelFromUrl(url) }]);
              setError(null);
            }
          }}
          onBlur={add}
          inputMode="url"
        />
      </form>
      {error && <p className={styles.fieldError}>{error}</p>}
    </div>
  );
}

const AVATAR_TINTS = [
  ["#FCE3D3", "#B85B2E"],
  ["#DCE8F2", "#3B6A93"],
  ["#E8DDF5", "#6B4AA0"],
  ["#DCEBD6", "#3E6B3B"],
  ["#F8E6B9", "#8A6416"],
];

export function avatarTint(name: string): [string, string] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length] as [string, string];
}

export function Avatar({ name, size = 30 }: { name: string; size?: number }) {
  const [bg, fg] = avatarTint(name);
  return (
    <span className={styles.avatar} style={{ background: bg, color: fg, width: size, height: size, fontSize: size * 0.46 }} aria-hidden>
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * Residents typed comma-separated, rendered as pills. With `onOpen`, each pill is a profile
 * you can click; `hasWorld` marks the ones who already have a world to visit.
 */
export function ResidentsField({
  residents,
  onChange,
  onOpen,
  hasWorld,
}: {
  residents: string[];
  onChange: (r: string[]) => void;
  onOpen?: (name: string) => void;
  hasWorld?: (name: string) => boolean;
}) {
  const [draft, setDraft] = useState<string>("");
  const commit = () => {
    const names = parseResidents(draft).filter((n) => !residents.some((r) => r.toLowerCase() === n.toLowerCase()));
    if (names.length) onChange([...residents, ...names]);
    setDraft("");
  };
  return (
    <div className={styles.residents}>
      {residents.length > 0 && (
        <ul className={styles.pills}>
          {residents.map((r, i) => (
            <li key={`${r}:${i}`} className={`${styles.pill} ${onOpen ? styles.pillOpenable : ""}`}>
              {onOpen ? (
                <button
                  type="button"
                  className={styles.pillOpen}
                  onClick={() => onOpen(r)}
                  aria-label={hasWorld?.(r) ? `Visit ${r}’s world` : `Open ${r}’s profile`}
                >
                  <span className={styles.pillAvatar}>
                    <Avatar name={r} />
                    {hasWorld?.(r) && (
                      <span className={styles.pillWorld} aria-hidden>
                        <Plane size={10} strokeWidth={2.6} />
                      </span>
                    )}
                  </span>
                  <span>{r}</span>
                </button>
              ) : (
                <>
                  <Avatar name={r} />
                  <span>{r}</span>
                </>
              )}
              <button type="button" className={styles.pillX} aria-label={`Remove ${r}`} onClick={() => onChange(residents.filter((_, j) => j !== i))}>
                <X size={14} strokeWidth={2.4} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className={styles.addRow}
        onSubmit={(e) => {
          e.preventDefault();
          commit();
        }}
      >
        <Plus size={18} strokeWidth={2} aria-hidden className={styles.addIcon} />
        <input
          className={styles.addInput}
          aria-label="Add residents, separated by commas"
          placeholder="Add a resident"
          value={draft}
          onChange={(e) => {
            const v = e.target.value;
            if (v.endsWith(",")) {
              const names = parseResidents(v).filter((n) => !residents.some((r) => r.toLowerCase() === n.toLowerCase()));
              if (names.length) onChange([...residents, ...names]);
              setDraft("");
            } else setDraft(v);
          }}
          onBlur={commit}
        />
      </form>
    </div>
  );
}
