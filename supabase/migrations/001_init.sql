-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Worlds table: stores user worlds as JSONB
CREATE TABLE worlds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL,          -- Full { format, version, world } export
  og_image_url TEXT,            -- Supabase Storage URL for canvas snapshot
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common lookups
CREATE INDEX idx_worlds_slug ON worlds(slug);
CREATE INDEX idx_worlds_owner ON worlds(owner_id);

-- Row Level Security
ALTER TABLE worlds ENABLE ROW LEVEL SECURITY;

-- Anyone can read (for visitors)
CREATE POLICY "worlds_select" ON worlds FOR SELECT USING (true);

-- Only owner can insert
CREATE POLICY "worlds_insert" ON worlds FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Only owner can update
CREATE POLICY "worlds_update" ON worlds FOR UPDATE USING (auth.uid() = owner_id);

-- Only owner can delete
CREATE POLICY "worlds_delete" ON worlds FOR DELETE USING (auth.uid() = owner_id);

-- Auto-update updated_at on changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_worlds_updated_at
    BEFORE UPDATE ON worlds
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Storage bucket for OG images
INSERT INTO storage.buckets (id, name, public)
VALUES ('og-images', 'og-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to og-images bucket
CREATE POLICY "og_images_insert" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'og-images'
  AND auth.role() = 'authenticated'
);

-- Allow public read access to og-images
CREATE POLICY "og_images_select" ON storage.objects
FOR SELECT
USING (bucket_id = 'og-images');

-- Allow owners to update their own images
CREATE POLICY "og_images_update" ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'og-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow owners to delete their own images
CREATE POLICY "og_images_delete" ON storage.objects
FOR DELETE
USING (
  bucket_id = 'og-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
