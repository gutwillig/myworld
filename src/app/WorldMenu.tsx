import { useRef, useState } from "react";
import { Download, RotateCcw, Upload } from "lucide-react";
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
import { exportWorld, parseWorld, useWorldStore } from "@/store/world";
import styles from "./chrome.module.css";

/** Export, Import and Reset — the entire persistence story, in one quiet corner pill. */
export function WorldMenu() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState<boolean>(false);
  const replaceWorld = useWorldStore((s) => s.replaceWorld);
  const reset = useWorldStore((s) => s.reset);

  const onExport = () => {
    const world = useWorldStore.getState().world;
    const blob = new Blob([exportWorld(world)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${world.slug || "world"}.world.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("World exported", { description: `${world.buildings.length} buildings saved to a file.` });
  };

  const onFile = async (file: File) => {
    try {
      const text = await file.text();
      const world = parseWorld(JSON.parse(text));
      useFx.getState().select(null);
      replaceWorld(world);
      toast.success(`Welcome to ${world.ownerName}'s world`, { description: `${world.buildings.length} buildings imported.` });
    } catch (err) {
      console.warn("[import] failed", err instanceof Error ? err.message : err);
      toast.error("Couldn't import that file", {
        description: err instanceof Error && err.message.includes("myworld") ? err.message : "Pick a .json file exported from myworld.",
      });
    }
  };

  return (
    <>
      <nav className={styles.menu} aria-label="World file">
        <button type="button" className={styles.menuBtn} onClick={onExport}>
          <Upload size={17} strokeWidth={2} aria-hidden />
          Export
        </button>
        <button type="button" className={styles.menuBtn} onClick={() => fileRef.current?.click()}>
          <Download size={17} strokeWidth={2} aria-hidden />
          Import
        </button>
        <button type="button" className={styles.menuBtn} onClick={() => setConfirmReset(true)}>
          <RotateCcw size={16} strokeWidth={2.1} aria-hidden />
          Reset
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = "";
          }}
        />
      </nav>
      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent className={styles.dialog}>
          <AlertDialogHeader>
            <AlertDialogTitle className={styles.dialogTitle}>Start this world over on an empty beach?</AlertDialogTitle>
            <AlertDialogDescription>
              Every building in this world will be cleared. Export first if you want to keep a copy.
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
