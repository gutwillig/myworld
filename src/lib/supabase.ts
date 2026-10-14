import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Auth and sync will not work.",
  );
}

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "");

/** Database types for the worlds table */
export type DbWorld = {
  id: string;
  slug: string;
  owner_id: string;
  data: {
    format: "myworld";
    version: number;
    world: unknown;
  };
  og_image_url: string | null;
  created_at: string;
  updated_at: string;
};
