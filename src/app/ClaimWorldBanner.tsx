import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { AuthDialog } from "./AuthDialog";
import styles from "./claim.module.css";

type ClaimWorldBannerProps = {
  /** The owner's name, shown in the banner text. */
  ownerName: string;
  /** Hide when a building panel is open or during travel. */
  hidden?: boolean;
};

/**
 * A friendly CTA for visitors who aren't signed in.
 * Shows at the bottom of the screen when viewing someone else's world.
 */
export function ClaimWorldBanner({ ownerName, hidden }: ClaimWorldBannerProps) {
  const [authOpen, setAuthOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);

  // Don't show if signed in or still loading auth state
  if (user || loading || hidden) return null;

  return (
    <>
      <div className={styles.banner}>
        <p className={styles.text}>
          You're exploring <strong>{ownerName}'s world</strong>
        </p>
        <button type="button" className={styles.cta} onClick={() => setAuthOpen(true)}>
          <Sparkles size={18} strokeWidth={2} aria-hidden />
          Claim your own world
        </button>
      </div>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </>
  );
}
