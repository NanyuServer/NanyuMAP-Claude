-- Add missing columns to road_nodes
ALTER TABLE "road_nodes" ADD COLUMN IF NOT EXISTS "campus" TEXT NOT NULL DEFAULT 'junior';

-- Add missing columns to road_edges
ALTER TABLE "road_edges" ADD COLUMN IF NOT EXISTS "is_trunk" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "road_edges" ADD COLUMN IF NOT EXISTS "campus" TEXT NOT NULL DEFAULT 'junior';

-- Add missing campus column to locations if not present
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "campus" TEXT NOT NULL DEFAULT 'junior';

-- Create indexes for campus queries
CREATE INDEX IF NOT EXISTS "road_nodes_campus_idx" ON "road_nodes"("campus");
CREATE INDEX IF NOT EXISTS "road_edges_campus_idx" ON "road_edges"("campus");
CREATE INDEX IF NOT EXISTS "locations_campus_idx" ON "locations"("campus");
