-- Add floor column to road_nodes table
ALTER TABLE "road_nodes" ADD COLUMN IF NOT EXISTS "floor" INTEGER DEFAULT 0;

-- Create floor_markers table
CREATE TABLE IF NOT EXISTS "floor_markers" (
    "id" SERIAL NOT NULL,
    "campus" TEXT NOT NULL DEFAULT 'senior',
    "floor" INTEGER NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "w" DOUBLE PRECISION NOT NULL,
    "h" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "floor_markers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "floor_markers_campus_floor_key" ON "floor_markers"("campus", "floor");

-- Create stairwell_floors table
CREATE TABLE IF NOT EXISTS "stairwell_floors" (
    "id" SERIAL NOT NULL,
    "stairwell_id" INTEGER NOT NULL,
    "floor" INTEGER NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "rect_x1" DOUBLE PRECISION NOT NULL,
    "rect_y1" DOUBLE PRECISION NOT NULL,
    "rect_x2" DOUBLE PRECISION NOT NULL,
    "rect_y2" DOUBLE PRECISION NOT NULL,
    "exit_x" DOUBLE PRECISION,
    "exit_y" DOUBLE PRECISION,
    CONSTRAINT "stairwell_floors_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stairwell_floors_stairwell_id_fkey" FOREIGN KEY ("stairwell_id") REFERENCES "stairwells"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "stairwell_floors_stairwell_id_floor_key" ON "stairwell_floors"("stairwell_id", "floor");
