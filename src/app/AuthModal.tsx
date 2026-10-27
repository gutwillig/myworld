import { useState } from "react";
import { Mail, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import styles from "./auth.module.css";

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
  /** Message shown above the form */
  prompt?: string;
};

export function AuthModal({ open, onClose, prompt }: AuthModalProps) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { sendMagicLink } = useAuth();

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await sendMagicLink(email, displayName.trim() || undefined);
    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <X size={20} strokeWidth={2} />
          </button>

          <div className={styles.sent}>
            <Mail size={32} strokeWidth={1.5} />
            <h2 className={styles.title}>Check your email</h2>
            <p className={styles.prompt}>
              We sent a magic link to <strong>{email}</strong>. Click the link to sign in.
            </p>
            <button type="button" className={styles.submitAlt} onClick={onClose}>
              Got it
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          <X size={20} strokeWidth={2} />
        </button>

        <h2 className={styles.title}>Create your world</h2>
        {prompt && <p className={styles.prompt}>{prompt}</p>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.field}>
            <span>Your name</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Alex"
              autoComplete="name"
            />
          </label>

          <label className={styles.field}>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? "Sending..." : "Send magic link"}
          </button>

          <p className={styles.hint}>
            No password needed — we'll email you a link to sign in.
          </p>
        </form>
      </div>
    </div>
  );
}
