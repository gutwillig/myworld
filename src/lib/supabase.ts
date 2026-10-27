import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

/** Database types matching the schema */
export type DbWorld = {
  id: string;
  owner_id: string;
  slug: string;
  owner_name: string;
  terrain: "beach" | "mountain" | "village";
  pitch?: string;
  center?: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type DbBuilding = {
  id: string;
  world_id: string;
  slug: string;
  type: string;
  name: string;
  one_liner: string;
  status: "active" | "past" | "lab";
  hex_q: number;
  hex_r: number;
  style?: string;
  grounds?: string;
  accent_color?: string;
  category?: string;
  parent_id?: string;
  spot_x?: number;
  spot_z?: number;
  client?: string;
  showcase_template?: string;
  showcase_tagline?: string;
  showcase_data?: string; // JSON string for template-specific data
  created_at: string;
  updated_at: string;
};

export type DbBuildingCta = {
  id: string;
  building_id: string;
  label: string;
  url: string;
  is_primary: boolean;
  sort_order: number;
};

export type DbBuildingResident = {
  id: string;
  building_id: string;
  name: string;
  profile_id?: string;
  sort_order: number;
};

export type DbProfile = {
  id: string;
  email?: string;
  display_name: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
};
