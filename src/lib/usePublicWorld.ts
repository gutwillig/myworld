import { useState, useEffect } from "react";
import { loadWorldBySlug } from "./worldSync";
import type { World } from "@/store/types";

type PublicWorldState = {
  world: World | null;
  loading: boolean;
  error: Error | null;
  notFound: boolean;
};

/**
 * Hook that loads a public world from Supabase by slug.
 * Returns the world data for viewing (not for editing).
 */
export function usePublicWorld(slug: string | undefined): PublicWorldState {
  const [state, setState] = useState<PublicWorldState>({
    world: null,
    loading: !!slug,
    error: null,
    notFound: false,
  });

  useEffect(() => {
    if (!slug) {
      setState({ world: null, loading: false, error: null, notFound: false });
      return;
    }

    let cancelled = false;

    const load = async () => {
      setState((s) => ({ ...s, loading: true, error: null, notFound: false }));

      const { world, error } = await loadWorldBySlug(slug);

      if (cancelled) return;

      if (error) {
        setState({ world: null, loading: false, error, notFound: false });
      } else if (!world) {
        setState({ world: null, loading: false, error: null, notFound: true });
      } else {
        setState({ world, loading: false, error: null, notFound: false });
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return state;
}
