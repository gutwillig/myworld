import type { Session, User } from "@supabase/supabase-js";
import { create } from "zustand";
import { supabase } from "@/lib/supabase";

type AuthState = {
  /** The current authenticated user, or null if signed out. */
  user: User | null;
  /** The current session, or null if signed out. */
  session: Session | null;
  /** True while we're checking the initial auth state on mount. */
  loading: boolean;
  /** True while a magic link is being sent. */
  sending: boolean;
  /** Error message from the last auth operation, if any. */
  error: string | null;

  /** Initialize auth state - call once on app mount. */
  init: () => Promise<void>;
  /** Send a magic link to the given email address. */
  sendMagicLink: (email: string) => Promise<boolean>;
  /** Sign out the current user. */
  signOut: () => Promise<void>;
  /** Clear any auth error. */
  clearError: () => void;
};

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  session: null,
  loading: true,
  sending: false,
  error: null,

  init: async () => {
    try {
      // Get the initial session
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.warn("[auth] Failed to get session:", error.message);
        set({ loading: false, error: error.message });
        return;
      }

      set({
        session,
        user: session?.user ?? null,
        loading: false,
      });

      // Ensure founder's world is available as a neighbor for everyone
      import("./sync").then((m) => m.ensureFounderWorld()).catch(() => {});

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (event, session) => {
        const wasSignedOut = !get().user;
        set({
          session,
          user: session?.user ?? null,
        });

        // Sync on sign-in
        if (event === "SIGNED_IN" && session?.user && wasSignedOut) {
          // Import lazily to avoid circular dependency
          const { syncOnSignIn } = await import("./sync");
          await syncOnSignIn();
        }
      });
    } catch (err) {
      console.error("[auth] Init error:", err);
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },

  sendMagicLink: async (email: string) => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      set({ error: "Please enter an email address." });
      return false;
    }

    set({ sending: true, error: null });

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        set({ sending: false, error: error.message });
        return false;
      }

      set({ sending: false });
      return true;
    } catch (err) {
      set({
        sending: false,
        error: err instanceof Error ? err.message : "Failed to send magic link",
      });
      return false;
    }
  },

  signOut: async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.warn("[auth] Sign out error:", error.message);
      }
      set({ user: null, session: null });
    } catch (err) {
      console.error("[auth] Sign out error:", err);
    }
  },

  clearError: () => set({ error: null }),
}));

/** Convenience hook for checking if user is authenticated */
export const useIsAuthenticated = () => useAuthStore((s) => !!s.user);
