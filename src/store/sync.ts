import { toast } from "sonner";
import { supabase, type DbWorld } from "@/lib/supabase";
import type { World } from "./types";
import { parseWorld, STORE_VERSION, useWorldStore } from "./world";
import { useAuthStore } from "./auth";

/** The founder's world slug - everyone gets this as their first neighbor. */
export const FOUNDER_SLUG = "alex";

// Import OG capture lazily to avoid circular dependency
let captureOgImpl: ((world: World) => Promise<void>) | null = null;
const maybeCaptureOg = async (world: World) => {
  if (!captureOgImpl) {
    try {
      const mod = await import("@/lib/ogCapture");
      captureOgImpl = mod.captureAndUploadOg;
    } catch {
      // OG capture not available
      return;
    }
  }
  await captureOgImpl(world);
};

/** Debounce delay for saving to server (ms). */
const SAVE_DEBOUNCE_MS = 2000;

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingWorld: World | null = null;

/**
 * Queues a world save to the server, debounced.
 * Only saves if the user is authenticated and it's their home world.
 */
export function queueSave(world: World): void {
  const { user } = useAuthStore.getState();
  const { homeId } = useWorldStore.getState();

  // Only sync the home world for authenticated users
  if (!user || world.id !== homeId) return;

  pendingWorld = world;

  if (saveTimer) {
    clearTimeout(saveTimer);
  }

  saveTimer = setTimeout(() => {
    if (pendingWorld) {
      void saveWorldToServer(pendingWorld);
      pendingWorld = null;
    }
    saveTimer = null;
  }, SAVE_DEBOUNCE_MS);
}

/**
 * Immediately saves a world to the server.
 * Upserts based on the world slug.
 */
export async function saveWorldToServer(world: World): Promise<boolean> {
  const { user } = useAuthStore.getState();
  if (!user) return false;

  try {
    const data = {
      format: "myworld" as const,
      version: STORE_VERSION,
      world,
    };

    // Check if world exists for this user
    const { data: existing, error: fetchError } = await supabase
      .from("worlds")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (fetchError) {
      console.error("[sync] Error checking existing world:", fetchError);
      return false;
    }

    if (existing) {
      // Update existing world
      const { error } = await supabase
        .from("worlds")
        .update({
          slug: world.slug,
          data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (error) {
        // Handle slug conflicts - another user might have that slug
        if (error.code === "23505") {
          const uniqueSlug = `${world.slug}-${user.id.slice(0, 8)}`;
          console.log("[sync] Slug conflict, trying unique slug:", uniqueSlug);
          const { error: retryError } = await supabase
            .from("worlds")
            .update({
              slug: uniqueSlug,
              data: { ...data, world: { ...world, slug: uniqueSlug } },
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);

          if (retryError) {
            console.error("[sync] Error updating world with unique slug:", retryError);
            toast.error("Failed to sync", { description: "Your changes are saved locally." });
            return false;
          }
          // Update local world with the unique slug
          useWorldStore.getState().updateSlug(world.id, uniqueSlug);
          toast("Slug updated", { description: `Your world is now at /w/${uniqueSlug}` });
        } else {
          console.error("[sync] Error updating world:", error);
          toast.error("Failed to sync", { description: "Your changes are saved locally." });
          return false;
        }
      }
    } else {
      // Insert new world
      const { error } = await supabase.from("worlds").insert({
        slug: world.slug,
        owner_id: user.id,
        data,
      });

      if (error) {
        // Handle slug conflicts
        if (error.code === "23505") {
          // Unique violation - generate a unique slug
          const uniqueSlug = `${world.slug}-${user.id.slice(0, 8)}`;
          const { error: retryError } = await supabase.from("worlds").insert({
            slug: uniqueSlug,
            owner_id: user.id,
            data: { ...data, world: { ...world, slug: uniqueSlug } },
          });

          if (retryError) {
            console.error("[sync] Error inserting world with unique slug:", retryError);
            toast.error("Failed to sync", { description: "Your changes are saved locally." });
            return false;
          }
        } else {
          console.error("[sync] Error inserting world:", error);
          toast.error("Failed to sync", { description: "Your changes are saved locally." });
          return false;
        }
      }
    }

    // Capture OG image in the background (don't await)
    maybeCaptureOg(world).catch(() => {});

    return true;
  } catch (err) {
    console.error("[sync] Unexpected error saving world:", err);
    toast.error("Failed to sync", { description: "Your changes are saved locally." });
    return false;
  }
}

/**
 * Loads a world from the server by slug.
 * Returns null if not found.
 */
export async function loadWorldFromServer(slug: string): Promise<World | null> {
  try {
    const { data, error } = await supabase
      .from("worlds")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error) return null;

    if (!data) return null;

    const dbWorld = data as DbWorld;
    return parseWorld(dbWorld.data);
  } catch {
    return null;
  }
}

/**
 * Loads the authenticated user's world from the server.
 * Returns null if not found or not authenticated.
 */
export async function loadMyWorld(): Promise<World | null> {
  const { user } = useAuthStore.getState();
  if (!user) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("worlds")
      .select("*")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (error || !data) return null;

    const dbWorld = data as DbWorld;
    return parseWorld(dbWorld.data);
  } catch {
    return null;
  }
}

/**
 * Gets the owner ID for a world by slug.
 * Returns null if not found.
 */
export async function getWorldOwnerId(slug: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("worlds")
      .select("owner_id")
      .eq("slug", slug)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data.owner_id;
  } catch {
    return null;
  }
}

