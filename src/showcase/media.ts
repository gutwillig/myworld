/** Media plumbing for showcases: video URL parsing and image file shrinking. */

/** A video the viewer can play: YouTube, Vimeo, or a direct file. */
export type Embed =
  | { kind: "youtube"; id: string }
  | { kind: "vimeo"; id: string; hash?: string }
  | { kind: "file"; url: string };

/**
 * Accepts:
 * - YouTube watch/share/embed/shorts URLs
 * - Vimeo URLs (vimeo.com/123 or player.vimeo.com/video/123?h=xxx)
 * - Vimeo iframe embed codes (extracts the src)
 * - Direct .mp4/.webm/.mov URLs
 */
export function parseVideo(raw: string): Embed | null {
  const input = raw.trim();
  if (!input) return null;

  // Extract src from iframe embed code if present
  const iframeSrc = input.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  const url = iframeSrc ? iframeSrc[1] : input;

  // YouTube
  const yt = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,20})/i,
  );
  if (yt) return { kind: "youtube", id: yt[1] ?? "" };

  // Vimeo player embed URL (player.vimeo.com/video/ID?h=HASH)
  const vimeoPlayer = url.match(/player\.vimeo\.com\/video\/(\d+)(?:\?h=([a-z0-9]+))?/i);
  if (vimeoPlayer) return { kind: "vimeo", id: vimeoPlayer[1], hash: vimeoPlayer[2] };

  // Vimeo regular URL (vimeo.com/ID or vimeo.com/ID/HASH)
  const vimeo = url.match(/vimeo\.com\/(\d+)(?:\/([a-z0-9]+))?/i);
  if (vimeo) return { kind: "vimeo", id: vimeo[1], hash: vimeo[2] };

  // Direct video file
  if (/^https:\/\/.*\.(mp4|webm|mov)(\?.*)?$/i.test(url)) return { kind: "file", url };

  return null;
}

export const ytThumb = (id: string): string => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

export const ytEmbedUrl = (id: string): string =>
  `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;

export const vimeoThumb = (id: string): string => `https://vumbnail.com/${id}.jpg`;

export const vimeoEmbedUrl = (id: string, hash?: string): string =>
  `https://player.vimeo.com/video/${id}${hash ? `?h=${hash}&` : "?"}autoplay=1&title=0&byline=0&portrait=0`;

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
