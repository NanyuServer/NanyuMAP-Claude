-- NanyuMAP Road System v2: Slope Roads + Stairwells
-- Run this in Neon SQL Editor

-- Add stairwell fields to road_nodes
ALTER TABLE "road_nodes" ADD COLUMN IF NOT EXISTS "stairwell_id" INTEGER;
ALTER TABLE "road_nodes" ADD COLUMN IF NOT EXISTS "stairwell_floor" INTEGER;
ALTER TABLE "road_nodes" ADD COLUMN IF NOT EXISTS "stairwell_role" TEXT;

-- Add slope fields to road_edges
ALTER TABLE "road_edges" ADD COLUMN IF NOT EXISTS "is_slope" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "road_edges" ADD COLUMN IF NOT EXISTS "slope_floors" TEXT NOT NULL DEFAULT '[]';

-- Create stairwells table
CREATE TABLE IF NOT EXISTS "stairwells" (
    "id" SERIAL NOT NULL,
    "campus" TEXT NOT NULL DEFAULT 'junior',
    "building_category" TEXT NOT NULL,
    "center_x" DOUBLE PRECISION NOT NULL,
    "center_y" DOUBLE PRECISION NOT NULL,
    "rect_x1" DOUBLE PRECISION NOT NULL,
    "rect_y1" DOUBLE PRECISION NOT NULL,
    "rect_x2" DOUBLE PRECISION NOT NULL,
    "rect_y2" DOUBLE PRECISION NOT NULL,
    "floors" TEXT NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stairwells_pkey" PRIMARY KEY ("id")
);
