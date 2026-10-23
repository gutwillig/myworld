/** Media plumbing for showcases: video URL parsing and image file shrinking. */

/** A video the viewer can play: a YouTube embed or a direct file. */
export type Embed = { kind: "youtube"; id: string } | { kind: "file"; url: string };

/** Accepts watch/share/embed/shorts YouTube URLs, or a direct .mp4/.webm/.mov URL. */
export function parseVideo(raw: string): Embed | null {
  const url = raw.trim();
  if (!url) return null;
  const yt = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,20})/i,
  );
  if (yt) return { kind: "youtube", id: yt[1] ?? "" };
  if (/^https:\/\/.*\.(mp4|webm|mov)(\?.*)?$/i.test(url)) return { kind: "file", url };
  return null;
}

/** The video a building plays: its reel, or failing that the first link that is a video. */
export function videoOf(b: { showcase?: { template: string; videoUrl?: string }; links: { url: string }[] }): Embed | null {
  if (b.showcase?.template === "reel") {
    const v = parseVideo(b.showcase.videoUrl ?? "");
    if (v) return v;
  }
  for (const l of b.links) {
    const v = parseVideo(l.url);
    if (v) return v;
  }
  return null;
}

/** The link the big "Play it" button opens: the first link that isn't a video. */
export function launchOf<L extends { url: string }>(b: { links: L[] }): L | undefined {
  return b.links.find((l) => !parseVideo(l.url));
}

/** True when clicking the building should open the experience card instead of the editor. */
export const hasExperience = (b: Parameters<typeof videoOf>[0]): boolean =>
  !!b.showcase || !!videoOf(b) || !!launchOf(b);

export const ytThumb = (id: string): string => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

export const ytEmbedUrl = (id: string): string =>
  `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;

/**
 * Reads an image file and returns a resized JPEG data URL (long edge capped), small
 * enough for localStorage. Falls back to the raw data URL if decoding fails.
 */
export function fileToDataUrl(file: File, maxDim = 1600, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const raw = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d");
        if (!ctx) {
          resolve(raw);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => resolve(raw);
      img.src = raw;
    };
    reader.readAsDataURL(file);
  });
}
