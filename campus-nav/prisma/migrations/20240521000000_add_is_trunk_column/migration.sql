-- Add isTrunk column to road_edges table if it doesn't exist
ALTER TABLE "road_edges" ADD COLUMN IF NOT EXISTS "is_trunk" BOOLEAN NOT NULL DEFAULT false;
