import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AuthModal } from "./AuthModal";
import styles from "./visitor.module.css";

type VisitorCtaProps = {
  ownerName: string;
  hidden?: boolean;
};

/**
 * A CTA shown to visitors viewing someone else's world,
 * prompting them to create their own world.
 */
export function VisitorCta({ ownerName, hidden }: VisitorCtaProps) {
  const { user, loading } = useAuth();
  const [showAuth, setShowAuth] = useState(false);

  // Don't show if loading, user is signed in, or explicitly hidden
  if (loading || user || hidden) return null;

  return (
    <>
      <div className={styles.cta}>
        <p className={styles.text}>
          Enjoying {ownerName}&rsquo;s world?
        </p>
        <button
          type="button"
          className={styles.button}
          onClick={() => setShowAuth(true)}
        >
          <Sparkles size={16} strokeWidth={2.2} />
          Create your own
        </button>
      </div>
      <AuthModal
        open={showAuth}
        onClose={() => setShowAuth(false)}
        prompt={`Build your world just like ${ownerName} did`}
      />
    </>
  );
}
