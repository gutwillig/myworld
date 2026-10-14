import { toast } from "sonner";
import { supabase } from "./supabase";
import { useAuthStore } from "@/store/auth";
import type { World } from "@/store/types";

/** OG image dimensions (1200x630 is the recommended OG image size) */
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

/** JPEG quality for OG images (0-1) */
const OG_QUALITY = 0.85;

/**
 * Captures the Three.js canvas and returns a Blob.
 * The canvas is scaled to fit the OG image dimensions.
 */
function captureCanvas(): Blob | null {
  const canvas = document.querySelector("canvas");
  if (!canvas) {
    console.warn("[ogCapture] No canvas found");
    return null;
  }

  try {
    // Create an offscreen canvas for resizing
    const offscreen = document.createElement("canvas");
    offscreen.width = OG_WIDTH;
    offscreen.height = OG_HEIGHT;
    const ctx = offscreen.getContext("2d");
    if (!ctx) {
      console.warn("[ogCapture] Could not get 2D context");
      return null;
    }

    // Calculate scaling to fill the OG dimensions while maintaining aspect ratio
    const sourceWidth = canvas.width;
    const sourceHeight = canvas.height;
    const sourceAspect = sourceWidth / sourceHeight;
    const targetAspect = OG_WIDTH / OG_HEIGHT;

    let sx = 0,
      sy = 0,
      sw = sourceWidth,
      sh = sourceHeight;

    if (sourceAspect > targetAspect) {
      // Source is wider - crop sides
      sw = sourceHeight * targetAspect;
      sx = (sourceWidth - sw) / 2;
    } else {
      // Source is taller - crop top/bottom
      sh = sourceWidth / targetAspect;
      sy = (sourceHeight - sh) / 2;
    }

    // Draw the cropped/scaled image
    ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, OG_WIDTH, OG_HEIGHT);

    // Convert to blob synchronously (toBlob is async, but we can use toDataURL)
    const dataUrl = offscreen.toDataURL("image/jpeg", OG_QUALITY);
    const byteString = atob(dataUrl.split(",")[1]);
    const mimeString = dataUrl.split(",")[0].split(":")[1].split(";")[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  } catch (err) {
    console.error("[ogCapture] Error capturing canvas:", err);
    return null;
  }
}

/**
 * Uploads an OG image to Supabase Storage and updates the world record.
 * Returns the public URL of the uploaded image.
 */
export async function uploadOgImage(world: World): Promise<string | null> {
  const { user } = useAuthStore.getState();
  if (!user) {
    console.warn("[ogCapture] Cannot upload: not authenticated");
    return null;
  }

  const blob = captureCanvas();
  if (!blob) {
    return null;
  }

  try {
    // Upload to Supabase Storage
    const fileName = `${user.id}/${world.slug}-${Date.now()}.jpg`;
    const { data, error } = await supabase.storage
      .from("og-images")
      .upload(fileName, blob, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (error) {
      console.error("[ogCapture] Error uploading:", error);
      return null;
    }

    // Get the public URL
    const { data: urlData } = supabase.storage.from("og-images").getPublicUrl(data.path);
    const publicUrl = urlData.publicUrl;

    // Update the world record with the OG image URL
    const { error: updateError } = await supabase
      .from("worlds")
      .update({ og_image_url: publicUrl })
      .eq("owner_id", user.id);

    if (updateError) {
      console.error("[ogCapture] Error updating world record:", updateError);
      // Still return the URL even if we couldn't update the record
    }

    console.log("[ogCapture] OG image uploaded:", publicUrl);
    return publicUrl;
  } catch (err) {
    console.error("[ogCapture] Unexpected error:", err);
    return null;
  }
}

/**
 * Captures and uploads an OG image after a successful sync.
 * This should be called after queueSave completes successfully.
 */
export async function captureAndUploadOg(world: World): Promise<void> {
  // Small delay to ensure the canvas is fully rendered
  await new Promise((resolve) => setTimeout(resolve, 500));

  const url = await uploadOgImage(world);
  if (url) {
    console.log("[ogCapture] OG image updated");
  }
}
