import { useState } from "react";
import { Mail, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/store/auth";
import styles from "./chrome.module.css";

type AuthDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const sendMagicLink = useAuthStore((s) => s.sendMagicLink);
  const sending = useAuthStore((s) => s.sending);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await sendMagicLink(email);
    if (success) {
      setSent(true);
      toast.success("Check your email", {
        description: "We sent you a magic link to sign in.",
      });
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      // Reset state when closing
      setEmail("");
      setSent(false);
      clearError();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={styles.authDialog}>
        <DialogHeader>
          <DialogTitle className={styles.authTitle}>
            {sent ? "Check your email" : "Sign in to save your world"}
          </DialogTitle>
          <DialogDescription className={styles.authDesc}>
            {sent
              ? `We sent a magic link to ${email}. Click it to sign in.`
              : "We'll send you a magic link — no password needed."}
          </DialogDescription>
        </DialogHeader>

        {!sent ? (
          <form onSubmit={handleSubmit} className={styles.authForm}>
            <div className={styles.authInputWrap}>
              <Mail size={18} strokeWidth={2} className={styles.authInputIcon} aria-hidden />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={styles.authInput}
                autoComplete="email"
                autoFocus
                required
              />
            </div>
            {error && <p className={styles.authError}>{error}</p>}
            <button type="submit" className={styles.authSubmit} disabled={sending || !email.trim()}>
              {sending ? "Sending..." : "Send magic link"}
            </button>
          </form>
        ) : (
          <div className={styles.authSent}>
            <p>Didn't get it? Check your spam folder, or</p>
            <button
              type="button"
              className={styles.authRetry}
              onClick={() => {
                setSent(false);
                clearError();
              }}
            >
              try again
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
