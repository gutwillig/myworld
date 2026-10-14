import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import styles from "./chrome.module.css";

/**
 * Handles the OAuth/magic link callback redirect from Supabase.
 * This page processes the auth tokens from the URL hash and redirects to home.
 */
export function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Supabase automatically picks up the tokens from the URL hash
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("[auth callback] Error:", error.message);
          setError(error.message);
          return;
        }

        if (data.session) {
          toast.success("Signed in!", {
            description: "Your world will now sync to the cloud.",
          });
          // Navigate to home after successful auth
          navigate("/", { replace: true });
        } else {
          // No session yet - might be processing, wait a bit
          const { data: retryData, error: retryError } = await supabase.auth.getSession();
          if (retryError) {
            setError(retryError.message);
          } else if (retryData.session) {
            toast.success("Signed in!", {
              description: "Your world will now sync to the cloud.",
            });
            navigate("/", { replace: true });
          } else {
            setError("Could not complete sign in. Please try again.");
          }
        }
      } catch (err) {
        console.error("[auth callback] Unexpected error:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    };

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <main className={styles.authCallbackPage}>
        <div className={styles.authCallbackCard}>
          <h1>Sign in failed</h1>
          <p>{error}</p>
          <button type="button" onClick={() => navigate("/", { replace: true })}>
            Go home
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.authCallbackPage}>
      <div className={styles.authCallbackCard}>
        <h1>Signing you in...</h1>
        <p>Please wait while we complete your sign in.</p>
      </div>
    </main>
  );
}
