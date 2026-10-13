import { memo, useEffect, useState } from "react";
import type { BuildingType } from "@/store/types";
import { cachedThumbnail, requestThumbnail } from "./thumbnail";

type Props = {
  type: BuildingType;
  accent: string;
  size?: number;
  faded?: boolean;
  style?: string;
  /** Pass to include the lot's grounds in the picture. */
  grounds?: string;
  className?: string;
  alt?: string;
};

/** A small pre-rendered 3D image of a building, rendered offscreen with the world's kit. */
export const BuildingIcon = memo(function BuildingIcon({ type, accent, size = 128, faded = false, style, grounds, className, alt = "" }: Props) {
  const opts = { style, grounds };
  const [src, setSrc] = useState<string | null>(() => cachedThumbnail(type, accent, size * 2, faded, opts) ?? null);
  useEffect(() => {
    const hit = cachedThumbnail(type, accent, size * 2, faded, { style, grounds });
    if (hit) {
      setSrc(hit);
      return;
    }
    return requestThumbnail(type, accent, size * 2, faded, { style, grounds }, setSrc);
  }, [type, accent, size, faded, style, grounds]);
  return (
    <span className={className} style={{ display: "inline-block", width: size, height: size }}>
      {src && <img src={src} alt={alt} width={size} height={size} draggable={false} style={{ width: "100%", height: "100%", display: "block" }} />}
    </span>
  );
});
