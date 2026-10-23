import { useEffect } from "react";
import { ArrowLeft, ArrowRight, Calendar, ExternalLink } from "lucide-react";
import { Link as RouterLink, useParams } from "react-router-dom";
import { Brand } from "@/app/Brand";
import { WorldMenu } from "@/app/WorldMenu";
import { BuildingIcon } from "@/buildings/BuildingIcon";
import { buildingAccent } from "@/buildings/kit";
import { typeLabel } from "@/buildings/suggest";
import { Avatar, LinkIcon, StatusBadge } from "@/panel/fields";
import { worldPath } from "@/app/NeighborsMenu";
import { getBuildingBySlug, getWorldBySlug, useWorldStore } from "@/store/world";
import { useFx } from "@/world/fx";
import styles from "./flat.module.css";

/** One building as a plain, readable page. Proves a building is real content with a URL. */
export default function FlatBuildingPage() {
  const { world: worldSlug = "", building: slug = "" } = useParams();
  const worlds = useWorldStore((s) => s.worlds);
  const homeId = useWorldStore((s) => s.homeId);
  const world = getWorldBySlug(worlds, worldSlug) ?? worlds[homeId];
  const building = getBuildingBySlug(world, slug);
  const back = worldPath(world, homeId);
  const owner = world.id === homeId ? "My" : `${world.ownerName}’s`;

  useEffect(() => {
    document.title = building ? `${building.name} · ${world.ownerName}'s world` : `Not found · myworld`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta && building) meta.setAttribute("content", building.oneLiner || `${building.name}, part of ${world.ownerName}'s world.`);
  }, [building, world.ownerName]);

  const since = building ? new Date(building.createdAt).getFullYear() : null;

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <Brand />
        <WorldMenu />
      </header>

      {!building ? (
        <main className={styles.main}>
          <h1 className={styles.title}>Nothing stands here</h1>
          <p className={styles.oneLiner}>This building may have been knocked down, renamed, or lives in someone else&rsquo;s browser.</p>
          <RouterLink to={back} className={styles.back}>
            <ArrowLeft size={18} aria-hidden /> Back to {owner} world
          </RouterLink>
        </main>
      ) : (
        <main className={styles.main}>
          <article className={styles.article}>
            <BuildingIcon
              type={building.type}
              accent={buildingAccent(building)}
              style={building.style}
              grounds={building.grounds}
              faded={building.status === "past"}
              size={300}
              className={styles.hero}
              alt={`A ${typeLabel(building.type).toLowerCase()}`}
            />
            <h1 className={styles.title}>{building.name}</h1>
            <StatusBadge status={building.status} />
            {building.oneLiner && <p className={styles.oneLiner}>{building.oneLiner}</p>}

            <section className={styles.card} aria-label="Links">
              <ul className={styles.list}>
                {building.links.map((l, i) => (
                  <li key={`${l.url}:${i}`}>
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className={styles.row}>
                      <span className={styles.rowIcon}>
                        <LinkIcon link={l} size={20} />
                      </span>
                      <span className={styles.rowText}>{l.label}</span>
                      <ExternalLink size={19} className={styles.rowTrail} aria-hidden />
                    </a>
                  </li>
                ))}
                <li className={styles.row}>
                  <span className={styles.rowIcon}>
                    <Calendar size={20} aria-hidden />
                  </span>
                  <span className={styles.rowText}>
                    {building.status === "past" ? `Since ${since}` : `${since} – present`}
                  </span>
                </li>
              </ul>
            </section>

            {building.residents.length > 0 && (
              <section className={styles.card}>
                <h2 className={styles.h2}>Residents</h2>
                <ul className={styles.residents}>
                  {building.residents.map((r, i) => (
                    <li key={`${r}:${i}`} className={styles.resident}>
                      <Avatar name={r} size={46} />
                      {r}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <RouterLink
              to={back}
              className={styles.back}
              onClick={() => {
                useWorldStore.getState().visit(world.id);
                useFx.getState().select(building.id);
              }}
            >
              <ArrowLeft size={20} aria-hidden />
              Part of {owner.toLowerCase() === "my" ? "my" : owner} world
              <ArrowRight size={20} aria-hidden />
            </RouterLink>
          </article>
        </main>
      )}
    </div>
  );
}
