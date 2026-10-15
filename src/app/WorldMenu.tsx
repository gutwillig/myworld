import { useState } from "react";
import { Link2, LogIn, LogOut, Pencil, RotateCcw, Sparkles } from "lucide-react";
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
  const [renameOpen, setRenameOpen] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>("");
  const [authOpen, setAuthOpen] = useState<boolean>(false);
  const reset = useWorldStore((s) => s.reset);
  const setOwnerName = useWorldStore((s) => s.setOwnerName);
  const ownerName = useWorldStore((s) => s.world.ownerName);
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  const handleSignOut = async () => {
    await signOut();
    toast("Signed out", { description: "Your world is saved locally." });
  };

  const onShare = async () => {
    const world = useWorldStore.getState().world;
    const url = `${window.location.origin}/w/${world.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied", { description: "Share it with anyone to show them your world." });
    } catch {
      toast(url, { description: "Copy this link to share your world." });
    }
  };

  const onWhatsNew = () => {
    window.open("https://myworld.build/changelog", "_blank");
  };

  return (
    <>
      <nav className={styles.menu} aria-label="World menu">
        {user ? (
          <>
            <button type="button" className={styles.menuBtnAuth} onClick={onShare}>
              <Link2 size={17} strokeWidth={2} aria-hidden />
              Share
            </button>
            <button
              type="button"
              className={styles.menuBtn}
              onClick={() => {
                setNewName(ownerName);
                setRenameOpen(true);
              }}
            >
              <Pencil size={15} strokeWidth={2.1} aria-hidden />
              Rename
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
      <AlertDialog open={renameOpen} onOpenChange={setRenameOpen}>
        <AlertDialogContent className={styles.dialog}>
          <AlertDialogHeader>
            <AlertDialogTitle className={styles.dialogTitle}>Rename your world</AlertDialogTitle>
            <AlertDialogDescription>
              This changes how your world appears to visitors.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            type="text"
            className={styles.dialogInput}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Your name"
            maxLength={40}
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel className={styles.dialogCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={styles.dialogAction}
              disabled={!newName.trim()}
              onClick={() => {
                const trimmed = newName.trim();
                if (trimmed) {
                  setOwnerName(trimmed);
                  toast.success(`Now it's ${trimmed}'s world`);
                }
              }}
            >
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
