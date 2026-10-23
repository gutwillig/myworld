import type { Link } from "@/store/types";

/** Adds https:// when the user pasted a bare domain. Returns null when it can't be a URL. */
export function normalizeUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v || /\s/.test(v)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    if (!/^https?:$/.test(u.protocol)) return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Auto-label from the domain: linkedin.com/company/fullsend → "linkedin.com/company/fullsend". */
export function labelFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "");
    const short = path && path.length <= 28 ? `${host}${path}` : host;
    return short;
  } catch {
    return url;
  }
}

export type LinkKind = "linkedin" | "github" | "twitter" | "youtube" | "instagram" | "web";

export function linkKind(link: Link): LinkKind {
  try {
    const host = new URL(link.url).hostname.replace(/^www\./, "");
    if (host.endsWith("linkedin.com")) return "linkedin";
    if (host.endsWith("github.com")) return "github";
    if (host === "x.com" || host.endsWith("twitter.com")) return "twitter";
    if (host.endsWith("youtube.com") || host === "youtu.be") return "youtube";
    if (host.endsWith("instagram.com")) return "instagram";
  } catch {
    /* fall through */
  }
  return "web";
}

export function parseResidents(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 40);
}
