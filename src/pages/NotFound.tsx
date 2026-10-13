import { Link } from "react-router-dom";

const NotFound = () => (
  <main style={{ minHeight: "100%", display: "grid", placeItems: "center", background: "var(--canvas)", color: "var(--ink)", textAlign: "center", padding: 24 }}>
    <div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 48, fontWeight: 750, margin: 0, letterSpacing: "-0.03em" }}>Off the map</h1>
      <p style={{ margin: "10px 0 22px", color: "var(--ink-soft)", fontSize: 18 }}>There&rsquo;s no road out here yet.</p>
      <Link to="/" style={{ display: "inline-flex", height: 48, alignItems: "center", padding: "0 22px", borderRadius: 999, background: "var(--coral)", color: "#fff", fontWeight: 650, textDecoration: "none" }}>
        Back to your world
      </Link>
    </div>
  </main>
);

export default NotFound;
