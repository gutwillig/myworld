import { Canvas } from "@react-three/fiber";
import { BuildingMesh } from "@/buildings/BuildingMesh";
import { BuildingIcon } from "@/buildings/BuildingIcon";
import { DEFAULT_ACCENT } from "@/buildings/kit";
import { groundsFor } from "@/buildings/grounds";
import { STYLES } from "@/buildings/styles";
import { typeLabel } from "@/buildings/suggest";
import type { BuildingType } from "@/store/types";
import { Brand } from "./Brand";

const TYPES: BuildingType[] = ["house", "office", "studio", "workshop", "clubhouse", "theater", "exchange", "tower", "clinic", "storefront"];

/** Dev page: all ten building types side by side from the world's camera angle, plus faded Old Town versions. */
export default function KitPage() {
  const spacing = 2.3;
  const offset = ((TYPES.length - 1) * spacing) / 2;
  return (
    <div style={{ minHeight: "100%", background: "var(--canvas)", padding: "26px 30px 60px" }}>
      <Brand />
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 750, margin: "28px 0 4px", letterSpacing: "-0.02em" }}>Building kit</h1>
      <p style={{ margin: 0, color: "var(--ink-soft)", fontWeight: 500 }}>Ten primitive buildings from the world&rsquo;s fixed camera. Every silhouette should read at a glance.</p>
      <div style={{ height: 360, marginTop: 20, borderRadius: 28, background: "#e7ead9", overflow: "hidden" }}>
        <Canvas orthographic shadows camera={{ position: [20, 20 * Math.tan((35 * Math.PI) / 180) * Math.SQRT2, 20], zoom: 52 }}>
          <hemisphereLight args={["#D9E9F0", "#D6C29C", 1.9]} />
          <directionalLight position={[-7, 14, 11]} intensity={2.7} color="#FFE6C7" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={14} shadow-camera-bottom={-14} />
          <mesh rotation-x={-Math.PI / 2} receiveShadow position={[0, -0.01, 0]}>
            <planeGeometry args={[60, 60]} />
            <meshStandardMaterial color="#9DC07A" />
          </mesh>
          {TYPES.map((t, i) => {
            const d = i * spacing - offset;
            return (
              <group key={t} position={[d * Math.SQRT1_2, 0, -d * Math.SQRT1_2]}>
                <BuildingMesh type={t} accent={DEFAULT_ACCENT[t]} />
              </group>
            );
          })}
        </Canvas>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 14, marginTop: 24 }}>
        {TYPES.map((t) => (
          <figure key={t} style={{ margin: 0, padding: 12, borderRadius: 22, background: "var(--surface)", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", gap: 4 }}>
              <BuildingIcon type={t} accent={DEFAULT_ACCENT[t]} size={96} alt={t} />
              <BuildingIcon type={t} accent={DEFAULT_ACCENT[t]} size={72} faded alt={`${t} in Old Town`} />
            </div>
            <figcaption style={{ fontWeight: 650, marginTop: 6 }}>{typeLabel(t)}</figcaption>
          </figure>
        ))}
      </div>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 750, margin: "36px 0 10px" }}>Styles and grounds</h2>
      {TYPES.filter((t) => t !== "house").map((t) => (
        <section key={t} style={{ marginTop: 14, padding: 14, borderRadius: 22, background: "var(--surface)" }}>
          <h3 style={{ margin: "0 0 8px", fontWeight: 700 }}>{typeLabel(t)}</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {STYLES[t].map((st) => (
              <figure key={st.id} style={{ margin: 0, textAlign: "center" }}>
                <BuildingIcon type={t} style={st.id} accent={DEFAULT_ACCENT[t]} size={96} alt={st.label} />
                <figcaption style={{ fontSize: 12, fontWeight: 650 }}>{st.label}</figcaption>
              </figure>
            ))}
            <span style={{ width: 1, background: "rgba(46,74,59,0.12)", margin: "0 6px" }} />
            {groundsFor(t).map((g) => (
              <figure key={g.id} style={{ margin: 0, textAlign: "center" }}>
                <BuildingIcon type={t} grounds={g.id} accent={DEFAULT_ACCENT[t]} size={96} alt={g.label} />
                <figcaption style={{ fontSize: 12, fontWeight: 650 }}>{g.label}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
