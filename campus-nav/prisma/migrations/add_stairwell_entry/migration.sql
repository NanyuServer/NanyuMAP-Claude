-- Add entry point fields to stairwell_floors
ALTER TABLE "stairwell_floors" ADD COLUMN IF NOT EXISTS "entry_x" DOUBLE PRECISION;
ALTER TABLE "stairwell_floors" ADD COLUMN IF NOT EXISTS "entry_y" DOUBLE PRECISION;
