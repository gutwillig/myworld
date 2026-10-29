import { useState } from "react";
import { Link, RotateCcw } from "lucide-react";
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
import { useFx } from "@/world/fx";
import { useWorldStore } from "@/store/world";
import styles from "./chrome.module.css";

/** Share and Reset — the main world actions in one quiet corner pill. */
export function WorldMenu() {
  const [confirmReset, setConfirmReset] = useState<boolean>(false);
  const reset = useWorldStore((s) => s.reset);
  const world = useWorldStore((s) => s.world);

  const onShare = async () => {
    const slug = world.slug || world.ownerName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const shareUrl = `${window.location.origin}/w/${slug}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied!", { description: `Share ${shareUrl} with friends.` });
    } catch {
      // Fallback for browsers that don't support clipboard API
      toast.info("Share your world", { description: shareUrl });
    }
  };

  return (
    <>
      <nav className={styles.menu} aria-label="World actions">
        <button type="button" className={styles.menuBtn} onClick={onShare}>
          <Link size={16} strokeWidth={2.2} aria-hidden />
          Share
        </button>
        <button type="button" className={styles.menuBtn} onClick={() => setConfirmReset(true)}>
          <RotateCcw size={16} strokeWidth={2.1} aria-hidden />
          Reset
        </button>
      </nav>
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
