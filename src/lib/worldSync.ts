import { supabase, type DbWorld, type DbBuilding, type DbBuildingCta, type DbBuildingResident } from "./supabase";
import type { World, Building, Keepsake } from "@/store/types";

/** Convert local World to database format */
function worldToDb(world: World, ownerId: string): Omit<DbWorld, "created_at" | "updated_at"> {
  return {
    id: world.id,
    owner_id: ownerId,
    slug: world.slug,
    owner_name: world.ownerName,
    terrain: world.terrain,
    pitch: world.pitch,
    center: world.center,
    is_public: true,
  };
}

/** Convert database World to local format */
function dbToWorld(db: DbWorld, buildings: Building[], keepsakes: Keepsake[]): World {
  return {
    id: db.id,
    slug: db.slug,
    ownerName: db.owner_name,
    terrain: db.terrain,
    home: { q: 0, r: 0 },
    buildings,
    roads: [], // Will be computed by withRoads
    keepsakes,
    center: db.center as World["center"],
    pitch: db.pitch,
  };
}

/** Convert local Building to database format */
function buildingToDb(building: Building, worldId: string): Omit<DbBuilding, "created_at" | "updated_at"> {
  return {
    id: building.id,
    world_id: worldId,
    slug: building.slug,
    type: building.type,
    name: building.name,
    one_liner: building.oneLiner,
    status: building.status,
    hex_q: building.hex.q,
    hex_r: building.hex.r,
    style: building.style,
    grounds: building.grounds,
    accent_color: building.accent,
    category: building.category,
    parent_id: building.parentId,
    spot_x: building.spot?.x,
    spot_z: building.spot?.z,
    client: building.client,
    showcase_template: building.showcase?.template,
    showcase_tagline: building.showcase?.tagline,
    showcase_data: building.showcase ? JSON.stringify(building.showcase) : undefined,
  };
}

/** Convert database Building to local format */
function dbToBuilding(
  db: DbBuilding,
  links: DbBuildingCta[],
  residents: DbBuildingResident[]
): Building {
  let showcase = undefined;
  if (db.showcase_data) {
    try {
      showcase = JSON.parse(db.showcase_data);
    } catch {
      // Invalid JSON, ignore
    }
  }

  return {
    id: db.id,
    slug: db.slug,
    type: db.type as Building["type"],
    name: db.name,
    oneLiner: db.one_liner,
    status: db.status,
    links: links.map((l) => ({ label: l.label, url: l.url })),
    residents: residents.map((r) => r.name),
    hex: { q: db.hex_q, r: db.hex_r },
    createdAt: new Date(db.created_at).getTime(),
    style: db.style,
    grounds: db.grounds,
    accent: db.accent_color,
    showcase,
    category: db.category as Building["category"],
    parentId: db.parent_id,
    spot: db.spot_x !== undefined && db.spot_z !== undefined ? { x: db.spot_x, z: db.spot_z } : undefined,
    client: db.client,
  };
}

/** Save a world to Supabase */
export async function saveWorld(world: World, userId: string): Promise<{ error: Error | null }> {
  try {
    // Upsert world
    const { error: worldError } = await supabase
      .from("worlds")
      .upsert(worldToDb(world, userId), { onConflict: "id" });

    if (worldError) throw worldError;

    // Get existing buildings to determine what to delete
    const { data: existingBuildings } = await supabase
      .from("buildings")
      .select("id")
      .eq("world_id", world.id);

    const existingIds = new Set(existingBuildings?.map((b) => b.id) ?? []);
    const currentIds = new Set(world.buildings.map((b) => b.id));

    // Delete removed buildings
    const toDelete = [...existingIds].filter((id) => !currentIds.has(id));
    if (toDelete.length > 0) {
      await supabase.from("buildings").delete().in("id", toDelete);
    }

    // Upsert buildings
    for (const building of world.buildings) {
      const { error: buildingError } = await supabase
        .from("buildings")
        .upsert(buildingToDb(building, world.id), { onConflict: "id" });

      if (buildingError) throw buildingError;

      // Sync links (CTAs)
      await supabase.from("building_ctas").delete().eq("building_id", building.id);
      if (building.links.length > 0) {
        const ctas = building.links.map((link, i) => ({
          building_id: building.id,
          label: link.label,
          url: link.url,
          is_primary: i === 0,
          sort_order: i,
        }));
        await supabase.from("building_ctas").insert(ctas);
      }

      // Sync residents
      await supabase.from("building_residents").delete().eq("building_id", building.id);
      if (building.residents.length > 0) {
        const residents = building.residents.map((name, i) => ({
          building_id: building.id,
          name,
          sort_order: i,
        }));
        await supabase.from("building_residents").insert(residents);
      }
    }

    return { error: null };
  } catch (err) {
    console.error("[worldSync] Failed to save world:", err);
    return { error: err as Error };
  }
}

/** Load a world from Supabase by slug */
export async function loadWorldBySlug(slug: string): Promise<{ world: World | null; error: Error | null }> {
  try {
    // Fetch world
    const { data: worldData, error: worldError } = await supabase
      .from("worlds")
      .select("*")
      .eq("slug", slug)
      .eq("is_public", true)
      .single();

    if (worldError) {
      if (worldError.code === "PGRST116") {
        // Not found
        return { world: null, error: null };
      }
      throw worldError;
    }

    // Fetch buildings
    const { data: buildingsData, error: buildingsError } = await supabase
      .from("buildings")
      .select("*")
      .eq("world_id", worldData.id);

    if (buildingsError) throw buildingsError;

    // Fetch CTAs and residents for all buildings
    const buildingIds = buildingsData?.map((b) => b.id) ?? [];

    const { data: ctasData } = await supabase
      .from("building_ctas")
      .select("*")
      .in("building_id", buildingIds)
      .order("sort_order");

    const { data: residentsData } = await supabase
      .from("building_residents")
      .select("*")
      .in("building_id", buildingIds)
      .order("sort_order");

    // Build the world
    const buildings = (buildingsData ?? []).map((b) => {
      const links = (ctasData ?? []).filter((c) => c.building_id === b.id);
      const residents = (residentsData ?? []).filter((r) => r.building_id === b.id);
      return dbToBuilding(b, links, residents);
    });

    const world = dbToWorld(worldData, buildings, []);
    return { world, error: null };
  } catch (err) {
    console.error("[worldSync] Failed to load world:", err);
    return { world: null, error: err as Error };
  }
}

/** Load the current user's world from Supabase */
export async function loadUserWorld(userId: string): Promise<{ world: World | null; error: Error | null }> {
  try {
    // Fetch user's world (they should only have one for now)
    const { data: worldData, error: worldError } = await supabase
      .from("worlds")
      .select("*")
      .eq("owner_id", userId)
      .limit(1)
      .single();

    if (worldError) {
      if (worldError.code === "PGRST116") {
        // No world yet
        return { world: null, error: null };
      }
      throw worldError;
    }

    // Use loadWorldBySlug to get full data
    return loadWorldBySlug(worldData.slug);
  } catch (err) {
    console.error("[worldSync] Failed to load user world:", err);
    return { world: null, error: err as Error };
  }
}

/** Check if a slug is available */
export async function isSlugAvailable(slug: string, excludeWorldId?: string): Promise<boolean> {
  const query = supabase.from("worlds").select("id").eq("slug", slug);
  if (excludeWorldId) {
    query.neq("id", excludeWorldId);
  }
  const { data } = await query.limit(1);
  return !data || data.length === 0;
}
