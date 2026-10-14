import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth";
import { getWorldOwnerId } from "@/store/sync";
import { useWorldStore } from "@/store/world";

/** Cache for ownership lookups to avoid repeated queries. */
const ownershipCache = new Map<string, string | null>();

/**
 * Hook to check if the current user owns a world by its slug.
 * Returns true if:
 * 1. The slug matches the user's home world slug, or
 * 2. The world is owned by the authenticated user (checked via server)
 *
 * For local-only worlds (Ross, etc.), falls back to checking if it's the home world.
 */
export function useIsOwner(slug: string | undefined): boolean {
  const user = useAuthStore((s) => s.user);
  const homeId = useWorldStore((s) => s.homeId);
  const worlds = useWorldStore((s) => s.worlds);
  const homeWorld = worlds[homeId];

  const [serverOwnerId, setServerOwnerId] = useState<string | null | "loading">("loading");

  // Check if this is the home world (local check first for instant feedback)
  const isLocalHomeWorld = homeWorld?.slug === slug;

  useEffect(() => {
    if (!slug) {
      setServerOwnerId(null);
      return;
    }

    // Check cache first
    if (ownershipCache.has(slug)) {
      setServerOwnerId(ownershipCache.get(slug) ?? null);
      return;
    }

    // Fetch from server
    let cancelled = false;
    getWorldOwnerId(slug).then((ownerId) => {
      if (!cancelled) {
        ownershipCache.set(slug, ownerId);
        setServerOwnerId(ownerId);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  // User is not logged in - they can only edit local home world
  if (!user) {
    return isLocalHomeWorld;
  }

  // Server check completed
  if (serverOwnerId !== "loading" && serverOwnerId !== null) {
    return serverOwnerId === user.id;
  }

  // Fallback to local check while loading or if server has no record
  return isLocalHomeWorld;
}

/**
 * Hook to check if the current user can edit the current world.
 * This is a simpler version that uses the current world context.
 */
export function useCanEdit(): boolean {
  const user = useAuthStore((s) => s.user);
  const currentId = useWorldStore((s) => s.currentId);
  const homeId = useWorldStore((s) => s.homeId);
  const world = useWorldStore((s) => s.world);

  // For local checks, user can edit their home world
  const isHome = currentId === homeId;

  // If user is not signed in, they can only edit their local home
  if (!user) {
    return isHome;
  }

  // Use the ownership hook for server-backed ownership
  // For now, this is a simpler check - if it's the home world locally, user can edit
  // This will be accurate after sync
  return isHome;
}

/**
 * Clears the ownership cache. Call this when signing out or on major state changes.
 */
export function clearOwnershipCache(): void {
  ownershipCache.clear();
}
