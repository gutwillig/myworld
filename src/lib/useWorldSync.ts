import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "./auth";
import { saveWorld, loadUserWorld } from "./worldSync";
import { useWorldStore } from "@/store/world";

/** Debounce time in ms before syncing to Supabase */
const SYNC_DELAY = 2000;

/**
 * Hook that syncs the user's home world to Supabase.
 * - Loads the user's world from Supabase on sign-in
 * - Saves changes to Supabase with debouncing
 */
export function useWorldSync() {
  const { user } = useAuth();
  const syncTimeoutRef = useRef<number | null>(null);
  const lastSyncRef = useRef<string | null>(null);
  const initialLoadDone = useRef(false);

  // Load user's world from Supabase on sign-in
  useEffect(() => {
    if (!user || initialLoadDone.current) return;

    const loadFromSupabase = async () => {
      console.log("[sync] Loading user world from Supabase...");
      const { world, error } = await loadUserWorld(user.id);

      if (error) {
        console.error("[sync] Failed to load from Supabase:", error);
        return;
      }

      if (world) {
        console.log("[sync] Loaded world from Supabase:", world.slug);
        // Import the world from Supabase, replacing the current home world
        const store = useWorldStore.getState();
        // Only import if different from current (to avoid overwriting local changes)
        if (world.id !== store.homeId) {
          store.replaceWorld(world);
        }
      } else {
        console.log("[sync] No world in Supabase, will sync local world");
        // User has no world in Supabase yet, sync their local world
        const state = useWorldStore.getState();
        const homeWorld = state.worlds[state.homeId];
        if (homeWorld) {
          const { error: saveError } = await saveWorld(homeWorld, user.id);
          if (saveError) {
            console.error("[sync] Failed to save initial world:", saveError);
          } else {
            console.log("[sync] Saved initial world to Supabase");
          }
        }
      }

      initialLoadDone.current = true;
    };

    loadFromSupabase();
  }, [user]);

  // Sync to Supabase on world changes (debounced)
  const syncToSupabase = useCallback(async () => {
    if (!user) return;

    const state = useWorldStore.getState();
    const homeWorld = state.worlds[state.homeId];
    if (!homeWorld) return;

    // Create a hash of the world to detect changes
    const worldHash = JSON.stringify({
      id: homeWorld.id,
      slug: homeWorld.slug,
      ownerName: homeWorld.ownerName,
      terrain: homeWorld.terrain,
      buildings: homeWorld.buildings.map((b) => ({
        id: b.id,
        name: b.name,
        type: b.type,
        hex: b.hex,
        status: b.status,
      })),
      center: homeWorld.center,
      pitch: homeWorld.pitch,
    });

    // Skip if nothing changed
    if (worldHash === lastSyncRef.current) return;

    console.log("[sync] Syncing world to Supabase...");
    const { error } = await saveWorld(homeWorld, user.id);

    if (error) {
      console.error("[sync] Failed to sync:", error);
    } else {
      console.log("[sync] World synced successfully");
      lastSyncRef.current = worldHash;
    }
  }, [user]);

  // Subscribe to world store changes
  useEffect(() => {
    if (!user) return;

    const unsubscribe = useWorldStore.subscribe((state, prevState) => {
      // Only sync home world changes
      const homeWorld = state.worlds[state.homeId];
      const prevHomeWorld = prevState.worlds[prevState.homeId];

      if (!homeWorld || homeWorld === prevHomeWorld) return;

      // Clear existing timeout
      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current);
      }

      // Debounce the sync
      syncTimeoutRef.current = window.setTimeout(() => {
        syncToSupabase();
      }, SYNC_DELAY);
    });

    return () => {
      unsubscribe();
      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [user, syncToSupabase]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);
}
