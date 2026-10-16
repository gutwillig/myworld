import { useState } from "react";
import { useWorldStore } from "@/store/world";
import type { Terrain } from "@/store/types";
import { Brand } from "./Brand";
import styles from "./worldChoice.module.css";

/** Tiny flat-shaded postcard of a beach town: sun, water, a sand spit, one pine. */
function BeachArt() {
  return (
    <svg className={styles.art} viewBox="0 0 246 128" role="img" aria-label="A low-poly beach town">
      <rect width="246" height="128" fill="#DCEAE6" />
      <circle cx="196" cy="30" r="15" fill="#F6CE8C" />
      <path d="M0 78 L246 62 L246 128 L0 128 Z" fill="#8ED2C6" />
      <path d="M0 84 Q40 78 80 84 T160 84 T246 80" stroke="#FBFBF4" strokeWidth="3" fill="none" opacity="0.7" />
      <path d="M20 128 L48 92 Q88 78 118 96 L138 128 Z" fill="#EAD7AE" />
      <path d="M138 128 L150 100 L166 92 L182 104 L188 128 Z" fill="#9DC07A" />
      <path d="M56 96 L64 70 L72 96 Z" fill="#5E9B5A" />
      <rect x="62" y="94" width="4" height="10" fill="#8A6446" />
      <path d="M96 128 L106 100 L116 128 Z" fill="#D8C6A2" opacity="0.8" />
    </svg>
  );
}

/** Tiny flat-shaded postcard of a mountain town: peaks, snow caps, pines, a mesa airstrip. */
function MountainArt() {
  return (
    <svg className={styles.art} viewBox="0 0 246 128" role="img" aria-label="A low-poly mountain town">
      <rect width="246" height="128" fill="#E4EBE0" />
      <path d="M0 84 L46 22 L86 84 Z" fill="#8E9E8D" />
      <path d="M46 22 L60 40 L52 42 L46 34 L38 42 L32 40 Z" fill="#F4F6F2" />
      <path d="M60 84 L118 14 L182 84 Z" fill="#7E8F7E" />
      <path d="M118 14 L136 36 L126 38 L118 28 L108 40 L100 36 Z" fill="#F4F6F2" />
      <path d="M150 84 L196 34 L246 84 Z" fill="#9AA79A" />
      <path d="M196 34 L208 48 L200 50 L196 44 L188 50 L184 48 Z" fill="#F4F6F2" />
      <rect y="82" width="246" height="46" fill="#A2BC7F" />
      <path d="M0 104 L246 98 L246 128 L0 128 Z" fill="#B9AE97" />
      <path d="M70 100 L196 95 L200 99 L66 104 Z" fill="#CDBFA3" />
      <path d="M150 74 L164 70 L170 76 L156 79 Z" fill="#E5694F" />
      <path d="M154 74 L158 82 M166 72 L170 80" stroke="#2E4A3B" strokeWidth="1.4" />
      <path d="M52 88 L62 60 L72 88 Z" fill="#4F7D54" />
      <path d="M190 88 L198 66 L206 88 Z" fill="#436E4D" />
      <path d="M24 124 L32 100 L40 124 Z" fill="#5C8B5C" />
    </svg>
  );
}

const CHOICES: { terrain: Terrain; name: string; blurb: string; art: () => React.ReactElement }[] = [
  { terrain: "beach", name: "Beach town", blurb: "Surf, bonfires and a ballpark by the sea.", art: BeachArt },
  { terrain: "mountain", name: "Mountain town", blurb: "A mesa town ringed by peaks, with its own airstrip — Telluride style.", art: MountainArt },
];

/**
 * First-run screen: pick the town your world becomes, then enter your name.
 * Everything else (dock, ferry, neighbors) stays the same sea; this only skins the island.
 */
export function WorldChoice() {
  const chooseHome = useWorldStore((s) => s.chooseHome);
  const [step, setStep] = useState<"terrain" | "name">("terrain");
  const [selectedTerrain, setSelectedTerrain] = useState<Terrain | null>(null);
  const [name, setName] = useState("");
  const [leaving, setLeaving] = useState(false);

  const pickTerrain = (terrain: Terrain) => {
    if (selectedTerrain) return;
    setSelectedTerrain(terrain);
    window.setTimeout(() => setStep("name"), 380);
  };

  const finish = () => {
    if (!selectedTerrain || leaving) return;
    setLeaving(true);
    window.setTimeout(() => chooseHome(selectedTerrain, name.trim() || undefined), 380);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && name.trim()) {
      finish();
    }
  };

  if (step === "name") {
    return (
      <div className={`${styles.root} ${leaving ? styles.rootLeaving : ""}`} role="dialog" aria-label="Name your world">
        <Brand />
        <div className={styles.head}>
          <p className={styles.eyebrow}>Almost there</p>
          <h1 className={styles.title}>What's your name?</h1>
          <p className={styles.sub}>
            This is how your world will appear to visitors — "{name.trim() || "Your name"}'s world"
          </p>
        </div>
        <div className={styles.nameForm}>
          <input
            type="text"
            className={styles.nameInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter your name"
            maxLength={40}
            autoFocus
          />
          <button
            type="button"
            className={styles.nameSubmit}
            onClick={finish}
            disabled={!name.trim()}
          >
            {leaving ? "Building…" : "Start building"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.root} ${selectedTerrain ? styles.rootLeaving : ""}`} role="dialog" aria-label="Choose your world">
      <Brand />
      <div className={styles.head}>
        <p className={styles.eyebrow}>Welcome to myworld</p>
        <h1 className={styles.title}>First, choose your world.</h1>
        <p className={styles.sub}>
          Every world has a floatplane — it lands on water or the airstrip, so neighbors can fly over either way. Pick where you build.
        </p>
      </div>
      <div className={styles.cards}>
        {CHOICES.map(({ terrain, name, blurb, art: Art }) => (
          <button key={terrain} type="button" className={styles.card} onClick={() => pickTerrain(terrain)}>
            <Art />
            <span className={styles.body}>
              <span className={styles.name}>{name}</span>
              <span className={styles.blurb}>{blurb}</span>
              <span className={styles.pick}>{selectedTerrain === terrain ? "Taking off…" : "Build here"}</span>
            </span>
          </button>
        ))}
      </div>
      <p className={styles.foot}>You can visit the other shore any time — every world keeps its own look.</p>
    </div>
  );
}
