-- Add missing columns to support full world sync

-- Add pitch and center to worlds
ALTER TABLE worlds ADD COLUMN IF NOT EXISTS pitch TEXT;
ALTER TABLE worlds ADD COLUMN IF NOT EXISTS center TEXT;

-- Add missing columns to buildings for full sync
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS style TEXT;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS grounds TEXT;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES buildings(id) ON DELETE SET NULL;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS spot_x REAL;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS spot_z REAL;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS client TEXT;

-- Add showcase columns to buildings
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS showcase_template TEXT;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS showcase_tagline TEXT;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS showcase_data JSONB;

-- Create keepsakes table
CREATE TABLE IF NOT EXISTS world_keepsakes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  note TEXT DEFAULT '' NOT NULL,
  pin_x REAL,
  pin_z REAL,
  pin_rot REAL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS world_keepsakes_world_id_idx ON world_keepsakes(world_id);

-- RLS for keepsakes
ALTER TABLE world_keepsakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Keepsakes are viewable if world is viewable"
  ON world_keepsakes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM worlds
      WHERE worlds.id = world_keepsakes.world_id
      AND (worlds.is_public = true OR worlds.owner_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage keepsakes in their worlds"
  ON world_keepsakes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM worlds
      WHERE worlds.id = world_keepsakes.world_id
      AND worlds.owner_id = auth.uid()
    )
  );

-- Create building_updates table for news
CREATE TABLE IF NOT EXISTS building_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  posted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS building_updates_building_id_idx ON building_updates(building_id);

-- RLS for updates
ALTER TABLE building_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Updates are viewable if building is viewable"
  ON building_updates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM buildings b
      JOIN worlds w ON w.id = b.world_id
      WHERE b.id = building_updates.building_id
      AND (w.is_public = true OR w.owner_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage updates in their buildings"
  ON building_updates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM buildings b
      JOIN worlds w ON w.id = b.world_id
      WHERE b.id = building_updates.building_id
      AND w.owner_id = auth.uid()
    )
  );