/**
 * Syncs the local home world to the server after sign-in.
 * If a server world exists, it takes precedence (merge would be more complex).
 */
export async function syncOnSignIn(): Promise<void> {
  const { user } = useAuthStore.getState();
  if (!user) return;

  const serverWorld = await loadMyWorld();

  if (serverWorld) {
    // Server world exists - merge it with local data
    // For now, we'll replace the home world with the server version
    // A more sophisticated merge could be implemented later
    const { worlds, homeId, replaceWorld, visit } = useWorldStore.getState();
    const localHome = worlds[homeId];

    // If local home has more buildings, keep local (user created content offline)
    // Otherwise, use server version
    if (localHome && localHome.buildings.length > serverWorld.buildings.length) {
      // Local has more content, save it to server
      await saveWorldToServer(localHome);
      toast.success("Synced", { description: "Your local changes have been saved to the cloud." });
    } else if (serverWorld.buildings.length > 0) {
      // Server has content, use it
      replaceWorld(serverWorld);
      visit(useWorldStore.getState().homeId);
      toast.success("World restored", { description: "Your world has been loaded from the cloud." });
    }
  } else {
    // No server world - save local world
    const { worlds, homeId } = useWorldStore.getState();
    const localHome = worlds[homeId];
    if (localHome) {
      await saveWorldToServer(localHome);
      toast.success("Synced", { description: "Your world has been saved to the cloud." });
    }
  }

  // Always ensure founder's world is available as a neighbor
  await ensureFounderWorld();
}

/**
 * Fetches the founder's world from the server and adds it as a neighbor.
 * Called on app init so everyone has at least one connection.
 */
export async function ensureFounderWorld(): Promise<void> {
  const { worlds, homeId } = useWorldStore.getState();
  const homeWorld = worlds[homeId];

  // Don't add founder as neighbor to themselves
  if (homeWorld?.slug === FOUNDER_SLUG) {
    return;
  }

  // Check if founder's world is already in our local book
  const hasFounder = Object.values(worlds).some((w) => w.slug === FOUNDER_SLUG);
  if (hasFounder) {
    return;
  }

  // Fetch founder's world from server
  const founderWorld = await loadWorldFromServer(FOUNDER_SLUG);
  if (!founderWorld) return;

  // Add founder's world to local book as a neighbor
  const { order } = useWorldStore.getState();
  useWorldStore.setState({
    worlds: { ...useWorldStore.getState().worlds, [founderWorld.id]: founderWorld },
    order: [...order, founderWorld.id],
  });
}
