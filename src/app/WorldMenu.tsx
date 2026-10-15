import { useState } from "react";
import { LogIn, LogOut, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuthStore } from "@/store/auth";
import { useFx } from "@/world/fx";
import { useWorldStore } from "@/store/world";
import { AuthDialog } from "./AuthDialog";
import styles from "./chrome.module.css";

/** Sign in, What's new, Reset and Sign out — the core menu actions. */
export function WorldMenu() {
  const [confirmReset, setConfirmReset] = useState<boolean>(false);
  const [authOpen, setAuthOpen] = useState<boolean>(false);
  const reset = useWorldStore((s) => s.reset);
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  const handleSignOut = async () => {
    await signOut();
    toast("Signed out", { description: "Your world is saved locally." });
  };

  const onWhatsNew = () => {
    window.open("https://myworld.build/changelog", "_blank");
  };

  return (
    <>
      <nav className={styles.menu} aria-label="World menu">
        {user ? (
          <>
            <button type="button" className={styles.menuBtn} onClick={onWhatsNew}>
              <Sparkles size={16} strokeWidth={2.1} aria-hidden />
              What&rsquo;s new
            </button>
            <button type="button" className={styles.menuBtn} onClick={() => setConfirmReset(true)}>
              <RotateCcw size={16} strokeWidth={2.1} aria-hidden />
              Reset
            </button>
            <span className={styles.menuSep} aria-hidden />
            <button type="button" className={styles.menuBtn} onClick={handleSignOut}>
              <LogOut size={17} strokeWidth={2} aria-hidden />
              Sign out
            </button>
          </>
        ) : (
          <button type="button" className={styles.menuBtnAuth} onClick={() => setAuthOpen(true)}>
            <LogIn size={17} strokeWidth={2} aria-hidden />
            Make it yours
          </button>
        )}
      </nav>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent className={styles.dialog}>
          <AlertDialogHeader>
            <AlertDialogTitle className={styles.dialogTitle}>Start this world over?</AlertDialogTitle>
            <AlertDialogDescription>
              Every building in this world will be cleared and you&rsquo;ll pick your town again. Export first if you want to keep a copy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={styles.dialogCancel}>Keep my world</AlertDialogCancel>
            <AlertDialogAction
              className={styles.dialogAction}
              onClick={() => {
                useFx.getState().select(null);
                reset();
                toast("Fresh sand, fresh start.");
              }}
            >
              Reset world
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
