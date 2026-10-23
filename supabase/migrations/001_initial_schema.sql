-- Worlds Database Schema
-- Supports multiple worlds, buildings with multiple CTAs

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
CREATE TYPE terrain_type AS ENUM ('beach', 'mountain', 'village');
CREATE TYPE building_status AS ENUM ('active', 'past', 'lab');
CREATE TYPE content_type AS ENUM ('website', 'video', 'game', 'document', 'social', 'custom');

-- Profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Worlds table
CREATE TABLE worlds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  terrain terrain_type DEFAULT 'beach' NOT NULL,
  is_public BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT worlds_slug_unique UNIQUE (slug)
);

CREATE INDEX worlds_owner_id_idx ON worlds(owner_id);
CREATE INDEX worlds_slug_idx ON worlds(slug);

-- Buildings table
CREATE TABLE buildings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  one_liner TEXT DEFAULT '' NOT NULL,
  status building_status DEFAULT 'active' NOT NULL,
  hex_q INTEGER NOT NULL,
  hex_r INTEGER NOT NULL,
  accent_color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT buildings_world_slug_unique UNIQUE (world_id, slug)
);

CREATE INDEX buildings_world_id_idx ON buildings(world_id);

-- Building CTAs (calls to action)
-- Each building can have multiple CTAs, one marked as primary
CREATE TABLE building_ctas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  content_type content_type DEFAULT 'website' NOT NULL,
  is_primary BOOLEAN DEFAULT false NOT NULL,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX building_ctas_building_id_idx ON building_ctas(building_id);

-- Ensure only one primary CTA per building
CREATE UNIQUE INDEX building_ctas_primary_unique
  ON building_ctas(building_id)
  WHERE is_primary = true;

-- Building residents
CREATE TABLE building_residents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX building_residents_building_id_idx ON building_residents(building_id);

-- Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE worlds ENABLE ROW LEVEL SECURITY;
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE building_ctas ENABLE ROW LEVEL SECURITY;
ALTER TABLE building_residents ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Worlds policies
CREATE POLICY "Public worlds are viewable by everyone"
  ON worlds FOR SELECT
  USING (is_public = true OR auth.uid() = owner_id);

CREATE POLICY "Users can create their own worlds"
  ON worlds FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own worlds"
  ON worlds FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own worlds"
  ON worlds FOR DELETE
  USING (auth.uid() = owner_id);

-- Buildings policies (inherit from world visibility)
CREATE POLICY "Buildings are viewable if world is viewable"
  ON buildings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM worlds
      WHERE worlds.id = buildings.world_id
      AND (worlds.is_public = true OR worlds.owner_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage buildings in their worlds"
  ON buildings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM worlds
      WHERE worlds.id = buildings.world_id
      AND worlds.owner_id = auth.uid()
    )
  );

-- Building CTAs policies
CREATE POLICY "CTAs are viewable if building is viewable"
  ON building_ctas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM buildings b
      JOIN worlds w ON w.id = b.world_id
      WHERE b.id = building_ctas.building_id
      AND (w.is_public = true OR w.owner_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage CTAs in their buildings"
  ON building_ctas FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM buildings b
      JOIN worlds w ON w.id = b.world_id
      WHERE b.id = building_ctas.building_id
      AND w.owner_id = auth.uid()
    )
  );

-- Building residents policies
CREATE POLICY "Residents are viewable if building is viewable"
  ON building_residents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM buildings b
      JOIN worlds w ON w.id = b.world_id
      WHERE b.id = building_residents.building_id
      AND (w.is_public = true OR w.owner_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage residents in their buildings"
  ON building_residents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM buildings b
      JOIN worlds w ON w.id = b.world_id
      WHERE b.id = building_residents.building_id
      AND w.owner_id = auth.uid()
    )
  );

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER worlds_updated_at
  BEFORE UPDATE ON worlds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER buildings_updated_at
  BEFORE UPDATE ON buildings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
