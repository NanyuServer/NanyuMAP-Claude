-- Add floor column to locations
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "floor" INTEGER;

-- Add floors column to road_edges
ALTER TABLE "road_edges" ADD COLUMN IF NOT EXISTS "floors" TEXT NOT NULL DEFAULT '[]';

-- Add staircase columns to road_nodes
ALTER TABLE "road_nodes" ADD COLUMN IF NOT EXISTS "is_staircase" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "road_nodes" ADD COLUMN IF NOT EXISTS "staircase_floors" TEXT NOT NULL DEFAULT '[]';
